import { describe, it, expect, vi, beforeEach } from 'vitest';

// lib/db/system.ts behaviour:
//   - Federation echo loop guard: an ingested report or warrant (source_feed_id
//     set) is not re-shared via collectShareableIntel.
//   - Warrant over-share: a non-active (Cancelled/Claimed) warrant never leaves
//     the org; only Active/Standing warrants share.
//   - OG config validation: updateOpenGraphConfig strips a javascript:/non-image
//     faviconUrl and an invalid themeColor before persist.
//
// The mock supabase builder records .is()/.in() filters and applies them to the
// seeded tables, so the test exercises the real query predicates.

const h = vi.hoisted(() => ({
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    upserts: [] as Array<{ key: string; value: Record<string, unknown> }>,
}));

vi.mock('../lib/db/common', () => {
    function builder(table: string) {
        const eqFilters: Record<string, unknown> = {};
        const isFilters: Record<string, unknown> = {};
        const inFilters: Record<string, unknown[]> = {};
        let lastUpsert: Record<string, unknown> | null = null;

        const matches = (r: Record<string, unknown>): boolean => {
            for (const [col, val] of Object.entries(eqFilters)) if (r[col] !== val) return false;
            for (const [col, val] of Object.entries(isFilters)) {
                // .is(col, null) means strictly null/undefined.
                if (val === null) { if (r[col] != null) return false; }
                else if (r[col] !== val) return false;
            }
            for (const [col, vals] of Object.entries(inFilters)) {
                if (!vals.includes(r[col])) return false;
            }
            return true;
        };
        const rows = () => (h.tables[table] ?? []).filter(matches);

        const b: any = {};
        b.select = () => b;
        b.eq = (col: string, val: unknown) => { eqFilters[col] = val; return b; };
        b.is = (col: string, val: unknown) => { isFilters[col] = val; return b; };
        b.in = (col: string, vals: unknown[]) => { inFilters[col] = vals; return b; };
        b.gt = () => b;
        b.order = () => b;
        b.upsert = (value: Record<string, unknown>) => { lastUpsert = value; return b; };
        b.maybeSingle = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
        b.single = () => Promise.resolve({ data: rows()[0] ?? null, error: null });
        b.then = (resolve: any, reject: any) => {
            if (lastUpsert) {
                const v = lastUpsert as { key: string; value: Record<string, unknown> };
                h.upserts.push({ key: v.key, value: v.value });
                return Promise.resolve({ data: null, error: null }).then(resolve, reject);
            }
            return Promise.resolve({ data: rows(), error: null }).then(resolve, reject);
        };
        return b;
    }
    return {
        supabase: { from: (table: string) => builder(table) },
        handleSupabaseError: ({ error, message }: { error: unknown; message: string }) => { if (error) throw new Error(message); },
        broadcastToOrg: () => {},
        broadcastToChannel: () => {},
        safeFetch: async () => [],
        getSystemRoles: async () => ({}),
    };
});

import { collectShareableIntel, updateOpenGraphConfig } from '../lib/db/system';

beforeEach(() => {
    h.upserts = [];
    h.tables = {
        security_limiting_markers: [],
        intel_report_limiting_markers: [],
        intel_bulletin_limiting_markers: [],
        intel_bulletins: [],
        intel_reports: [
            // Locally-authored report — source_feed_id null → shareable.
            { id: 'rep-local', target_id: 'Bandit', subject_type: 'Person', threat_level: 'High', tags: [], summary: 'spotted', created_at: '2026-06-06T00:00:00Z', affiliated_org: 'X', classification_level: 0, source_feed_id: null },
            // Ingested from ally feedA — must never be re-shared.
            { id: 'rep-ingested', target_id: 'Pirate', subject_type: 'Person', threat_level: 'High', tags: [], summary: 'relayed', created_at: '2026-06-06T00:00:00Z', affiliated_org: 'Y', classification_level: 0, source_feed_id: 'feedA' },
        ],
        warrants: [
            // Locally-issued Active warrant → shareable.
            { id: 'war-active', target_rsi_handle: 'Outlaw', reason: 'piracy', action: 'Detain', uec_reward: 100, status: 'Active', created_at: '2026-06-06T00:00:00Z', source_feed_id: null },
            // Standing warrant → shareable.
            { id: 'war-standing', target_rsi_handle: 'Fugitive', reason: 'KOS', action: 'Eliminate', uec_reward: 200, status: 'Standing', created_at: '2026-06-06T00:00:00Z', source_feed_id: null },
            // Cancelled → must not leave the org.
            { id: 'war-cancelled', target_rsi_handle: 'Reformed', reason: 'rescinded', action: 'Detain', uec_reward: 0, status: 'Cancelled', created_at: '2026-06-06T00:00:00Z', source_feed_id: null },
            // Claimed → no longer an actionable bounty; must not leave.
            { id: 'war-claimed', target_rsi_handle: 'Caught', reason: 'done', action: 'Detain', uec_reward: 0, status: 'Claimed', created_at: '2026-06-06T00:00:00Z', source_feed_id: null },
            // Ingested-from-ally Active warrant — loop guard must exclude.
            { id: 'war-ingested', target_rsi_handle: 'Relayed', reason: 'via ally', action: 'Detain', uec_reward: 50, status: 'Active', created_at: '2026-06-06T00:00:00Z', source_feed_id: 'feedA' },
        ],
    };
});

const opts = {
    maxClearance: 5,
    channels: { reports: true, warrants: true, bulletins: true },
    bulletinsRequireSharedFlag: false,
};

describe('collectShareableIntel — federation echo loop guard (fed#4)', () => {
    it('excludes an ingested report (source_feed_id set) from the outbound projection', async () => {
        const res = await collectShareableIntel(opts);
        const ids = res.reports.map((r: { id: string }) => r.id);
        expect(ids).toContain('rep-local');
        expect(ids).not.toContain('rep-ingested');
    });

    it('excludes an ingested warrant (source_feed_id set) from the outbound projection', async () => {
        const res = await collectShareableIntel(opts);
        const ids = res.warrants.map((w: { id: string }) => w.id);
        expect(ids).not.toContain('war-ingested');
    });
});

describe('collectShareableIntel — warrant over-share (fed#5)', () => {
    it('shares only Active/Standing warrants; Cancelled and Claimed never leave the org', async () => {
        const res = await collectShareableIntel(opts);
        const ids = res.warrants.map((w: { id: string }) => w.id).sort();
        expect(ids).toEqual(['war-active', 'war-standing']);
        expect(ids).not.toContain('war-cancelled');
        expect(ids).not.toContain('war-claimed');
    });

    it('honours a sub-zero clearance ceiling by withholding all warrants', async () => {
        const res = await collectShareableIntel({ ...opts, maxClearance: -1 });
        expect(res.warrants).toHaveLength(0);
    });
});

describe('updateOpenGraphConfig — write-time validation (input-injection#3)', () => {
    const persisted = () => h.upserts.find(u => u.key === 'openGraphConfig')?.value ?? {};

    it('strips a javascript: faviconUrl and a non-image imageUrl to empty string', async () => {
        await updateOpenGraphConfig({
            title: 'T',
            faviconUrl: 'javascript:alert(1)',
            imageUrl: 'https://tracker.example/pixel',   // no image extension
        });
        const v = persisted();
        expect(v.faviconUrl).toBe('');
        expect(v.imageUrl).toBe('');
        // Non-URL fields survive untouched.
        expect(v.title).toBe('T');
    });

    it('keeps a valid https image url and a valid hex themeColor', async () => {
        await updateOpenGraphConfig({
            imageUrl: 'https://cdn.example/og.png',
            faviconUrl: 'https://cdn.example/icon.png',
            themeColor: '#0F172A',
        });
        const v = persisted();
        expect(v.imageUrl).toBe('https://cdn.example/og.png');
        expect(v.faviconUrl).toBe('https://cdn.example/icon.png');
        expect(v.themeColor).toBe('#0F172A');
    });

    it('drops an invalid themeColor so it never reaches the SSR meta tag', async () => {
        await updateOpenGraphConfig({ themeColor: 'red; } body{display:none}' });
        const v = persisted();
        expect('themeColor' in v).toBe(false);
    });
});
