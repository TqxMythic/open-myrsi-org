
import React, { useMemo, useState } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useMembers } from '../../../contexts/MembersContext';
import { useAuth } from '../../../contexts/AuthContext';
import { SecurityClearance, LimitingMarker } from '../../../types';
import { TabPageHeader, HeroStat } from '../../shared/ui';
import { useNotification } from '../../../contexts/NotificationContext';
import { useModalRegistry } from '../../../contexts/ModalRegistryContext';

const getClearanceColor = (level: number) => {
    switch (level) {
        case 1: return 'text-green-400 border-green-500/30 bg-green-500/10';
        case 2: return 'text-sky-400 border-sky-500/30 bg-sky-500/10';
        case 3: return 'text-amber-400 border-amber-500/30 bg-amber-500/10';
        case 4: return 'text-orange-400 border-orange-500/30 bg-orange-500/10';
        case 5: return 'text-red-400 border-red-500/30 bg-red-500/10';
        default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    }
};

// Local SectionCard helper — same chrome as the other detail views.
const SectionCard: React.FC<{
    title: string;
    icon: string;
    accent?: 'sky' | 'amber' | 'red' | 'emerald';
    children: React.ReactNode;
    contentClassName?: string;
    actions?: React.ReactNode;
    note?: string;
}> = ({ title, icon, accent = 'sky', children, contentClassName, actions, note }) => {
    const accents = {
        sky: { bg: 'bg-sky-500/10', border: 'border-sky-500/30', text: 'text-sky-300' },
        amber: { bg: 'bg-amber-500/10', border: 'border-amber-500/30', text: 'text-amber-300' },
        red: { bg: 'bg-red-500/10', border: 'border-red-500/30', text: 'text-red-300' },
        emerald: { bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', text: 'text-emerald-300' },
    } as const;
    const a = accents[accent];
    return (
        <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5 bg-white/5 flex items-center gap-3">
                <div className={`h-8 w-8 rounded-lg ${a.bg} border ${a.border} flex items-center justify-center shrink-0`}>
                    <i className={`fa-solid ${icon} ${a.text} text-sm`}></i>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-black uppercase tracking-widest text-slate-200">{title}</h3>
                    {note && <p className="text-[10px] text-slate-500 mt-0.5">{note}</p>}
                </div>
                {actions}
            </div>
            <div className={contentClassName ?? 'p-5 space-y-4'}>{children}</div>
        </div>
    );
};

const ClearanceManagementTab: React.FC = () => {
    const { rpcAction, refreshMainState } = useData();
    const { securityClearances, limitingMarkers } = useMembers();
    const { addToast, confirm } = useNotification();
    const { openBulkAssignClearanceModal } = useModalRegistry();
    const { hasPermission } = useAuth();

    const [editingId, setEditingId] = useState<number | null>(null);
    const [editName, setEditName] = useState('');
    const [editDesc, setEditDesc] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const [editingMarkerId, setEditingMarkerId] = useState<number | null>(null);
    const [markerName, setMarkerName] = useState('');
    const [markerCode, setMarkerCode] = useState('');
    const [markerDesc, setMarkerDesc] = useState('');
    const [markerSyncRestricted, setMarkerSyncRestricted] = useState(false);

    const syncRestrictedCount = useMemo(
        () => limitingMarkers.filter(m => m.syncRestricted).length,
        [limitingMarkers]
    );

    const startEdit = (c: SecurityClearance) => {
        setEditingId(c.id);
        setEditName(c.name);
        setEditDesc(c.description || '');
    };
    const cancelEdit = () => setEditingId(null);

    const saveEdit = async () => {
        if (!editingId) return;
        setIsLoading(true);
        try {
            await rpcAction('admin:update_clearance', { id: editingId, name: editName, description: editDesc });
            setEditingId(null);
            await refreshMainState();
        } catch (error) {
            console.error("Failed to update clearance:", error);
            addToast("Update Failed", <i className="fa-solid fa-xmark"></i>, "bg-red-500/10 text-red-400 border-red-500/50", { description: "Could not update the clearance level." });
        } finally {
            setIsLoading(false);
        }
    };

    const startEditMarker = (m?: LimitingMarker) => {
        if (m) {
            setEditingMarkerId(m.id);
            setMarkerName(m.name);
            setMarkerCode(m.code);
            setMarkerDesc(m.description || '');
            setMarkerSyncRestricted(m.syncRestricted || false);
        } else {
            setEditingMarkerId(-1);
            setMarkerName('');
            setMarkerCode('');
            setMarkerDesc('');
            setMarkerSyncRestricted(false);
        }
    };
    const cancelEditMarker = () => setEditingMarkerId(null);

    const saveMarker = async () => {
        if (editingMarkerId === null) return;
        setIsLoading(true);
        try {
            if (editingMarkerId === -1) {
                await rpcAction('admin:add_marker', { name: markerName, code: markerCode.toUpperCase(), description: markerDesc, syncRestricted: markerSyncRestricted });
            } else {
                await rpcAction('admin:update_marker', { id: editingMarkerId, name: markerName, code: markerCode.toUpperCase(), description: markerDesc, syncRestricted: markerSyncRestricted });
            }
            setEditingMarkerId(null);
            await refreshMainState();
        } catch (error) {
            console.error("Failed to save marker:", error);
            addToast("Save Failed", <i className="fa-solid fa-xmark"></i>, "bg-red-500/10 text-red-400 border-red-500/50", { description: "Could not save the limiting marker." });
        } finally {
            setIsLoading(false);
        }
    };

    const deleteMarker = async (id: number) => {
        const confirmed = await confirm({ title: 'Delete Marker', message: 'WARNING: Deleting a marker may cause sync issues with external organizations if they rely on this specific code. Are you sure?', confirmText: 'Delete', variant: 'danger' });
        if (!confirmed) return;
        setIsLoading(true);
        try {
            await rpcAction('admin:delete_marker', { id });
            await refreshMainState();
        } catch (error) {
            console.error(error);
            addToast("Delete Failed", <i className="fa-solid fa-xmark"></i>, "bg-red-500/10 text-red-400 border-red-500/50", { description: "Could not delete the limiting marker." });
        } finally {
            setIsLoading(false);
        }
    };

    const inputClass = "w-full bg-slate-950/60 border border-slate-700 rounded-lg px-3 py-2 text-white text-sm focus:border-red-500/40 focus:ring-1 focus:ring-red-500/30 outline-hidden transition-colors";
    const inputClassMono = `${inputClass} font-mono uppercase`;
    const canBulkAssign = hasPermission('admin:user:manage_clearance');

    return (
        <div className="p-4 md:p-8 space-y-6 animate-fade-in">
            <TabPageHeader
                title="Access Control & Clearances"
                icon="fa-solid fa-shield-halved"
                accent="red"
                subtitle="Manage security levels and compartmented information controls."
                actions={canBulkAssign ? (
                    <button
                        onClick={openBulkAssignClearanceModal}
                        className="flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-bold px-4 py-2.5 rounded-lg border border-red-500/40 transition-colors shadow-lg shadow-red-900/20 text-sm whitespace-nowrap"
                    >
                        <i className="fa-solid fa-users-gear" />
                        Bulk Assign Clearance
                    </button>
                ) : undefined}
            />

            <div className="hidden md:grid grid-cols-3 gap-3">
                <HeroStat icon="fa-shield-halved" label="Clearance Levels" value={securityClearances.length} accent="sky" emphasize={securityClearances.length > 0} />
                <HeroStat icon="fa-tags" label="Limiting Markers" value={limitingMarkers.length} accent="amber" emphasize={limitingMarkers.length > 0} />
                <HeroStat icon="fa-ban" label="Sync Restricted" value={syncRestrictedCount} accent="red" emphasize={syncRestrictedCount > 0} />
            </div>

            <SectionCard title="Clearance Levels" icon="fa-shield-halved" accent="sky" note="Hierarchical access tiers (1–5 are protected baselines)." contentClassName="divide-y divide-slate-800">
                    {securityClearances.map(c => (
                        <div key={c.id} className={`p-4 transition-colors ${editingId === c.id ? 'bg-slate-950/40' : 'hover:bg-slate-950/20'}`}>
                            <div className="flex items-start justify-between gap-4 mb-2">
                                <div className="flex-1 min-w-0">
                                    {editingId === c.id ? (
                                        <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                                            className={`${inputClass} font-bold uppercase tracking-wide`} autoFocus />
                                    ) : (
                                        <div className={`inline-flex items-center gap-3 px-3 py-1.5 rounded-lg border font-black uppercase text-xs tracking-wider ${getClearanceColor(c.level)}`}>
                                            <i className="fa-solid fa-shield-halved"></i>
                                            Level {c.level} <span className="opacity-50">{'//'}</span> {c.name}
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-1 pt-0.5 shrink-0">
                                    {editingId === c.id ? (
                                        <>
                                            <button onClick={saveEdit} disabled={isLoading} className="text-emerald-300 hover:text-emerald-200 p-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 rounded-sm transition-colors"><i className="fa-solid fa-check"></i></button>
                                            <button onClick={cancelEdit} disabled={isLoading} className="text-slate-400 hover:text-white p-1.5 bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 rounded-sm transition-colors"><i className="fa-solid fa-xmark"></i></button>
                                        </>
                                    ) : (
                                        <button onClick={() => startEdit(c)} className="text-slate-400 hover:text-sky-300 p-1.5 hover:bg-slate-800/60 rounded-sm transition-colors">
                                            <i className="fa-solid fa-pencil"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div className="pl-1">
                                {editingId === c.id ? (
                                    <textarea value={editDesc} onChange={e => setEditDesc(e.target.value)}
                                        className={`${inputClass} text-xs resize-none`} rows={2} />
                                ) : (
                                    <p className="text-xs text-slate-400 leading-relaxed">{c.description}</p>
                                )}
                            </div>
                        </div>
                    ))}
                </SectionCard>

                {/* LIMITING MARKERS */}
                <SectionCard
                    title="Limiting Markers"
                    icon="fa-tags"
                    accent="amber"
                    note="Compartmented control tags (e.g. NOFORN). Affects Intel feed sync."
                    contentClassName="divide-y divide-slate-800"
                    actions={
                        <button onClick={() => startEditMarker()}
                            className="text-[10px] font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-sm uppercase tracking-wider transition-colors">
                            <i className="fa-solid fa-plus mr-1"></i> Add Marker
                        </button>
                    }
                >
                    {/* New marker form */}
                    {editingMarkerId === -1 && (
                        <div className="p-4 bg-amber-500/4 border-b border-amber-500/15">
                            <div className="flex gap-2 mb-2">
                                <input type="text" placeholder="Code (e.g. ORCON)" value={markerCode}
                                    onChange={e => setMarkerCode(e.target.value.toUpperCase())}
                                    className={`${inputClassMono} w-32 text-xs`} />
                                <input type="text" placeholder="Full Name" value={markerName}
                                    onChange={e => setMarkerName(e.target.value)}
                                    className={`${inputClass} flex-1 text-sm`} />
                            </div>
                            <textarea placeholder="Description..." value={markerDesc}
                                onChange={e => setMarkerDesc(e.target.value)}
                                className={`${inputClass} text-xs resize-none mb-3`} rows={2} />
                            <label className="flex items-center gap-2 cursor-pointer mb-3">
                                <input type="checkbox" checked={markerSyncRestricted}
                                    onChange={e => setMarkerSyncRestricted(e.target.checked)}
                                    className="h-4 w-4 rounded-sm bg-slate-800 border-slate-600 text-red-500 focus:ring-red-500" />
                                <span className="text-xs text-red-300 font-bold uppercase tracking-wide">
                                    <i className="fa-solid fa-ban mr-1"></i> Restrict from External Sync
                                </span>
                            </label>
                            <div className="flex justify-end gap-2">
                                <button onClick={cancelEditMarker} disabled={isLoading} className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 px-3 py-1.5 rounded-sm uppercase tracking-wider transition-colors">Cancel</button>
                                <button onClick={saveMarker} disabled={isLoading} className="text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-sm uppercase tracking-wider transition-colors">Save</button>
                            </div>
                        </div>
                    )}

                    {limitingMarkers.map(m => (
                        <div key={m.id} className={`p-4 transition-colors ${editingMarkerId === m.id ? 'bg-slate-950/40' : 'hover:bg-slate-950/20'}`}>
                            {editingMarkerId === m.id ? (
                                <div>
                                    <div className="flex gap-2 mb-2">
                                        <input type="text" value={markerCode}
                                            onChange={e => setMarkerCode(e.target.value.toUpperCase())}
                                            className={`${inputClassMono} w-32 text-xs`} />
                                        <input type="text" value={markerName}
                                            onChange={e => setMarkerName(e.target.value)}
                                            className={`${inputClass} flex-1 text-sm`} />
                                    </div>
                                    <textarea value={markerDesc} onChange={e => setMarkerDesc(e.target.value)}
                                        className={`${inputClass} text-xs resize-none mb-3`} rows={2} />
                                    <label className="flex items-center gap-2 cursor-pointer mb-3">
                                        <input type="checkbox" checked={markerSyncRestricted}
                                            onChange={e => setMarkerSyncRestricted(e.target.checked)}
                                            className="h-4 w-4 rounded-sm bg-slate-800 border-slate-600 text-red-500 focus:ring-red-500" />
                                        <span className="text-xs text-red-300 font-bold uppercase tracking-wide">
                                            <i className="fa-solid fa-ban mr-1"></i> Restrict from External Sync
                                        </span>
                                    </label>
                                    <div className="flex justify-end gap-2">
                                        <button onClick={cancelEditMarker} disabled={isLoading} className="text-xs font-bold text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-700/60 border border-slate-700 px-3 py-1.5 rounded-sm uppercase tracking-wider transition-colors">Cancel</button>
                                        <button onClick={saveMarker} disabled={isLoading} className="text-xs font-bold text-amber-300 hover:text-amber-200 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 rounded-sm uppercase tracking-wider transition-colors">Save</button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex justify-between items-start group gap-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                                            <span className="text-[10px] bg-slate-950/60 text-slate-300 border border-slate-700 px-1.5 py-0.5 rounded-sm font-mono font-bold">
                                                {m.code}
                                            </span>
                                            <span className="text-sm font-bold text-white">{m.name}</span>
                                            {m.syncRestricted && (
                                                <span className="text-[9px] bg-red-500/10 text-red-300 border border-red-500/30 px-1.5 py-0.5 rounded-sm uppercase font-black tracking-wider flex items-center gap-1">
                                                    <i className="fa-solid fa-ban"></i> No Sync
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-400">{m.description}</p>
                                    </div>
                                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                        <button onClick={() => startEditMarker(m)} className="p-1.5 text-slate-400 hover:text-amber-300 hover:bg-slate-800/60 rounded-sm transition-colors"><i className="fa-solid fa-pencil"></i></button>
                                        <button onClick={() => deleteMarker(m.id)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-sm transition-colors"><i className="fa-solid fa-trash-can"></i></button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                    {limitingMarkers.length === 0 && editingMarkerId !== -1 && (
                        <div className="p-8 text-center text-slate-500 italic text-sm">No limiting markers defined.</div>
                    )}
                </SectionCard>

            <SectionCard title="API Sync Warning" icon="fa-triangle-exclamation" accent="red">
                <p className="text-xs text-amber-200 leading-relaxed">
                    Modifying or deleting Limiting Markers may affect intelligence reports synchronized with external organizations. If a marker (e.g., NOFORN) is removed locally but used by an allied organization's feed, reports containing that tag may be filtered out or display incorrectly. Use the <span className="font-bold text-red-300">Restrict from External Sync</span> toggle to prevent a specific marker from being exposed in your public API feed.
                </p>
            </SectionCard>
        </div>
    );
};

export default ClearanceManagementTab;
