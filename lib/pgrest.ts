// Helpers for building PostgREST filter strings safely.
//
// Supabase's client parameterizes .eq/.ilike/.in/etc. automatically, but .or()
// and .filter() take a raw filter STRING. Any untrusted value interpolated
// into that string can break out of its intended condition and inject
// additional filter terms. These helpers assert that an ID value is the
// expected shape before it's stringified into a filter.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Sanitize a user-supplied search term before it is interpolated into a
 * PostgREST `.or()`/`.filter()` grammar string. Escaping only the LIKE
 * metacharacters (`%_\`) is NOT enough — `.or()` also parses commas, parens and
 * dots as structure, so an under-escaped term can inject sibling OR conditions.
 * Strip to an allow-list (alphanumerics, space, underscore, hyphen) and cap
 * length. Returns '' for non-strings/empties so callers can skip the filter.
 */
export function safeSearchTerm(raw: unknown, maxLen = 100): string {
    if (typeof raw !== 'string') return '';
    return raw.replace(/[^a-zA-Z0-9 _-]/g, '').trim().slice(0, maxLen);
}

/** Return a UUID if it matches the canonical shape, otherwise throw. */
export function requireUuid(value: unknown, field = 'id'): string {
    if (typeof value !== 'string' || !UUID_RE.test(value)) {
        throw new Error(`Invalid ${field}: not a UUID`);
    }
    return value;
}

/**
 * Return a positive-integer ID as a string if it's a safe integer, otherwise
 * throw. Rejects floats, NaN, Infinity, negatives, and numeric strings that
 * contain non-digit characters.
 */
export function requireIntId(value: unknown, field = 'id'): string {
    if (typeof value === 'number') {
        if (!Number.isInteger(value) || value < 0 || value > Number.MAX_SAFE_INTEGER) {
            throw new Error(`Invalid ${field}: not a non-negative safe integer`);
        }
        return String(value);
    }
    if (typeof value === 'string' && /^\d+$/.test(value)) {
        return value;
    }
    throw new Error(`Invalid ${field}: not an integer`);
}

/**
 * Assert an unknown value is a bounded array of primitive IDs. Throws on
 * non-array, empty, oversized, or non-primitive elements. Used at the top of
 * bulk admin handlers to prevent a malicious or buggy client from submitting
 * an unbounded id array and pinning the worker.
 */
export function assertIdArray(
    value: unknown,
    max: number,
    field = 'ids',
): (string | number)[] {
    if (!Array.isArray(value)) {
        throw new Error(`Invalid ${field}: not an array`);
    }
    if (value.length === 0) {
        throw new Error(`Invalid ${field}: empty array`);
    }
    if (value.length > max) {
        throw new Error(`Invalid ${field}: array too large (max ${max})`);
    }
    for (const v of value) {
        if (typeof v !== 'string' && typeof v !== 'number') {
            throw new Error(`Invalid ${field}: elements must be string or number`);
        }
    }
    return value as (string | number)[];
}
