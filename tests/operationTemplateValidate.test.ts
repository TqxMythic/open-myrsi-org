import { describe, it, expect } from 'vitest';
import { validateTemplatePayload } from '../lib/operation-template-validate';
import { TaskPriority } from '../types';

// These tests lock in the contract that the wizard's `inlinePhases` payload
// (sent through operation:create) and JSON-imported templates must satisfy.
// The same validator runs on both paths server-side, so a regression here
// would silently ship malformed phases into operations.

describe('validateTemplatePayload — happy path', () => {
    it('accepts an empty phase list', () => {
        const result = validateTemplatePayload({ phases: [] });
        expect(result).toEqual({ phases: [] });
    });

    it('keeps a minimal phase intact', () => {
        const result = validateTemplatePayload({ phases: [{ name: 'Approach' }] });
        expect(result.phases).toHaveLength(1);
        expect(result.phases[0]).toEqual({ name: 'Approach' });
    });

    it('trims phase names and descriptions', () => {
        const result = validateTemplatePayload({ phases: [{ name: '  Hold  ', description: '  do the thing  ' }] });
        expect(result.phases[0].name).toBe('Hold');
        expect(result.phases[0].description).toBe('do the thing');
    });

    it('accepts the snake_case alias phase_type', () => {
        const result = validateTemplatePayload({ phases: [{ name: 'Fallback', phase_type: 'contingency' }] });
        expect(result.phases[0].phaseType).toBe('contingency');
    });

    it('preserves milestones with a label and trims notes', () => {
        const result = validateTemplatePayload({
            phases: [{ name: 'P', milestones: [{ label: '  Stack form-up  ', notes: '  brief on TS  ' }] }],
        });
        expect(result.phases[0].milestones).toEqual([{ label: 'Stack form-up', notes: 'brief on TS' }]);
    });

    it('truncates non-integer offsetMinutes', () => {
        const result = validateTemplatePayload({
            phases: [{ name: 'P', milestones: [{ label: 'm', offsetMinutes: 12.7 }] }],
        });
        expect(result.phases[0].milestones![0].offsetMinutes).toBe(12);
    });

    it('drops a non-numeric offsetMinutes silently', () => {
        const result = validateTemplatePayload({
            phases: [{ name: 'P', milestones: [{ label: 'm', offsetMinutes: 'soon' as any }] }],
        });
        expect(result.phases[0].milestones![0].offsetMinutes).toBeUndefined();
    });

    it('preserves task fields', () => {
        const result = validateTemplatePayload({
            phases: [{
                name: 'Engagement',
                tasks: [{ title: 'Engage hostile', priority: TaskPriority.Critical, taskType: 'primary' }],
            }],
        });
        expect(result.phases[0].tasks).toEqual([{
            title: 'Engage hostile',
            priority: TaskPriority.Critical,
            taskType: 'primary',
        }]);
    });

    it('drops empty milestones / tasks arrays from output to keep payloads tight', () => {
        const result = validateTemplatePayload({
            phases: [{ name: 'P', milestones: [], tasks: [] }],
        });
        expect(result.phases[0]).not.toHaveProperty('milestones');
        expect(result.phases[0]).not.toHaveProperty('tasks');
    });
});

describe('validateTemplatePayload — rejection paths', () => {
    it('rejects non-object payloads', () => {
        expect(() => validateTemplatePayload(null)).toThrow(/must be an object/);
        expect(() => validateTemplatePayload('hello')).toThrow(/must be an object/);
        expect(() => validateTemplatePayload(42)).toThrow(/must be an object/);
    });

    it('rejects payloads missing the phases array', () => {
        expect(() => validateTemplatePayload({})).toThrow(/phases must be an array/);
        expect(() => validateTemplatePayload({ phases: 'oops' })).toThrow(/phases must be an array/);
    });

    it('rejects a phase with no name', () => {
        expect(() => validateTemplatePayload({ phases: [{}] })).toThrow(/Phase #1 requires a non-empty name/);
        expect(() => validateTemplatePayload({ phases: [{ name: '   ' }] })).toThrow(/Phase #1 requires a non-empty name/);
    });

    it('rejects an unknown phaseType', () => {
        expect(() => validateTemplatePayload({ phases: [{ name: 'P', phaseType: 'parallel' }] }))
            .toThrow(/invalid phaseType "parallel"/);
    });

    it('rejects a milestone missing its label', () => {
        expect(() => validateTemplatePayload({ phases: [{ name: 'P', milestones: [{}] }] }))
            .toThrow(/Milestone #1 of phase "P" requires a non-empty label/);
    });

    it('rejects a task missing its title', () => {
        expect(() => validateTemplatePayload({ phases: [{ name: 'P', tasks: [{}] }] }))
            .toThrow(/Task #1 of phase "P" requires a non-empty title/);
    });

    it('rejects an unknown task priority', () => {
        expect(() => validateTemplatePayload({ phases: [{ name: 'P', tasks: [{ title: 't', priority: 'Urgent' }] }] }))
            .toThrow(/invalid priority "Urgent"/);
    });

    it('rejects an unknown taskType', () => {
        expect(() => validateTemplatePayload({ phases: [{ name: 'P', tasks: [{ title: 't', taskType: 'epic' }] }] }))
            .toThrow(/invalid taskType "epic"/);
    });
});

describe('validateTemplatePayload — count caps (IMP-S1 DoS guard)', () => {
    it('rejects more than 50 phases', () => {
        expect(() => validateTemplatePayload({ phases: Array.from({ length: 51 }, () => ({ name: 'p' })) }))
            .toThrow(/too many phases.*max 50/i);
    });
    it('rejects more than 200 tasks in a phase', () => {
        expect(() => validateTemplatePayload({ phases: [{ name: 'p', tasks: Array.from({ length: 201 }, () => ({ title: 't' })) }] }))
            .toThrow(/too many tasks.*max 200/i);
    });
    it('rejects more than 200 milestones in a phase', () => {
        expect(() => validateTemplatePayload({ phases: [{ name: 'p', milestones: Array.from({ length: 201 }, () => ({ label: 'm' })) }] }))
            .toThrow(/too many milestones.*max 200/i);
    });
    it('accepts exactly the cap (inclusive — no off-by-one against legit large templates)', () => {
        const r = validateTemplatePayload({
            phases: [{ name: 'p', tasks: Array.from({ length: 200 }, (_, i) => ({ title: `t${i}` })), milestones: Array.from({ length: 200 }, (_, i) => ({ label: `m${i}` })) }],
        });
        expect(r.phases[0].tasks).toHaveLength(200);
        expect(r.phases[0].milestones).toHaveLength(200);
    });
});

describe('validateTemplatePayload — free-text sanitize + no arbitrary fields (IMP-S2/IMP-S3)', () => {
    it('strips HTML from phase/task/milestone free-text', () => {
        const r = validateTemplatePayload({
            phases: [{
                name: '<b>Approach</b>', description: '<script>x</script>brief',
                tasks: [{ title: '<i>Engage</i>' }],
                milestones: [{ label: '<u>Stack</u>', notes: '<img src=x onerror=1>note' }],
            }],
        });
        expect(r.phases[0].name).not.toContain('<');
        expect(r.phases[0].description ?? '').not.toContain('<');
        expect(r.phases[0].tasks![0].title).not.toContain('<');
        expect(r.phases[0].milestones![0].label).not.toContain('<');
        expect(r.phases[0].milestones![0].notes ?? '').not.toContain('<');
    });
    it('caps an over-length phase name', () => {
        const r = validateTemplatePayload({ phases: [{ name: 'P'.repeat(500) }] });
        expect(r.phases[0].name.length).toBe(200);
    });
    it('rejects a name that collapses to empty after stripping', () => {
        expect(() => validateTemplatePayload({ phases: [{ name: '<br>' }] })).toThrow(/non-empty name/i);
    });
    it('drops arbitrary/injected fields (id, operation_id, __proto__) — strict re-projection', () => {
        const r = validateTemplatePayload({ phases: [{ name: 'p', id: 99, operation_id: 'x', created_by: 5, evil: true }] });
        const phase = r.phases[0] as unknown as Record<string, unknown>;
        expect('id' in phase).toBe(false);
        expect('operation_id' in phase).toBe(false);
        expect('created_by' in phase).toBe(false);
        expect('evil' in phase).toBe(false);
        expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    });
});

describe('validateTemplatePayload — round-trip stability', () => {
    it('is idempotent: validating an already-valid payload returns the same shape', () => {
        const input = {
            phases: [
                {
                    name: 'Approach',
                    phaseType: 'sequential',
                    tasks: [{ title: 'Form up', priority: TaskPriority.High }],
                    milestones: [{ label: 'Jump-point stack', offsetMinutes: -15 }],
                },
                {
                    name: 'Engagement',
                    tasks: [{ title: 'Engage', priority: TaskPriority.Critical }],
                },
            ],
        };
        const once = validateTemplatePayload(input);
        const twice = validateTemplatePayload(once);
        expect(twice).toEqual(once);
    });
});
