import { describe, it, expect, vi, beforeEach } from 'vitest';

// L1 pinning: unit:update_details is the unit-LEADER edit path (dispatcher lets
// a unit's own leader through). It must accept ONLY cosmetic fields — the
// structural fields (leaderId / parentUnitId / isRestricted) are admin-only
// (admin:update_unit, gated admin:config:units). A revert that forwards the
// whole `updates` blob would let a leader re-assign leadership / re-parent /
// flip the visibility gate on their own unit.

const spies = vi.hoisted(() => ({ updateUnit: vi.fn() }));
vi.mock('../lib/db', () => spies);
vi.mock('../lib/push', () => ({ sendPushToUsers: vi.fn() }));

import { userActions } from '../api/actions/user';

beforeEach(() => spies.updateUnit.mockReset().mockResolvedValue(undefined));

describe('unit:update_details cosmetic allow-list (L1)', () => {
    it('drops structural fields (leaderId/parentUnitId/isRestricted), keeps cosmetic', async () => {
        await (userActions as Record<string, (p: unknown) => Promise<unknown>>)['unit:update_details']({
            unitId: 5,
            updates: { name: 'New Name', motto: 'For Glory', leaderId: 999, parentUnitId: 12, isRestricted: true },
        });
        expect(spies.updateUnit).toHaveBeenCalledTimes(1);
        const arg = spies.updateUnit.mock.calls[0][0] as Record<string, unknown>;
        expect(arg.id).toBe(5);
        expect(arg.name).toBe('New Name');
        expect(arg.motto).toBe('For Glory');
        // structural fields must NOT be forwarded on the leader path
        expect('leaderId' in arg).toBe(false);
        expect('parentUnitId' in arg).toBe(false);
        expect('isRestricted' in arg).toBe(false);
    });
});
