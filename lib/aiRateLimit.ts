// Per-USER throttle for the paid-LLM (Gemini) actions — intel:generate_summary,
// operation:generate_aar_summary, warrant:generate_report.
//
// These actions forward to the org's metered Gemini key. Gated only by a domain
// permission (default Member for some), they ride only the global 100/min/IP
// limiter — so a single member could loop them to run up the admin's AI bill
// and exhaust the quota for everyone. This adds a per-user minute + daily cap,
// keyed on the authenticated user id (server-derived, unspoofable), independent
// of the IP limiter.
//
// In-memory, single-instance — same caveat as authRateLimit.ts: move to a
// shared store if the server is ever replicated.

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;
const PER_MINUTE = 5;
const PER_DAY = 50;
const MAX_BUCKETS = 10_000;

interface Bucket {
    minuteCount: number;
    minuteStart: number;
    dayCount: number;
    dayStart: number;
}

const buckets = new Map<string, Bucket>();

export interface AiRateLimitResult {
    ok: boolean;
    /** Seconds until the relevant window resets. 0 when ok. */
    retryAfter: number;
    /** Which window tripped, for the error message. */
    scope?: 'minute' | 'day';
}

/**
 * Record an AI-action attempt for `userId` and decide if it may proceed.
 * Fails open for a missing user id (the actions are permission-gated, so an
 * unauthenticated caller never reaches them anyway). `now` is injectable for
 * tests.
 */
export function checkAiRateLimit(userId: number | string | undefined | null, now: number = Date.now()): AiRateLimitResult {
    if (userId === undefined || userId === null || userId === '') return { ok: true, retryAfter: 0 };
    const key = String(userId);

    let b = buckets.get(key);
    if (!b) {
        if (buckets.size >= MAX_BUCKETS) return { ok: true, retryAfter: 0 }; // shed under spray; IP limiter still caps
        b = { minuteCount: 0, minuteStart: now, dayCount: 0, dayStart: now };
        buckets.set(key, b);
    }
    if (now - b.minuteStart >= MINUTE_MS) { b.minuteCount = 0; b.minuteStart = now; }
    if (now - b.dayStart >= DAY_MS) { b.dayCount = 0; b.dayStart = now; }

    if (b.dayCount >= PER_DAY) {
        return { ok: false, retryAfter: Math.max(1, Math.ceil((b.dayStart + DAY_MS - now) / 1000)), scope: 'day' };
    }
    if (b.minuteCount >= PER_MINUTE) {
        return { ok: false, retryAfter: Math.max(1, Math.ceil((b.minuteStart + MINUTE_MS - now) / 1000)), scope: 'minute' };
    }
    b.minuteCount += 1;
    b.dayCount += 1;
    return { ok: true, retryAfter: 0 };
}

/** Throwing convenience wrapper used by the AI action handlers. */
export function assertAiRateLimit(userId: number | string | undefined | null, now: number = Date.now()): void {
    const r = checkAiRateLimit(userId, now);
    if (!r.ok) {
        const err = new Error(`AI request limit reached (per ${r.scope}). Try again in ${r.retryAfter}s.`) as Error & { code?: string };
        err.code = 'AI_RATE_LIMITED';
        throw err;
    }
}

/** Periodic cleanup of fully-expired buckets. Returns the number removed. */
export function pruneAiRateLimitBuckets(now: number = Date.now()): number {
    let removed = 0;
    for (const [k, b] of buckets.entries()) {
        if (now - b.dayStart >= DAY_MS && now - b.minuteStart >= MINUTE_MS) {
            buckets.delete(k);
            removed++;
        }
    }
    return removed;
}

/** Test-only: clear all bucket state. */
export function _resetAiRateLimit(): void {
    buckets.clear();
}
