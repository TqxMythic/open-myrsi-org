
import React, { useState, useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useMembers } from '../../../contexts/MembersContext';

import { OrganizationalUnit } from '../../../types';
import { TabPageHeader } from '../../shared/ui';
import { useNotification } from '../../../contexts/NotificationContext';
import { useModalRegistry } from '../../../contexts/ModalRegistryContext';

type UnitNode = OrganizationalUnit & { children: UnitNode[], memberCount: number };

const UnitManagementTab: React.FC = () => {
    const { isFetching } = useData();
    const { units, allUsers, deleteUnit, updateUnit } = useMembers();
    const { addToast, confirm } = useNotification();
    const { openUnitModal } = useModalRegistry();
    const [searchTerm, setSearchTerm] = useState('');

    // Drag & Drop State
    const [draggedUnit, setDraggedUnit] = useState<UnitNode | null>(null);
    const [dropTarget, setDropTarget] = useState<{ id: number, position: 'inside' | 'before' | 'after' } | null>(null);
    const [isUpdating, setIsUpdating] = useState(false);

    // Build the hierarchy tree
    const unitTree = useMemo(() => {
        const memberCounts = new Map<number, number>();
        allUsers.forEach(user => {
            if (user.unit) {
                memberCounts.set(user.unit.id, (memberCounts.get(user.unit.id) || 0) + 1);
            }
        });

        const nodesById = new Map<number, UnitNode>(
            units.map(u => [u.id, { ...u, children: [], memberCount: memberCounts.get(u.id) || 0 }])
        );

        const roots: UnitNode[] = [];

        units.forEach(u => {
            const node = nodesById.get(u.id)!;
            if (u.parentUnitId && nodesById.has(u.parentUnitId)) {
                nodesById.get(u.parentUnitId)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        const sortNodes = (node: UnitNode) => {
            node.children.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
            node.children.forEach(sortNodes);
        };

        roots.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
        roots.forEach(sortNodes);

        return roots;
    }, [units, allUsers]);

    const filteredTree = useMemo(() => {
        if (!searchTerm.trim()) return unitTree;

        const lowerSearch = searchTerm.toLowerCase();

        const filterNode = (node: UnitNode): UnitNode | null => {
            const match = node.name.toLowerCase().includes(lowerSearch);
            const filteredChildren = node.children.map(filterNode).filter(Boolean) as UnitNode[];

            if (match || filteredChildren.length > 0) {
                return { ...node, children: filteredChildren };
            }
            return null;
        };

        return unitTree.map(filterNode).filter(Boolean) as UnitNode[];
    }, [unitTree, searchTerm]);

    const handleDelete = async (unit: UnitNode) => {
        if (unit.memberCount > 0) {
            await confirm({
                title: 'Cannot Delete',
                message: `Cannot delete "${unit.name}" as it is assigned to ${unit.memberCount} member(s). Please reassign them first.`,
                confirmText: 'OK',
                variant: 'info'
            });
            return;
        }
        if (unit.children.length > 0) {
            await confirm({
                title: 'Cannot Delete',
                message: `Cannot delete "${unit.name}" as it is the parent of ${unit.children.length} other unit(s). Please reassign or delete child units first.`,
                confirmText: 'OK',
                variant: 'info'
            });
            return;
        }
        const confirmed = await confirm({
            title: 'Delete Unit',
            message: `Permanently delete the unit "${unit.name}"? Past operations, tasks, command-node assignments, and transfer requests that referenced this unit will be preserved but unlinked. Unit posts will be deleted. This cannot be undone.`,
            confirmText: 'Delete',
            variant: 'danger'
        });
        if (confirmed) {
            try {
                await deleteUnit(unit.id);
                addToast("Unit Deleted", <i className="fa-solid fa-trash-can"></i>, "bg-slate-500/10 text-slate-300 border-slate-500/50", { description: `${unit.name} has been permanently deleted.` });
            } catch (err: any) {
                addToast("Delete Failed", <i className="fa-solid fa-triangle-exclamation"></i>, "bg-red-500/10 text-red-400 border-red-500/50", { description: err?.message || "Failed to delete the unit." });
            }
        }
    };

    // --- Drag & Drop Logic ---
    const handleDragStart = (e: React.DragEvent, unit: UnitNode) => {
        e.stopPropagation();
        setDraggedUnit(unit);
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', unit.id.toString());
    };

    const handleDragOver = (e: React.DragEvent, targetUnit: UnitNode) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedUnit || draggedUnit.id === targetUnit.id) return;

        // Prevent dragging parent into child (Circular dependency check)
        const isDescendant = (parent: UnitNode, targetId: number): boolean => {
            if (parent.id === targetId) return true;
            return parent.children.some(child => isDescendant(child, targetId));
        };

        if (isDescendant(draggedUnit, targetUnit.id)) return;

        // Calculate drop position based on mouse Y relative to target row
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const height = rect.height;

        // Zones: Top 25% = Before, Middle 50% = Inside (Reparent), Bottom 25% = After
        if (y < height * 0.25) {
            setDropTarget({ id: targetUnit.id, position: 'before' });
        } else if (y > height * 0.75) {
            setDropTarget({ id: targetUnit.id, position: 'after' });
        } else {
            setDropTarget({ id: targetUnit.id, position: 'inside' });
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Intentionally left empty: resetting the drop target here flickers when
        // moving between elements; it is cleared on drop or drag end.
    };

    const handleDrop = async (e: React.DragEvent, targetUnit: UnitNode) => {
        e.preventDefault();
        e.stopPropagation();

        if (!draggedUnit || !dropTarget || draggedUnit.id === targetUnit.id) {
            setDropTarget(null);
            setDraggedUnit(null);
            return;
        }

        setIsUpdating(true);

        try {
            // Case 1: Reparenting (Inside)
            if (dropTarget.position === 'inside') {
                await updateUnit({ ...draggedUnit, parentUnitId: targetUnit.id });
                addToast("Unit Moved", <i className="fa-solid fa-folder-tree"></i>, "bg-slate-500/10 text-slate-300 border-slate-500/50", { description: `Moved ${draggedUnit.name} into ${targetUnit.name}.` });
            }
            // Case 2: Reordering (Before/After)
            else {
                const newParentId = targetUnit.parentUnitId;

                const siblings = units
                    .filter(u => u.parentUnitId === newParentId && u.id !== draggedUnit.id)
                    .sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));

                const targetIndex = siblings.findIndex(u => u.id === targetUnit.id);
                const insertionIndex = dropTarget.position === 'before' ? targetIndex : targetIndex + 1;

                siblings.splice(insertionIndex, 0, draggedUnit);

                // Renumber sort orders across the affected siblings.
                const updates = siblings.map((u, index) => updateUnit({
                    ...u,
                    parentUnitId: newParentId, // Ensure parent matches
                    sortOrder: (index + 1) * 10
                }));

                await Promise.all(updates);
                addToast("Unit Reordered", <i className="fa-solid fa-sort"></i>, "bg-green-500/10 text-green-400 border-green-500/50", { description: `${draggedUnit.name} has been repositioned successfully.` });
            }
        } catch (err) {
            console.error("Move failed:", err);
            addToast("Move Failed", <i className="fa-solid fa-triangle-exclamation"></i>, "bg-red-500/10 text-red-400 border-red-500/50", { description: "Failed to move the unit in the hierarchy." });
        } finally {
            setIsUpdating(false);
            setDropTarget(null);
            setDraggedUnit(null);
        }
    };

    // Recursive render function
    const renderUnitRow = (unit: UnitNode, level: number = 0) => {
        const isDragging = draggedUnit?.id === unit.id;
        const isTarget = dropTarget?.id === unit.id;

        let dropIndicator = null;
        if (isTarget) {
            if (dropTarget.position === 'before') dropIndicator = <div className="absolute top-0 left-0 right-0 h-1 bg-slate-300 z-10 shadow-[0_0_10px_rgba(148,163,184,0.8)]"></div>;
            if (dropTarget.position === 'after') dropIndicator = <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-300 z-10 shadow-[0_0_10px_rgba(148,163,184,0.8)]"></div>;
            if (dropTarget.position === 'inside') dropIndicator = <div className="absolute inset-0 border-2 border-slate-300 bg-slate-400/20 z-10 pointer-events-none animate-pulse"></div>;
        }

        return (
            <React.Fragment key={unit.id}>
                <div
                    className={`flex items-center p-4 hover:bg-slate-800/50 transition-colors border-b border-slate-700/50 group relative ${isDragging ? 'opacity-40 bg-slate-900 pointer-events-none' : ''}`}
                    draggable={!searchTerm}
                    onDragStart={(e) => handleDragStart(e, unit)}
                    onDragOver={(e) => handleDragOver(e, unit)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, unit)}
                >
                    {dropIndicator}

                    {/* Drag Handle */}
                    <div className="w-8 hidden md:flex justify-center text-slate-600 cursor-grab active:cursor-grabbing mr-2 hover:text-slate-400 transition-colors">
                        <i className="fa-solid fa-grip-vertical"></i>
                    </div>

                    <div className="flex-1 flex items-center min-w-0" style={{ paddingLeft: `${level * (window.innerWidth < 768 ? 1 : 2)}rem` }}>
                        {level > 0 && <div className="w-4 h-4 border-l-2 border-b-2 border-slate-600 rounded-bl mr-3 -mt-3"></div>}
                        <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-sm bg-slate-800 flex items-center justify-center border border-slate-700 shrink-0 ${level === 0 ? 'text-slate-200' : 'text-slate-400'}`}>
                                <i className={`fa-solid ${level === 0 ? 'fa-sitemap' : 'fa-users'} text-xs`}></i>
                            </div>
                            <div className="min-w-0">
                                <p className={`text-sm font-bold truncate ${level === 0 ? 'text-white' : 'text-slate-200'}`}>{unit.name}</p>
                                {level === 0 && <span className="text-[10px] text-slate-400 font-black uppercase tracking-wider">Top Level Command</span>}
                                <span className="text-[10px] text-slate-500 md:hidden">{unit.memberCount} personnel</span>
                            </div>
                        </div>
                    </div>

                    <div className="w-24 text-center text-xs font-mono text-slate-500 hidden md:block">
                        {unit.sortOrder}
                    </div>

                    <div className="w-32 text-center hidden md:block">
                        <span className={`text-xs font-mono font-bold px-2 py-1 rounded-sm ${unit.memberCount > 0 ? 'bg-slate-800 text-white' : 'text-slate-600'}`}>
                            {unit.memberCount}
                        </span>
                    </div>

                    <div className="w-24 md:w-32 text-right md:opacity-0 md:group-hover:opacity-100 transition-opacity flex justify-end gap-2">
                        <button onClick={() => openUnitModal(unit)} className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-sm transition-colors" title="Edit">
                            <i className="fa-solid fa-pencil"></i>
                        </button>
                        <button onClick={() => handleDelete(unit)} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-red-900/20 rounded-sm transition-colors" title="Delete">
                            <i className="fa-solid fa-trash-can"></i>
                        </button>
                    </div>
                </div>
                {unit.children.map(child => renderUnitRow(child, level + 1))}
            </React.Fragment>
        );
    };

    return (
        <div className="p-4 md:p-8 space-y-6 animate-fade-in">
            <TabPageHeader
                title="Organizational Units"
                icon="fa-solid fa-sitemap"
                accent="cyan"
                subtitle="Manage unit structure and hierarchy. Drag and drop to reorder or reparent."
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
                                placeholder="Search units..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-slate-400/50 focus:border-slate-500 outline-hidden text-sm font-medium transition-all"
                            />
                        </div>
                        <button
                            onClick={() => openUnitModal()}
                            className="flex items-center justify-center bg-slate-700 text-white font-bold px-4 py-2.5 rounded-lg border border-slate-600 hover:bg-slate-600 transition-colors shadow-lg text-sm whitespace-nowrap"
                        >
                            <i className="fa-solid fa-plus mr-2" />
                            Create Unit
                        </button>
                    </div>
                }
            />

            <div className={`bg-slate-900/40 rounded-xl border border-slate-700/50 overflow-hidden ${isUpdating ? 'opacity-60 pointer-events-none' : ''}`}>
                <div className="flex bg-slate-800/60 p-4 border-b border-slate-700/50 text-xs font-black text-slate-500 uppercase tracking-widest">
                    <div className="w-10 hidden md:block"></div>
                    <div className="flex-1">Unit Hierarchy</div>
                    <div className="w-24 text-center hidden md:block">Order</div>
                    <div className="w-32 text-center hidden md:block">Personnel</div>
                    <div className="w-24 md:w-32 text-right">Actions</div>
                </div>
                <div className="divide-y divide-slate-700/50">
                    {filteredTree.length > 0 ? (
                        filteredTree.map(node => renderUnitRow(node))
                    ) : (
                        <div className="p-12 text-center">
                            <p className="text-slate-500 font-medium italic">No units found.</p>
                        </div>
                    )}
                </div>
            </div>
            {searchTerm ? (
                <p className="text-xs text-amber-500 italic text-center mt-4">Drag and drop reordering is disabled while searching.</p>
            ) : (
                <p className="text-center text-xs text-slate-600 mt-4 italic">
                    {isUpdating ? (
                        <span className="text-slate-300"><i className="fa-solid fa-circle-notch animate-spin mr-2"></i> Updating unit structure...</span>
                    ) : (
                        <>
                            <i className="fa-solid fa-lightbulb mr-1 text-amber-500/50"></i>
                            Tip: Drag a unit onto another to set it as a child, or between rows to reorder.
                        </>
                    )}
                </p>
            )}
        </div>
    );
};

export default UnitManagementTab;
