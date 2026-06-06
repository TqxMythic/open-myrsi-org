import { describe, it, expect, vi, beforeEach } from 'vitest';

// Marketplace state-machine behaviour across the sibling transitions:
//   cancel-after-delivery fires warehouse_marketplace_reverse (a real +qty
//     restock of shared stock), so it re-checks warehouse:manage (mirroring
//     mark_delivered) and the cancel handler forwards the actor.
//   the cancel status flip is optimistic (.eq('status', expected) + only release
//     the listing if it claimed a row) so two concurrent cancels can't double-call
//     the non-idempotent marketplace_release_listing.
//   deliver/confirm carry the same optimistic guard.
//   milestone toggle is gated to in-progress contracts.
//   reputation returns zero for a soft-deleted / non-existent user.
//   one open report per reporter per target (dedup).
//
// The mock honours the optimistic guard — an UPDATE with a .eq('status', X) that
// no longer matches affects 0 rows and `.select()` returns [] — the load-bearing
// behaviour these tests assert against.

const h = vi.hoisted(() => ({
    orgEmits: [] as Array<{ event: string; payload: Record<string, unknown> }>,
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
    nextId: 1,
}));

vi.mock('../lib/db/common', () => {
    function builder(table: string) {
        const state = {
            op: 'select' as string,
            values: null as Record<string, unknown> | null,
            filters: {} as Record<string, unknown>,
            nullFilters: [] as string[],   // columns required to be null (.is(col, null))
            orClause: null as string | null,
        };
        const rows = () => (h.tables[table] ?? []).filter((r) => {
            for (const [c, v] of Object.entries(state.filters)) if (r[c] !== v) return false;
            for (const c of state.nullFilters) if (r[c] != null) return false;
            if (state.orClause) {
                const parts = state.orClause.split(',').map((p) => p.split('.'));
                if (!parts.some(([col, , val]) => String(r[col]) === val)) return false;
            }
            return true;
        });
        const b: any = {};
        b.select = () => b;
        b.update = (values: Record<string, unknown>) => { state.op = 'update'; state.values = values; return b; };
        b.insert = (values: Record<string, unknown>) => { state.op = 'insert'; state.values = values; return b; };
        b.delete = () => { state.op = 'delete'; return b; };
        b.eq = (c: string, v: unknown) => { state.filters[c] = v; return b; };
        b.is = (c: string, _v: unknown) => { state.nullFilters.push(c); return b; };
        b.or = (clause: string) => { state.orClause = clause; return b; };
        b.in = () => b; b.order = () => b; b.limit = () => b; b.ilike = () => b;
        const settle = (mode: 'many' | 'single') => {
            if (state.op === 'select') {
                const data = rows();
                return Promise.resolve({ data: mode === 'single' ? (data[0] ?? null) : data, error: null });
            }
            const list = (h.tables[table] = h.tables[table] ?? []);
            if (state.op === 'insert') {
                const row = { id: `gen-${h.nextId++}`, ...(state.values as Record<string, unknown>) };
                list.push(row);
                return Promise.resolve({ data: mode === 'single' ? row : [row], error: null });
            }
            if (state.op === 'update') {
                const affected = rows();          // honours .eq('status', X) optimistic guard
                for (const r of affected) Object.assign(r, state.values);
                // PostgREST returns the affected rows when .select() is chained.
                return Promise.resolve({ data: affected, error: null });
            }
            if (state.op === 'delete') {
                const doomed = new Set(rows());
                h.tables[table] = list.filter((r) => !doomed.has(r));
                return Promise.resolve({ data: null, error: null });
            }
            return Promise.resolve({ data: null, error: null });
        };
        b.single = () => settle('single');
        b.maybeSingle = () => settle('single');
        b.then = (resolve: any, reject: any) => settle('many').then(resolve, reject);
        return b;
    }
    return {
        supabase: {
            from: (t: string) => builder(t),
            rpc: (fn: string, args: Record<string, unknown>) => {
                h.rpcCalls.push({ fn, args });
                if (fn === 'marketplace_release_listing') {
                    const l = (h.tables.marketplace_listings || []).find((r) => r.id === args.p_listing_id);
                    if (l) l.quantity_claimed = Math.max(0, Number(l.quantity_claimed ?? 0) - Number(args.p_qty ?? 0));
                    return Promise.resolve({ data: null, error: null });
                }
                return Promise.resolve({ data: 'ok', error: null });
            },
        },
        handleSupabaseError: ({ error, message }: { error: unknown; message: string }) => { if (error) throw new Error(message); },
        broadcastToOrg: (event: string, payload: Record<string, unknown> = {}) => { h.orgEmits.push({ event, payload }); },
        broadcastToChannel: () => {},
        safeFetch: async () => [],
        getSystemRoles: async () => ({}),
    };
});

import {
    cancelMarketplaceContract, markMarketplaceDelivered, confirmMarketplaceReceived,
    toggleMarketplaceMilestone, getMarketplaceReputation, reportMarketplace,
} from '../lib/db/marketplace';

const SELLER = 10, BUYER = 20, STRANGER = 99;
const WAREHOUSE_ACTOR = { permissions: ['warehouse:manage'] };
const PLAIN_ACTOR = { permissions: [] as string[] };

function seedListing(over: Record<string, unknown> = {}) {
    h.tables.marketplace_listings = [{
        id: 'L1', seller_id: SELLER, kind: 'item', listing_type: 'sell', title: 'Widget',
        quantity: 10, quantity_claimed: 2, status: 'active', warehouse_stock_id: null, ...over,
    }];
}
function seedContract(over: Record<string, unknown> = {}) {
    h.tables.marketplace_contracts = [{
        id: 'C1', listing_id: 'L1', seller_id: SELLER, buyer_id: BUYER, kind: 'item', quantity: 2,
        status: 'proposed', proposed_by_id: BUYER, warehouse_stock_id: null, ...over,
    }];
}
const reverseCalls = () => h.rpcCalls.filter((r) => r.fn === 'warehouse_marketplace_reverse');
const releaseCalls = () => h.rpcCalls.filter((r) => r.fn === 'marketplace_release_listing');

beforeEach(() => { h.orgEmits = []; h.rpcCalls = []; h.tables = {}; h.nextId = 1; });

describe('mkt#1: cancel-after-delivery requires warehouse:manage', () => {
    it('a buyer WITHOUT warehouse:manage cancelling a delivered warehouse-linked contract is rejected before any reversal', async () => {
        seedListing(); seedContract({ status: 'delivered', kind: 'item', warehouse_stock_id: 7, quantity: 2 });
        await expect(cancelMarketplaceContract('C1', BUYER, 'nope', PLAIN_ACTOR)).rejects.toThrow(/warehouse:manage/i);
        // fail-closed: no reversal, no release, no status change.
        expect(reverseCalls()).toHaveLength(0);
        expect(releaseCalls()).toHaveLength(0);
        expect(h.tables.marketplace_contracts[0].status).toBe('delivered');
    });
    it('a party WITH warehouse:manage can cancel a delivered warehouse-linked contract (reversal fires)', async () => {
        seedListing(); seedContract({ status: 'delivered', kind: 'item', warehouse_stock_id: 7, quantity: 2 });
        await cancelMarketplaceContract('C1', SELLER, 'oops', WAREHOUSE_ACTOR);
        expect(reverseCalls()).toHaveLength(1);
        expect(h.tables.marketplace_contracts[0].status).toBe('cancelled');
    });
    it('a non-warehouse-linked cancel needs no warehouse permission', async () => {
        seedListing(); seedContract({ status: 'accepted', kind: 'item', warehouse_stock_id: null, quantity: 2 });
        await cancelMarketplaceContract('C1', BUYER, 'fine', PLAIN_ACTOR);
        expect(h.tables.marketplace_contracts[0].status).toBe('cancelled');
        expect(reverseCalls()).toHaveLength(0);
    });
});

describe('mkt#2: optimistic cancel guard prevents double-release', () => {
    it('a second cancel against an already-cancelled contract does not re-release the listing reservation', async () => {
        seedListing({ quantity_claimed: 2 });
        seedContract({ status: 'accepted', kind: 'item', warehouse_stock_id: null, quantity: 2 });
        // First cancel: claims the transition, releases once.
        await cancelMarketplaceContract('C1', SELLER, 'first');
        expect(releaseCalls()).toHaveLength(1);
        expect(h.tables.marketplace_listings[0].quantity_claimed).toBe(0);
        // Second cancel (stale 'accepted' read, but row is now 'cancelled'): the
        // terminal-status precheck rejects it and nothing is released again.
        await expect(cancelMarketplaceContract('C1', SELLER, 'second')).rejects.toThrow(/no longer be cancelled/i);
        expect(releaseCalls()).toHaveLength(1);                 // STILL one — no over-release
        expect(h.tables.marketplace_listings[0].quantity_claimed).toBe(0);
    });

    it('the guarded UPDATE affects 0 rows when status changed under us → release is skipped', async () => {
        // Simulate the race directly: pre-read sees 'accepted', but a concurrent
        // actor flips the row to 'cancelled' before our guarded UPDATE lands.
        seedListing({ quantity_claimed: 2 });
        seedContract({ status: 'accepted', kind: 'item', warehouse_stock_id: null, quantity: 2 });
        const realFrom = (await import('../lib/db/common')).supabase.from;
        let raced = false;
        const spy = vi.spyOn((await import('../lib/db/common')).supabase, 'from').mockImplementation((t: string) => {
            const b = (realFrom as any)(t);
            if (t === 'marketplace_contracts' && !raced) {
                const origUpdate = b.update.bind(b);
                b.update = (v: Record<string, unknown>) => {
                    // concurrent winner flips status the instant before our guarded update
                    raced = true;
                    h.tables.marketplace_contracts[0].status = 'cancelled';
                    return origUpdate(v);
                };
            }
            return b;
        });
        await expect(cancelMarketplaceContract('C1', SELLER, 'loser')).rejects.toThrow(/no longer be cancelled/i);
        expect(releaseCalls()).toHaveLength(0);                 // loser released NOTHING
        expect(h.tables.marketplace_listings[0].quantity_claimed).toBe(2);
        spy.mockRestore();
    });
});

describe('mkt#3: deliver/confirm carry optimistic status guards', () => {
    it('mark_delivered against a contract no longer in a deliverable state is rejected (no stock moved)', async () => {
        seedContract({ status: 'accepted', kind: 'item', warehouse_stock_id: 7, quantity: 2 });
        const realFrom = (await import('../lib/db/common')).supabase.from;
        let raced = false;
        const spy = vi.spyOn((await import('../lib/db/common')).supabase, 'from').mockImplementation((t: string) => {
            const b = (realFrom as any)(t);
            if (t === 'marketplace_contracts' && !raced) {
                const origUpdate = b.update.bind(b);
                b.update = (v: Record<string, unknown>) => {
                    raced = true;
                    h.tables.marketplace_contracts[0].status = 'cancelled';   // concurrent cancel won
                    return origUpdate(v);
                };
            }
            return b;
        });
        await expect(markMarketplaceDelivered('C1', SELLER, WAREHOUSE_ACTOR)).rejects.toThrow(/not ready to deliver/i);
        expect(h.rpcCalls.find((r) => r.fn === 'warehouse_marketplace_deliver')).toBeUndefined();
        expect(h.tables.marketplace_contracts[0].status).toBe('cancelled');   // not clobbered to 'delivered'
        spy.mockRestore();
    });

    it('confirm_received against a contract no longer delivered is rejected (no clobber)', async () => {
        seedContract({ status: 'delivered', kind: 'item', warehouse_stock_id: null, quantity: 2 });
        const realFrom = (await import('../lib/db/common')).supabase.from;
        let raced = false;
        const spy = vi.spyOn((await import('../lib/db/common')).supabase, 'from').mockImplementation((t: string) => {
            const b = (realFrom as any)(t);
            if (t === 'marketplace_contracts' && !raced) {
                const origUpdate = b.update.bind(b);
                b.update = (v: Record<string, unknown>) => {
                    raced = true;
                    h.tables.marketplace_contracts[0].status = 'cancelled';
                    return origUpdate(v);
                };
            }
            return b;
        });
        await expect(confirmMarketplaceReceived('C1', BUYER)).rejects.toThrow(/awaiting confirmation/i);
        expect(h.tables.marketplace_contracts[0].status).toBe('cancelled');
        spy.mockRestore();
    });

    it('the happy paths still work (deliver then confirm)', async () => {
        seedContract({ status: 'accepted', kind: 'item', warehouse_stock_id: null, quantity: 2 });
        await markMarketplaceDelivered('C1', SELLER, WAREHOUSE_ACTOR);
        expect(h.tables.marketplace_contracts[0].status).toBe('delivered');
        await confirmMarketplaceReceived('C1', BUYER);
        expect(h.tables.marketplace_contracts[0].status).toBe('completed');
    });
});

describe('mkt#4: milestone toggle is status-gated', () => {
    function seedMilestone(contractStatus: string) {
        seedContract({ kind: 'service', status: contractStatus });
        h.tables.marketplace_contract_milestones = [{ id: 1, contract_id: 'C1', completed_at: null }];
    }
    it('rejects a toggle on a completed contract', async () => {
        seedMilestone('completed');
        await expect(toggleMarketplaceMilestone(1, SELLER)).rejects.toThrow(/locked/i);
        expect(h.tables.marketplace_contract_milestones[0].completed_at).toBeNull();
    });
    it('rejects a toggle on a cancelled contract', async () => {
        seedMilestone('cancelled');
        await expect(toggleMarketplaceMilestone(1, SELLER)).rejects.toThrow(/locked/i);
    });
    it('allows a toggle on an accepted contract', async () => {
        seedMilestone('accepted');
        await toggleMarketplaceMilestone(1, SELLER);
        expect(h.tables.marketplace_contract_milestones[0].completed_at).not.toBeNull();
    });
});

describe('mkt#5: getMarketplaceReputation guards soft-deleted users', () => {
    it('returns zeroed "New" reputation for a soft-deleted user (history not readable)', async () => {
        h.tables.users = [{ id: SELLER, deleted_at: '2026-01-01' }];
        h.tables.marketplace_ratings = [{ id: 1, ratee_id: SELLER, rater_id: BUYER, stars: 5 }];
        const rep = await getMarketplaceReputation(SELLER);
        expect(rep).toEqual({ userId: SELLER, averageStars: 0, ratingCount: 0, tier: 'New' });
    });
    it('returns zeroed reputation for a non-existent user', async () => {
        h.tables.users = [];
        const rep = await getMarketplaceReputation(12345);
        expect(rep.ratingCount).toBe(0);
        expect(rep.averageStars).toBe(0);
    });
    it('returns real reputation for a live user', async () => {
        h.tables.users = [{ id: SELLER, deleted_at: null }];
        h.tables.marketplace_ratings = [
            { id: 1, ratee_id: SELLER, stars: 5 }, { id: 2, ratee_id: SELLER, stars: 3 },
        ];
        const rep = await getMarketplaceReputation(SELLER);
        expect(rep.ratingCount).toBe(2);
        expect(rep.averageStars).toBe(4);
    });
});

describe('ratelimit#5: marketplace report dedup (one open report per reporter per target)', () => {
    it('rejects a duplicate open report on the same listing', async () => {
        h.tables.marketplace_listings = [{ id: 'L1', status: 'active', seller_id: SELLER }];
        await reportMarketplace({ listingId: 'L1', reasonCategory: 'scam' }, BUYER);
        expect(h.tables.marketplace_reports).toHaveLength(1);
        await expect(reportMarketplace({ listingId: 'L1', reasonCategory: 'scam' }, BUYER))
            .rejects.toThrow(/already have an open report/i);
        expect(h.tables.marketplace_reports).toHaveLength(1);   // not flooded
    });
    it('rejects a duplicate open report on the same contract', async () => {
        seedContract({ status: 'completed' });
        await reportMarketplace({ contractId: 'C1', reasonCategory: 'fraud' }, BUYER);
        await expect(reportMarketplace({ contractId: 'C1', reasonCategory: 'fraud' }, BUYER))
            .rejects.toThrow(/already have an open report/i);
        expect(h.tables.marketplace_reports).toHaveLength(1);
    });
    it('a DIFFERENT reporter is not blocked by another reporter open report', async () => {
        h.tables.marketplace_listings = [{ id: 'L1', status: 'active', seller_id: SELLER }];
        await reportMarketplace({ listingId: 'L1', reasonCategory: 'scam' }, BUYER);
        await reportMarketplace({ listingId: 'L1', reasonCategory: 'scam' }, STRANGER);
        expect(h.tables.marketplace_reports).toHaveLength(2);
    });
    it('a closed (actioned/dismissed) prior report does not block a fresh one', async () => {
        h.tables.marketplace_listings = [{ id: 'L1', status: 'active', seller_id: SELLER }];
        h.tables.marketplace_reports = [{ id: 1, listing_id: 'L1', reporter_id: BUYER, status: 'dismissed' }];
        await reportMarketplace({ listingId: 'L1', reasonCategory: 'scam' }, BUYER);
        expect(h.tables.marketplace_reports).toHaveLength(2);
    });
});
