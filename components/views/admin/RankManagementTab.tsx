
import React, { useState, useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useMembers } from '../../../contexts/MembersContext';

import { Rank } from '../../../types';
import { TabPageHeader } from '../../shared/ui';
import { useNotification } from '../../../contexts/NotificationContext';
import { useModalRegistry } from '../../../contexts/ModalRegistryContext';

const RankManagementTab: React.FC = () => {
    const { isFetching } = useData();
    const { ranks, allUsers, deleteRank, updateRank } = useMembers();
    const { addToast, confirm } = useNotification();
    const { openRankModal } = useModalRegistry();
    const [searchTerm, setSearchTerm] = useState('');

    // Drag & Drop State
    const [draggedRank, setDraggedRank] = useState<Rank | null>(null);
    const [dropTargetId, setDropTargetId] = useState<number | null>(null);
    const [dropPosition, setDropPosition] = useState<'before' | 'after' | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    const rankData = useMemo(() => {
        const memberCounts = new Map<number, number>();
        allUsers.forEach(user => {
            if (user.rank) {
                memberCounts.set(user.rank.id, (memberCounts.get(user.rank.id) || 0) + 1);
            }
        });
        const sorted = [...ranks].sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

        return sorted.map(rank => ({
            ...rank,
            memberCount: memberCounts.get(rank.id) || 0,
        }));
    }, [ranks, allUsers]);

    const displayedRanks = useMemo(() => {
        if (!searchTerm) return rankData;
        return rankData.filter(r => r.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }, [rankData, searchTerm]);

    const handleDelete = async (rank: Rank & { memberCount: number }) => {
        if (rank.memberCount > 0) {
            await confirm({
                title: 'Cannot Delete',
                message: `Cannot delete "${rank.name}" as it is assigned to ${rank.memberCount} member(s). Please reassign them first.`,
                confirmText: 'OK',
                variant: 'info'
            });
            return;
        }
        const confirmed = await confirm({
            title: 'Delete Rank',
            message: `Are you sure you want to permanently delete the rank "${rank.name}"? This action cannot be undone.`,
            confirmText: 'Delete',
            variant: 'danger'
        });
        if (confirmed) {
            deleteRank(rank.id);
        }
    };

    // --- Drag & Drop Handlers ---
    const handleDragStart = (e: React.DragEvent, rank: Rank) => {
        if (searchTerm) return; // Disable drag during search
        setDraggedRank(rank);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', rank.id.toString());
    };

    const handleDragOver = (e: React.DragEvent, targetRank: Rank) => {
        if (!draggedRank || searchTerm || draggedRank.id === targetRank.id) return;
        e.preventDefault();
        e.stopPropagation();

        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        setDropTargetId(targetRank.id);

        if (y < height / 2) {
            setDropPosition('before');
        } else {
            setDropPosition('after');
        }
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDragLeave = () => {
        // Intentionally left empty: keep the drop target active to avoid flicker;
        // it is cleared on drop or drag end.
    };

    const handleDrop = async (e: React.DragEvent, targetRank: Rank) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedRank || searchTerm || !dropTargetId || !dropPosition) {
            setDropTargetId(null);
            setDropPosition(null);
            return;
        }

        const sourceIndex = rankData.findIndex(r => r.id === draggedRank.id);
        const targetIndex = rankData.findIndex(r => r.id === targetRank.id);

        if (sourceIndex === targetIndex) return;

        const newOrder = [...rankData];
        const [movedItem] = newOrder.splice(sourceIndex, 1);

        // Re-find the target index in the spliced array since removing the source
        // may have shifted it.
        const newTargetIndex = newOrder.findIndex(r => r.id === targetRank.id);
        const insertionIndex = dropPosition === 'before' ? newTargetIndex : newTargetIndex + 1;

        newOrder.splice(insertionIndex, 0, movedItem);

        setIsUpdating(true);
        setDraggedRank(null);
        setDropTargetId(null);
        setDropPosition(null);

        addToast('Reordering Ranks', <i className="fa-solid fa-spinner animate-spin"></i>, 'bg-slate-500/10 text-slate-300 border-slate-500/50', { description: 'Saving new rank precedence order...' });

        const updates = newOrder.map((rank, index) => ({
            ...rank,
            sortOrder: (index + 1) * 10
        }));

        try {
            await Promise.all(updates.map(r => updateRank(r)));
            addToast('Ranks Reordered', <i className="fa-solid fa-check"></i>, 'bg-green-500/10 text-green-400 border-green-500/50', { description: 'Rank precedence order updated successfully.' });
        } catch (err) {
            console.error("Failed to reorder ranks:", err);
            addToast("Reorder Failed", <i className="fa-solid fa-triangle-exclamation"></i>, "bg-red-500/10 text-red-400 border-red-500/50", { description: "Failed to save the new rank order." });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="p-4 md:p-8 space-y-6 animate-fade-in">
            <TabPageHeader
                title="Rank Structure"
                icon="fa-solid fa-ranking-star"
                accent="amber"
                subtitle="Configure hierarchy and insignias. Drag rows to reorder precedence."
                meta={isFetching['main'] && (
                    <span className="text-slate-300 animate-pulse text-xs font-bold flex items-center gap-1">
                        <i className="fa-solid fa-arrows-rotate fa-spin"></i> Syncing...
                    </span>
                )}
                actions={
                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="relative flex-1 md:w-64">
                            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search ranks..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-slate-400/50 focus:border-slate-500 outline-hidden text-sm font-medium transition-all"
                            />
                        </div>
                        <button
                            onClick={() => openRankModal()}
                            className="flex items-center justify-center bg-slate-700 text-white font-bold px-4 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors shadow-lg text-sm whitespace-nowrap"
                        >
                            <i className="fa-solid fa-plus mr-2" />
                            Create Rank
                        </button>
                    </div>
                }
            />

            <div className={`bg-slate-900/40 rounded-xl border border-slate-700/50 overflow-hidden ${isUpdating ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="flex bg-slate-800/60 p-4 border-b border-slate-700/50 text-xs font-black text-slate-500 uppercase tracking-widest">
                    <div className="w-10"></div>
                    <div className="w-16">Insignia</div>
                    <div className="w-24 text-center">Precedence</div>
                    <div className="flex-1">Rank Name</div>
                    <div className="w-32 hidden md:block">System ID</div>
                    <div className="w-32 text-center">Personnel</div>
                    <div className="w-32 text-right">Actions</div>
                </div>

                <div className="divide-y divide-slate-700/50">
                    {displayedRanks.map((rank) => {
                        const isDragging = draggedRank?.id === rank.id;
                        const isTarget = dropTargetId === rank.id;

                        return (
                            <div
                                key={rank.id}
                                className={`flex items-center p-4 hover:bg-slate-800/50 transition-colors group relative ${isDragging ? 'bg-slate-900 opacity-40' : ''}`}
                                draggable={!searchTerm}
                                onDragStart={(e) => handleDragStart(e, rank)}
                                onDragOver={(e) => handleDragOver(e, rank)}
                                onDragLeave={handleDragLeave}
                                onDrop={(e) => handleDrop(e, rank)}
                            >
                                {/* Drop Indicator Lines */}
                                {isTarget && dropPosition === 'before' && (
                                    <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300 z-10 shadow-[0_0_10px_rgba(148,163,184,0.8)]"></div>
                                )}
                                {isTarget && dropPosition === 'after' && (
                                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-300 z-10 shadow-[0_0_10px_rgba(148,163,184,0.8)]"></div>
                                )}
                                {isTarget && (
                                    <div className="absolute inset-0 bg-slate-400/10 pointer-events-none"></div>
                                )}

                                <div className="w-10 flex justify-center text-slate-600 cursor-grab active:cursor-grabbing hover:text-slate-400 transition-colors">
                                    <i className="fa-solid fa-grip-vertical"></i>
                                </div>

                                <div className="w-16 shrink-0">
                                    <div className="w-10 h-10 bg-slate-800 rounded-sm flex items-center justify-center border border-slate-700">
                                        <img src={rank.iconUrl || 'https://via.placeholder.com/40'} alt={rank.name} className="h-6 w-6 object-contain" />
                                    </div>
                                </div>

                                <div className="w-24 text-center text-xs font-mono text-slate-500">
                                    {rank.sortOrder}
                                </div>

                                <div className="flex-1 min-w-0 pr-4">
                                    <h3 className="text-white font-bold text-sm group-hover:text-white transition-colors truncate">{rank.name}</h3>
                                </div>

                                <div className="w-32 hidden md:block">
                                    <span className="font-mono text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-sm border border-slate-700">{rank.id}</span>
                                </div>

                                <div className="w-32 text-center">
                                    <span className={`text-xs font-mono font-bold px-2 py-1 rounded-sm ${rank.memberCount > 0 ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>
                                        {rank.memberCount}
                                    </span>
                                </div>

                                <div className="w-32 text-right flex justify-end gap-2">
                                    <button onClick={() => openRankModal(rank)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-sm transition-colors" title="Edit">
                                        <i className="fa-solid fa-pencil"></i>
                                    </button>
                                    <button onClick={() => handleDelete(rank)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-sm transition-colors" title="Delete">
                                        <i className="fa-solid fa-trash-can"></i>
                                    </button>
                                </div>
                            </div>
                        )
                    })}

                    {displayedRanks.length === 0 && (
                        <div className="p-12 text-center">
                            <p className="text-slate-500 font-medium italic">No ranks found.</p>
                        </div>
                    )}
                </div>
            </div>
            <p className="text-center text-xs text-slate-600 mt-4 italic">
                {isUpdating ? (
                    <span className="text-slate-300"><i className="fa-solid fa-circle-notch animate-spin mr-2"></i> Reordering ranks...</span>
                ) : (
                    <>
                        <i className="fa-solid fa-lightbulb mr-1 text-amber-500/50"></i>
                        Tip: Drag and drop rows to change rank precedence.
                    </>
                )}
            </p>
        </div>
    );
};

export default RankManagementTab;
