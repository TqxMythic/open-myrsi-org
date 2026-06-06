import { describe, it, expect, vi, beforeEach } from 'vitest';

// Marketplace ADMIN surface (marketplace:admin): category CRUD + report
// moderation. The permission GATE itself is enforced by the dispatcher and
// pinned by permissionMapCoverage; these tests pin the db-layer BEHAVIOUR —
// notably that 'actioned' on a listing report takes the listing down (and only
// then), while 'dismissed' leaves it untouched, and that resolved reports can't
// be re-resolved. Reuses the in-memory supabase mock from the security suite.

const h = vi.hoisted(() => ({
    orgEmits: [] as Array<{ event: string; payload: Record<string, unknown> }>,
    tables: {} as Record<string, Array<Record<string, unknown>>>,
    insertError: null as { code?: string; message: string } | null,
    nextId: 1,
}));

vi.mock('../lib/db/common', () => {
    function builder(table: string) {
        const state = { op: 'select' as string, values: null as Record<string, unknown> | null, filters: {} as Record<string, unknown> };
        const rows = () => (h.tables[table] ?? []).filter((r) => {
            for (const [c, v] of Object.entries(state.filters)) if (r[c] !== v) return false;
            return true;
        });
        const b: any = {};
        b.select = () => b;
        b.update = (values: Record<string, unknown>) => { state.op = 'update'; state.values = values; return b; };
        b.insert = (values: Record<string, unknown>) => { state.op = 'insert'; state.values = values; return b; };
        b.delete = () => { state.op = 'delete'; return b; };
        b.eq = (c: string, v: unknown) => { state.filters[c] = v; return b; };
        b.or = () => b; b.is = () => b; b.in = () => b; b.order = () => b; b.limit = () => b; b.ilike = () => b;
        const settle = (mode: 'many' | 'single') => {
            if (state.op === 'select') {
                const data = rows();
                return Promise.resolve({ data: mode === 'single' ? (data[0] ?? null) : data, error: null });
            }
            const list = (h.tables[table] = h.tables[table] ?? []);
            if (state.op === 'insert') {
                if (h.insertError) return Promise.resolve({ data: null, error: h.insertError });
                const row = { id: h.nextId++, ...(state.values as Record<string, unknown>) };
                list.push(row);
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
        supabase: { from: (t: string) => builder(t), rpc: () => Promise.resolve({ data: null, error: null }) },
        handleSupabaseError: ({ error, message }: { error: unknown; message: string }) => { if (error) throw new Error(message); },
        broadcastToOrg: (event: string, payload: Record<string, unknown> = {}) => { h.orgEmits.push({ event, payload }); },
        broadcastToChannel: () => {},
        safeFetch: async () => [],
        getSystemRoles: async () => ({}),
    };
});

import {
    createMarketplaceCategory, updateMarketplaceCategory, deleteMarketplaceCategory,
    listAllMarketplaceCategories, getMarketplaceCategories,
    reviewMarketplaceReport,
} from '../lib/db/marketplace';

const SELLER = 10, MOD = 1;

beforeEach(() => { h.orgEmits = []; h.tables = {}; h.insertError = null; h.nextId = 1; });

const emitted = () => h.orgEmits.filter((e) => e.event === 'marketplace:update');

describe('category management (marketplace:admin)', () => {
    it('create derives a slug from the name and emits an id-only nudge', async () => {
        const cat = await createMarketplaceCategory({ name: 'Ship Components!' });
        expect(h.tables.marketplace_categories).toHaveLength(1);
        expect(h.tables.marketplace_categories[0].slug).toBe('ship-components');
        expect(cat.name).toBe('Ship Components!');
        // realtime nudge carries no row body
        expect(JSON.stringify(emitted())).not.toContain('Ship Components');
    });

    it('create rejects a name with no slug-able characters', async () => {
        await expect(createMarketplaceCategory({ name: '★★★' })).rejects.toThrow(/letters or numbers/i);
        expect(h.tables.marketplace_categories ?? []).toHaveLength(0);
    });

    it('update changes allowed fields but rejects self-parenting', async () => {
        h.tables.marketplace_categories = [{ id: 5, slug: 'svc', name: 'Services', parent_id: null, listing_kind: 'service', icon: null, sort_order: 0, active: true }];
        await expect(updateMarketplaceCategory(5, { parentId: 5 })).rejects.toThrow(/its own parent/i);
        await updateMarketplaceCategory(5, { name: 'Services v2', active: false });
        expect(h.tables.marketplace_categories[0].name).toBe('Services v2');
        expect(h.tables.marketplace_categories[0].active).toBe(false);
    });

    it('delete removes the row', async () => {
        h.tables.marketplace_categories = [{ id: 5, slug: 'svc', name: 'Services', parent_id: null, listing_kind: 'service', icon: null, sort_order: 0, active: true }];
        await deleteMarketplaceCategory(5);
        expect(h.tables.marketplace_categories).toHaveLength(0);
    });

    it('listAll returns inactive categories; the member-facing list hides them', async () => {
        h.tables.marketplace_categories = [
            { id: 1, slug: 'a', name: 'Active', parent_id: null, listing_kind: 'both', icon: null, sort_order: 0, active: true },
            { id: 2, slug: 'b', name: 'Hidden', parent_id: null, listing_kind: 'both', icon: null, sort_order: 1, active: false },
        ];
        expect(await listAllMarketplaceCategories()).toHaveLength(2);
        const members = await getMarketplaceCategories();
        expect(members).toHaveLength(1);
        expect(members[0].name).toBe('Active');
    });
});

describe('report moderation (marketplace:admin)', () => {
    function seedListingReport(listingStatus = 'active') {
        h.tables.marketplace_listings = [{ id: 'L1', seller_id: SELLER, status: listingStatus, title: 'Bad Widget' }];
        h.tables.marketplace_reports = [{ id: 1, listing_id: 'L1', contract_id: null, reporter_id: 50, reason_category: 'scam', details: null, status: 'open', reviewed_at: null, reviewed_by_id: null }];
    }

    it("'actioned' on a listing report takes the listing down and resolves the report", async () => {
        seedListingReport('active');
        await reviewMarketplaceReport(1, 'actioned', MOD);
        expect(h.tables.marketplace_listings[0].status).toBe('closed');     // taken down
        const report = h.tables.marketplace_reports[0];
        expect(report.status).toBe('actioned');
        expect(report.reviewed_by_id).toBe(MOD);
        expect(report.reviewed_at).toBeTruthy();
        // takedown nudges realtime with the listing id only
        expect(emitted().some((e) => e.payload.listingId === 'L1')).toBe(true);
    });

    it("'dismissed' resolves the report but leaves the listing untouched", async () => {
        seedListingReport('active');
        await reviewMarketplaceReport(1, 'dismissed', MOD);
        expect(h.tables.marketplace_listings[0].status).toBe('active');     // NOT taken down
        expect(h.tables.marketplace_reports[0].status).toBe('dismissed');
        expect(emitted()).toHaveLength(0);
    });

    it("'actioned' on a contract report records the decision without closing any listing", async () => {
        h.tables.marketplace_reports = [{ id: 2, listing_id: null, contract_id: 'C1', reporter_id: 50, reason_category: 'other', details: null, status: 'open', reviewed_at: null, reviewed_by_id: null }];
        await reviewMarketplaceReport(2, 'actioned', MOD);
        expect(h.tables.marketplace_reports[0].status).toBe('actioned');
        expect(emitted()).toHaveLength(0);   // nothing to take down
    });

    it('a resolved report cannot be re-resolved', async () => {
        h.tables.marketplace_reports = [{ id: 3, listing_id: 'L1', contract_id: null, reporter_id: 50, reason_category: 'scam', details: null, status: 'actioned', reviewed_at: 't', reviewed_by_id: MOD }];
        await expect(reviewMarketplaceReport(3, 'dismissed', MOD)).rejects.toThrow(/already resolved/i);
    });

    it('rejects an invalid decision', async () => {
        seedListingReport('active');
        await expect(reviewMarketplaceReport(1, 'banhammer' as any, MOD)).rejects.toThrow(/invalid decision/i);
        expect(h.tables.marketplace_reports[0].status).toBe('open');
    });

    it('does not re-close an already-closed listing (idempotent, no extra nudge)', async () => {
        seedListingReport('closed');
        await reviewMarketplaceReport(1, 'actioned', MOD);
        expect(h.tables.marketplace_reports[0].status).toBe('actioned');
        expect(emitted()).toHaveLength(0);   // listing was already closed
    });
});
