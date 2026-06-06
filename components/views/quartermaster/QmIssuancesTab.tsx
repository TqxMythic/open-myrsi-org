import React, { useMemo, useState } from 'react';
import type { QmIssuance, QmIssuanceStatus, QmMemberRecord, QmUserRef } from '../../../types';
import IssuanceRow from './IssuanceRow';

interface Props {
    issuances: QmIssuance[];
    /** Server-grouped per-member rollup of open issuances — not derived from `issuances` (which is capped at 200). */
    memberRecords: QmMemberRecord[];
    canManage: boolean;
    onFulfil: (issuanceId: number) => void;
    onReturn: (issuance: QmIssuance) => void;
    onWriteOff: (issuance: QmIssuance) => void;
    /** Opens the bulk-issue modal with no pre-selection — "Issue Kit" top-level action. */
    onIssueKit?: () => void;
    /** Opens the bulk-issue modal pre-targeted at a member. */
    onIssueToMember?: (member: QmUserRef) => void;
    /** Opens the bulk-return modal with a member's active issuances. */
    onReturnFromMember?: (member: QmUserRef, active: QmIssuance[]) => void;
}

const STATUS_TABS: readonly { key: 'all' | 'open' | QmIssuanceStatus; label: string }[] = [
    { key: 'open',        label: 'Open' },
    { key: 'requested',   label: 'Requested' },
    { key: 'active',      label: 'On Issue' },
    { key: 'returned',    label: 'Returned' },
    { key: 'written_off', label: 'Written Off' },
    { key: 'all',         label: 'All' },
];

type ViewMode = 'ledger' | 'byMember';

function weightLedger(iss: QmIssuance) {
    if (iss.status === 'active' && iss.isOverdue) return 0;
    if (iss.status === 'requested') return 1;
    if (iss.status === 'active') return 2;
    return 3;
}

export default function QmIssuancesTab({
    issuances, memberRecords, canManage, onFulfil, onReturn, onWriteOff, onIssueKit, onIssueToMember, onReturnFromMember,
}: Props) {
    const [viewMode, setViewMode] = useState<ViewMode>('ledger');
    const [filter, setFilter] = useState<'all' | 'open' | QmIssuanceStatus>('open');
    const [expandedMemberId, setExpandedMemberId] = useState<number | null>(null);
    const [memberSearch, setMemberSearch] = useState('');

    const ledgerSorted = useMemo(() => {
        const filtered = issuances.filter((iss) => {
            if (filter === 'all') return true;
            if (filter === 'open') return iss.status === 'requested' || iss.status === 'active';
            return iss.status === filter;
        });
        return [...filtered].sort((a, b) => {
            const wa = weightLedger(a);
            const wb = weightLedger(b);
            if (wa !== wb) return wa - wb;
            if (a.status === 'requested' && b.status === 'requested') {
                return new Date(a.requestedAt || 0).getTime() - new Date(b.requestedAt || 0).getTime();
            }
            if (a.status === 'active' && b.status === 'active') {
                const ad = a.dueBackAt ? new Date(a.dueBackAt).getTime() : Number.POSITIVE_INFINITY;
                const bd = b.dueBackAt ? new Date(b.dueBackAt).getTime() : Number.POSITIVE_INFINITY;
                return ad - bd;
            }
            return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        });
    }, [issuances, filter]);

    // Records come from the server (qm:list_member_records) — open issuances
    // aren't capped like the ledger, so no client-side grouping needed.
    const filteredRecords = useMemo(() => {
        const q = memberSearch.trim().toLowerCase();
        if (!q) return memberRecords;
        return memberRecords.filter(r =>
            r.user.name.toLowerCase().includes(q) ||
            (r.user.rsiHandle || '').toLowerCase().includes(q),
        );
    }, [memberRecords, memberSearch]);

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-1 bg-slate-900 rounded-lg border border-white/10 p-1">
                    <button
                        onClick={() => setViewMode('ledger')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition flex items-center gap-1.5 ${
                            viewMode === 'ledger' ? 'bg-orange-500/20 text-orange-200' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <i className="fa-solid fa-list-ul" />Ledger
                    </button>
                    <button
                        onClick={() => setViewMode('byMember')}
                        className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition flex items-center gap-1.5 ${
                            viewMode === 'byMember' ? 'bg-orange-500/20 text-orange-200' : 'text-slate-400 hover:text-slate-200'
                        }`}
                    >
                        <i className="fa-solid fa-user-tag" />By Member
                    </button>
                </div>

                {viewMode === 'ledger' && (
                    <div className="flex items-center gap-1 bg-slate-900 rounded-lg border border-white/10 p-1 flex-wrap">
                        {STATUS_TABS.map((t) => (
                            <button
                                key={t.key}
                                onClick={() => setFilter(t.key)}
                                className={`px-3 py-1.5 rounded-md text-[11px] font-bold uppercase tracking-widest transition ${
                                    filter === t.key ? 'bg-orange-500/20 text-orange-200' : 'text-slate-400 hover:text-slate-200'
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>
                )}

                {viewMode === 'byMember' && (
                    <input
                        type="text"
                        value={memberSearch}
                        onChange={(e) => setMemberSearch(e.target.value)}
                        placeholder="Search members…"
                        className="bg-slate-900 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 flex-1 max-w-xs"
                    />
                )}

                {/* Top-level "Issue Kit" — opens the bulk-issue modal with no pre-selection.
                    Covers the case where a member has no open issuances yet (so they don't
                    appear in the By-Member view) and you need a fresh kit. */}
                {canManage && onIssueKit && (
                    <button
                        onClick={onIssueKit}
                        className="ml-auto inline-flex items-center gap-2 bg-orange-600 hover:bg-orange-500 text-white px-3 py-1.5 rounded-lg text-[11px] font-bold uppercase tracking-widest transition"
                    >
                        <i className="fa-solid fa-people-carry-box" /> Issue Kit
                    </button>
                )}
            </div>

            {viewMode === 'ledger' && (
                ledgerSorted.length === 0 ? (
                    <div className="rounded-xl border border-white/5 bg-slate-900/30 p-10 text-center text-slate-500 text-sm">
                        No issuances match the current filter.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {ledgerSorted.map((iss) => (
                            <IssuanceRow
                                key={iss.id}
                                issuance={iss}
                                onFulfil={canManage && iss.status === 'requested' ? () => onFulfil(iss.id) : undefined}
                                onReturn={canManage && iss.status === 'active' ? () => onReturn(iss) : undefined}
                                onWriteOff={canManage && iss.status === 'active' ? () => onWriteOff(iss) : undefined}
                            />
                        ))}
                    </div>
                )
            )}

            {viewMode === 'byMember' && (
                filteredRecords.length === 0 ? (
                    <div className="rounded-xl border border-white/5 bg-slate-900/30 p-10 text-center text-slate-500 text-sm">
                        {memberRecords.length === 0
                            ? 'No members currently hold any open issuances.'
                            : 'No members match the search.'}
                    </div>
                ) : (
                    <div className="space-y-2">
                        {filteredRecords.map((rec) => {
                            const expanded = expandedMemberId === rec.user.id;
                            const totalOpen = rec.active.length + rec.requested.length;
                            return (
                                <div
                                    key={rec.user.id}
                                    className={`rounded-lg border overflow-hidden transition-colors ${
                                        rec.overdueCount > 0
                                            ? 'border-rose-500/30 bg-rose-500/5'
                                            : 'border-white/10 bg-slate-900/40'
                                    }`}
                                >
                                    <button
                                        onClick={() => setExpandedMemberId(expanded ? null : rec.user.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-white/5 transition"
                                    >
                                        <img src={rec.user.avatarUrl} alt="" className="w-10 h-10 rounded-full shrink-0 object-cover" />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-sm font-bold text-white truncate">{rec.user.name}</span>
                                                {rec.user.rsiHandle && (
                                                    <span className="text-[10px] font-mono text-slate-500 truncate">{rec.user.rsiHandle}</span>
                                                )}
                                            </div>
                                            <div className="text-[11px] text-slate-400 font-mono mt-0.5 flex items-center gap-3 flex-wrap">
                                                <span>
                                                    <span className="font-bold text-white">{totalOpen}</span> open
                                                    <span className="text-slate-600"> · {rec.totalQuantity}× total</span>
                                                </span>
                                                {rec.active.length > 0 && (
                                                    <span className="text-sky-300">{rec.active.length} on issue</span>
                                                )}
                                                {rec.requested.length > 0 && (
                                                    <span className="text-amber-300">{rec.requested.length} requested</span>
                                                )}
                                                {rec.overdueCount > 0 && (
                                                    <span className="text-rose-300 font-bold uppercase tracking-widest text-[10px]">
                                                        {rec.overdueCount} overdue
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                            {canManage && onIssueToMember && (
                                                <button
                                                    onClick={() => onIssueToMember(rec.user)}
                                                    className="px-2.5 py-1.5 bg-orange-600/20 hover:bg-orange-600/40 text-orange-200 rounded-sm border border-orange-500/40 text-[10px] font-bold uppercase tracking-widest transition"
                                                >
                                                    <i className="fa-solid fa-plus mr-1" />Issue more
                                                </button>
                                            )}
                                            {canManage && onReturnFromMember && rec.active.length > 0 && (
                                                <button
                                                    onClick={() => onReturnFromMember(rec.user, rec.active)}
                                                    className="px-2.5 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/40 text-emerald-200 rounded-sm border border-emerald-500/40 text-[10px] font-bold uppercase tracking-widest transition"
                                                >
                                                    <i className="fa-solid fa-rotate-left mr-1" />Return
                                                </button>
                                            )}
                                            <i className={`fa-solid fa-chevron-${expanded ? 'up' : 'down'} text-slate-500 w-4 text-center ml-1`} />
                                        </div>
                                    </button>

                                    {expanded && (
                                        <div className="px-4 py-3 border-t border-white/5 bg-slate-950/40 space-y-2">
                                            {[...rec.active, ...rec.requested]
                                                .sort((a, b) => {
                                                    if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
                                                    const ad = a.dueBackAt ? new Date(a.dueBackAt).getTime() : Number.POSITIVE_INFINITY;
                                                    const bd = b.dueBackAt ? new Date(b.dueBackAt).getTime() : Number.POSITIVE_INFINITY;
                                                    return ad - bd;
                                                })
                                                .map(iss => (
                                                    <IssuanceRow
                                                        key={iss.id}
                                                        issuance={iss}
                                                        onFulfil={canManage && iss.status === 'requested' ? () => onFulfil(iss.id) : undefined}
                                                        onReturn={canManage && iss.status === 'active' ? () => onReturn(iss) : undefined}
                                                        onWriteOff={canManage && iss.status === 'active' ? () => onWriteOff(iss) : undefined}
                                                    />
                                                ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )
            )}
        </div>
    );
}
