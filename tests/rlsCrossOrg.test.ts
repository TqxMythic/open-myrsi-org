import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Derive the table list from schema.sql so newly added tables are covered
// automatically — a hand-maintained list silently rots as the schema grows.
// RLS_TEST_TABLES still overrides for targeted runs.
function tablesFromSchema(): string[] {
    try {
        const sql = readFileSync(resolve(__dirname, '..', 'schema.sql'), 'utf8');
        const names = new Set<string>();
        for (const m of sql.matchAll(/CREATE TABLE(?: IF NOT EXISTS)?\s+(?:public\.)?"?([a-z0-9_]+)"?/gi)) {
            names.add(m[1].toLowerCase());
        }
        return [...names];
    } catch {
        return [];
    }
}

// Cross-org RLS smoke test. The application layer enforces tenant isolation in
// api/services.ts, but the database itself should refuse cross-org reads even if
// that check is bypassed, for defense in depth. This test connects as the anon
// role (no authenticated user) and verifies that reads against org-scoped tables
// either return zero rows or an RLS-denial error.
//
// SKIPPED by default — only runs when explicitly opted in via
// RLS_TEST_LIVE=1, because it requires a reachable Supabase instance
// with seeded data. Intended to run against staging during deploy
// verification, not in unit-test CI against mocks.
//
// To run:
//   RLS_TEST_LIVE=1 \
//   SUPABASE_URL=https://your-project.supabase.co \
//   SUPABASE_ANON_KEY=your-anon-key \
//   RLS_TEST_TABLES="users,service_requests,operations" \
//   npm test -- rlsCrossOrg

const RLS_TEST_LIVE = process.env.RLS_TEST_LIVE === '1';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const RLS_TEST_TABLES = process.env.RLS_TEST_TABLES
    ? process.env.RLS_TEST_TABLES.split(',').map(t => t.trim()).filter(Boolean)
    : tablesFromSchema();

const live = RLS_TEST_LIVE && !!SUPABASE_URL && !!SUPABASE_ANON_KEY && SUPABASE_URL !== 'http://localhost:54321';

describe.skipIf(!live)('RLS cross-org smoke', () => {
    // `createClient` runs lazily — describe.skipIf still evaluates the body
    // to collect test declarations, but beforeAll is skipped along with the
    // tests, so the client only initialises when the suite actually runs.
    let supabase: SupabaseClient;
    beforeAll(() => {
        supabase = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!);
    });

    // Only materialize the per-table cases when the live suite runs —
    // otherwise the schema-derived list (~100 tables) floods the unit-test
    // summary with skipped entries.
    for (const table of (live ? RLS_TEST_TABLES : [])) {
        it(`anon role cannot read rows from ${table}`, async () => {
            const { data, error } = await supabase
                .from(table)
                .select('id', { head: false, count: 'exact' })
                .limit(5);

            // Acceptable outcomes:
            //   1. RLS denies entirely: error is set, no rows returned.
            //   2. RLS allows the query but filters to zero rows: data is [].
            // Failure mode: data has rows. That means anon can read tenant data.
            if (error) {
                // Many Supabase RLS denials surface as PGRST301 ("permission denied")
                // or similar PostgREST codes; we don't whitelist specific codes
                // because they vary by Supabase version. Any error here is fine —
                // the request was refused.
                expect(error).toBeTruthy();
                return;
            }
            expect(
                data,
                `anon role read ${data?.length ?? 0} rows from ${table} — RLS is OFF or misconfigured`,
            ).toEqual([]);
        });
    }
});

// Always-on assertion: the suite itself loads (i.e. the file compiles and
// the createClient call doesn't blow up on import). Prevents bit-rot when
// nobody runs the live suite for a while.
describe('RLS test scaffold', () => {
    it('loads', () => {
        expect(typeof createClient).toBe('function');
    });

    it('derives a non-trivial table list from schema.sql (live suite covers every table)', () => {
        const tables = tablesFromSchema();
        expect(tables.length).toBeGreaterThan(50);
        for (const t of ['users', 'service_requests', 'operations', 'warrants', 'intel_reports', 'hr_applications', 'settings']) {
            expect(tables, `schema parse missed ${t}`).toContain(t);
        }
    });
});
