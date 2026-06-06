import { describe, it, expect, vi, beforeEach } from 'vitest';

// auth:finalize_setup gained an offline "verify later" bypass for the first-run
// wizard. SECURITY contract pinned here:
//   - bypass is honored ONLY with a valid admin grant (first-admin context);
//     it creates the admin with rsi_verified=false and DOES NOT hit RSI.
//   - the verified path still calls verifyRsiHandle and sets rsi_verified=true.
//   - a member (no admin grant) CANNOT skip — verification is required.

const h = vi.hoisted(() => ({ createUserCalls: [] as any[], verifyRsiCalls: 0 }));

vi.mock('../lib/db', () => ({
    createUser: vi.fn(async (u: any) => { h.createUserCalls.push(u); return { id: 1, roleId: u.isAdmin ? 4 : 1, name: u.name }; }),
    supabase: { from: () => ({ select: () => ({ eq: () => ({ single: async () => ({ data: null, error: null }), maybeSingle: async () => ({ data: null, error: null }) }) }) }) },
    getSystemRoles: async () => ({ admin: { id: 4 } }),
    findUserByDiscordId: async () => null,
}));
vi.mock('../lib/discord', () => ({}));
vi.mock('../lib/radio', () => ({}));
vi.mock('../lib/auth', () => ({
    signToken: () => 'session-token',
    signAdminSetupGrant: (d: string) => `grant:${d}`,
    verifyAdminSetupGrant: (t: string) => (t === 'valid-grant' ? { discordId: 'd1' } : null),
    signIdentityGrant: () => 'valid-identity',
    verifyIdentityGrant: (t: string) => (t === 'valid-identity' ? { discordId: 'd1' } : null),
}));
vi.mock('../lib/rsi', () => ({ verifyRsiHandle: vi.fn(async () => { h.verifyRsiCalls++; return true; }) }));
vi.mock('../lib/db/userFilters', () => ({ stripSensitiveUserFields: (u: any) => u }));

import { authActions } from '../api/actions/auth';

const finalize = (authActions as Record<string, (p: any) => Promise<any>>)['auth:finalize_setup'];
const base = { discordId: 'd1', name: 'Cmdr', avatarUrl: 'a.png', rsiHandle: 'Cmdr_Handle', identityToken: 'valid-identity' };

beforeEach(() => { h.createUserCalls = []; h.verifyRsiCalls = 0; });

describe('auth:finalize_setup RSI bypass', () => {
    it('admin bypass: skips verifyRsiHandle and creates an UNVERIFIED admin', async () => {
        const user = await finalize({ ...base, adminSetupToken: 'valid-grant', skipVerification: true });
        expect(h.verifyRsiCalls).toBe(0);
        expect(h.createUserCalls).toHaveLength(1);
        expect(h.createUserCalls[0].isAdmin).toBe(true);
        expect(h.createUserCalls[0].rsiVerified).toBe(false);
        expect(user.token).toBe('session-token');
    });

    it('verified path: calls verifyRsiHandle and creates a VERIFIED user', async () => {
        await finalize({ ...base, adminSetupToken: 'valid-grant', verificationCode: 'MYRSI-XYZ' });
        expect(h.verifyRsiCalls).toBe(1);
        expect(h.createUserCalls[0].rsiVerified).toBe(true);
    });

    it('skip is REJECTED without a valid admin grant (members cannot bypass)', async () => {
        await expect(finalize({ ...base, skipVerification: true })).rejects.toThrow(/verification code/i);
        expect(h.createUserCalls).toHaveLength(0);
        expect(h.verifyRsiCalls).toBe(0);
    });

    it('requires an RSI handle', async () => {
        await expect(finalize({ ...base, rsiHandle: '', adminSetupToken: 'valid-grant', skipVerification: true })).rejects.toThrow(/RSI handle/i);
    });
});

describe('auth:finalize_setup identity binding', () => {
    it('rejects a missing identity grant', async () => {
        await expect(finalize({ ...base, identityToken: undefined, verificationCode: 'X' })).rejects.toThrow(/sign in with discord/i);
        expect(h.createUserCalls).toHaveLength(0);
    });

    it('rejects an identity grant minted for a different discord id (no account squatting)', async () => {
        await expect(finalize({ ...base, discordId: 'victim', verificationCode: 'X' })).rejects.toThrow(/sign in with discord/i);
        expect(h.createUserCalls).toHaveLength(0);
    });

    it('accepts a grant matching the submitted discord id', async () => {
        await finalize({ ...base, verificationCode: 'X' });
        expect(h.createUserCalls).toHaveLength(1);
        expect(h.createUserCalls[0].discordId).toBe('d1');
    });
});
