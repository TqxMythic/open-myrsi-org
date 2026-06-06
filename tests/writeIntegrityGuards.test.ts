import { describe, it, expect, vi, beforeEach } from 'vitest';

// Related coverage lives elsewhere: dossier targetId broadcast in
// realtimeSliceDb2.test.ts, marketplace warehouse:manage in
// marketplaceSecurity.test.ts, feed-ingest sanitize/caps in intelFeedSync.test.ts.

const h = vi.hoisted(() => ({
    resolveQuery: ((_q: { table: string; calls: Array<{ method: string; args: unknown[] }> }) => ({ data: null as unknown, error: null as unknown })) as (q: { table: string; calls: Array<{ method: string; args: unknown[] }> }) => { data?: unknown; error?: unknown },
    broadcasts: [] as Array<{ event: string; payload: Record<string, unknown> }>,
}));

vi.mock('../lib/db/common', () => {
    function builder(table: string) {
        const calls: Array<{ method: string; args: unknown[] }> = [];
        const b: any = {};
        for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'order', 'limit', 'gt', 'gte', 'lt', 'ilike', 'update', 'insert', 'delete', 'upsert']) {
            b[m] = (...args: unknown[]) => { calls.push({ method: m, args }); return b; };
        }
        const settle = () => Promise.resolve(h.resolveQuery({ table, calls }));
        b.single = () => { calls.push({ method: 'single', args: [] }); return settle(); };
        b.maybeSingle = () => { calls.push({ method: 'maybeSingle', args: [] }); return settle(); };
        b.then = (resolve: any, reject: any) => settle().then(resolve, reject);
        return b;
    }
    return {
        supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: null, error: null }) },
        handleSupabaseError: ({ error, message }: { error: unknown; message: string }) => { if (error) throw new Error(message); },
        broadcastToOrg: (event: string, payload: Record<string, unknown> = {}) => { h.broadcasts.push({ event, payload }); },
        broadcastToChannel: () => {},
        safeFetch: async (q: PromiseLike<{ data: unknown; error: unknown }>, fallback: unknown) => {
            try { const { data, error } = await q; return error ? fallback : (data ?? fallback); } catch { return fallback; }
        },
    };
});

import { addAAREntry } from '../lib/db/ops';
import { projectOperationSnapshot } from '../lib/db/operations-federation';
import { castLegislationVote, castMotionVote } from '../lib/db/government/legislation';
import { checkAiRateLimit, assertAiRateLimit, _resetAiRateLimit } from '../lib/aiRateLimit';
import type { HydratedOperation } from '../types';

beforeEach(() => {
    h.resolveQuery = () => ({ data: null, error: null });
    h.broadcasts = [];
    _resetAiRateLimit();
});

// AAR author is the dispatcher actor, never a nested payload.data.authorId.
describe('addAAREntry authorship (M2)', () => {
    it('attributes the entry to data.userId, ignoring a forged data.authorId', async () => {
        let insertValues: Record<string, unknown> | undefined;
        h.resolveQuery = ({ table, calls }) => {
            if (table === 'operation_aar_entries') {
                const ins = calls.find(c => c.method === 'insert');
                if (ins) insertValues = ins.args[0] as Record<string, unknown>;
                return { data: { id: 1 }, error: null };
            }
            return { data: null, error: null };
        };
        // Attacker nests authorId in payload.data; the dispatcher-injected actor is userId=6.
        await addAAREntry('op1', { authorId: 999, userId: 6, content: 'fabricated admission' });
        expect(insertValues?.author_id).toBe(6);
        expect(insertValues?.author_id).not.toBe(999);
    });
});

// Joint-op snapshot is recipient-aware (no cross-peer PII, no internal id).
describe('projectOperationSnapshot recipient scoping (M7)', () => {
    const baseOp = () => ({
        id: 'op1', name: 'Joint', type: 'Combat', status: 'Planning', description: '',
        owner: { id: 5, name: 'Cmd' }, participants: [],
        alliedOrgs: [
            { id: 1, operationId: 'op1', peerId: 'peer-B', accepted: true, invitedAt: 't', label: 'OrgB' },
            { id: 2, operationId: 'op1', peerId: 'peer-C', accepted: true, invitedAt: 't', label: 'OrgC' },
        ],
        alliedParticipants: [
            { operationId: 'op1', peerId: 'peer-B', remoteUserHandle: 'b-member', rsvpStatus: 'going', isReady: true, updatedAt: 't' },
            { operationId: 'op1', peerId: 'peer-C', remoteUserHandle: 'c-member', rsvpStatus: 'going', isReady: true, updatedAt: 't' },
        ],
    } as unknown as HydratedOperation);

    it('a recipient sees ONLY its own allied org/members; the internal peerId is neutralised', () => {
        const snap = projectOperationSnapshot(baseOp(), false, 'peer-C')!;
        const orgs = snap.alliedOrgs ?? [];
        const parts = snap.alliedParticipants ?? [];
        expect(orgs.map(o => o.label)).toEqual(['OrgC']);
        expect(parts.map(p => p.remoteUserHandle)).toEqual(['c-member']);
        // No other peer's roster, and no internal alliance_peers UUID on the wire.
        expect(orgs.every(o => o.peerId === '')).toBe(true);
        expect(parts.every(p => p.peerId === '')).toBe(true);
        expect(JSON.stringify(snap)).not.toContain('peer-B');
        expect(JSON.stringify(snap)).not.toContain('peer-C');
    });

    it('with no recipient, peerId is still neutralised on every allied entry', () => {
        const snap = projectOperationSnapshot(baseOp(), false)!;
        expect((snap.alliedOrgs ?? []).every(o => o.peerId === '')).toBe(true);
        expect((snap.alliedParticipants ?? []).every(p => p.peerId === '')).toBe(true);
    });

    it('a sync-restricted op projects to null (unchanged)', () => {
        expect(projectOperationSnapshot(baseOp(), true, 'peer-C')).toBeNull();
    });
});

describe('AI rate limit (M9)', () => {
    it('allows up to the per-minute cap then blocks within the window', () => {
        const t = 1_000_000;
        for (let i = 0; i < 5; i++) expect(checkAiRateLimit(42, t).ok).toBe(true);
        expect(checkAiRateLimit(42, t).ok).toBe(false);
        expect(checkAiRateLimit(42, t).scope).toBe('minute');
        // a fresh minute reopens the per-minute window
        expect(checkAiRateLimit(42, t + 61_000).ok).toBe(true);
    });

    it('enforces a daily ceiling across minutes', () => {
        let t = 2_000_000;
        let allowed = 0;
        for (let i = 0; i < 60; i++) {
            if (checkAiRateLimit(7, t).ok) allowed++;
            t += 61_000; // skip past each minute window so only the daily cap bites
        }
        expect(allowed).toBe(50); // PER_DAY
        expect(checkAiRateLimit(7, t).scope).toBe('day');
    });

    it('is per-user (one user hitting the cap does not block another)', () => {
        const t = 3_000_000;
        for (let i = 0; i < 5; i++) checkAiRateLimit(1, t);
        expect(checkAiRateLimit(1, t).ok).toBe(false);
        expect(checkAiRateLimit(2, t).ok).toBe(true);
    });

    it('fails open for a missing user id (actions are permission-gated)', () => {
        for (let i = 0; i < 100; i++) expect(checkAiRateLimit(undefined).ok).toBe(true);
    });

    it('assertAiRateLimit throws once the cap is exceeded', () => {
        const t = 4_000_000;
        for (let i = 0; i < 5; i++) assertAiRateLimit(9, t);
        expect(() => assertAiRateLimit(9, t)).toThrow(/limit/i);
    });
});

// One-person-one-vote (legislation + motions).
describe('government vote uniqueness (M11)', () => {
    // Resolve the validation queries (status Voting + voting position), then the
    // existing-vote probe returns a row → already-voted.
    function votingFixture(opts: { existingVote?: boolean; insert23505?: boolean; secret?: boolean }) {
        h.resolveQuery = ({ table, calls }) => {
            if (table === 'government_legislation') return { data: { status: 'Voting' }, error: null };
            if (table === 'government_motions') return { data: { status: 'Voting', is_secret_ballot: !!opts.secret, restricted_to_position_ids: null }, error: null };
            if (table === 'government_position_holders') return { data: { position_id: 1, position: { can_vote_legislation: true } }, error: null };
            if (table === 'government_legislation_votes' || table === 'government_motion_votes') {
                const isInsert = calls.some(c => c.method === 'insert');
                if (isInsert) return opts.insert23505 ? { data: null, error: { code: '23505' } } : { data: null, error: null };
                // the existing-vote probe (select + maybeSingle)
                return { data: opts.existingVote ? { id: 'v1' } : null, error: null };
            }
            return { data: null, error: null };
        };
    }

    it('legislation: rejects a second vote (pre-check)', async () => {
        votingFixture({ existingVote: true });
        await expect(castLegislationVote(1, 6, 1, 'for')).rejects.toThrow(/already voted/i);
    });

    it('legislation: rejects a concurrent double-submit (23505 atomic guard)', async () => {
        votingFixture({ existingVote: false, insert23505: true });
        await expect(castLegislationVote(1, 6, 1, 'for')).rejects.toThrow(/already voted/i);
    });

    it('legislation: first vote succeeds', async () => {
        votingFixture({ existingVote: false });
        await expect(castLegislationVote(1, 6, 1, 'for')).resolves.toBeUndefined();
    });

    it('motion: rejects a second vote (pre-check)', async () => {
        votingFixture({ existingVote: true });
        await expect(castMotionVote(1, 6, 'against')).rejects.toThrow(/already voted/i);
    });

    it('motion: rejects a concurrent double-submit (23505 atomic guard)', async () => {
        votingFixture({ existingVote: false, insert23505: true });
        await expect(castMotionVote(1, 6, 'against')).rejects.toThrow(/already voted/i);
    });

    it('SECRET motion: rejects a re-vote via the deterministic voter_hash pre-check', async () => {
        votingFixture({ existingVote: true, secret: true });
        await expect(castMotionVote(1, 6, 'for')).rejects.toThrow(/already voted/i);
    });

    it('SECRET motion: rejects a concurrent double-submit on the hash index (23505)', async () => {
        votingFixture({ existingVote: false, insert23505: true, secret: true });
        await expect(castMotionVote(1, 6, 'for')).rejects.toThrow(/already voted/i);
    });

    it('SECRET motion: a first vote succeeds (anonymous — voter_hash, no user_id)', async () => {
        votingFixture({ existingVote: false, secret: true });
        await expect(castMotionVote(1, 6, 'for')).resolves.toBeUndefined();
    });
});
