
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { getOrgSecret } from './secrets.js';
import { supabase } from './db/common.js';
import { assertOpVisibleToUser } from './db/ops.js';
import { log as baseLog } from './log.js';

const log = baseLog.child({ module: 'lib.radio' });

// The radio token-minting + status actions proxy to the external LiveKit API (a
// metered service) and are reachable by any authenticated user (user:manage:self).
// Without a per-user throttle a single member could loop radio:auth /
// radio:op_auth / radio:status to run up the org's LiveKit bill — a cost-DoS. This
// adds a per-user minute + daily cap keyed on the authenticated (server-derived,
// unspoofable) user id, independent of the global per-IP limiter.
//
// In-memory, single-instance — same caveat as authRateLimit.ts / aiRateLimit.ts:
// move to a shared store if the server is ever replicated.

const RADIO_MINUTE_MS = 60_000;
const RADIO_DAY_MS = 86_400_000;
const RADIO_PER_MINUTE = 20;
const RADIO_PER_DAY = 500;
const RADIO_MAX_BUCKETS = 10_000;

interface RadioRateBucket {
    minuteCount: number;
    minuteStart: number;
    dayCount: number;
    dayStart: number;
}

const radioBuckets = new Map<string, RadioRateBucket>();

export interface RadioRateLimitResult {
    ok: boolean;
    /** Seconds until the relevant window resets. 0 when ok. */
    retryAfter: number;
    /** Which window tripped, for the error message. */
    scope?: 'minute' | 'day';
}

/**
 * Record a radio-action attempt for `userId` and decide if it may proceed.
 * Fails open for a missing user id (the actions are reached only after the
 * dispatcher injects the authenticated user, so a real caller always has one).
 * `now` is injectable for tests.
 */
export function checkRadioRateLimit(userId: number | string | undefined | null, now: number = Date.now()): RadioRateLimitResult {
    if (userId === undefined || userId === null || userId === '') return { ok: true, retryAfter: 0 };
    const key = String(userId);

    let b = radioBuckets.get(key);
    if (!b) {
        if (radioBuckets.size >= RADIO_MAX_BUCKETS) return { ok: true, retryAfter: 0 }; // shed under spray; IP limiter still caps
        b = { minuteCount: 0, minuteStart: now, dayCount: 0, dayStart: now };
        radioBuckets.set(key, b);
    }
    if (now - b.minuteStart >= RADIO_MINUTE_MS) { b.minuteCount = 0; b.minuteStart = now; }
    if (now - b.dayStart >= RADIO_DAY_MS) { b.dayCount = 0; b.dayStart = now; }

    if (b.dayCount >= RADIO_PER_DAY) {
        return { ok: false, retryAfter: Math.max(1, Math.ceil((b.dayStart + RADIO_DAY_MS - now) / 1000)), scope: 'day' };
    }
    if (b.minuteCount >= RADIO_PER_MINUTE) {
        return { ok: false, retryAfter: Math.max(1, Math.ceil((b.minuteStart + RADIO_MINUTE_MS - now) / 1000)), scope: 'minute' };
    }
    b.minuteCount += 1;
    b.dayCount += 1;
    return { ok: true, retryAfter: 0 };
}

/** Throwing convenience wrapper used by the radio action handlers. */
export function assertRadioRateLimit(userId: number | string | undefined | null, now: number = Date.now()): void {
    const r = checkRadioRateLimit(userId, now);
    if (!r.ok) {
        const err = new Error(`Radio request limit reached (per ${r.scope}). Try again in ${r.retryAfter}s.`) as Error & { code?: string };
        err.code = 'RADIO_RATE_LIMITED';
        throw err;
    }
}

/** Periodic cleanup of fully-expired buckets. Returns the number removed. */
export function pruneRadioRateLimitBuckets(now: number = Date.now()): number {
    let removed = 0;
    for (const [k, b] of radioBuckets.entries()) {
        if (now - b.dayStart >= RADIO_DAY_MS && now - b.minuteStart >= RADIO_MINUTE_MS) {
            radioBuckets.delete(k);
            removed++;
        }
    }
    return removed;
}

/** Test-only: clear all bucket state. */
export function _resetRadioRateLimit(): void {
    radioBuckets.clear();
}

// Authenticated actor passed in by the dispatcher. The radio actions are
// reachable by any authenticated user (user:manage:self), so the LiveKit grant
// must be authorized here against the actor's identity — the client-supplied
// room name / participant name are not trusted.
export interface RadioUser {
    id: number | string;
    name?: string;
    role?: string;
    permissions?: string[];
    clearanceLevel?: { level?: number } | null;
    // Compartment markers participate in op-voice authorization — the dispatcher
    // injects the full authenticated user, so these are present at runtime and
    // consumed by assertOpVisibleToUser.
    limitingMarkers?: unknown[];
}

export async function generateRadioToken(user: RadioUser, room: string) {
    // The requested room must be a CONFIGURED radio channel (`radio-<channelId>`),
    // not an arbitrary string. Without this a member could request
    // `op-radio-<id>` or any room name and receive a join grant for it.
    const match = /^radio-(.+)$/.exec(String(room || ''));
    if (!match) throw new Error('Invalid radio channel');
    const channelId = match[1];
    const { data: channel } = await supabase.from('radio_channels').select('id').eq('id', channelId).maybeSingle();
    if (!channel) throw new Error('Unknown radio channel');

    const apiKey = await getOrgSecret('LIVEKIT_API_KEY');
    const apiSecret = await getOrgSecret('LIVEKIT_API_SECRET');
    const wsUrl = await getOrgSecret('LIVEKIT_URL');

    if (!apiKey || !apiSecret || !wsUrl) throw new Error("Radio configuration missing");

    // Best-effort: set auto-cleanup timeouts on the room. LiveKit auto-creates rooms
    // on first join, so this failing should not block token generation.
    try {
        const svc = new RoomServiceClient(wsUrl, apiKey, apiSecret);
        await svc.createRoom({
            name: room,
            emptyTimeout: 300,      // Close room 5 min after last participant leaves
            departureTimeout: 30,   // 30s grace period for reconnects
        });
    } catch (e) {
        log.warn('room pre-create failed', { room, err: e });
    }

    const at = new AccessToken(apiKey, apiSecret, {
        // Identity + display name are taken from the AUTHENTICATED user, never the
        // client payload — prevents impersonating another member in the room.
        identity: String(user.id),
        name: user.name || String(user.id),
        ttl: '6h', // Auto-expire sessions after 6 hours to prevent indefinite connections
    });
    at.addGrant({ roomJoin: true, room: room });

    return { token: await at.toJwt(), url: wsUrl };
}

// Participant identities + names of every active room — incl. private per-op
// comms — must not be handed to every authenticated member. `includeParticipants`
// is set only for callers holding radio:manage; everyone else receives room names
// + counts (presence) but no identities.
export async function getRadioStatus(opts?: { includeParticipants?: boolean }) {
    const includeParticipants = !!opts?.includeParticipants;
    const apiKey = await getOrgSecret('LIVEKIT_API_KEY');
    const apiSecret = await getOrgSecret('LIVEKIT_API_SECRET');
    const wsUrl = await getOrgSecret('LIVEKIT_URL');

    if (!apiKey || !apiSecret || !wsUrl) return { activeChannels: [] };

    const svc = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    const rooms = await svc.listRooms();

    const activeChannels = await Promise.all(rooms.map(async room => {
        // Skip the extra API call for empty rooms, or whenever the caller is not
        // permitted to see participant identities.
        if (!room.numParticipants || !includeParticipants) {
            return {
                roomName: room.name,
                participantCount: room.numParticipants || 0,
                participants: [],
                participantNames: []
            };
        }

        let participants: any[] = [];
        try {
            participants = await svc.listParticipants(room.name);
        } catch (e: any) {
            // Room might have closed between listRooms and listParticipants
            if (e.code === 404 || e.message?.includes('not found')) {
                // Silent ignore, room is gone
            } else {
                log.warn('list participants failed', { room: room.name, err: e });
            }
        }

        return {
            roomName: room.name,
            participantCount: room.numParticipants,
            participants: participants.map(p => p.identity),
            participantNames: participants.map(p => p.name)
        };
    }));

    return { activeChannels };
}

export async function generateOpRadioToken(user: RadioUser, operationId: string) {
    // Confirm the operation exists + load the owner id for the bypass below.
    const { data: op, error: opErr } = await supabase
        .from('operations')
        .select('id, owner_id')
        .eq('id', operationId)
        .single();
    if (opErr || !op) throw new Error('Operation not found');

    // Tie voice access to the canonical per-op visibility predicate. Owner /
    // operations:manage bypass; everyone else needs operations:view (this action
    // is reachable by any authenticated user via user:manage:self, so the view
    // permission must be re-checked here) AND assertOpVisibleToUser, which
    // enforces the clearance level and every limiting marker.
    const perms = user.permissions || [];
    const isOwner = op.owner_id === user.id;
    const canManage = user.role === 'Admin' || perms.includes('operations:manage');
    if (!isOwner && !canManage) {
        if (!perms.includes('operations:view')) {
            throw new Error('Insufficient clearance to join this operation channel.');
        }
        await assertOpVisibleToUser(operationId, user);
    }

    const apiKey = await getOrgSecret('LIVEKIT_API_KEY');
    const apiSecret = await getOrgSecret('LIVEKIT_API_SECRET');
    const wsUrl = await getOrgSecret('LIVEKIT_URL');
    if (!apiKey || !apiSecret || !wsUrl) throw new Error('Radio configuration missing');

    const roomName = `op-radio-${operationId}`;

    // Best-effort: set auto-cleanup timeouts on the room
    try {
        const svc = new RoomServiceClient(wsUrl, apiKey, apiSecret);
        await svc.createRoom({
            name: roomName,
            emptyTimeout: 300,      // Close room 5 min after last participant leaves
            departureTimeout: 30,   // 30s grace period for reconnects
        });
    } catch (e) {
        log.warn('room pre-create failed', { room: roomName, err: e });
    }

    const at = new AccessToken(apiKey, apiSecret, {
        // Identity + name from the authenticated user, never the client payload.
        identity: String(user.id),
        name: user.name || String(user.id),
        ttl: '6h', // Auto-expire sessions after 6 hours
    });
    at.addGrant({ roomJoin: true, room: roomName });

    return { token: await at.toJwt(), url: wsUrl, roomName };
}

export async function rebootRadioNetwork() {
    const apiKey = await getOrgSecret('LIVEKIT_API_KEY');
    const apiSecret = await getOrgSecret('LIVEKIT_API_SECRET');
    const wsUrl = await getOrgSecret('LIVEKIT_URL');

    if (!apiKey || !apiSecret || !wsUrl) throw new Error("Radio configuration missing");

    const svc = new RoomServiceClient(wsUrl, apiKey, apiSecret);
    try {
        const rooms = await svc.listRooms();
        const promises = rooms.map(room => svc.deleteRoom(room.name));
        await Promise.allSettled(promises);
        return { success: true, count: rooms.length };
    } catch (e: any) {
        log.error('radio network reboot failed', { err: e });
        throw e;
    }
}
