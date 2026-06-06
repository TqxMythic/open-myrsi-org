import { describe, it, expect, beforeEach } from 'vitest';

// The per-user radio limiter. The radio token-minting + status actions proxy to
// the metered LiveKit API and are reachable by any authenticated user, so they
// are throttled per-user to stop a single member looping them to run up the org's
// LiveKit bill. This file exercises the real limiter logic (no mocks); the
// handler-wiring half is in tests/radioHandlerThrottle.test.ts.

import {
    checkRadioRateLimit,
    assertRadioRateLimit,
    pruneRadioRateLimitBuckets,
    _resetRadioRateLimit,
} from '../lib/radio';

const t0 = 1_700_000_000_000; // arbitrary fixed epoch ms
const PER_MINUTE = 20; // must mirror RADIO_PER_MINUTE in lib/radio.ts
const PER_DAY = 500;   // must mirror RADIO_PER_DAY in lib/radio.ts

describe('radio per-user rate limit (ratelimit#2)', () => {
    beforeEach(() => {
        _resetRadioRateLimit();
    });

    it('allows the first PER_MINUTE requests by one user in a 60s window', () => {
        for (let i = 0; i < PER_MINUTE; i++) {
            const r = checkRadioRateLimit(42, t0 + i * 100);
            expect(r.ok, `request ${i + 1} should pass`).toBe(true);
            expect(r.retryAfter).toBe(0);
        }
    });

    it('rejects the (PER_MINUTE+1)th request by the same user with a non-zero retryAfter', () => {
        for (let i = 0; i < PER_MINUTE; i++) checkRadioRateLimit(42, t0 + i * 100);
        const r = checkRadioRateLimit(42, t0 + PER_MINUTE * 100);
        expect(r.ok).toBe(false);
        expect(r.retryAfter).toBeGreaterThan(0);
        expect(r.retryAfter).toBeLessThanOrEqual(60);
        expect(r.scope).toBe('minute');
    });

    it('does NOT affect a different user — buckets are keyed per-user id', () => {
        // User 42 burns through the whole minute window.
        for (let i = 0; i < PER_MINUTE + 5; i++) checkRadioRateLimit(42, t0 + i * 100);
        expect(checkRadioRateLimit(42, t0 + (PER_MINUTE + 6) * 100).ok).toBe(false);

        // User 99 is unaffected and can still mint tokens.
        for (let i = 0; i < PER_MINUTE; i++) {
            expect(checkRadioRateLimit(99, t0 + i * 100).ok, `user 99 request ${i + 1}`).toBe(true);
        }
    });

    it('resets the minute window after 60s elapse', () => {
        for (let i = 0; i < PER_MINUTE; i++) checkRadioRateLimit(7, t0 + i * 100);
        expect(checkRadioRateLimit(7, t0 + PER_MINUTE * 100).ok).toBe(false);
        // Advance past the 60s minute window.
        const r = checkRadioRateLimit(7, t0 + 61_000);
        expect(r.ok).toBe(true);
    });

    it('enforces a per-day cap independent of the minute window', () => {
        let now = t0;
        let allowed = 0;
        // Walk well past the daily cap, advancing > a minute each call so the
        // minute window never trips — only the day cap can stop us.
        for (let i = 0; i < PER_DAY + 10; i++) {
            const r = checkRadioRateLimit(5, now);
            if (r.ok) allowed++;
            else {
                expect(r.scope).toBe('day');
                break;
            }
            now += 61_000; // > 60s so minute bucket resets every call
        }
        expect(allowed).toBe(PER_DAY);
    });

    it('fails open for a missing user id (never blocks an id-less caller)', () => {
        expect(checkRadioRateLimit(undefined).ok).toBe(true);
        expect(checkRadioRateLimit(null).ok).toBe(true);
        expect(checkRadioRateLimit('').ok).toBe(true);
    });

    it('assertRadioRateLimit throws a coded error once the cap is exceeded', () => {
        for (let i = 0; i < PER_MINUTE; i++) assertRadioRateLimit(11, t0 + i * 100);
        try {
            assertRadioRateLimit(11, t0 + PER_MINUTE * 100);
            throw new Error('expected assertRadioRateLimit to throw');
        } catch (e) {
            const err = e as Error & { code?: string };
            expect(err.code).toBe('RADIO_RATE_LIMITED');
            expect(err.message).toMatch(/Radio request limit reached/i);
        }
    });

    it('prunes fully-expired buckets', () => {
        checkRadioRateLimit(1, t0);
        const removed = pruneRadioRateLimitBuckets(t0 + 2 * 86_400_000);
        expect(removed).toBe(1);
    });
});
