import { describe, it, expect, vi, beforeAll } from 'vitest';

// /sw.js in-process TTL cache.
//
// GET /sw.js is unauthenticated, not under /api (so the global apiLimiter does
// not cover it), and swFn (api/sw.ts) reads the branding/openGraph settings rows
// from the DB on every request — a per-request DB-read DoS amplifier.
//
// server.ts wraps the SW production in an in-process TTL memo (createTtlCache):
// the first get() invokes the producer (the DB-hitting render), and subsequent
// get() calls with the same key within the TTL replay the cached value without
// re-invoking the producer. The route keys on a stable SW version so a redeploy
// (process restart drops the cache) and a short TTL still let branding/version
// changes propagate.
//
// We exercise the cache helper directly (the exact one exported from server.ts);
// the route wiring (captureSwResponse + the swLimiter middleware) is verified by
// reading the route, not unit-run here.
//
// Importing server.ts for a unit test is side-effect-free: it binds a socket +
// registers cron only when it is the process entrypoint, guarded by an ESM
// "is main module" check (process.argv[1] !== this file under vitest).

// Some modules in server.ts's transitive import graph touch env at load. Under
// vitest NODE_ENV==='test' so none throw, but set a JWT_SECRET defensively so
// the import is quiet and deterministic regardless of the runner's env.
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-sw-cache-spec';

let createTtlCache: <T>(ttlMs: number, now?: () => number) => {
    get(key: string, produce: () => Promise<T>): Promise<T>;
    peek(): { key: string; expiresAt: number } | null;
};

beforeAll(async () => {
    const mod = await import('../server.ts');
    createTtlCache = mod.createTtlCache;
});

describe('round2 /sw.js in-process TTL cache (DoS amplification fix)', () => {
    it('exports the real cache helper from server.ts (reverting the fix removes this)', () => {
        expect(typeof createTtlCache).toBe('function');
    });

    it('invokes the (DB-hitting) producer only ONCE for repeated hits within the TTL', async () => {
        let clock = 1_000;
        const cache = createTtlCache<string>(10_000, () => clock);

        const produce = vi.fn(async () => `sw-body-${clock}`);

        // First hit: cache miss -> producer runs (this is the only DB read).
        const a = await cache.get('sw', produce);
        // Many subsequent hits within the TTL window.
        clock = 2_000;
        const b = await cache.get('sw', produce);
        clock = 9_999; // still < 1_000 + 10_000
        const c = await cache.get('sw', produce);

        expect(produce).toHaveBeenCalledTimes(1);
        // Same cached bytes replayed — NOT re-rendered against the new clock.
        expect(a).toBe('sw-body-1000');
        expect(b).toBe('sw-body-1000');
        expect(c).toBe('sw-body-1000');
    });

    it('re-queries after the TTL expires so branding/version changes still propagate', async () => {
        let clock = 0;
        const cache = createTtlCache<string>(10_000, () => clock);
        const produce = vi.fn(async () => `sw-body-${clock}`);

        await cache.get('sw', produce); // miss at t=0, expires at t=10_000
        clock = 10_001;                 // past TTL
        const after = await cache.get('sw', produce);

        expect(produce).toHaveBeenCalledTimes(2);
        expect(after).toBe('sw-body-10001'); // fresh render reflects new state
    });

    it('re-queries when the version key changes (redeploy/version bump busts the cache)', async () => {
        const clock = 0;
        const cache = createTtlCache<string>(60_000, () => clock);
        const produce = vi.fn(async () => `sw-body-${clock}`);

        await cache.get('sw-v1', produce); // miss
        const refetched = await cache.get('sw-v2', produce); // different key -> miss again

        expect(produce).toHaveBeenCalledTimes(2);
        expect(refetched).toBe('sw-body-0');
    });

    it('collapses a concurrent burst of misses into a single producer call', async () => {
        const cache = createTtlCache<string>(10_000);
        let resolveProducer: (v: string) => void = () => {};
        const produce = vi.fn(() => new Promise<string>((resolve) => { resolveProducer = resolve; }));

        // Three /sw.js hits arrive before the first DB read resolves.
        const p1 = cache.get('sw', produce);
        const p2 = cache.get('sw', produce);
        const p3 = cache.get('sw', produce);

        resolveProducer('sw-body');
        const [r1, r2, r3] = await Promise.all([p1, p2, p3]);

        // Only ONE DB read for the whole burst.
        expect(produce).toHaveBeenCalledTimes(1);
        expect(r1).toBe('sw-body');
        expect(r2).toBe('sw-body');
        expect(r3).toBe('sw-body');
    });

    it('does not serve a stale entry from a different key even within its TTL', async () => {
        let clock = 0;
        const cache = createTtlCache<string>(60_000, () => clock);
        const produce = vi.fn(async (label: string) => label);

        await cache.get('a', () => produce('first'));
        clock = 100; // well within TTL
        const second = await cache.get('b', () => produce('second'));

        expect(second).toBe('second');
        expect(produce).toHaveBeenCalledTimes(2);
    });
});
