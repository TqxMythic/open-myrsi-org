
import { supabase, handleSupabaseError, safeFetch } from '../common.js';
import { sanitizeTiptapJson } from '../../tiptapValidate.js';
import {
    GovernmentConfig,
    GovernmentBranch,
    GovernmentPosition,
    GovernmentPositionHolder,
} from '../../../types.js';
import {
    log,
    USER_HYDRATE,
    broadcastGovernmentUpdate,
    toGovernmentConfig,
    toGovernmentBranch,
    toGovernmentPosition,
    toGovernmentPositionHolder,
} from './internal.js';
import { getElectionsState } from './elections.js';
import { getLegislationState, getMotionsState } from './legislation.js';

// ---------------------------------------------------------------------------
// State aggregation (query subset)
// ---------------------------------------------------------------------------

/**
 * The structure key-group of the government bundle: config + branches +
 * positions + holders (+ the feature toggle). These four stay co-fetched
 * because of the cross-row hydration below (holders bucket into positions,
 * positions into branches). Backs both getGovernmentState and the realtime
 * `government_structure` slice subset.
 */
export async function getGovernmentStructureState() {
    const [configResult, branchesResult, positionsResult, holdersResult, featureToggleResult] = await Promise.all([
        safeFetch(
            supabase.from('government_configs').select('*').maybeSingle(),
            null, 'government_configs'
        ),
        safeFetch(
            supabase.from('government_branches').select('*').order('sort_order'),
            [], 'government_branches'
        ),
        safeFetch(
            supabase.from('government_positions').select('*').order('sort_order'),
            [], 'government_positions'
        ),
        safeFetch(
            supabase.from('government_position_holders').select(`
                *,
                user:users!government_position_holders_user_id_fkey(${USER_HYDRATE}),
                appointed_by:users!government_position_holders_appointed_by_id_fkey(${USER_HYDRATE})
            `).is('ended_at', null),
            [], 'government_position_holders'
        ),
        safeFetch(
            supabase.from('settings').select('value').eq('key', 'governmentsConfig').maybeSingle(),
            null, 'settings:governmentsConfig'
        ),
    ]);

    const branches = Array.isArray(branchesResult) ? branchesResult.map(toGovernmentBranch) : [];
    const positions = Array.isArray(positionsResult) ? positionsResult.map(toGovernmentPosition) : [];
    const holders = Array.isArray(holdersResult) ? holdersResult.map(toGovernmentPositionHolder) : [];

    // Hydrate positions with their current holders
    const holdersByPosition = new Map<number, GovernmentPositionHolder[]>();
    for (const h of holders) {
        const arr = holdersByPosition.get(h.positionId) || [];
        arr.push(h);
        holdersByPosition.set(h.positionId, arr);
    }
    for (const pos of positions) {
        pos.currentHolders = holdersByPosition.get(pos.id) || [];
    }

    // Hydrate branches with their positions
    const positionsByBranch = new Map<number, GovernmentPosition[]>();
    for (const pos of positions) {
        if (pos.branchId) {
            const arr = positionsByBranch.get(pos.branchId) || [];
            arr.push(pos);
            positionsByBranch.set(pos.branchId, arr);
        }
    }
    for (const branch of branches) {
        branch.positions = positionsByBranch.get(branch.id) || [];
    }

    const featureToggle = featureToggleResult as { value?: unknown } | null;
    return {
        governmentsConfig: featureToggle?.value || { enabled: false },
        governmentConfig: configResult ? toGovernmentConfig(configResult) : null,
        governmentBranches: branches,
        governmentPositions: positions,
        governmentPositionHolders: holders,
    };
}

export async function getGovernmentState() {
    // Structure key-group + the three list key-groups in parallel.
    // Elections/legislation/motions are deliberately called WITHOUT a
    // currentUserId (per-viewer ballot flags stay absent on the subset path —
    // parity preserved by the per-slice subsets too).
    const [structure, elections, legislation, motions] = await Promise.all([
        getGovernmentStructureState(),
        getElectionsState().catch(() => []),
        getLegislationState().catch(() => []),
        getMotionsState().catch(() => []),
    ]);

    return {
        ...structure,
        governmentElections: elections,
        governmentLegislation: legislation,
        governmentMotions: motions,
    };
}

// ---------------------------------------------------------------------------
// Government Config CRUD
// ---------------------------------------------------------------------------

export async function upsertGovernmentConfig(config: Partial<GovernmentConfig>): Promise<GovernmentConfig | null> {
    const payload: Record<string, unknown> = {
        government_type: config.governmentType || 'custom',
        name: config.name || 'Government',
        description: config.description || null,
        // Constitution is edited via the WikiEditor (Tiptap JSON); sanitize on
        // save to drop disallowed nodes/marks and reject unsafe link/image URLs.
        constitution_content: config.constitutionContent
            ? sanitizeTiptapJson(config.constitutionContent, 'wiki')
            : null,
        updated_at: new Date().toISOString(),
    };

    // Single-org: government_configs holds exactly one row. Upsert on the PK —
    // reuse the existing row's id if present, otherwise insert a fresh one.
    const { data: existing } = await supabase.from('government_configs').select('id').limit(1).maybeSingle();
    if (existing?.id) payload.id = existing.id;
    const { data, error } = await supabase.from('government_configs')
        .upsert(payload, { onConflict: 'id' })
        .select()
        .single();
    handleSupabaseError({ error, message: 'Failed to upsert government config' });
    broadcastGovernmentUpdate('structure');
    return data ? toGovernmentConfig(data) : null;
}

export async function updateConstitution(content: unknown) {
    const safeContent = content ? sanitizeTiptapJson(content, 'wiki') : null;
    const { error } = await supabase.from('government_configs')
        .update({ constitution_content: safeContent, updated_at: new Date().toISOString() })
        ;
    handleSupabaseError({ error, message: 'Failed to update constitution' });
    broadcastGovernmentUpdate('structure');
}

// ---------------------------------------------------------------------------
// Government Branches CRUD
// ---------------------------------------------------------------------------

export async function createGovernmentBranch(data: Partial<GovernmentBranch>): Promise<GovernmentBranch | null> {
    const payload = {
        name: data.name,
        branch_type: data.branchType || 'Custom',
        description: data.description || null,
        sort_order: data.sortOrder ?? 0,
        icon: data.icon || null,
    };
    const { data: result, error } = await supabase.from('government_branches')
        .insert(payload).select().single();
    handleSupabaseError({ error, message: 'Failed to create government branch' });
    broadcastGovernmentUpdate('structure');
    return result ? toGovernmentBranch(result) : null;
}

export async function updateGovernmentBranch(branchId: number, updates: Partial<GovernmentBranch>) {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.branchType !== undefined) dbUpdates.branch_type = updates.branchType;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('government_branches')
        .update(dbUpdates).eq('id', branchId);
    handleSupabaseError({ error, message: 'Failed to update government branch' });
    broadcastGovernmentUpdate('structure');
}

export async function deleteGovernmentBranch(branchId: number) {
    const { error } = await supabase.from('government_branches')
        .delete().eq('id', branchId);
    handleSupabaseError({ error, message: 'Failed to delete government branch' });
    broadcastGovernmentUpdate('structure');
}

/**
 * Apply a new order to government branches within an org. Caller passes the
 * full ordered id list; we set sort_order = (idx + 1) * 10 so future inserts
 * can slot between two existing rows without a renumber. Mirrors
 * reorderFleetGroups (lib/db/fleet.ts).
 */
export async function reorderGovernmentBranches(orderedIds: number[]) {
    if (orderedIds.length === 0) return;
    const updates = orderedIds.map((id, idx) =>
        supabase.from('government_branches')
            .update({ sort_order: (idx + 1) * 10 })
            .eq('id', id)
            
    );
    const results = await Promise.all(updates);
    for (const r of results) {
        handleSupabaseError({ error: r.error, message: 'Failed to reorder government branches' });
    }
    broadcastGovernmentUpdate('structure');
}

// ---------------------------------------------------------------------------
// Government Positions CRUD
// ---------------------------------------------------------------------------

export async function createGovernmentPosition(data: Partial<GovernmentPosition>): Promise<GovernmentPosition | null> {
    const payload = {
        branch_id: data.branchId || null,
        name: data.name,
        description: data.description || null,
        fill_method: data.fillMethod || 'Appointed',
        term_length_days: data.termLengthDays || null,
        max_holders: data.maxHolders ?? 1,
        icon: data.icon || null,
        sort_order: data.sortOrder ?? 0,
        permissions_granted: data.permissionsGranted || [],
        can_propose_legislation: data.canProposeLegislation ?? false,
        can_vote_legislation: data.canVoteLegislation ?? false,
        can_veto_legislation: data.canVetoLegislation ?? false,
        can_call_elections: data.canCallElections ?? false,
        can_issue_orders: data.canIssueOrders ?? false,
    };
    const { data: result, error } = await supabase.from('government_positions')
        .insert(payload).select().single();
    handleSupabaseError({ error, message: 'Failed to create government position' });
    broadcastGovernmentUpdate('structure');
    return result ? toGovernmentPosition(result) : null;
}

export async function updateGovernmentPosition(positionId: number, updates: Partial<GovernmentPosition>) {
    const dbUpdates: Record<string, unknown> = {};
    if (updates.branchId !== undefined) dbUpdates.branch_id = updates.branchId;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.fillMethod !== undefined) dbUpdates.fill_method = updates.fillMethod;
    if (updates.termLengthDays !== undefined) dbUpdates.term_length_days = updates.termLengthDays;
    if (updates.maxHolders !== undefined) dbUpdates.max_holders = updates.maxHolders;
    if (updates.icon !== undefined) dbUpdates.icon = updates.icon;
    if (updates.sortOrder !== undefined) dbUpdates.sort_order = updates.sortOrder;
    if (updates.permissionsGranted !== undefined) dbUpdates.permissions_granted = updates.permissionsGranted;
    if (updates.canProposeLegislation !== undefined) dbUpdates.can_propose_legislation = updates.canProposeLegislation;
    if (updates.canVoteLegislation !== undefined) dbUpdates.can_vote_legislation = updates.canVoteLegislation;
    if (updates.canVetoLegislation !== undefined) dbUpdates.can_veto_legislation = updates.canVetoLegislation;
    if (updates.canCallElections !== undefined) dbUpdates.can_call_elections = updates.canCallElections;
    if (updates.canIssueOrders !== undefined) dbUpdates.can_issue_orders = updates.canIssueOrders;

    if (Object.keys(dbUpdates).length === 0) return;

    const { error } = await supabase.from('government_positions')
        .update(dbUpdates).eq('id', positionId);
    handleSupabaseError({ error, message: 'Failed to update government position' });
    broadcastGovernmentUpdate('structure');
}

export async function deleteGovernmentPosition(positionId: number) {
    const { error } = await supabase.from('government_positions')
        .delete().eq('id', positionId);
    handleSupabaseError({ error, message: 'Failed to delete government position' });
    broadcastGovernmentUpdate('structure');
}

/**
 * Apply a new order to positions within a single branch (or to top-level
 * positions when branchId is null). Validates branch membership when scoped.
 * Mirrors reorderGroupShips (lib/db/fleet.ts).
 */
export async function reorderGovernmentPositions(branchId: number | null, orderedIds: number[]) {
    if (orderedIds.length === 0) return;

    if (branchId !== null) {
        // Defense-in-depth: confirm the branch belongs to the caller's org
        // so a crafted payload can't reorder another tenant's positions.
        const { data: branch } = await supabase.from('government_branches')
            .select('id')
            .eq('id', branchId)
            
            .maybeSingle();
        if (!branch) throw new Error('Government branch not found');
    }

    const updates = orderedIds.map((id, idx) => {
        const q = supabase.from('government_positions')
            .update({ sort_order: (idx + 1) * 10 })
            .eq('id', id)
            ;
        return branchId !== null ? q.eq('branch_id', branchId) : q.is('branch_id', null);
    });
    const results = await Promise.all(updates);
    for (const r of results) {
        handleSupabaseError({ error: r.error, message: 'Failed to reorder government positions' });
    }
    broadcastGovernmentUpdate('structure');
}

// ---------------------------------------------------------------------------
// Position Holders
// ---------------------------------------------------------------------------

export async function appointPositionHolder(data: Partial<GovernmentPositionHolder>): Promise<GovernmentPositionHolder | null> {
    // Check current holder count doesn't exceed max_holders
    const { data: position } = await supabase.from('government_positions')
        .select('max_holders').eq('id', data.positionId).single();
    if (!position) throw new Error('Position not found');

    const { count } = await supabase.from('government_position_holders')
        .select('id', { count: 'exact', head: true })
        .eq('position_id', data.positionId)
        
        .is('ended_at', null);

    if (count !== null && count >= position.max_holders) {
        throw new Error(`Position is full (${position.max_holders} holder${position.max_holders > 1 ? 's' : ''} max)`);
    }

    // Check user isn't already holding this position
    const { count: existingCount } = await supabase.from('government_position_holders')
        .select('id', { count: 'exact', head: true })
        .eq('position_id', data.positionId)
        .eq('user_id', data.userId)
        
        .is('ended_at', null);

    if (existingCount && existingCount > 0) {
        throw new Error('User already holds this position');
    }

    const payload = {
        position_id: data.positionId,
        user_id: data.userId,
        appointed_by_id: data.appointedById || null,
        election_id: data.electionId || null,
    };
    const { data: result, error } = await supabase.from('government_position_holders')
        .insert(payload).select().single();
    handleSupabaseError({ error, message: 'Failed to appoint position holder' });
    broadcastGovernmentUpdate('structure');
    return result ? toGovernmentPositionHolder(result) : null;
}

export async function removePositionHolder(holderId: number, reason: string) {
    const { error } = await supabase.from('government_position_holders')
        .update({ ended_at: new Date().toISOString(), end_reason: reason })
        .eq('id', holderId)

        .is('ended_at', null);
    handleSupabaseError({ error, message: 'Failed to remove position holder' });
    broadcastGovernmentUpdate('structure');
}

/**
 * Called when a user leaves the org — vacates all their government positions.
 */
export async function vacateAllPositions(userId: number) {
    const { error } = await supabase.from('government_position_holders')
        .update({ ended_at: new Date().toISOString(), end_reason: 'org_left' })
        .eq('user_id', userId)

        .is('ended_at', null);
    if (error) log.error('vacate positions for leaving user failed', { userId, err: error });
    else broadcastGovernmentUpdate('structure');
}
