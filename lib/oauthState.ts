// Fail-closed decision for the Discord OAuth callback CSRF nonce check.
// Extracted as a pure, isolated function so it is unit-testable and a future
// SessionContext refactor cannot silently reintroduce a fail-open
// `if (rawState) { ...check... }` gate (which would let an attacker strip
// `state` and complete a login-CSRF / session-fixation against a victim).
//
// A legitimate login always carries `state` = `login:<nonce>` (or
// `admin_setup:<key>:<nonce>`); the unguessable nonce (crypto.randomUUID,
// stored in sessionStorage before redirect) is the LAST `:`-segment. The code
// may only be exchanged when that nonce is present and matches what we stored.

/**
 * True only if the OAuth callback `state` carries a nonce that matches the
 * one stored before redirect. Returns false (→ abort, do NOT exchange the
 * code) when state is absent, the stored nonce is missing, or they mismatch.
 */
export function isValidOAuthState(rawState: string | null | undefined, storedNonce: string | null | undefined): boolean {
    if (!rawState || !storedNonce) return false;
    const receivedNonce = rawState.split(':').pop();
    return !!receivedNonce && receivedNonce === storedNonce;
}
