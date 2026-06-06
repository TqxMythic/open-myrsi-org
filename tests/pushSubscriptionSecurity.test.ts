import { describe, it, expect, vi, beforeEach } from 'vitest';

// Push subscription enforcement beyond the pure isAllowedPushEndpoint predicate:
//   1. savePushSubscription rejects a disallowed/internal endpoint + missing keys
//      at the write boundary (stored-SSRF guard).
//   2. savePushSubscription evicts the oldest subscription past the per-user cap.
//   3. sendBatch drops + deletes a stored row whose endpoint is not allow-listed
//      and never POSTs to it, while a good endpoint is still sent.

const h = vi.hoisted(() => ({
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    deletes: [] as Array<{ table: string; filters: Record<string, unknown> }>,
    inserts: [] as Array<{ table: string; values: Record<string, unknown> }>,
    sent: [] as Array<{ endpoint?: string }>,
}));

vi.mock('../lib/db/common', () => {
    function builder(table: string) {
        const state = { op: 'select', values: null as Record<string, unknown> | null, filters: {} as Record<string, unknown>, inFilters: {} as Record<string, unknown[]>, order: null as null | { col: string; asc: boolean } };
        const rows = () => (h.tables[table] ?? []).filter((r) => {
            for (const [c, v] of Object.entries(state.filters)) if (r[c] !== v) return false;
            for (const [c, vals] of Object.entries(state.inFilters)) if (!vals.includes(r[c])) return false;
            return true;
        });
        const b: any = {};
        b.select = () => b;
        b.insert = (v: Record<string, unknown>) => { state.op = 'insert'; state.values = v; return b; };
        b.update = (v: Record<string, unknown>) => { state.op = 'update'; state.values = v; return b; };
        b.delete = () => { state.op = 'delete'; return b; };
        b.eq = (c: string, v: unknown) => { state.filters[c] = v; return b; };
        b.in = (c: string, vals: unknown[]) => { state.inFilters[c] = vals; return b; };
        b.is = () => b; b.not = () => b; b.gt = () => b; b.limit = () => b;
        b.order = (col: string, opts: { ascending?: boolean }) => { state.order = { col, asc: !!opts?.ascending }; return b; };
        const settle = (mode: 'many' | 'single') => {
            if (state.op === 'select') {
                let data = rows();
                if (state.order) {
                    const { col, asc } = state.order;
                    data = [...data].sort((a, b2) => (asc ? 1 : -1) * String(a[col]).localeCompare(String(b2[col])));
                }
                return Promise.resolve({ data: mode === 'single' ? (data[0] ?? null) : data, error: null });
            }
            if (state.op === 'insert') {
                h.inserts.push({ table, values: state.values as Record<string, unknown> });
                (h.tables[table] = h.tables[table] ?? []).push({ id: `gen-${(h.tables[table]?.length ?? 0) + 1}`, ...(state.values as Record<string, unknown>) });
                return Promise.resolve({ data: null, error: null });
            }
            if (state.op === 'delete') {
                h.deletes.push({ table, filters: { ...state.filters, ...Object.fromEntries(Object.entries(state.inFilters).map(([k, v]) => [`in:${k}`, v])) } });
                const doomed = rows();
                h.tables[table] = (h.tables[table] ?? []).filter((r) => !doomed.includes(r));
                return Promise.resolve({ data: null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
        };
        b.single = () => settle('single');
        b.maybeSingle = () => settle('single');
        b.then = (res: any, rej: any) => settle('many').then(res, rej);
        return b;
    }
    return {
        supabase: { from: (t: string) => builder(t) },
        handleSupabaseError: ({ error, message }: { error: unknown; message: string }) => { if (error) throw new Error(message); },
        broadcastToOrg: () => {},
    };
});

// web-push mock: lets sendBatch's getWebPush() resolve and records every send.
vi.mock('web-push', () => ({
    default: { setVapidDetails: () => {}, sendNotification: (sub: { endpoint?: string }) => { h.sent.push(sub); return Promise.resolve(); } },
}));

import { savePushSubscription } from '../lib/db/users';
import { sendPushToUsers, MAX_PUSH_SUBSCRIPTIONS_PER_USER } from '../lib/push';

const goodEndpoint = (n: number) => `https://fcm.googleapis.com/fcm/send/tok-${n}`;
const keys = { p256dh: 'BPk', auth: 'aGVsbG8' };

beforeEach(() => { h.tables = {}; h.deletes = []; h.inserts = []; h.sent = []; });

describe('savePushSubscription write boundary (H7)', () => {
    it('rejects an internal / non-vendor endpoint (never stored)', async () => {
        await expect(savePushSubscription(1, { endpoint: 'https://10.0.0.5:8443/internal', keys }))
            .rejects.toThrow(/invalid push subscription endpoint/i);
        expect(h.inserts).toHaveLength(0);
    });

    it('rejects a missing key set', async () => {
        await expect(savePushSubscription(1, { endpoint: goodEndpoint(1), keys: { p256dh: '', auth: '' } }))
            .rejects.toThrow(/keys/i);
        expect(h.inserts).toHaveLength(0);
    });

    it('stores a valid vendor endpoint', async () => {
        await savePushSubscription(1, { endpoint: goodEndpoint(1), keys });
        expect(h.inserts).toHaveLength(1);
        expect(h.inserts[0].values.endpoint).toBe(goodEndpoint(1));
    });

    it('evicts the OLDEST subscription past the per-user cap', async () => {
        const cap = MAX_PUSH_SUBSCRIPTIONS_PER_USER;
        h.tables.push_subscriptions = Array.from({ length: cap }, (_, i) => ({
            id: `sub-${i}`, user_id: 1, endpoint: goodEndpoint(i),
            created_at: `2026-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
        }));
        await savePushSubscription(1, { endpoint: goodEndpoint(999), keys });
        // The cap-eviction delete targets the oldest id ('sub-0') via .in('id', [...]).
        const eviction = h.deletes.find((d) => d.table === 'push_subscriptions' && Array.isArray(d.filters['in:id']));
        expect(eviction).toBeDefined();
        expect(eviction!.filters['in:id']).toContain('sub-0');
        expect(h.inserts).toHaveLength(1);
    });
});

describe('sendBatch defensive endpoint drop (H7)', () => {
    it('drops + deletes a stored disallowed endpoint and never POSTs to it; good endpoints still send', async () => {
        h.tables.push_subscriptions = [
            { id: 'bad', user_id: 1, subscription: { endpoint: 'https://10.0.0.5/x', keys } },
            { id: 'good', user_id: 1, subscription: { endpoint: goodEndpoint(1), keys } },
        ];
        await sendPushToUsers([1], { title: 'T', body: 'B' });
        // bad row deleted, never sent
        expect(h.deletes.some((d) => d.table === 'push_subscriptions' && d.filters.id === 'bad')).toBe(true);
        expect(h.sent.some((s) => s.endpoint === 'https://10.0.0.5/x')).toBe(false);
        // good row sent
        expect(h.sent.some((s) => s.endpoint === goodEndpoint(1))).toBe(true);
    });
});
