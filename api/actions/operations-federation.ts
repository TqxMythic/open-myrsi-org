// api/actions/operations-federation.ts — RPC handlers for joint-op federation.
// Host invite/revoke require operations:manage; guest mirror accept/decline are
// admin (alliance:manage); list/get/rsvp/poll are member-level. The
// cross-instance inbound handlers are HTTP endpoints in server.ts, not RPCs.

import * as db from '../../lib/db.js';

interface InviteAllyPayload { operationId: string; peerId: string }
interface MirrorIdPayload { id: string }
interface MirrorRsvpPayload { id: string; rsvpStatus: string; shipText?: string; isReady?: boolean; userId: number }

export const operationsFederationActions = {
    // Host
    'operation:invite_ally': ({ operationId, peerId }: InviteAllyPayload) => db.inviteAllyToOperation(operationId, peerId),
    'operation:revoke_ally': ({ operationId, peerId }: InviteAllyPayload) => db.revokeAllyFromOperation(operationId, peerId),

    // Guest mirror surface
    'mirror:list': () => db.listMirroredOperations(false),
    'mirror:list_pending': () => db.listMirroredOperations(true),
    'mirror:get': ({ id }: MirrorIdPayload) => db.getMirroredOperation(id),
    'mirror:accept': ({ id }: MirrorIdPayload) => db.acceptMirroredOperation(id),
    'mirror:decline': ({ id }: MirrorIdPayload) => db.declineMirroredOperation(id),
    'mirror:poll': ({ id }: MirrorIdPayload) => db.pollMirroredOperation(id),
    'mirror:rsvp': ({ id, rsvpStatus, shipText, isReady, userId }: MirrorRsvpPayload) =>
        db.rsvpMirroredOperation(id, userId, rsvpStatus, shipText, isReady),
    // Withdraw: delete the member's local participation + push the removal to
    // the host so its allied-participant row doesn't linger (ghost RSVPs).
    'mirror:rsvp_remove': ({ id, userId }: { id: string; userId: number }) =>
        db.removeMirroredRsvp(id, userId),
};
