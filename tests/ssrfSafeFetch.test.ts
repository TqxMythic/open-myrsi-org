import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// The shared SSRF-safe outbound fetch. ssrfSafeFetch must: (a) reject hosts
// resolving to private/reserved IPs, (b) refuse to follow redirects (a hostile
// peer 302-ing a credentialed request to an internal/metadata target), and
// (c) pin the vetted IP into the connection (DNS-rebind defence).

const h = vi.hoisted(() => ({
    lookupResult: [] as Array<{ address: string; family: number }>,
    lookupThrows: false,
    fetchResponse: { status: 200 } as { status: number },
    fetchCalls: [] as Array<{ url: string; init: any }>,
}));

vi.mock('node:dns/promises', () => {
    const lookup = async () => { if (h.lookupThrows) throw new Error('ENOTFOUND'); return h.lookupResult; };
    return { lookup, default: { lookup } };
});
// Stub the undici Agent so construction (the IP-pinning dispatcher) is inert
// under the test environment; we only assert it is wired, not that it dials.
vi.mock('undici', () => ({ Agent: class { constructor(public opts: unknown) {} close() { return Promise.resolve(); } } }));

import { ssrfSafeFetch, assertResolvesToPublicHost } from '../lib/ssrf';

beforeEach(() => {
    h.lookupResult = [{ address: '93.184.216.34', family: 4 }]; // public by default
    h.lookupThrows = false;
    h.fetchResponse = { status: 200 };
    h.fetchCalls = [];
    vi.stubGlobal('fetch', async (url: string, init: any) => { h.fetchCalls.push({ url, init }); return h.fetchResponse; });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('ssrfSafeFetch', () => {
    it('rejects a host resolving to a private/reserved IP (never fetches)', async () => {
        h.lookupResult = [{ address: '10.0.0.5', family: 4 }];
        await expect(ssrfSafeFetch('https://internal.evil.example/x')).rejects.toThrow(/private|reserved/i);
        expect(h.fetchCalls).toHaveLength(0);
    });

    it('rejects the link-local cloud-metadata address', async () => {
        h.lookupResult = [{ address: '169.254.169.254', family: 4 }];
        await expect(ssrfSafeFetch('https://rebind.evil.example/x')).rejects.toThrow(/private|reserved/i);
        expect(h.fetchCalls).toHaveLength(0);
    });

    it('refuses to follow a 3xx redirect (credential-exfil guard)', async () => {
        h.fetchResponse = { status: 302 };
        await expect(ssrfSafeFetch('https://peer.example/api/alliance/op-manifest')).rejects.toThrow(/redirect/i);
    });

    it('sets redirect:manual and pins the vetted IP via a dispatcher', async () => {
        h.fetchResponse = { status: 200 };
        const res = await ssrfSafeFetch('https://peer.example/api/alliance/profile', { headers: { 'x-api-key': 'k' } });
        expect((res as { status: number }).status).toBe(200);
        expect(h.fetchCalls).toHaveLength(1);
        expect(h.fetchCalls[0].init.redirect).toBe('manual');
        expect(h.fetchCalls[0].init.dispatcher).toBeDefined();
        expect(h.fetchCalls[0].init.headers['x-api-key']).toBe('k');
    });

    it('rejects a host resolving to a private IPv6 address (loopback)', async () => {
        h.lookupResult = [{ address: '::1', family: 6 }];
        await expect(ssrfSafeFetch('https://v6.evil.example/x')).rejects.toThrow(/private|reserved/i);
        expect(h.fetchCalls).toHaveLength(0);
    });

    it('pins the EXACT vetted address into the connection (M5 DNS-rebind)', async () => {
        h.lookupResult = [{ address: '93.184.216.34', family: 4 }];
        await ssrfSafeFetch('https://peer.example/x');
        const dispatcher = h.fetchCalls[0].init.dispatcher as { opts: { connect: { lookup: (...a: unknown[]) => void } } };
        expect(dispatcher).toBeDefined();
        // The undici Agent's connect.lookup must yield ONLY the pre-vetted IP,
        // not re-resolve DNS — assert the value, not just that a dispatcher exists.
        let allResult: unknown;
        dispatcher.opts.connect.lookup('peer.example', { all: true }, (_e: unknown, addrs: unknown) => { allResult = addrs; });
        expect(allResult).toEqual([{ address: '93.184.216.34', family: 4 }]);
        let legacyAddr: unknown; let legacyFam: unknown;
        dispatcher.opts.connect.lookup('peer.example', {}, (_e: unknown, addr: unknown, fam: unknown) => { legacyAddr = addr; legacyFam = fam; });
        expect(legacyAddr).toBe('93.184.216.34');
        expect(legacyFam).toBe(4);
    });

    it('throws when the host does not resolve', async () => {
        h.lookupThrows = true;
        await expect(ssrfSafeFetch('https://nope.example/x')).rejects.toThrow(/resolve/i);
        expect(h.fetchCalls).toHaveLength(0);
    });

    it('assertResolvesToPublicHost returns the vetted addresses (for pinning)', async () => {
        h.lookupResult = [{ address: '93.184.216.34', family: 4 }];
        const addrs = await assertResolvesToPublicHost('https://peer.example/');
        expect(addrs).toEqual([{ address: '93.184.216.34', family: 4 }]);
    });
});
