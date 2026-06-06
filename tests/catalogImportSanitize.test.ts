import { describe, it, expect, vi, beforeEach } from 'vitest';

// CAT-S3 / CAT-C2 pins for the platform-catalog import/sync surface:
//  - UEX mappers strip markup from DISPLAY free-text but keep identifier/slug
//    fields EXACT (a drifted external_id/slug would break the onConflict upsert).
//  - updatePlatformCommodity drops the protected sync-key fields.

const h = vi.hoisted(() => ({ calls: [] as Array<{ table: string; method: string; args: unknown[] }> }));
vi.mock('../lib/db/common', () => {
    function builder(table: string) {
        const b: any = {};
        for (const m of ['select', 'eq', 'in', 'is', 'not', 'order', 'limit', 'ilike', 'update', 'delete', 'insert', 'upsert', 'range']) {
            b[m] = (...args: unknown[]) => { h.calls.push({ table, method: m, args }); return b; };
        }
        b.then = (res: any, rej: any) => Promise.resolve({ data: [], error: null }).then(res, rej);
        b.single = () => Promise.resolve({ data: null, error: null });
        b.maybeSingle = () => Promise.resolve({ data: null, error: null });
        return b;
    }
    return {
        supabase: { from: (t: string) => builder(t) },
        handleSupabaseError: ({ error, message }: { error: unknown; message: string }) => { if (error) throw new Error(message); },
        broadcastToOrg: () => {},
    };
});

import { mapUexItemToQmRow, mapUexCommodityToWarehouseRow } from '../lib/db/uex';
import { updatePlatformCommodity } from '../lib/db/warehouse';

beforeEach(() => { h.calls = []; });

describe('UEX mapper sanitize (CAT-S3)', () => {
    it('strips markup from item display fields but keeps slug/external ids EXACT', () => {
        const row = mapUexItemToQmRow(
            { uuid: 'uuid-1', id: 42, slug: 'gun-slug', name: '<b>Gun</b>', category: '<x>cat', company_name: '<i>Co</i>', vehicle_name: '<u>V</u>' } as any,
            new Map(),
        )!;
        expect(String(row.name)).not.toContain('<');
        expect(String(row.subcategory ?? '')).not.toContain('<');
        expect(String(row.company_name ?? '')).not.toContain('<');
        expect(String(row.vehicle_name ?? '')).not.toContain('<');
        // Identifier / match-key fields must be byte-exact (onConflict upsert key).
        expect(row.external_uuid).toBe('uuid-1');
        expect(row.external_id).toBe(42);
        expect(row.slug).toBe('gun-slug');
    });

    it('strips markup from commodity display fields but keeps slug/external_id EXACT', () => {
        const row = mapUexCommodityToWarehouseRow(
            { id: 99, slug: 'iron', name: '<b>Iron</b>', code: 'IRON', kind: '<i>metal</i>' } as any,
            new Map(),
        );
        expect(String(row.name)).not.toContain('<');
        expect(String(row.kind ?? '')).not.toContain('<');
        expect(row.external_id).toBe(99);
        expect(row.slug).toBe('iron');
    });
});

describe('updatePlatformCommodity protected-field allow-list (CAT-C2)', () => {
    it('drops identity/sync-key fields, keeps legit edits', async () => {
        await updatePlatformCommodity(1, { name: 'New', price_buy: 10, external_id: 999, external_uuid: 'x', slug: 'y', id: 5, created_at: 'z', last_synced_at: 'w' } as any);
        const upd = h.calls.find(c => c.table === 'warehouse_platform_commodities' && c.method === 'update');
        expect(upd).toBeDefined();
        const patch = upd!.args[0] as Record<string, unknown>;
        expect(patch.name).toBe('New');
        expect(patch.price_buy).toBe(10);
        expect('external_id' in patch).toBe(false);
        expect('external_uuid' in patch).toBe(false);
        expect('slug' in patch).toBe(false);
        expect('id' in patch).toBe(false);
        expect('created_at' in patch).toBe(false);
        expect('last_synced_at' in patch).toBe(false);
    });

    it('throws when only protected fields are supplied (nothing editable)', async () => {
        await expect(updatePlatformCommodity(1, { external_id: 999, slug: 'y' } as any)).rejects.toThrow(/no updatable fields/i);
    });
});
