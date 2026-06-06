import { describe, it, expect, vi, beforeEach } from 'vitest';

// Wiki-import clearance integrity. wiki:import_pages is gated admin:access, which
// the non-Admin Dispatcher role also holds, so importWikiPages mirrors
// createWikiPage / updateWikiPage: clamp classification, guard
// overwrite-visibility, reproduce limiting markers, fail closed.

const h = vi.hoisted(() => ({
    data: {} as Record<string, unknown>,                  // per-table seeded rows for selects
    calls: [] as Array<{ table: string; method: string; args: unknown[] }>,
}));

vi.mock('../lib/db/common', () => {
    function builder(table: string) {
        const b: any = {};
        for (const m of ['select', 'eq', 'neq', 'in', 'is', 'not', 'order', 'limit', 'ilike', 'update', 'delete', 'insert', 'upsert']) {
            b[m] = (...args: unknown[]) => { h.calls.push({ table, method: m, args }); return b; };
        }
        const settle = () => Promise.resolve({ data: h.data[table] ?? [], error: null });
        b.single = () => Promise.resolve({ data: (h.data[table] as unknown[])?.[0] ?? null, error: null });
        b.maybeSingle = () => Promise.resolve({ data: (h.data[table] as unknown[])?.[0] ?? null, error: null });
        b.then = (res: any, rej: any) => settle().then(res, rej);
        return b;
    }
    return {
        supabase: { from: (t: string) => builder(t) },
        handleSupabaseError: ({ error, message }: { error: unknown; message: string }) => { if (error) throw new Error(message); },
        broadcastToOrg: () => {},
    };
});
vi.mock('../lib/db/system', () => ({ updateWikiHomeConfig: vi.fn() }));

import { importWikiPages } from '../lib/db/wiki';
import type { WikiExportBundle, WikiImportMode } from '../types';

const dispatcher = { id: 6, role: 'Dispatcher', permissions: ['admin:access', 'wiki:edit_page'], clearanceLevel: { level: 1 }, limitingMarkers: [] } as any;
const admin = { id: 1, role: 'Admin', permissions: [], clearanceLevel: { level: 0 }, limitingMarkers: [] } as any;

const page = (over: Record<string, unknown> = {}) => ({
    id: 'p1', parentPageId: null, title: 'Page', slug: 'page',
    content: { type: 'doc', content: [] }, classificationLevel: 0, sortOrder: 0, markerNames: [] as string[],
    ...over,
});
const bundle = (pages: unknown[], version = 1): WikiExportBundle =>
    ({ version, exportedAt: 't', sourceOrg: { id: 'o', name: 'O' }, wikiHomeConfig: null, pages } as unknown as WikiExportBundle);

const run = (b: WikiExportBundle, mode: WikiImportMode, actor: unknown) => importWikiPages(b, mode, false, 6, actor as any);
const inserts = (table: string) => h.calls.filter(c => c.table === table && c.method === 'insert');

beforeEach(() => { h.data = {}; h.calls = []; });

describe('importWikiPages classification clamp (IMP-W1)', () => {
    it('rejects a Dispatcher importing a page ABOVE their clearance — and writes nothing (atomic pre-flight)', async () => {
        await expect(run(bundle([page({ classificationLevel: 3 })]), 'new', dispatcher)).rejects.toThrow(/above your own clearance/i);
        expect(inserts('wiki_pages')).toHaveLength(0);
    });

    it('lets an Admin import a high-classification page', async () => {
        await run(bundle([page({ classificationLevel: 5 })]), 'new', admin);
        const ins = inserts('wiki_pages');
        expect(ins).toHaveLength(1);
        expect((ins[0].args[0] as Record<string, unknown>).classification_level).toBe(5);
    });

    it('blocks a Dispatcher OVERWRITING a classified page they cannot read (visibility guard)', async () => {
        // Existing page is level 3; the Dispatcher (level 1) tries to overwrite it down to level 1.
        h.data.wiki_pages = [{ id: 'existing', slug: 'secret', classification_level: 3, wiki_page_limiting_markers: [] }];
        await expect(run(bundle([page({ slug: 'secret', classificationLevel: 1 })]), 'overwrite', dispatcher))
            .rejects.toThrow(/not cleared to overwrite/i);
        expect(h.calls.some(c => c.table === 'wiki_pages' && c.method === 'update')).toBe(false);
    });
});

describe('importWikiPages limiting markers (IMP-W2)', () => {
    it('reproduces compartmentation — resolves markerNames→ids and writes wiki_page_limiting_markers', async () => {
        h.data.security_limiting_markers = [{ id: 7, name: 'NOFORN' }];
        await run(bundle([page({ classificationLevel: 1, markerNames: ['NOFORN'] })]), 'new', admin);
        const markerInserts = inserts('wiki_page_limiting_markers');
        expect(markerInserts).toHaveLength(1);
        expect(markerInserts[0].args[0]).toContainEqual(expect.objectContaining({ marker_id: 7 }));
    });

    it('FAILS CLOSED on an unknown marker name — throws + writes nothing (never silently widens access)', async () => {
        h.data.security_limiting_markers = [{ id: 7, name: 'NOFORN' }];
        await expect(run(bundle([page({ classificationLevel: 0, markerNames: ['GHOST'] })]), 'new', admin))
            .rejects.toThrow(/does not exist/i);
        expect(inserts('wiki_pages')).toHaveLength(0);
    });
});

describe('importWikiPages content sanitize + bundle validation', () => {
    it('strips HTML from the imported title', async () => {
        await run(bundle([page({ title: '<script>x</script>Briefing' })]), 'new', admin);
        expect(String((inserts('wiki_pages')[0].args[0] as Record<string, unknown>).title)).not.toContain('<');
    });
    it('rejects a malformed bundle / invalid mode', async () => {
        await expect(run(bundle([page()], 2), 'new', admin)).rejects.toThrow(/invalid wiki export bundle/i);
        await expect(run(bundle([page()]), 'merge' as WikiImportMode, admin)).rejects.toThrow(/invalid import mode/i);
    });
});
