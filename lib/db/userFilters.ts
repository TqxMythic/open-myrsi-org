import { User } from '../../types.js';

export interface RequesterContext {
    id: number;
    role: string;
    permissions: string[];
}

const hasPerm = (perms: string[] | undefined, name: string) => !!perms && perms.includes(name);

/**
 * Strip sensitive fields from a User record before sending to a client,
 * based on the requester's role and permissions.
 *
 * Field rules (non-admin requester):
 *   adminNotes        → only with `admin:user:update` (admin-only by UX intent;
 *                       not visible to self unless the user has the perm)
 *   personnelNotes    → self OR `user:manage:personnel_notes`
 *   conductRecord     → self OR `user:manage:conduct_record`
 *   limitingMarkers   → self OR `admin:user:manage_clearance`
 *
 * Admin role bypasses all checks (matches services.ts dispatcher behavior).
 *
 * If `requester` is null (unauthenticated path or no resolved user), all
 * sensitive fields are stripped — defense-in-depth.
 */
export function stripSensitiveUserFields(user: User, requester: RequesterContext | null): User {
    if (!user) return user;

    const isSelf = !!requester && requester.id === user.id;

    // rsiVerificationCode + rsiHandlePending are a one-time proof-of-ownership for
    // an in-progress RSI handle change. Only the user themselves should see them —
    // blank for every other viewer, including Admins, BEFORE the Admin bypass.
    const base: User = isSelf
        ? { ...user }
        : { ...user, rsiVerificationCode: undefined, rsiHandlePending: undefined };

    if (!requester) {
        // Unauthenticated / unresolved viewer: strip everything sensitive.
        return {
            ...base,
            adminNotes: undefined,
            personnelNotes: undefined,
            conductRecord: [],
            limitingMarkers: [],
            discordId: '',
        };
    }

    if (requester.role === 'Admin') return base;

    const perms = requester.permissions;
    const out: User = { ...base };

    if (!hasPerm(perms, 'admin:user:update')) {
        out.adminNotes = undefined;
    }
    if (!isSelf && !hasPerm(perms, 'user:manage:personnel_notes')) {
        out.personnelNotes = undefined;
    }
    if (!isSelf && !hasPerm(perms, 'user:manage:conduct_record')) {
        out.conductRecord = [];
    }
    if (!isSelf && !hasPerm(perms, 'admin:user:manage_clearance')) {
        out.limitingMarkers = [];
    }
    // A member's Discord snowflake is PII (enables account targeting). Only self
    // and roster/Discord administrators need it; strip it from the bulk roster for
    // rank-and-file members.
    if (!isSelf && !hasPerm(perms, 'admin:view:roster') && !hasPerm(perms, 'admin:config:discord')) {
        out.discordId = '';
    }

    return out;
}

export function stripSensitiveUserFieldsBulk(users: User[], requester: RequesterContext | null): User[] {
    return users.map(u => stripSensitiveUserFields(u, requester));
}
