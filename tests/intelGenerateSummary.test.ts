import { describe, it, expect, vi, beforeEach } from 'vitest';

// intel:generate_summary must (a) refetch the dossier server-side via
// db.getDossier(targetId, user) and ignore the client-supplied dossier body
// (closes the AI-cache-poisoning angle), and (b) apply the per-user AI rate limit.

const spies = vi.hoisted(() => ({
    getDossier: vi.fn(),
    generateDossierSummary: vi.fn(),
    assertAiRateLimit: vi.fn(),
}));

vi.mock('../lib/db', () => ({ getDossier: spies.getDossier }));
vi.mock('../lib/ai', () => ({ generateDossierSummary: spies.generateDossierSummary }));
vi.mock('../lib/aiRateLimit', () => ({ assertAiRateLimit: spies.assertAiRateLimit }));
// intelActions also imports discord + push at module scope — not called by
// generate_summary; stub to keep import side-effect-free.
vi.mock('../lib/discord', () => ({}));
vi.mock('../lib/push', () => ({ sendPushToStaff: vi.fn() }));

import { intelActions } from '../api/actions/intel';

const call = (p: unknown) => (intelActions as Record<string, (x: unknown) => Promise<unknown>>)['intel:generate_summary'](p);
const user = { id: 7, role: 'Admin', permissions: ['intel:manage'], clearanceLevel: { level: 9 }, limitingMarkers: [] };

beforeEach(() => {
    spies.getDossier.mockReset();
    spies.generateDossierSummary.mockReset();
    spies.assertAiRateLimit.mockReset();
    spies.getDossier.mockResolvedValue({ targetId: 'Jane', reports: [{ summary: 'REAL-server-side' }] });
    spies.generateDossierSummary.mockResolvedValue('summary');
});

describe('intel:generate_summary (M9 / H3 cache-poisoning closure)', () => {
    it('refetches the dossier server-side and ignores the forged client payload', async () => {
        await call({ dossier: { targetId: 'Jane', reports: [{ summary: 'FORGED-by-attacker' }] }, user });
        expect(spies.getDossier).toHaveBeenCalledWith('Jane', user);
        // The AI is fed the server-refetched dossier, NOT the client payload.
        expect(spies.generateDossierSummary).toHaveBeenCalledWith({ targetId: 'Jane', reports: [{ summary: 'REAL-server-side' }] });
        const fed = spies.generateDossierSummary.mock.calls[0][0] as { reports: { summary: string }[] };
        expect(JSON.stringify(fed)).not.toContain('FORGED-by-attacker');
    });

    it('applies the per-user AI rate limit (keyed on the server user id)', async () => {
        await call({ dossier: { targetId: 'Jane' }, user });
        expect(spies.assertAiRateLimit).toHaveBeenCalledWith(7);
    });

    it('rejects when no target id is supplied', async () => {
        await expect(call({ dossier: {}, user })).rejects.toThrow(/target is required/i);
        expect(spies.getDossier).not.toHaveBeenCalled();
    });
});
