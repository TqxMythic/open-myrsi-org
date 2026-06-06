
import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { User, OrganizationalUnit } from '../../../types';
import { useData } from '../../../contexts/DataContext';
import { useMembers } from '../../../contexts/MembersContext';
import { useAuth } from '../../../contexts/AuthContext';
import { VirtualizedList } from '../../ui/VirtualizedList';
import { useBulkSelection } from '../../../hooks/useBulkSelection';
import { usePersistentState } from '../../../hooks/usePersistentState';
import BulkSelectToolbar, { BulkAction } from '../../shared/BulkSelectToolbar';
import FilterPopover from '../../shared/FilterPopover';
import SortableColumnHeader from '../../shared/SortableColumnHeader';
import BulkDemoteToClientModal from '../../modals/BulkDemoteToClientModal';
import BulkAssignUnitModal from '../../modals/BulkAssignUnitModal';
import BulkAssignRankModal from '../../modals/BulkAssignRankModal';
import BulkAssignPositionModal from '../../modals/BulkAssignPositionModal';
import BulkGrantCertificationModal from '../../modals/BulkGrantCertificationModal';
import BulkGrantCommendationModal from '../../modals/BulkGrantCommendationModal';
import { TabPageHeader } from '../../shared/ui';

type BulkActionKey = 'demote' | 'unit' | 'rank' | 'position' | 'cert' | 'commendation';
type RosterMode = 'hierarchy' | 'flat';
type FlatSortKey = 'name' | 'rank' | 'position' | 'unit' | 'isDuty';
type SortDir = 'asc' | 'desc';

// Module-scope so the serializer reference is stable across renders.
const SET_SERIALIZER = {
    serialize: (v: Set<number>): string => JSON.stringify(Array.from(v)),
    deserialize: (s: string): Set<number> => new Set(JSON.parse(s)),
};

interface AdminMemberManagementProps {
    onManageUser: (user: User) => void;
    scrollId?: string;
}

type RosterItemType = 'unit' | 'member';

interface RosterItem {
    id: string;
    type: RosterItemType;
    data: User | OrganizationalUnit;
    level: number;
}

interface UnitNode extends OrganizationalUnit {
    children: UnitNode[];
}

const AdminMemberManagement: React.FC<AdminMemberManagementProps> = ({ onManageUser, scrollId = "admin-member-list" }) => {
    const { isFetching } = useData();
    const { allUsers, units, ranks } = useMembers();
    const { currentUser } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { selected, toggle, isSelected, clear, setMany, count } = useBulkSelection<number>();
    const [bulkAction, setBulkAction] = useState<BulkActionKey | null>(null);

    // Roster shape & filters — persisted across reloads so admins don't have to
    // re-apply them each page load. Sets need a custom serializer (JSON has none).
    const [rosterMode, setRosterMode] = usePersistentState<RosterMode>(
        'adminRoster_mode',
        'hierarchy',
    );
    const [unitFilter, setUnitFilter] = usePersistentState<Set<number>>(
        'adminRoster_unitFilter',
        new Set(),
        SET_SERIALIZER,
    );
    const [rankFilter, setRankFilter] = usePersistentState<Set<number>>(
        'adminRoster_rankFilter',
        new Set(),
        SET_SERIALIZER,
    );
    const [flatSortKey, setFlatSortKey] = usePersistentState<FlatSortKey>(
        'adminRoster_flatSortKey',
        'name',
    );
    const [flatSortDir, setFlatSortDir] = usePersistentState<SortDir>(
        'adminRoster_flatSortDir',
        'asc',
    );

    const toggleUnit = useCallback((id: number) => {
        setUnitFilter(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, [setUnitFilter]);
    const toggleRank = useCallback((id: number) => {
        setRankFilter(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }, [setRankFilter]);

    const members = useMemo(() => allUsers.filter(u => u.role !== 'Client'), [allUsers]);

    const sortedRanksForFilter = useMemo(
        () => [...(ranks || [])].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999)),
        [ranks],
    );

    // Prune stale ids from persisted filters: a selected unit/rank deleted while
    // the admin was away would leave the roster showing "0 matches" with no cause.
    // Drop ids absent from live data. Guard on length > 0 so we don't prune mid-load.
    useEffect(() => {
        if (units.length === 0 || unitFilter.size === 0) return;
        const validIds = new Set(units.map(u => u.id));
        const pruned = Array.from(unitFilter).filter(id => validIds.has(id));
        if (pruned.length !== unitFilter.size) {
            setUnitFilter(new Set(pruned));
        }
    }, [units, unitFilter, setUnitFilter]);

    useEffect(() => {
        if (!ranks || ranks.length === 0 || rankFilter.size === 0) return;
        const validIds = new Set(ranks.map(r => r.id));
        const pruned = Array.from(rankFilter).filter(id => validIds.has(id));
        if (pruned.length !== rankFilter.size) {
            setRankFilter(new Set(pruned));
        }
    }, [ranks, rankFilter, setRankFilter]);

    // Composed predicate — unit filter, rank filter, and search box all apply
    // in both hierarchy and flat modes.
    const memberMatches = useCallback((m: User): boolean => {
        if (unitFilter.size > 0 && (!m.unit || !unitFilter.has(m.unit.id))) return false;
        if (rankFilter.size > 0 && (!m.rank || !rankFilter.has(m.rank.id))) return false;
        if (searchTerm) {
            const t = searchTerm.toLowerCase();
            const nameMatch = m.name.toLowerCase().includes(t);
            const handleMatch = m.rsiHandle?.toLowerCase().includes(t);
            const rankMatch = m.rank?.name.toLowerCase().includes(t);
            if (!nameMatch && !handleMatch && !rankMatch) return false;
        }
        return true;
    }, [unitFilter, rankFilter, searchTerm]);

    const filteredCount = useMemo(() => members.filter(memberMatches).length, [members, memberMatches]);

    const requestFlatSort = useCallback((key: FlatSortKey) => {
        if (flatSortKey === key) {
            setFlatSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
        } else {
            setFlatSortKey(key);
            setFlatSortDir('asc');
        }
    }, [flatSortKey, setFlatSortDir, setFlatSortKey]);

    // Brief delay to let data hydrate before rendering.
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    const unitTree = useMemo(() => {
        const nodes: UnitNode[] = units.map(u => ({ ...u, children: [] }));
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        const roots: UnitNode[] = [];

        nodes.forEach(node => {
            if (node.parentUnitId && nodeMap.has(node.parentUnitId)) {
                nodeMap.get(node.parentUnitId)!.children.push(node);
            } else {
                roots.push(node);
            }
        });

        const sortNodes = (nodeList: UnitNode[]) => {
            nodeList.sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0) || a.name.localeCompare(b.name));
            nodeList.forEach(n => sortNodes(n.children));
        };
        sortNodes(roots);

        return roots;
    }, [units]);

    // Flatten the tree into a list. Two modes: hierarchy (preserves nesting) and
    // flat (sortable single-level list). Both filter through `memberMatches`.
    const flattenedRoster = useMemo<RosterItem[]>(() => {
        if (isLoading) return [];

        if (rosterMode === 'flat') {
            const filtered = members.filter(memberMatches);
            const cmp = (a: User, b: User): number => {
                let v = 0;
                switch (flatSortKey) {
                    case 'name':
                        v = a.name.localeCompare(b.name);
                        break;
                    case 'rank':
                        v = (a.rank?.sortOrder ?? 9999) - (b.rank?.sortOrder ?? 9999);
                        if (v === 0) v = a.name.localeCompare(b.name);
                        break;
                    case 'position':
                        v = (a.position?.name || '').localeCompare(b.position?.name || '');
                        if (v === 0) v = a.name.localeCompare(b.name);
                        break;
                    case 'unit':
                        v = (a.unit?.name || '~').localeCompare(b.unit?.name || '~');
                        if (v === 0) v = a.name.localeCompare(b.name);
                        break;
                    case 'isDuty':
                        v = Number(b.isDuty) - Number(a.isDuty);
                        if (v === 0) v = a.name.localeCompare(b.name);
                        break;
                }
                return flatSortDir === 'asc' ? v : -v;
            };
            return filtered.sort(cmp).map(m => ({
                id: `member-${m.id}`,
                type: 'member' as const,
                data: m,
                level: 0,
            }));
        }

        const result: RosterItem[] = [];

        const processNode = (node: UnitNode, level: number) => {
            const unitMembers = members
                .filter(m => m.unit?.id === node.id)
                .filter(memberMatches);

            unitMembers.sort((a, b) => {
                const rankA = a.rank?.sortOrder ?? 9999;
                const rankB = b.rank?.sortOrder ?? 9999;
                if (rankA !== rankB) return rankA - rankB;
                return a.name.localeCompare(b.name);
            });

            result.push({
                id: `unit-${node.id}`,
                type: 'unit',
                data: node,
                level
            });

            unitMembers.forEach(m => {
                result.push({
                    id: `member-${m.id}`,
                    type: 'member',
                    data: m,
                    level: level + 1
                });
            });

            node.children.forEach(child => processNode(child, level + 1));
        };

        const processUnassigned = () => {
            const unassigned = members
                .filter(m => !m.unit)
                .filter(memberMatches);

            unassigned.sort((a, b) => (a.rank?.sortOrder ?? 9999) - (b.rank?.sortOrder ?? 9999));

            if (unassigned.length > 0) {
                result.push({
                    id: 'unit-unassigned',
                    type: 'unit',
                    data: { id: 0, name: 'Unassigned Personnel', sortOrder: 9999 } as OrganizationalUnit,
                    level: 0
                });
                unassigned.forEach(m => {
                    result.push({
                        id: `member-${m.id}`,
                        type: 'member',
                        data: m,
                        level: 1
                    });
                });
            }
        }

        unitTree.forEach(root => processNode(root, 0));
        processUnassigned();

        return result;

    }, [unitTree, members, memberMatches, isLoading, rosterMode, flatSortKey, flatSortDir]);

    // Resolve full User objects for the selection (modals need them for the
    // preview list). Filter out the actor so they can't self-demote.
    const selectedUsers = useMemo<User[]>(
        () => members.filter((m) => isSelected(m.id) && m.id !== currentUser?.id),
        [members, isSelected, currentUser?.id],
    );

    // Visible (post-filter) members eligible for bulk actions, used by the
    // Select-All header checkbox. Excludes Admins and the actor.
    const visibleMemberIds = useMemo<number[]>(
        () => flattenedRoster
            .filter(item => item.type === 'member')
            .map(item => item.data as User)
            .filter(m => m.role !== 'Admin' && m.id !== currentUser?.id)
            .map(m => m.id),
        [flattenedRoster, currentUser?.id],
    );

    const allVisibleSelected = visibleMemberIds.length > 0
        && visibleMemberIds.every(id => isSelected(id));

    const onHeaderToggle = () => {
        if (allVisibleSelected) clear();
        else setMany(visibleMemberIds);
    };

    const bulkActions: BulkAction[] = useMemo(() => [
        {
            key: 'demote',
            label: 'Demote to Client',
            icon: 'fa-arrow-down',
            permission: 'admin:user:update_role',
            variant: 'danger',
            onClick: () => setBulkAction('demote'),
        },
        {
            key: 'unit',
            label: 'Assign Unit',
            icon: 'fa-people-group',
            permission: 'admin:user:update',
            onClick: () => setBulkAction('unit'),
        },
        {
            key: 'rank',
            label: 'Assign Rank',
            icon: 'fa-medal',
            permission: 'admin:user:update',
            onClick: () => setBulkAction('rank'),
        },
        {
            key: 'position',
            label: 'Assign Position',
            icon: 'fa-id-badge',
            permission: 'admin:user:update',
            onClick: () => setBulkAction('position'),
        },
        {
            key: 'cert',
            label: 'Grant Certification',
            icon: 'fa-certificate',
            permission: 'admin:award:certification',
            onClick: () => setBulkAction('cert'),
        },
        {
            key: 'commendation',
            label: 'Grant Commendation',
            icon: 'fa-award',
            permission: 'admin:award:commendation',
            onClick: () => setBulkAction('commendation'),
        },
    ], []);

    const closeBulkModal = () => {
        setBulkAction(null);
        clear();
    };

    return (
        <div className="h-full flex flex-col p-4 md:p-8 animate-fade-in">
            <div className="shrink-0">
                <TabPageHeader
                    title="Member Roster"
                    icon="fa-solid fa-users"
                    accent="emerald"
                    subtitle={<>Total Personnel: <span className="font-mono text-slate-300 font-bold">{members.length}</span></>}
                    meta={isFetching['main'] && (
                        <span className="text-slate-300 animate-pulse text-xs font-bold flex items-center gap-1">
                            <i className="fa-solid fa-arrows-rotate fa-spin"></i> Syncing...
                        </span>
                    )}
                    actions={
                        <div className="relative w-full md:w-72">
                            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search members..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-800 border border-slate-600 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-slate-400/50 focus:border-slate-500 outline-hidden text-sm font-medium transition-all focus:bg-slate-700"
                            />
                        </div>
                    }
                />
            </div>

            {/* Filter row — mode toggle + Unit/Rank multi-select chips. */}
            <div className="mt-4 flex flex-wrap items-center gap-2 shrink-0">
                <div className="flex bg-slate-900/60 rounded-lg border border-slate-700 p-0.5">
                    {(['hierarchy', 'flat'] as RosterMode[]).map(m => (
                        <button
                            key={m}
                            onClick={() => setRosterMode(m)}
                            className={`px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                                rosterMode === m
                                    ? 'bg-slate-500/20 text-slate-100 border border-slate-500/40'
                                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                            }`}
                        >
                            <i className={`fa-solid ${m === 'hierarchy' ? 'fa-sitemap' : 'fa-list'} mr-1.5`}></i>
                            {m === 'hierarchy' ? 'Hierarchy' : 'Flat'}
                        </button>
                    ))}
                </div>
                <FilterPopover
                    label="Unit"
                    icon="fa-people-group"
                    options={units.map(u => ({ id: u.id, name: u.name }))}
                    selected={unitFilter}
                    onToggle={toggleUnit}
                    onClear={() => setUnitFilter(new Set())}
                    accent="sky"
                />
                <FilterPopover
                    label="Rank"
                    icon="fa-medal"
                    options={sortedRanksForFilter.map(r => ({ id: r.id, name: r.name }))}
                    selected={rankFilter}
                    onToggle={toggleRank}
                    onClear={() => setRankFilter(new Set())}
                    accent="sky"
                />
                {(unitFilter.size > 0 || rankFilter.size > 0 || searchTerm.trim().length > 0) && (
                    <>
                        <button
                            type="button"
                            onClick={() => {
                                setUnitFilter(new Set());
                                setRankFilter(new Set());
                                setSearchTerm('');
                            }}
                            className="ml-auto flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-white hover:bg-white/5 border border-transparent hover:border-white/10 transition-colors"
                            title="Clear unit, rank, and search filters"
                        >
                            <i className="fa-solid fa-rotate-left text-[10px]"></i>
                            Reset filters
                        </button>
                        {(unitFilter.size > 0 || rankFilter.size > 0) && (
                            <span className="text-[10px] text-slate-500 font-mono">
                                {filteredCount} match{filteredCount === 1 ? '' : 'es'}
                            </span>
                        )}
                    </>
                )}
            </div>

            <div className="bg-slate-900/40 rounded-xl border border-slate-700/50 overflow-hidden flex-1 min-h-0 flex flex-col relative mt-6">
                <BulkSelectToolbar
                    selectedCount={count}
                    onClear={clear}
                    actions={bulkActions}
                />
                {rosterMode === 'flat' ? (
                    <div className="flex items-center bg-slate-800/80 p-4 border-b border-slate-700 shrink-0">
                        <div
                            className="w-8 shrink-0 flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={onHeaderToggle}
                                disabled={visibleMemberIds.length === 0}
                                className="w-4 h-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Select all visible members"
                            />
                        </div>
                        <div className="flex-1">
                            <SortableColumnHeader label="Name" sortKey="name" activeKey={flatSortKey} sortDir={flatSortDir} onSort={requestFlatSort} />
                        </div>
                        <div className="w-48 hidden md:block">
                            <SortableColumnHeader label="Rank" sortKey="rank" activeKey={flatSortKey} sortDir={flatSortDir} onSort={requestFlatSort} />
                        </div>
                        <div className="w-44 hidden lg:block">
                            <SortableColumnHeader label="Position" sortKey="position" activeKey={flatSortKey} sortDir={flatSortDir} onSort={requestFlatSort} />
                        </div>
                        <div className="w-44 hidden xl:block">
                            <SortableColumnHeader label="Unit" sortKey="unit" activeKey={flatSortKey} sortDir={flatSortDir} onSort={requestFlatSort} />
                        </div>
                        <div className="w-32 hidden sm:flex justify-center">
                            <SortableColumnHeader label="Status" sortKey="isDuty" activeKey={flatSortKey} sortDir={flatSortDir} onSort={requestFlatSort} />
                        </div>
                        <div className="w-12 text-right"></div>
                    </div>
                ) : (
                    <div className="flex bg-slate-800/80 p-4 border-b border-slate-700 text-xs font-black text-slate-500 uppercase tracking-widest shrink-0">
                        <div
                            className="w-8 shrink-0 flex items-center justify-center"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <input
                                type="checkbox"
                                checked={allVisibleSelected}
                                onChange={onHeaderToggle}
                                disabled={visibleMemberIds.length === 0}
                                className="w-4 h-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                                aria-label="Select all visible members"
                            />
                        </div>
                        <div className="flex-1">Identity</div>
                        <div className="w-48 hidden md:block">Rank</div>
                        <div className="w-44 hidden lg:block">Position</div>
                        <div className="w-32 text-center hidden sm:block">Status</div>
                        <div className="w-12 text-right"></div>
                    </div>
                )}

                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/50 backdrop-blur-xs">
                        <div className="flex flex-col items-center">
                            <i className="fa-solid fa-circle-notch animate-spin text-3xl text-slate-300 mb-3"></i>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Loading Roster...</span>
                        </div>
                    </div>
                ) : (
                    <div id={scrollId} className="flex-1 relative overflow-y-auto custom-scrollbar">
                        {flattenedRoster.length > 0 ? (
                            <VirtualizedList<RosterItem>
                                scrollContainerId={scrollId}
                                items={flattenedRoster}
                                itemHeight={50}
                                renderItem={(item) => {
                                    // Cap indent so deep nesting doesn't squeeze content off mobile.
                                    const paddingLeft = Math.min(item.level, 5);

                                    if (item.type === 'unit') {
                                        const unit = item.data as OrganizationalUnit;
                                        return (
                                            <div
                                                className="flex items-center px-4 h-full bg-slate-800/30 border-b border-slate-700/50"
                                                style={{ paddingLeft: `${paddingLeft + 1}rem` }}
                                            >
                                                {/* Spacer to align with member-row checkbox column */}
                                                <div className="w-8 shrink-0" aria-hidden />
                                                {item.level > 0 && (
                                                    <div className="w-4 h-4 border-l-2 border-b-2 border-slate-600 rounded-bl mr-3 -mt-3"></div>
                                                )}
                                                <div className="flex items-center gap-2">
                                                    <i className={`fa-solid ${item.level === 0 ? 'fa-sitemap text-slate-300' : 'fa-people-group text-slate-500'} text-xs`}></i>
                                                    <span className={`text-xs font-black uppercase tracking-wider ${item.level === 0 ? 'text-slate-100' : 'text-slate-400'}`}>
                                                        {unit.name}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    } else {
                                        const member = item.data as User;
                                        // Admins and the actor can't be bulk-demoted, so hide the checkbox.
                                        const canSelect = member.role !== 'Admin' && member.id !== currentUser?.id;
                                        return (
                                            <div
                                                key={member.id}
                                                onClick={() => onManageUser(member)}
                                                className={`flex items-center px-4 h-full hover:bg-slate-800/50 transition-colors border-b border-slate-700/30 group cursor-pointer ${isSelected(member.id) ? 'bg-amber-500/5' : ''}`}
                                                style={{ paddingLeft: `${paddingLeft + 1}rem` }}
                                            >
                                                <div
                                                    className="w-8 shrink-0 flex items-center justify-center"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    {canSelect && (
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected(member.id)}
                                                            onChange={() => toggle(member.id)}
                                                            className="w-4 h-4 accent-amber-500 cursor-pointer"
                                                            aria-label={`Select ${member.name}`}
                                                        />
                                                    )}
                                                </div>
                                                {item.level > 0 && (
                                                    <div className="w-4 h-4 border-l-2 border-b-2 border-slate-600 rounded-bl mr-3 -mt-3"></div>
                                                )}

                                                <div className="flex-1 flex items-center gap-3 min-w-0">
                                                    <div className="relative shrink-0">
                                                        <img src={member.avatarUrl} className="w-8 h-8 rounded-full border border-slate-600 object-cover group-hover:border-slate-500 transition-colors" alt="" />
                                                        {/* Presence dot — green when on-duty, slate otherwise. */}
                                                        <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-800 ${member.isDuty ? 'bg-green-500' : 'bg-slate-600'}`}></div>
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors flex items-center gap-2">
                                                            {member.name}
                                                            {member.role === 'Admin' && <span className="text-[9px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded-sm border border-red-500/20 uppercase font-black">Admin</span>}
                                                        </p>
                                                        <p className="text-[10px] text-slate-500 font-mono truncate md:hidden">{member.rank?.name || member.rsiHandle}</p>
                                                    </div>
                                                </div>

                                                <div className="w-48 hidden md:flex items-center gap-2 text-xs text-slate-400">
                                                    {member.rank?.iconUrl && <img src={member.rank.iconUrl} className="w-4 h-4 object-contain" alt="" />}
                                                    <span className="truncate">{member.rank?.name || '-'}</span>
                                                </div>

                                                <div className="w-44 hidden lg:flex items-center text-xs text-slate-400 truncate">
                                                    {member.position?.icon && <i className={`${member.position.icon} text-[10px] mr-1.5 text-slate-500 shrink-0`}></i>}
                                                    <span className="truncate">{member.position?.name || <span className="text-slate-600 italic">—</span>}</span>
                                                </div>

                                                {rosterMode === 'flat' && (
                                                    <div className="w-44 hidden xl:flex items-center text-xs text-slate-400 truncate">
                                                        {member.unit?.name || <span className="text-slate-600 italic">Unassigned</span>}
                                                    </div>
                                                )}

                                                <div className={`${rosterMode === 'flat' ? 'w-32' : 'w-32'} text-center hidden sm:block`}>
                                                    <span className={`px-2 py-0.5 rounded-sm text-[10px] font-black uppercase tracking-wider ${member.isDuty ? 'bg-green-500/10 text-green-400' : 'text-slate-600'}`}>
                                                        {member.isDuty ? 'Active' : 'Offline'}
                                                    </span>
                                                </div>

                                                <div className="w-12 text-right opacity-60 group-hover:opacity-100 transition-opacity">
                                                    <i className="fa-solid fa-chevron-right text-slate-500 group-hover:text-white"></i>
                                                </div>
                                            </div>
                                        );
                                    }
                                }}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 italic">
                                No personnel found.
                            </div>
                        )}
                    </div>
                )}
            </div>
            {bulkAction === 'demote' && (
                <BulkDemoteToClientModal selectedUsers={selectedUsers} onClose={closeBulkModal} />
            )}
            {bulkAction === 'unit' && (
                <BulkAssignUnitModal selectedUsers={selectedUsers} onClose={closeBulkModal} />
            )}
            {bulkAction === 'rank' && (
                <BulkAssignRankModal selectedUsers={selectedUsers} onClose={closeBulkModal} />
            )}
            {bulkAction === 'position' && (
                <BulkAssignPositionModal selectedUsers={selectedUsers} onClose={closeBulkModal} />
            )}
            {bulkAction === 'cert' && (
                <BulkGrantCertificationModal selectedUsers={selectedUsers} onClose={closeBulkModal} />
            )}
            {bulkAction === 'commendation' && (
                <BulkGrantCommendationModal selectedUsers={selectedUsers} onClose={closeBulkModal} />
            )}
        </div>
    );
};

export default AdminMemberManagement;
