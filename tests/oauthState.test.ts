import { describe, it, expect } from 'vitest';
import { isValidOAuthState } from '../lib/oauthState';

// The OAuth callback CSRF decision must fail closed. This pins the extracted pure
// predicate so a SessionContext refactor cannot silently reintroduce the old
// fail-open `if (rawState)` gate.

describe('isValidOAuthState (M10 fail-closed OAuth CSRF)', () => {
    it('rejects a missing state (the session-fixation vector: /?code=ATTACKER with state stripped)', () => {
        expect(isValidOAuthState(null, 'nonce-123')).toBe(false);
        expect(isValidOAuthState(undefined, 'nonce-123')).toBe(false);
        expect(isValidOAuthState('', 'nonce-123')).toBe(false);
    });
    it('rejects when no nonce was stored', () => {
        expect(isValidOAuthState('login:nonce-123', null)).toBe(false);
        expect(isValidOAuthState('login:nonce-123', '')).toBe(false);
    });
    it('rejects a mismatched nonce', () => {
        expect(isValidOAuthState('login:WRONG', 'nonce-123')).toBe(false);
        expect(isValidOAuthState('admin_setup:key:WRONG', 'nonce-123')).toBe(false);
    });
    it('accepts a matching login nonce (last segment)', () => {
        expect(isValidOAuthState('login:nonce-123', 'nonce-123')).toBe(true);
    });
    it('accepts a matching admin_setup nonce regardless of the key segment', () => {
        expect(isValidOAuthState('admin_setup:CLAIMKEY:nonce-123', 'nonce-123')).toBe(true);
        expect(isValidOAuthState('admin_setup::nonce-123', 'nonce-123')).toBe(true);
    });
});
