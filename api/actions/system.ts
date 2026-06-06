
import * as db from '../../lib/db.js';
import type { PlatformLocationKind } from '../../types.js';

interface SearchLocationsPayload {
    query?: string | number;
    kind?: PlatformLocationKind;
    starSystemId?: number | string;
    limit?: number;
}

interface CreateApiKeyPayload {
    label: string;
}

interface DeleteApiKeyPayload {
    keyId: string;
}

interface BroadcastPayload {
    message: string;
}

export const systemActions = {
    'system:get_push_config': async () => ({ publicKey: process.env.VAPID_PUBLIC_KEY }),
    'system:get_clearances': () => db.getSecurityClearances(),
    'system:get_markers': () => db.getLimitingMarkers(),
    // 'system:global_search' removed — it called a non-existent Postgres RPC
    // (global_search), had no client caller (the search UI uses intel:search),
    // and was gated only by 'user:manage:self'. A dead action behind a
    // near-public gate is a latent hole if the RPC is ever added.

    // Tenant-readable platform location search — backs the location autocomplete
    // on the service request modals. Returns reference data (UEX-sourced), so
    // any authenticated user can call it; gated as 'user:manage:self' in
    // services.ts.
    'system:search_locations': ({ query, kind, starSystemId, limit }: SearchLocationsPayload) =>
        db.searchPlatformLocations({
            query: String(query || ''),
            kind: kind || undefined,
            starSystemId: starSystemId ? Number(starSystemId) : undefined,
            limit: typeof limit === 'number' ? limit : undefined,
        }),

    // --- API KEYS ---
    'api:create_key': ({ label }: CreateApiKeyPayload) => db.createApiKey(label),
    'api:delete_key': ({ keyId }: DeleteApiKeyPayload) => db.deleteApiKey(keyId),
    'api:list_keys': () => db.listApiKeys(),

    // --- BROADCASTS ---
    'broadcast:eam': ({ message }: BroadcastPayload) => db.broadcastEAM(message),
    'broadcast:alert': ({ message }: BroadcastPayload) => db.broadcastSystemAlert(message),
    // Gated EAM-body fetch (the realtime eam_broadcast carries a timestamp
    // trigger only). Map entry is 'user:manage:self' (any authenticated) and
    // the handler enforces the SAME audience the client UI applies: staff
    // (any non-Client role) or the user:receive:eam permission.
    'broadcast:get_active_eam': ({ user }: { user?: { role?: string; permissions?: string[] } }) => {
        const isStaff = !!user && user.role !== 'Client';
        const canReceive = isStaff || (Array.isArray(user?.permissions) && user!.permissions!.includes('user:receive:eam'));
        if (!canReceive) throw new Error('Forbidden: EAM access requires staff role or user:receive:eam.');
        return db.getActiveEam();
    },

    // --- FIRST-RUN SETUP ---
    // Pre-auth preflight: booleans ONLY (never values). Public (PUBLIC_ACTIONS) so
    // the onboarding wizard can show env/config status + tips before login.
    'system:preflight': () => db.getPreflightStatus(),
    // Mark first-run onboarding complete (final wizard screen dismissed). Gated to
    // an admin perm in services.ts — the freshly-created admin calls it.
    'system:complete_setup': () => db.setSetupCompleted(),
};
