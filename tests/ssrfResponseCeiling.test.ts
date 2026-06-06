import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ssrfSafeFetch() returns a raw Response and consumers do an unbounded
// res.json()/res.text(), so a hostile peer streaming GBs could OOM us (several
// callers run unattended on cron). A central response-byte ceiling
// (maxResponseSize) is wired onto the IP-pinning undici Agent so the body is
// aborted and errored rather than buffered unbounded.
//
// The undici Agent is stubbed to capture its constructor opts; fetch is stubbed
// global.

const h = vi.hoisted(() => ({
    lookupResult: [] as Array<{ address: string; family: number }>,
    fetchResponse: { status: 200 } as { status: number },
    fetchCalls: [] as Array<{ url: string; init: any }>,
}));

vi.mock('node:dns/promises', () => {
    const lookup = async () => h.lookupResult;
    return { lookup, default: { lookup } };
});
// Stub the undici Agent so construction is inert under the test environment;
// we capture and assert the options it was constructed with.
vi.mock('undici', () => ({ Agent: class { constructor(public opts: any) {} close() { return Promise.resolve(); } } }));

import { ssrfSafeFetch, MAX_OUTBOUND_RESPONSE_BYTES } from '../lib/ssrf';

beforeEach(() => {
    h.lookupResult = [{ address: '93.184.216.34', family: 4 }]; // public
    h.fetchResponse = { status: 200 };
    h.fetchCalls = [];
    vi.stubGlobal('fetch', async (url: string, init: any) => { h.fetchCalls.push({ url, init }); return h.fetchResponse; });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe('ssrfSafeFetch response-byte ceiling (ssrf#1)', () => {
    it('exposes a positive, bounded outbound response ceiling constant', () => {
        // Generous (same order of magnitude as the intel-feed 8 MB cap) but a
        // hard, finite bound — never disabled (undici treats -1 as disabled).
        expect(typeof MAX_OUTBOUND_RESPONSE_BYTES).toBe('number');
        expect(MAX_OUTBOUND_RESPONSE_BYTES).toBeGreaterThan(0);
        expect(Number.isFinite(MAX_OUTBOUND_RESPONSE_BYTES)).toBe(true);
        // Comfortably above the 1 MB inbound-snapshot cap, near the 8 MB feed cap.
        expect(MAX_OUTBOUND_RESPONSE_BYTES).toBeGreaterThanOrEqual(1 * 1024 * 1024);
    });

    it('wires maxResponseSize = the ceiling into the pinning undici Agent', async () => {
        await ssrfSafeFetch('https://peer.example/api/alliance/profile', { headers: { 'x-api-key': 'k' } });
        expect(h.fetchCalls).toHaveLength(1);
        const dispatcher = h.fetchCalls[0].init.dispatcher as { opts: { maxResponseSize?: number } };
        expect(dispatcher).toBeDefined();
        // The Agent carries the ceiling so undici aborts an over-ceiling body
        // instead of buffering it unbounded.
        expect(dispatcher.opts.maxResponseSize).toBe(MAX_OUTBOUND_RESPONSE_BYTES);
        // Not disabled (-1) and not absent.
        expect(dispatcher.opts.maxResponseSize).not.toBe(-1);
        expect(dispatcher.opts.maxResponseSize).toBeGreaterThan(0);
    });

    it('preserves the redirect:manual + IP-pinning behaviour alongside the ceiling', async () => {
        await ssrfSafeFetch('https://peer.example/x');
        const init = h.fetchCalls[0].init;
        expect(init.redirect).toBe('manual');
        const dispatcher = init.dispatcher as { opts: { maxResponseSize?: number; connect: { lookup: (...a: unknown[]) => void } } };
        expect(dispatcher.opts.maxResponseSize).toBe(MAX_OUTBOUND_RESPONSE_BYTES);
        // IP pin still yields ONLY the pre-vetted address (no DNS re-resolution).
        let allResult: unknown;
        dispatcher.opts.connect.lookup('peer.example', { all: true }, (_e: unknown, addrs: unknown) => { allResult = addrs; });
        expect(allResult).toEqual([{ address: '93.184.216.34', family: 4 }]);
    });
});
