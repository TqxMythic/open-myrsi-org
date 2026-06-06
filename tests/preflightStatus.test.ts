import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// getPreflightStatus backs the pre-auth onboarding preflight (system:preflight,
// a PUBLIC action). It must return BOOLEANS ONLY — never env values or
// secrets. This pins the boolean-only contract + the derived flags.

const h = vi.hoisted(() => ({ settingsRows: [] as Array<{ key: string; value: unknown }>, adminCount: 0 }));

vi.mock('../lib/db/common', () => {
    const chain: any = {
        select: () => chain,
        eq: () => chain,
        // settings query: .select('key, value').in([...]) → { data }
        in: () => Promise.resolve({ data: h.settingsRows, error: null }),
        // admin-count query: .select('id', {count}).eq().is() → { count }
        is: () => Promise.resolve({ count: h.adminCount, error: null }),
        maybeSingle: () => Promise.resolve({ data: null, error: null }),
    };
    return {
        supabase: { from: () => chain },
        handleSupabaseError: () => {},
        getSystemRoles: async () => ({ admin: { id: 4, name: 'Admin' } }),
        broadcastToOrg: () => {}, broadcastToChannel: () => {}, safeFetch: async () => [],
    };
});
vi.mock('../lib/push', () => ({ sendPushToAll: () => {} }));

import { getPreflightStatus } from '../lib/db/system';

const ENV_KEYS = ['SUPABASE_JWT_SECRET', 'SECRETS_ENCRYPTION_KEY', 'JWT_SECRET', 'DISCORD_CLIENT_ID'];
let savedEnv: Record<string, string | undefined>;

// A high-entropy, >=32-char value the strength floor accepts.
const STRONG = (marker: string) => `${marker}-${'x'.repeat(40)}`;

beforeEach(() => {
    savedEnv = {};
    for (const k of ENV_KEYS) { savedEnv[k] = process.env[k]; delete process.env[k]; }
    h.settingsRows = [];
    h.adminCount = 0;
});
afterEach(() => {
    for (const k of ENV_KEYS) { if (savedEnv[k] === undefined) delete process.env[k]; else process.env[k] = savedEnv[k]; }
});

describe('getPreflightStatus', () => {
    it('returns ONLY booleans (no value leakage)', async () => {
        h.settingsRows = [{ key: 'discordConfig', value: { clientId: 'super-secret-client-id' } }];
        process.env.SUPABASE_JWT_SECRET = STRONG('jwt-realtime-secret');
        process.env.SECRETS_ENCRYPTION_KEY = STRONG('enc-at-rest-key');
        process.env.JWT_SECRET = STRONG('session-signing-key');
        const status = await getPreflightStatus();
        for (const [k, v] of Object.entries(status)) {
            expect(typeof v, `key ${k} must be boolean`).toBe('boolean');
        }
        // Defence-in-depth: no secret value is serialised into the payload.
        const serialized = JSON.stringify(status);
        expect(serialized).not.toContain('super-secret-client-id');
        expect(serialized).not.toContain('jwt-realtime-secret');
        expect(serialized).not.toContain('enc-at-rest-key');
        expect(serialized).not.toContain('session-signing-key');
    });

    it('reports configured state from env + settings (strong secrets)', async () => {
        h.settingsRows = [
            { key: 'discordConfig', value: { clientId: 'abc' } },
            { key: 'setup_completed', value: true },
            { key: 'admin_setup_code', value: { code: 'SETUP-DEADBEEF' } },
        ];
        h.adminCount = 1;
        process.env.SUPABASE_JWT_SECRET = STRONG('jwt');
        process.env.SECRETS_ENCRYPTION_KEY = STRONG('enc');
        process.env.JWT_SECRET = STRONG('session');
        const status = await getPreflightStatus();
        expect(status.dbConnected).toBe(true);
        expect(status.adminExists).toBe(true);
        expect(status.discordConfigured).toBe(true);
        expect(status.realtimeEnabled).toBe(true);
        expect(status.secretsEncrypted).toBe(true);
        expect(status.sessionSecretStrong).toBe(true);
        expect(status.setupCompleted).toBe(true);
        expect(status.setupCodeExists).toBe(true);
    });

    it('rejects secrets below the 32-char entropy floor (present but weak → false)', async () => {
        h.settingsRows = [];
        h.adminCount = 0;
        // 31 chars each — present, but one short of the floor.
        process.env.SUPABASE_JWT_SECRET = 'a'.repeat(31);
        process.env.SECRETS_ENCRYPTION_KEY = 'b'.repeat(31);
        process.env.JWT_SECRET = 'c'.repeat(31);
        const status = await getPreflightStatus();
        expect(status.realtimeEnabled).toBe(false);
        expect(status.secretsEncrypted).toBe(false);
        expect(status.sessionSecretStrong).toBe(false);
    });

    it('accepts secrets at exactly the 32-char floor (boundary, inclusive)', async () => {
        process.env.SUPABASE_JWT_SECRET = 'a'.repeat(32);
        process.env.SECRETS_ENCRYPTION_KEY = 'b'.repeat(32);
        process.env.JWT_SECRET = 'c'.repeat(32);
        const status = await getPreflightStatus();
        expect(status.realtimeEnabled).toBe(true);
        expect(status.secretsEncrypted).toBe(true);
        expect(status.sessionSecretStrong).toBe(true);
    });

    it('flags missing critical config (no Discord, no admin, no secrets)', async () => {
        h.settingsRows = []; // no discordConfig
        h.adminCount = 0;
        const status = await getPreflightStatus();
        expect(status.discordConfigured).toBe(false);
        expect(status.adminExists).toBe(false);
        expect(status.realtimeEnabled).toBe(false);
        expect(status.secretsEncrypted).toBe(false);
        expect(status.sessionSecretStrong).toBe(false);
        expect(status.setupCompleted).toBe(false);
        expect(status.setupCodeExists).toBe(false);
        // dbConnected is true because the settings query resolved without error.
        expect(status.dbConnected).toBe(true);
    });
});
