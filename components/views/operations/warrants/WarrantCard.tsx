import React from 'react';
import { HydratedWarrant, WarrantStatus } from '../../../../types';
import { ACCENTS } from '../../../shared/ui/accents';
import { useNotification } from '../../../../contexts/NotificationContext';
import {
    warrantStatusAccent,
    warrantStatusIcon,
    warrantStatusLabel,
    warrantIsLive,
    warrantActionAccent,
    warrantActionIcon,
    warrantActionLabel,
    timeAgoShort,
} from './warrantStyles';

interface Props {
    warrant: HydratedWarrant;
    canManage: boolean;
    onUpdate: (warrant: HydratedWarrant) => void;
    onDelete: (warrantId: string) => Promise<void> | void;
    onClick?: () => void;
}

const WarrantCard: React.FC<Props> = ({ warrant, canManage, onUpdate, onDelete, onClick }) => {
    const { confirm } = useNotification();

    const statusA = ACCENTS[warrantStatusAccent(warrant.status)];
    const statusIcon = warrantStatusIcon(warrant.status);
    const isLive = warrantIsLive(warrant.status);

    const actionA = ACCENTS[warrantActionAccent(warrant.action)];
    const actionIcon = warrantActionIcon(warrant.action);
    const actionLabel = warrantActionLabel(warrant.action);

    const warrantShortId = warrant.id.substring(0, 6).toUpperCase();

    const handleDelete = async (e: React.MouseEvent) => {
        e.stopPropagation();
        const confirmed = await confirm({
            title: 'Delete Caution Note',
            message: `Are you sure you want to delete the caution note for ${warrant.targetRsiHandle}?`,
            confirmText: 'Delete',
            variant: 'danger',
        });
        if (confirmed) await onDelete(warrant.id);
    };

    return (
        <div
            onClick={onClick}
            className="group relative flex flex-col h-full rounded-xl overflow-hidden border border-white/10 bg-linear-to-br from-slate-900/80 via-slate-900/60 to-slate-950/80 backdrop-blur-xs shadow-lg transition-all duration-300 cursor-pointer hover:border-white/20 hover:shadow-xl"
        >
            <div className={`absolute inset-y-0 left-0 w-1 ${statusA.dot} ${isLive ? 'animate-pulse' : ''}`} aria-hidden />

            <div
                className={`absolute -top-20 -left-10 w-64 h-64 ${statusA.bg} rounded-full blur-[90px] opacity-0 group-hover:opacity-60 pointer-events-none transition-opacity duration-500`}
                aria-hidden
            />

            <div className="relative pl-4 pr-3 py-3 bg-slate-950/40 border-b border-white/5 flex items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-12 h-12 rounded-lg ${actionA.bg} border ${actionA.border} flex items-center justify-center shrink-0`}>
                        <i className={`fa-solid ${actionIcon} ${actionA.text} text-xl`} aria-hidden />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-white font-black text-lg sm:text-xl tracking-tight uppercase truncate font-mono">
                            {warrant.targetRsiHandle}
                        </h3>
                        <div className="flex items-center gap-2 mt-0.5">
                            <span className="font-mono text-[10px] text-slate-500 tracking-wider">WRT-{warrantShortId}</span>
                            <span className="text-slate-700">·</span>
                            <span className="text-[10px] text-slate-500 font-mono">
                                <i className="fa-regular fa-clock mr-1" aria-hidden />
                                {timeAgoShort(warrant.issuedAt)}
                            </span>
                            <span className="text-slate-700">·</span>
                            <span className={`text-[10px] font-black uppercase tracking-widest ${actionA.text}`}>
                                {actionLabel}
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                    {warrant.sourceFeedLabel && (
                        <span
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm border font-black text-[9px] uppercase tracking-widest bg-sky-500/10 text-sky-300 border-sky-500/30"
                            title={warrant.sourceFeedLabel}
                        >
                            <i className="fa-solid fa-satellite-dish" aria-hidden /> EXT
                        </span>
                    )}
                    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-sm border font-black text-[10px] uppercase tracking-wider ${statusA.bg} ${statusA.border} ${statusA.text} ${isLive ? 'animate-pulse' : ''}`}>
                        <i className={`fa-solid ${statusIcon}`} aria-hidden />
                        {warrantStatusLabel(warrant.status)}
                    </span>
                </div>
            </div>

            <div className="relative pl-4 pr-4 py-4 grow grid grid-cols-1 md:grid-cols-5 gap-4 min-h-0">
                <div className="md:col-span-2 flex flex-col gap-3 min-w-0">
                    <div className="p-3 rounded-lg bg-slate-950/40 border border-white/5">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1.5">Reward Value</p>
                        <div className="flex items-baseline gap-2">
                            <span className="text-2xl font-black text-lime-400 font-mono tracking-tight leading-none">{warrant.uecReward.toLocaleString()}</span>
                            <span className="text-[10px] font-bold text-lime-400/70 uppercase tracking-widest">aUEC</span>
                        </div>
                    </div>

                    {warrant.issuedBy == null && warrant.sourceFeedLabel ? (
                        // Federated warrant: no local issuer, so show "via <ally>" provenance
                        // rather than fake admin attribution.
                        <div className="flex items-center gap-2 text-[11px] text-sky-300 min-w-0">
                            <i className="fa-solid fa-satellite-dish text-slate-500 shrink-0" aria-hidden />
                            <span className="text-slate-500 uppercase font-black tracking-widest text-[9px]">Issued</span>
                            <span className="truncate font-semibold">via {warrant.sourceFeedLabel}</span>
                        </div>
                    ) : warrant.issuedByUser && (
                        <div className="flex items-center gap-2 text-[11px] text-slate-300 min-w-0">
                            <i className="fa-solid fa-stamp text-slate-500 shrink-0" aria-hidden />
                            <span className="text-slate-500 uppercase font-black tracking-widest text-[9px]">Issued</span>
                            <img
                                src={warrant.issuedByUser.avatarUrl}
                                alt=""
                                className="w-5 h-5 rounded-full border border-slate-700 shrink-0"
                            />
                            <span className="truncate font-semibold">{warrant.issuedByUser.name}</span>
                        </div>
                    )}

                    {warrant.status === WarrantStatus.Claimed && warrant.claimedByUser && (
                        <div className="flex items-center gap-2 text-[11px] text-emerald-200 min-w-0 p-2 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
                            <i className="fa-solid fa-handcuffs text-emerald-400 shrink-0" aria-hidden />
                            <span className="text-emerald-400/80 uppercase font-black tracking-widest text-[9px]">Claimed</span>
                            <img
                                src={warrant.claimedByUser.avatarUrl}
                                alt=""
                                className="w-5 h-5 rounded-full border border-emerald-500/40 shrink-0"
                            />
                            <span className="truncate font-semibold">{warrant.claimedByUser.name}</span>
                        </div>
                    )}
                </div>

                <div className="md:col-span-3 flex flex-col gap-3 min-w-0 md:border-l md:border-white/5 md:pl-4">
                    <div className="grow min-w-0">
                        <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-1">Authorization</p>
                        <p className="text-slate-300 text-sm leading-relaxed italic line-clamp-5">
                            &ldquo;{warrant.reason}&rdquo;
                        </p>
                    </div>

                    {warrant.notes && (
                        <div className="rounded-md border border-white/5 bg-slate-950/40 px-2.5 py-1.5">
                            <p className="text-[9px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Field Notes</p>
                            <p className="text-xs text-slate-400 line-clamp-2">{warrant.notes}</p>
                        </div>
                    )}
                </div>
            </div>

            <div className="relative pl-4 pr-3 py-2.5 bg-slate-950/40 border-t border-white/5 flex items-center justify-end gap-2 shrink-0">
                {canManage ? (
                    <>
                        <button
                            onClick={handleDelete}
                            className="px-2.5 py-1.5 rounded-sm text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-1.5"
                            title="Delete caution note"
                        >
                            <i className="fa-solid fa-trash" aria-hidden /> Delete
                        </button>
                        <button
                            onClick={(e) => { e.stopPropagation(); onUpdate(warrant); }}
                            className="px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider bg-sky-500/10 text-sky-300 border border-sky-500/30 hover:bg-sky-500/20 transition-colors"
                        >
                            <i className="fa-solid fa-pen-to-square mr-1.5" aria-hidden />
                            Manage
                        </button>
                    </>
                ) : (
                    <button
                        onClick={(e) => { e.stopPropagation(); onClick?.(); }}
                        className="px-3 py-1.5 rounded-sm text-[10px] font-black uppercase tracking-wider bg-slate-800/60 text-slate-300 border border-white/10 hover:bg-slate-700/80 transition-colors"
                    >
                        <i className="fa-solid fa-eye mr-1.5" aria-hidden /> View Details
                    </button>
                )}
            </div>
        </div>
    );
};

export default React.memo(
    WarrantCard,
    (prev, next) => prev.canManage === next.canManage && JSON.stringify(prev.warrant) === JSON.stringify(next.warrant),
);
