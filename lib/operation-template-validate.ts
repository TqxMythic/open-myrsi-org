import type {
    OperationTemplatePayload,
    OperationTemplatePhase,
    OperationTemplateMilestone,
    OperationTemplateTask,
    TaskPriority,
} from '../types.js';
import { stripHtml, stripHtmlSingleLine } from './textSanitize.js';

// Pure validator extracted from lib/db/operation-templates.ts so it can be
// imported from tests without dragging in the Supabase client. Throws on the
// first invalid field with a descriptive message; the action handler turns
// that into a 4xx for the client.

const VALID_PHASE_TYPES = new Set(['sequential', 'contingency']);
const VALID_TASK_TYPES = new Set(['primary', 'secondary', 'assignment']);
const VALID_PRIORITIES = new Set<string>(['Low', 'Normal', 'High', 'Critical']);

// A template (or operation:create's inline phases) is stored verbatim in a jsonb
// column and re-materialised into N row inserts on every instantiate. Without
// count caps a single operations:create request (non-admin) could store tens of
// thousands of phases/tasks → an instantiate-time write-amplification DoS.
const MAX_PHASES = 50;
const MAX_TASKS_PER_PHASE = 200;
const MAX_MILESTONES_PER_PHASE = 200;

export function validateTemplatePayload(raw: unknown): OperationTemplatePayload {
    if (!raw || typeof raw !== 'object') throw new Error('Template payload must be an object.');
    const r = raw as any;
    if (!Array.isArray(r.phases)) throw new Error('Template payload.phases must be an array.');
    if (r.phases.length > MAX_PHASES) throw new Error(`Template has too many phases (${r.phases.length}; max ${MAX_PHASES}).`);

    const phases: OperationTemplatePhase[] = r.phases.map((p: any, idx: number) => {
        if (!p || typeof p !== 'object') throw new Error(`Phase #${idx + 1} must be an object.`);
        // Strip markup + length-cap every persisted free-text field, so a future
        // non-escaping consumer of the template jsonb can't be XSS'd and the row
        // can't be bloated. Emptiness is checked on the CLEANED value.
        const name = stripHtmlSingleLine(p.name, 200);
        if (!name) throw new Error(`Phase #${idx + 1} requires a non-empty name.`);

        const phaseType = p.phaseType ?? p.phase_type;
        if (phaseType !== undefined && !VALID_PHASE_TYPES.has(phaseType)) {
            throw new Error(`Phase #${idx + 1} has invalid phaseType "${phaseType}".`);
        }

        if (Array.isArray(p.milestones) && p.milestones.length > MAX_MILESTONES_PER_PHASE) {
            throw new Error(`Phase #${idx + 1} has too many milestones (${p.milestones.length}; max ${MAX_MILESTONES_PER_PHASE}).`);
        }
        const milestones: OperationTemplateMilestone[] | undefined = Array.isArray(p.milestones)
            ? p.milestones.map((m: any, mi: number) => {
                const label = m && typeof m === 'object' ? stripHtmlSingleLine(m.label, 200) : '';
                if (!label) throw new Error(`Milestone #${mi + 1} of phase "${name}" requires a non-empty label.`);
                const out: OperationTemplateMilestone = { label };
                const notes = stripHtml(m.notes, 2000);
                if (notes) out.notes = notes;
                if (typeof m.offsetMinutes === 'number' && Number.isFinite(m.offsetMinutes)) {
                    out.offsetMinutes = Math.trunc(m.offsetMinutes);
                }
                return out;
            })
            : undefined;

        if (Array.isArray(p.tasks) && p.tasks.length > MAX_TASKS_PER_PHASE) {
            throw new Error(`Phase #${idx + 1} has too many tasks (${p.tasks.length}; max ${MAX_TASKS_PER_PHASE}).`);
        }
        const tasks: OperationTemplateTask[] | undefined = Array.isArray(p.tasks)
            ? p.tasks.map((t: any, ti: number) => {
                const title = t && typeof t === 'object' ? stripHtmlSingleLine(t.title, 200) : '';
                if (!title) throw new Error(`Task #${ti + 1} of phase "${name}" requires a non-empty title.`);
                if (t.taskType !== undefined && !VALID_TASK_TYPES.has(t.taskType)) {
                    throw new Error(`Task #${ti + 1} of phase "${name}" has invalid taskType "${t.taskType}".`);
                }
                if (t.priority !== undefined && !VALID_PRIORITIES.has(t.priority)) {
                    throw new Error(`Task #${ti + 1} of phase "${name}" has invalid priority "${t.priority}".`);
                }
                const out: OperationTemplateTask = { title };
                const description = stripHtml(t.description, 4000);
                if (description) out.description = description;
                if (t.taskType) out.taskType = t.taskType;
                if (t.priority) out.priority = t.priority as TaskPriority;
                return out;
            })
            : undefined;

        const out: OperationTemplatePhase = { name };
        const description = stripHtml(p.description, 4000);
        if (description) out.description = description;
        if (phaseType) out.phaseType = phaseType;
        const color = stripHtmlSingleLine(p.color, 32);
        if (color) out.color = color;
        if (milestones?.length) out.milestones = milestones;
        if (tasks?.length) out.tasks = tasks;
        return out;
    });

    return { phases };
}
