import { describe, it, expect } from 'vitest';
import {
    deleteOperationPhase, deleteScheduleEntry, deleteOperationTask, deleteCommandNode,
    deleteBoardElement, deleteLogisticsItem, deleteAAREntry,
    updateOperationPhase, updateScheduleEntry, updateOperationTask, updateCommandNode,
    updateBoardElement, updateLogisticsItem, fulfillLogisticsItem,
} from '../lib/db/ops';

// Regression: indirect (parent-scoped) deletes must fail closed when their scoping
// key is missing. The operation-child tables carry no organization_id, so they are
// scoped by the (already org-verified) operation_id; unit_posts is scoped by its
// unit's org. The guard throws before any DB call, so a caller that forgets to
// thread the scope can't issue an unscoped (cross-tenant) delete under service-role.
describe('operation-child deletes require operationId (fail closed)', () => {
    const cases: Array<[string, () => Promise<unknown>]> = [
        ['deleteOperationPhase', () => deleteOperationPhase(1)],
        ['deleteScheduleEntry', () => deleteScheduleEntry(1)],
        ['deleteOperationTask', () => deleteOperationTask(1)],
        ['deleteCommandNode', () => deleteCommandNode(1)],
        ['deleteBoardElement', () => deleteBoardElement(1)],
        ['deleteLogisticsItem', () => deleteLogisticsItem(1)],
        ['deleteAAREntry', () => deleteAAREntry(1)],
    ];

    for (const [name, fn] of cases) {
        it(`${name} rejects without operationId`, async () => {
            await expect(fn()).rejects.toThrow(/operationId is required/);
        });
    }
});

// The delete-hardening is mirrored to the UPDATE/fulfill siblings: they were
// `.eq('id', childId)` only, so a foreign child id passed with the caller's own
// operationId mutated the foreign op's child. Same fail-closed contract: the guard
// throws before any DB call.
describe('operation-child updates/fulfill require operationId (fail closed)', () => {
    const cases: Array<[string, () => Promise<unknown>]> = [
        ['updateOperationPhase', () => updateOperationPhase(1, { name: 'x' })],
        ['updateScheduleEntry', () => updateScheduleEntry(1, { label: 'x' })],
        ['updateOperationTask', () => updateOperationTask(1, { title: 'x' })],
        ['updateCommandNode', () => updateCommandNode(1, { label: 'x' })],
        ['updateBoardElement', () => updateBoardElement(1, { label: 'x' })],
        ['updateLogisticsItem', () => updateLogisticsItem(1, { itemName: 'x' })],
        ['fulfillLogisticsItem', () => fulfillLogisticsItem(1, 5, 1)],
    ];

    for (const [name, fn] of cases) {
        it(`${name} rejects without operationId`, async () => {
            await expect(fn()).rejects.toThrow(/operationId is required/);
        });
    }
});
