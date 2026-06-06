import React from 'react';
import { useMembers } from '../../../contexts/MembersContext';
import { WikiPage } from '../../../types';
import PortalCard from '../../shared/ui/PortalCard';
import SectionLabel from '../../shared/ui/SectionLabel';

interface WikiPageSettingsProps {
    page?: WikiPage | null;
    classificationLevel: number;
    setClassificationLevel: (level: number) => void;
    selectedMarkerIds: number[];
    setSelectedMarkerIds: (ids: number[]) => void;
    parentPageId: string | null;
    setParentPageId: (id: string | null) => void;
    // Menu position lock. Optional so callers that haven't migrated to the new
    // prop can still mount the settings panel.
    menuStructureLocked?: boolean;
    setMenuStructureLocked?: (locked: boolean) => void;
    allPages: WikiPage[];
}

const WikiPageSettings: React.FC<WikiPageSettingsProps> = ({
    page,
    classificationLevel,
    setClassificationLevel,
    selectedMarkerIds,
    setSelectedMarkerIds,
    parentPageId,
    setParentPageId,
    menuStructureLocked,
    setMenuStructureLocked,
    allPages,
}) => {
    const { securityClearances, limitingMarkers } = useMembers();

    const toggleMarker = (markerId: number) => {
        setSelectedMarkerIds(
            selectedMarkerIds.includes(markerId)
                ? selectedMarkerIds.filter((id) => id !== markerId)
                : [...selectedMarkerIds, markerId]
        );
    };

    const getDescendantIds = (pageId: string): Set<string> => {
        const ids = new Set<string>();
        const children = allPages.filter((p) => p.parentPageId === pageId);
        children.forEach((c) => {
            ids.add(c.id);
            getDescendantIds(c.id).forEach((id) => ids.add(id));
        });
        return ids;
    };

    const excludedIds = page ? new Set([page.id, ...getDescendantIds(page.id)]) : new Set<string>();
    const validParents = allPages.filter((p) => !excludedIds.has(p.id));

    return (
        <PortalCard variant="dashed" padding="md" className="space-y-5">
            <SectionLabel label="Page Settings" icon="fa-gear" className="mb-0" />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Classification Level</label>
                    <select
                        value={classificationLevel}
                        onChange={(e) => setClassificationLevel(Number(e.target.value))}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-hidden"
                    >
                        {securityClearances.length > 0 ? (
                            securityClearances.map((c: any) => (
                                <option key={c.level} value={c.level}>
                                    Level {c.level} — {c.name}
                                </option>
                            ))
                        ) : (
                            <>
                                <option value={0}>Level 0 — Unclassified</option>
                                <option value={1}>Level 1 — Restricted</option>
                                <option value={2}>Level 2 — Confidential</option>
                                <option value={3}>Level 3 — Secret</option>
                                <option value={4}>Level 4 — Top Secret</option>
                            </>
                        )}
                    </select>
                </div>

                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Parent Page</label>
                    <select
                        value={parentPageId || ''}
                        onChange={(e) => setParentPageId(e.target.value || null)}
                        disabled={!!menuStructureLocked}
                        className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-hidden disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <option value="">Root (No Parent)</option>
                        {validParents.map((p) => (
                            <option key={p.id} value={p.id}>
                                {p.title}
                            </option>
                        ))}
                    </select>
                    {menuStructureLocked && (
                        <p className="text-[10px] text-amber-400/80 mt-1.5">
                            <i className="fa-solid fa-lock mr-1"></i>Menu position locked. Unlock below to re-parent.
                        </p>
                    )}
                </div>
            </div>

            {setMenuStructureLocked && (
                <label className="flex items-start gap-3 p-3 rounded-lg border border-slate-700/50 bg-slate-900/40 cursor-pointer hover:border-amber-500/30 transition-colors">
                    <input
                        type="checkbox"
                        checked={!!menuStructureLocked}
                        onChange={(e) => setMenuStructureLocked(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded-sm bg-slate-800 border-slate-600 text-amber-500 focus:ring-amber-500"
                    />
                    <div className="min-w-0">
                        <span className="text-xs font-bold text-white block">
                            <i className="fa-solid fa-lock mr-1.5 text-amber-400/80"></i>Lock menu position
                        </span>
                        <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">
                            Prevents this page from being moved to a different parent. Page can still be reordered alongside its current siblings.
                        </span>
                    </div>
                </label>
            )}

            {limitingMarkers.length > 0 && (
                <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-2">Limiting Markers</label>
                    <div className="flex flex-wrap gap-2">
                        {limitingMarkers.map((marker) => (
                            <button
                                key={marker.id}
                                onClick={() => toggleMarker(marker.id)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                                    selectedMarkerIds.includes(marker.id)
                                        ? 'bg-amber-600/20 border-amber-500/50 text-amber-400'
                                        : 'bg-slate-900 border-slate-700 text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {marker.code || marker.name}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </PortalCard>
    );
};

export default WikiPageSettings;
