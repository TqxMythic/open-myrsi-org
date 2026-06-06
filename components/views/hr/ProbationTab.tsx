
import React, { useState, useMemo, useCallback } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useMembers } from '../../../contexts/MembersContext';
import { useConfig } from '../../../contexts/ConfigContext';
import { useAuth, useFormatDate } from '../../../contexts/AuthContext';

import { UserRole } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';

const ProbationTab: React.FC = () => {
    const { rpcAction, refreshHR } = useData();
    const { allUsers, updateUserRecord } = useMembers();
    const { hrConfig } = useConfig();
    const { currentUser, hasPermission } = useAuth();
    const fmt = useFormatDate();
    const { addToast, confirm } = useNotification();

    const canAdmin = hasPermission('hr:admin');
    const canRecruit = hasPermission('hr:recruiter');

    // Config editing
    const [editingConfig, setEditingConfig] = useState(false);
    const [probationDays, setProbationDays] = useState<string>(String(hrConfig.probationDays || ''));
    const [savingConfig, setSavingConfig] = useState(false);

    // Review state
    const [reviewingUserId, setReviewingUserId] = useState<number | null>(null);
    const [reviewNotes, setReviewNotes] = useState('');
    const [saving, setSaving] = useState(false);

    // Members on probation (have probation_end set and are Member+)
    const probationMembers = useMemo(() => {
        return allUsers
            .filter(u => u.probationEnd && u.role !== UserRole.Client)
            .sort((a, b) => new Date(a.probationEnd!).getTime() - new Date(b.probationEnd!).getTime());
    }, [allUsers]);

    const now = new Date();

    const activeCount = probationMembers.filter(u => new Date(u.probationEnd!) > now).length;
    const overdueCount = probationMembers.filter(u => new Date(u.probationEnd!) <= now).length;

    const handleSaveConfig = useCallback(async () => {
        setSavingConfig(true);
        try {
            const days = parseInt(probationDays) || 0;
            await rpcAction('admin:update_hr_config', { config: { probationDays: days > 0 ? days : 0 } });
            setEditingConfig(false);
            addToast("Config Saved", <i className="fa-solid fa-check"></i>, "bg-emerald-500/10 text-emerald-400 border-emerald-500/50");
        } catch {
            addToast("Save Failed", <i className="fa-solid fa-xmark"></i>, "bg-red-500/10 text-red-400 border-red-500/50");
        } finally {
            setSavingConfig(false);
        }
    }, [probationDays, rpcAction, addToast]);

    const handleConfirmProbation = useCallback(async (userId: number, userName: string) => {
        const confirmed = await confirm({
            title: 'Confirm Probation Complete',
            message: `Clear probation for ${userName}? They will become a full member.`,
            confirmText: 'Confirm',
            variant: 'danger'
        });
        if (!confirmed) return;

        setSaving(true);
        try {
            await updateUserRecord(userId, { probationStart: null, probationEnd: null });
            addToast("Probation Cleared", <i className="fa-solid fa-check"></i>, "bg-emerald-500/10 text-emerald-400 border-emerald-500/50", { description: `${userName} is now a full member.` });
        } catch {
            addToast("Failed", <i className="fa-solid fa-xmark"></i>, "bg-red-500/10 text-red-400 border-red-500/50");
        } finally {
            setSaving(false);
            setReviewingUserId(null);
            setReviewNotes('');
        }
    }, [confirm, updateUserRecord, addToast]);

    const handleDemote = useCallback(async (userId: number, userName: string) => {
        const confirmed = await confirm({
            title: 'Demote to Client',
            message: `Demote ${userName} back to Client? This will remove their Member status and clear probation.`,
            confirmText: 'Demote',
            variant: 'danger'
        });
        if (!confirmed) return;

        setSaving(true);
        try {
            // Clear probation dates, then demote to Client via role change.
            await updateUserRecord(userId, { probationStart: null, probationEnd: null });
            const clientRole = allUsers.find(u => u.role === UserRole.Client);
            // Take the client role ID from an existing client user.
            const clientUsers = allUsers.filter(u => u.role === UserRole.Client);
            if (clientUsers.length > 0) {
                await updateUserRecord(userId, { roleId: clientUsers[0].roleId, probationStart: null, probationEnd: null });
            }
            addToast("Member Demoted", <i className="fa-solid fa-arrow-down"></i>, "bg-amber-500/10 text-amber-400 border-amber-500/50", { description: `${userName} has been demoted to Client.` });
        } catch {
            addToast("Failed", <i className="fa-solid fa-xmark"></i>, "bg-red-500/10 text-red-400 border-red-500/50");
        } finally {
            setSaving(false);
            setReviewingUserId(null);
            setReviewNotes('');
        }
    }, [confirm, updateUserRecord, addToast, allUsers]);

    const getDaysRemaining = (endDate: string) => {
        const end = new Date(endDate);
        const diff = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diff;
    };

    const getProgressPercent = (start: string, end: string) => {
        const s = new Date(start).getTime();
        const e = new Date(end).getTime();
        const n = now.getTime();
        if (n >= e) return 100;
        if (n <= s) return 0;
        return Math.round(((n - s) / (e - s)) * 100);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                        <i className="fa-solid fa-hourglass-half text-emerald-300"></i>
                        Probation Tracker
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Monitor and review new members on probation.</p>
                </div>
                <div className="flex items-center gap-2 text-xs">
                    <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider text-[10px]">
                        {activeCount} Active
                    </span>
                    {overdueCount > 0 && (
                        <span className="bg-red-500/10 text-red-300 border border-red-500/30 px-2.5 py-1 rounded-lg font-black uppercase tracking-wider text-[10px] animate-pulse">
                            {overdueCount} Overdue
                        </span>
                    )}
                </div>
            </div>

            {/* Config Panel */}
            {canAdmin && (
                <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-300">
                            <i className="fa-solid fa-gear text-sm"></i>
                        </div>
                        <h3 className="font-bold text-white text-sm uppercase tracking-wider">Probation Settings</h3>
                    </div>
                    <div className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <p className="text-xs text-slate-400 leading-relaxed">
                            {hrConfig.probationDays && hrConfig.probationDays > 0
                                ? `New hires are placed on ${hrConfig.probationDays}-day probation automatically.`
                                : 'Probation is not configured. New hires will not be placed on probation.'}
                        </p>
                        {editingConfig ? (
                            <div className="flex items-center gap-2 flex-wrap">
                                <input
                                    type="number"
                                    value={probationDays}
                                    onChange={e => setProbationDays(e.target.value)}
                                    placeholder="Days"
                                    min="0"
                                    max="365"
                                    className="w-20 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm text-center font-mono focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/30 outline-hidden transition-all"
                                />
                                <span className="text-xs text-slate-500">days</span>
                                <button
                                    onClick={handleSaveConfig}
                                    disabled={savingConfig}
                                    className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/40 rounded-lg shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
                                >
                                    {savingConfig ? <i className="fa-solid fa-spinner animate-spin"></i> : 'Save'}
                                </button>
                                <button
                                    onClick={() => { setEditingConfig(false); setProbationDays(String(hrConfig.probationDays || '')); }}
                                    className="px-3 py-2 text-slate-400 hover:text-white text-xs font-bold uppercase tracking-widest transition-colors"
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => { setEditingConfig(true); setProbationDays(String(hrConfig.probationDays || '')); }}
                                className="flex items-center gap-2 px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 bg-slate-900/60 border border-slate-700 rounded-lg hover:border-emerald-500/40 hover:bg-emerald-500/10 hover:text-emerald-300 transition whitespace-nowrap"
                            >
                                <i className="fa-solid fa-pen"></i> Configure
                            </button>
                        )}
                    </div>
                </div>
            )}

            {/* Probation List */}
            {probationMembers.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30 p-10 text-center">
                    <i className="fa-solid fa-hourglass text-4xl text-emerald-400 opacity-40 mb-3"></i>
                    <h3 className="text-lg font-bold text-white mb-1">No Members on Probation</h3>
                    <p className="text-sm text-slate-500">
                        {hrConfig.probationDays && hrConfig.probationDays > 0
                            ? 'New hires will appear here when placed on probation.'
                            : 'Configure a probation period above to enable automatic probation for new hires.'}
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {probationMembers.map(member => {
                        const daysLeft = getDaysRemaining(member.probationEnd!);
                        const isOverdue = daysLeft <= 0;
                        const isWarning = daysLeft > 0 && daysLeft <= 7;
                        const progress = member.probationStart ? getProgressPercent(member.probationStart, member.probationEnd!) : 100;
                        const isReviewing = reviewingUserId === member.id;

                        return (
                            <div key={member.id} className={`bg-slate-900/80 backdrop-blur-md border rounded-xl overflow-hidden transition-colors ${isOverdue ? 'border-red-500/40 shadow-lg shadow-red-900/20' : isWarning ? 'border-amber-500/40' : 'border-slate-700/50'
                                }`}>
                                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <img src={member.avatarUrl} alt="" className="w-10 h-10 rounded-lg border border-slate-700 shrink-0 object-cover" />
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-white truncate">{member.name}</p>
                                            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-widest">{member.rsiHandle}</p>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-4 shrink-0">
                                        <div className="text-right">
                                            {isOverdue ? (
                                                <span className="text-xs font-black text-red-300 uppercase tracking-wider flex items-center gap-1.5 animate-pulse">
                                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                                    Overdue ({Math.abs(daysLeft)}d)
                                                </span>
                                            ) : (
                                                <span className={`text-xs font-black uppercase tracking-wider ${isWarning ? 'text-amber-300' : 'text-slate-400'}`}>
                                                    {daysLeft}d remaining
                                                </span>
                                            )}
                                            <p className="text-[10px] text-slate-500 mt-0.5 uppercase tracking-widest font-mono">
                                                Ends {fmt.date(member.probationEnd!)}
                                            </p>
                                        </div>

                                        <div className="w-20 sm:w-28 hidden sm:block">
                                            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full rounded-full transition-all ${isOverdue ? 'bg-red-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                                                        }`}
                                                    style={{ width: `${Math.min(progress, 100)}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        {(canRecruit || canAdmin) && (
                                            <button
                                                onClick={() => setReviewingUserId(isReviewing ? null : member.id)}
                                                className={`flex items-center gap-2 px-3 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg border transition-colors shrink-0 ${isReviewing
                                                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                                                    : 'text-slate-400 border-slate-700 hover:border-emerald-500/40 hover:text-emerald-300 hover:bg-emerald-500/10'
                                                    }`}
                                            >
                                                <i className="fa-solid fa-clipboard-check"></i>Review
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {isReviewing && (
                                    <div className="border-t border-white/5 p-4 bg-slate-950/40 space-y-3">
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Start Date</p>
                                                <p className="text-slate-300 font-mono text-xs">{member.probationStart ? fmt.date(member.probationStart) : 'N/A'}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">End Date</p>
                                                <p className="text-slate-300 font-mono text-xs">{fmt.date(member.probationEnd!)}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Role</p>
                                                <p className="text-slate-300 text-xs">{member.role}</p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-1">Unit</p>
                                                <p className="text-slate-300 text-xs truncate">{member.unit?.name || 'Unassigned'}</p>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row gap-2 pt-2">
                                            <button
                                                onClick={() => handleConfirmProbation(member.id, member.name)}
                                                disabled={saving}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 border border-emerald-500/40 rounded-lg shadow-lg shadow-emerald-900/30 transition disabled:opacity-50"
                                            >
                                                <i className="fa-solid fa-check"></i> Confirm — Full Member
                                            </button>
                                            <button
                                                onClick={() => handleDemote(member.id, member.name)}
                                                disabled={saving}
                                                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg hover:bg-red-500/20 shadow-lg shadow-red-900/20 transition disabled:opacity-50"
                                            >
                                                <i className="fa-solid fa-arrow-down"></i> Demote to Client
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default ProbationTab;
