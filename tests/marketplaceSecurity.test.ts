import { describe, it, expect, vi, beforeEach } from 'vitest';

// Marketplace security + lifecycle. In this single-org marketplace the only authz
// boundary is per-user ownership / contract-party membership, so every
// id-addressed mutation re-checks it server-side. Also: no over-claim, realtime
// is ids-only, and the warehouse RPCs fire on delivery / reverse on
// cancel-after-delivery.

const h = vi.hoisted(() => ({
    orgEmits: [] as Array<{ event: string; payload: Record<string, unknown> }>,
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    rpcCalls: [] as Array<{ fn: string; args: Record<string, unknown> }>,
    insertError: null as { code?: string; message: string } | null,
    nextId: 1,
}));

vi.mock('../lib/db/common', () => {
    function builder(table: string) {
        const state = { op: 'select' as string, values: null as Record<string, unknown> | null, filters: {} as Record<string, unknown>, orClause: null as string | null };
        const rows = () => (h.tables[table] ?? []).filter((r) => {
            for (const [c, v] of Object.entries(state.filters)) if (r[c] !== v) return false;
            if (state.orClause) {
                // only `seller_id.eq.N,buyer_id.eq.N` is used
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
        b.or = (clause: string) => { state.orClause = clause; return b; };
        b.is = () => b; b.in = () => b; b.order = () => b; b.limit = () => b; b.ilike = () => b;
        const settle = (mode: 'many' | 'single') => {
            if (state.op === 'select') {
                const data = rows();
                return Promise.resolve({ data: mode === 'single' ? (data[0] ?? null) : data, error: null });
            }
            const list = (h.tables[table] = h.tables[table] ?? []);
            if (state.op === 'insert') {
                if (h.insertError) return Promise.resolve({ data: null, error: h.insertError });
                const row = { id: `gen-${h.nextId++}`, ...(state.values as Record<string, unknown>) };
                list.push(row);
                h.orgEmits.push({ event: `__insert:${table}`, payload: row });
                return Promise.resolve({ data: row, error: null });
            }
            if (state.op === 'update') for (const r of rows()) Object.assign(r, state.values);
            if (state.op === 'delete') { const doomed = new Set(rows()); h.tables[table] = list.filter((r) => !doomed.has(r)); }
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
                // Emulate the atomic accept RPC: flip a still-proposed contract.
                if (fn === 'marketplace_accept_contract') {
                    const c = (h.tables.marketplace_contracts || []).find((r) => r.id === args.p_contract_id);
                    if (c && c.status === 'proposed') { c.status = 'accepted'; c.accepted_at = 'now'; }
                    return Promise.resolve({ data: 'ok', error: null });
                }
                return Promise.resolve({ data: 'mv-1', error: null });
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
    updateMarketplaceListing, deleteMarketplaceListing, proposeMarketplaceContract,
    acceptMarketplaceContract, markMarketplaceDelivered, confirmMarketplaceReceived,
    cancelMarketplaceContract, rateMarketplaceContract, getMarketplaceContract,
    getMarketplaceListing, getContractRatings, getMarketplaceTraderProfile, createMarketplaceListing,
} from '../lib/db/marketplace';

const SELLER = 10, BUYER = 20, STRANGER = 99;

function seedListing(over: Record<string, unknown> = {}) {
    h.tables.marketplace_listings = [{
        id: 'L1', seller_id: SELLER, kind: 'item', listing_type: 'sell', title: 'Widget',
        quantity: 10, quantity_claimed: 0, status: 'active', warehouse_stock_id: null, ...over,
    }];
}
function seedContract(over: Record<string, unknown> = {}) {
    h.tables.marketplace_contracts = [{
        id: 'C1', listing_id: 'L1', seller_id: SELLER, buyer_id: BUYER, kind: 'item', quantity: 2,
        status: 'proposed', proposed_by_id: BUYER, warehouse_stock_id: null, ...over,
    }];
}

beforeEach(() => {
    h.orgEmits = []; h.rpcCalls = []; h.tables = {}; h.insertError = null; h.nextId = 1;
});

const ids = () => h.orgEmits.filter((e) => e.event === 'marketplace:update').flatMap((e) => Object.values(e.payload));

describe('listing ownership (M3)', () => {
    it('a non-owner cannot update or delete a listing', async () => {
        seedListing();
        await expect(updateMarketplaceListing('L1', { title: 'hax' }, STRANGER)).rejects.toThrow(/not found or access denied/i);
        await expect(deleteMarketplaceListing('L1', STRANGER)).rejects.toThrow(/not found or access denied/i);
        expect(h.tables.marketplace_listings[0].title).toBe('Widget');     // unchanged
    });
    it('the owner can update', async () => {
        seedListing();
        await updateMarketplaceListing('L1', { title: 'Widget v2' }, SELLER);
        expect(h.tables.marketplace_listings[0].title).toBe('Widget v2');
    });
});

describe('propose (M9 no over-claim, own-listing block)', () => {
    it('rejects contracting your own listing', async () => {
        seedListing();
        await expect(proposeMarketplaceContract({ listingId: 'L1', quantity: 1 }, SELLER)).rejects.toThrow(/your own listing/i);
    });
    it('rejects over-claiming remaining quantity', async () => {
        seedListing({ quantity: 5, quantity_claimed: 4 }); // only 1 remaining
        await expect(proposeMarketplaceContract({ listingId: 'L1', quantity: 2 }, BUYER)).rejects.toThrow(/remaining/i);
    });
    it('derives parties (sell ⇒ owner=seller, proposer=buyer) and emits an id only', async () => {
        seedListing();
        h.tables.marketplace_contracts = [];
        await proposeMarketplaceContract({ listingId: 'L1', quantity: 2 }, BUYER);
        const c = h.tables.marketplace_contracts[0];
        expect(c.seller_id).toBe(SELLER);
        expect(c.buyer_id).toBe(BUYER);
        expect(c.proposed_by_id).toBe(BUYER);
        // realtime payload carries an id, never the row body.
        expect(ids().length).toBeGreaterThan(0);
        expect(JSON.stringify(h.orgEmits.filter((e) => e.event === 'marketplace:update'))).not.toContain('Widget');
    });
});

describe('contract lifecycle party checks (M3/M4)', () => {
    it('accept: only the NON-proposer party; the proposer cannot self-accept', async () => {
        seedListing(); seedContract({ proposed_by_id: BUYER });
        await expect(acceptMarketplaceContract('C1', BUYER)).rejects.toThrow(/not found or access denied/i);   // proposer
        await expect(acceptMarketplaceContract('C1', STRANGER)).rejects.toThrow(/not found or access denied/i); // outsider
        await acceptMarketplaceContract('C1', SELLER);                       // the counterparty
        expect(h.tables.marketplace_contracts[0].status).toBe('accepted');
    });
    it('mark_delivered: seller only', async () => {
        seedContract({ status: 'accepted' });
        await expect(markMarketplaceDelivered('C1', BUYER)).rejects.toThrow(/not found or access denied/i);
        await expect(markMarketplaceDelivered('C1', STRANGER)).rejects.toThrow(/not found or access denied/i);
        await markMarketplaceDelivered('C1', SELLER);
        expect(h.tables.marketplace_contracts[0].status).toBe('delivered');
    });
    it('confirm_received: buyer only', async () => {
        seedContract({ status: 'delivered' });
        await expect(confirmMarketplaceReceived('C1', SELLER)).rejects.toThrow(/not found or access denied/i);
        await confirmMarketplaceReceived('C1', BUYER);
        expect(h.tables.marketplace_contracts[0].status).toBe('completed');
    });
    it('cancel: a party only; an outsider cannot', async () => {
        seedListing(); seedContract({ status: 'accepted', quantity: 2 });
        await expect(cancelMarketplaceContract('C1', STRANGER, 'x')).rejects.toThrow(/not found or access denied/i);
        await cancelMarketplaceContract('C1', SELLER, 'changed mind');
        expect(h.tables.marketplace_contracts[0].status).toBe('cancelled');
    });
    it('get_contract returns null for a non-party (no existence disclosure)', async () => {
        seedContract({ status: 'accepted' });
        expect(await getMarketplaceContract('C1', STRANGER)).toBeNull();
    });
});

describe('detail-read scoping mirrors the list gate (M3 read-path drift)', () => {
    it('get_listing hides a withdrawn (paused/closed) listing from non-owners, shows it to the owner', async () => {
        seedListing({ status: 'paused' });
        expect(await getMarketplaceListing('L1', STRANGER)).toBeNull();
        expect(await getMarketplaceListing('L1', SELLER)).not.toBeNull();
    });
    it('get_listing returns an active listing to anyone', async () => {
        seedListing({ status: 'active' });
        expect(await getMarketplaceListing('L1', STRANGER)).not.toBeNull();
    });
    it('get_contract_ratings is party-only (no cross-contract feedback enumeration)', async () => {
        seedContract({ status: 'completed' });
        await expect(getContractRatings('C1', STRANGER)).rejects.toThrow(/not found or access denied/i);
        await expect(getContractRatings('C1', BUYER)).resolves.toBeDefined();
    });
});

describe('warehouse fulfilment (M7)', () => {
    // Moving warehouse stock via the marketplace requires the same
    // warehouse:manage bar as a direct stock movement.
    const WAREHOUSE_ACTOR = { permissions: ['warehouse:manage'] };
    it('fires the deliver RPC on a warehouse-linked sell delivery (warehouse:manage)', async () => {
        seedContract({ status: 'accepted', kind: 'item', warehouse_stock_id: 7 });
        await markMarketplaceDelivered('C1', SELLER, WAREHOUSE_ACTOR);
        expect(h.rpcCalls.find((r) => r.fn === 'warehouse_marketplace_deliver')).toMatchObject({ args: { p_contract_id: 'C1', p_actor_id: SELLER } });
    });
    it('M8: rejects warehouse-linked delivery WITHOUT warehouse:manage (no stock moved)', async () => {
        seedContract({ status: 'accepted', kind: 'item', warehouse_stock_id: 7 });
        await expect(markMarketplaceDelivered('C1', SELLER, { permissions: [] })).rejects.toThrow(/warehouse:manage/i);
        expect(h.rpcCalls.find((r) => r.fn === 'warehouse_marketplace_deliver')).toBeUndefined();
    });
    it('does NOT fire the RPC for an unlinked contract', async () => {
        seedContract({ status: 'accepted', kind: 'item', warehouse_stock_id: null });
        await markMarketplaceDelivered('C1', SELLER, WAREHOUSE_ACTOR);
        expect(h.rpcCalls.find((r) => r.fn === 'warehouse_marketplace_deliver')).toBeUndefined();
    });
    it('posts a compensating reversal when a DELIVERED warehouse-linked contract is cancelled (with warehouse:manage)', async () => {
        // The reversal is a real stock movement, so cancelling a delivered
        // warehouse-linked contract requires the warehouse:manage bar (mirrors deliver).
        seedListing(); seedContract({ status: 'delivered', kind: 'item', warehouse_stock_id: 7, quantity: 2 });
        await cancelMarketplaceContract('C1', SELLER, 'oops', WAREHOUSE_ACTOR);
        expect(h.rpcCalls.find((r) => r.fn === 'warehouse_marketplace_reverse')).toMatchObject({ args: { p_contract_id: 'C1' } });
    });
    it('mkt#1: rejects cancelling a DELIVERED warehouse-linked contract WITHOUT warehouse:manage (no reversal)', async () => {
        seedListing(); seedContract({ status: 'delivered', kind: 'item', warehouse_stock_id: 7, quantity: 2 });
        await expect(cancelMarketplaceContract('C1', SELLER, 'oops', { permissions: [] })).rejects.toThrow(/warehouse:manage/i);
        expect(h.rpcCalls.find((r) => r.fn === 'warehouse_marketplace_reverse')).toBeUndefined();
    });
});

describe('trader profile + listing warehouse link (M3/M8)', () => {
    it('M3: getMarketplaceTraderProfile exposes NO recentRatings (party-confidential feedback withheld)', async () => {
        h.tables.users = [{ id: SELLER, name: 'Trader', rsi_handle: 'trader', avatar_url: null, deleted_at: null }];
        h.tables.marketplace_ratings = [{ id: 'r1', ratee_id: SELLER, rater_id: BUYER, stars: 5, feedback: 'SECRET private feedback', created_at: 't' }];
        h.tables.marketplace_listings = [];
        const profile = await getMarketplaceTraderProfile(SELLER);
        expect(profile).not.toBeNull();
        expect('recentRatings' in (profile as object)).toBe(false);
        // aggregate reputation still derived from stars
        expect(profile!.reputation.ratingCount).toBe(1);
        expect(JSON.stringify(profile)).not.toContain('SECRET private feedback');
    });

    it('M8: createMarketplaceListing rejects a warehouse link without warehouse:manage', async () => {
        h.tables.warehouse_stock = [{ id: 7 }];
        await expect(createMarketplaceListing(
            { kind: 'item', listingType: 'sell', title: 'Stock sale', quantity: 1, warehouseStockId: 7 },
            SELLER, { permissions: [] },
        )).rejects.toThrow(/warehouse:manage/i);
    });

    it('M8: createMarketplaceListing allows a warehouse link WITH warehouse:manage', async () => {
        h.tables.warehouse_stock = [{ id: 7 }];
        await expect(createMarketplaceListing(
            { kind: 'item', listingType: 'sell', title: 'Stock sale', quantity: 1, warehouseStockId: 7 },
            SELLER, { permissions: ['warehouse:manage'] },
        )).resolves.toBeDefined();
    });

    it('I2: strips HTML from listing free-text on create (latent stored-XSS guard)', async () => {
        await createMarketplaceListing(
            { kind: 'item', listingType: 'sell', title: '<b>Widget</b>', description: '<script>steal()</script>desc', location: '<i>HUR</i>', quantity: 1 },
            SELLER,
        );
        const stored = h.tables.marketplace_listings[0];
        // stripHtml removes the MARKUP (tags), leaving harmless plain text — so
        // no '<' survives to be re-interpreted as HTML by a future consumer.
        expect(String(stored.title)).not.toContain('<');
        expect(String(stored.description ?? '')).not.toContain('<');
        expect(String(stored.location ?? '')).not.toContain('<');
    });

    it('L10: clamps a negative / non-finite listing price to null', async () => {
        await createMarketplaceListing({ kind: 'item', listingType: 'sell', title: 'A', quantity: 1, priceUec: -500 }, SELLER);
        expect(h.tables.marketplace_listings[0].price_uec).toBeNull();
        h.tables.marketplace_listings = [];
        await createMarketplaceListing({ kind: 'item', listingType: 'sell', title: 'B', quantity: 1, priceUec: Number.POSITIVE_INFINITY }, SELLER);
        expect(h.tables.marketplace_listings[0].price_uec).toBeNull();
    });

    it('L10: keeps a valid price (floored)', async () => {
        await createMarketplaceListing({ kind: 'item', listingType: 'sell', title: 'C', quantity: 1, priceUec: 1234.9 }, SELLER);
        expect(h.tables.marketplace_listings[0].price_uec).toBe(1234);
    });

    it('I2 (sweep): strips HTML from proposed milestone title/description', async () => {
        seedListing();
        await proposeMarketplaceContract(
            { listingId: 'L1', quantity: 1, milestones: [{ title: '<b>Phase</b>', description: '<script>x</script>do it' }] },
            BUYER,
        );
        const ms = h.tables.marketplace_contract_milestones?.[0];
        expect(ms).toBeDefined();
        expect(String(ms.title)).not.toContain('<');
        expect(String(ms.description ?? '')).not.toContain('<');
    });

    it('I2 (sweep): strips HTML from cancel_reason (it rides CONTRACT_SELECT to the wire)', async () => {
        seedListing(); seedContract({ status: 'accepted' });
        await cancelMarketplaceContract('C1', SELLER, '<img src=x onerror=alert(1)>reason');
        expect(String(h.tables.marketplace_contracts[0].cancel_reason)).not.toContain('<');
    });
});

describe('rating (M9)', () => {
    it('only on a completed contract', async () => {
        seedContract({ status: 'delivered' });
        await expect(rateMarketplaceContract('C1', { stars: 5 }, BUYER)).rejects.toThrow(/completed/i);
    });
    it('rejects a non-party', async () => {
        seedContract({ status: 'completed' });
        await expect(rateMarketplaceContract('C1', { stars: 5 }, STRANGER)).rejects.toThrow(/not found or access denied/i);
    });
    it('maps the UNIQUE violation to a friendly "already rated"', async () => {
        seedContract({ status: 'completed' });
        h.insertError = { code: '23505', message: 'duplicate key' };
        await expect(rateMarketplaceContract('C1', { stars: 4 }, BUYER)).rejects.toThrow(/already rated/i);
    });
});
