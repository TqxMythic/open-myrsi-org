
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useMembers } from '../../../contexts/MembersContext';
import { useFormatDate } from '../../../contexts/AuthContext';
import { User, UserRole } from '../../../types';
import { VirtualizedList } from '../../ui/VirtualizedList';
import ClientFlagPills from '../../shared/ui/ClientFlagPills';
import { useBulkSelection } from '../../../hooks/useBulkSelection';
import BulkSelectToolbar, { BulkAction } from '../../shared/BulkSelectToolbar';
import BulkPromoteToMemberModal from '../../modals/BulkPromoteToMemberModal';
import BulkSetClientFlagModal from '../../modals/BulkSetClientFlagModal';
import { TabPageHeader } from '../../shared/ui';

type BulkActionKey = 'promote' | 'affiliate' | 'vip';

interface ClientManagementTabProps {
    onManageUser: (user: User) => void;
}

type ClientListItem = User & { requestCount: number };

const ClientManagementTab: React.FC<ClientManagementTabProps> = ({ onManageUser }) => {
    const { hydratedServiceRequests } = useData();
    const { allUsers } = useMembers();
    const fmt = useFormatDate();
    const [searchTerm, setSearchTerm] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const { selected, toggle, isSelected, clear, setMany, count } = useBulkSelection<number>();
    const [bulkAction, setBulkAction] = useState<BulkActionKey | null>(null);

    // Brief delay to let data hydrate before rendering.
    useEffect(() => {
        const timer = setTimeout(() => {
            setIsLoading(false);
        }, 600);
        return () => clearTimeout(timer);
    }, []);

    const clientData = useMemo(() => {
        const requestCounts = new Map<number, number>();
        hydratedServiceRequests.forEach(req => {
            if (req.clientId) {
                requestCounts.set(req.clientId, (requestCounts.get(req.clientId) || 0) + 1);
            }
        });

        let clients = allUsers
            .filter(u => u.role === UserRole.Client)
            .map(client => ({
                ...client,
                requestCount: requestCounts.get(client.id) || 0,
            }));

        if (searchTerm.trim()) {
            const q = searchTerm.toLowerCase();
            clients = clients.filter(c =>
                c.name.toLowerCase().includes(q) ||
                c.rsiHandle.toLowerCase().includes(q)
            );
        }

        return clients.sort((a, b) => a.reputation - b.reputation); // Low rep first for attention
    }, [allUsers, hydratedServiceRequests, searchTerm]);

    const getReputationColor = (rep: number) => {
        if (rep < 10) return 'text-red-500';
        if (rep < 25) return 'text-orange-500';
        if (rep < 50) return 'text-amber-400';
        if (rep < 75) return 'text-sky-400';
        return 'text-green-400';
    };

    // Resolve full User objects for the selection (modals need them, not bare ids).
    const selectedUsers = useMemo<User[]>(
        () => clientData.filter((c) => isSelected(c.id)),
        [clientData, isSelected],
    );

    // Select-All header checkbox: targets currently visible (post-search)
    // clients only, never the entire org. Re-clicks clear the selection.
    const visibleClientIds = useMemo<number[]>(
        () => clientData.map((c) => c.id),
        [clientData],
    );
    const allVisibleSelected = visibleClientIds.length > 0
        && visibleClientIds.every((id) => isSelected(id));
    const onHeaderToggle = () => {
        if (allVisibleSelected) clear();
        else setMany(visibleClientIds);
    };

    const bulkActions: BulkAction[] = useMemo(() => [
        {
            key: 'promote',
            label: 'Promote to Member',
            icon: 'fa-arrow-up',
            permission: 'admin:user:update_role',
            onClick: () => setBulkAction('promote'),
        },
        {
            key: 'affiliate',
            label: 'Set Affiliate',
            icon: 'fa-handshake',
            permission: 'admin:user:update',
            onClick: () => setBulkAction('affiliate'),
        },
        {
            key: 'vip',
            label: 'Set VIP',
            icon: 'fa-crown',
            permission: 'admin:user:update',
            onClick: () => setBulkAction('vip'),
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
                    title="Client Registry"
                    icon="fa-solid fa-address-book"
                    accent="sky"
                    subtitle={<>Total Registered: <span className="font-mono text-slate-200 font-bold">{clientData.length}</span></>}
                    actions={
                        <div className="relative w-full md:w-72">
                            <i className="fa-solid fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Search clients..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-500 focus:ring-1 focus:ring-slate-400/50 focus:border-slate-500 outline-hidden text-sm font-medium transition-all"
                            />
                        </div>
                    }
                />
            </div>

            <div className="@container/clients bg-slate-900/40 rounded-xl border border-slate-700/50 overflow-hidden flex-1 min-h-0 flex flex-col relative mt-6">
                <BulkSelectToolbar
                    selectedCount={count}
                    onClear={clear}
                    actions={bulkActions}
                />
                <div className="flex bg-slate-800/80 p-4 border-b border-slate-700 text-xs font-black text-slate-500 uppercase tracking-widest shrink-0">
                    <div
                        className="w-8 shrink-0 flex items-center justify-center"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <input
                            type="checkbox"
                            checked={allVisibleSelected}
                            onChange={onHeaderToggle}
                            disabled={visibleClientIds.length === 0}
                            className="w-4 h-4 accent-amber-500 cursor-pointer disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label="Select all visible clients"
                        />
                    </div>
                    <div className="flex-1">Client Identity</div>
                    <div className="w-48 hidden @3xl/clients:block">Joined</div>
                    <div className="w-32 text-center hidden @2xl/clients:block">Requests</div>
                    <div className="w-32 text-right hidden @lg/clients:block">Reputation</div>
                    <div className="w-12"></div>
                </div>

                {isLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center z-10 bg-slate-900/50 backdrop-blur-xs">
                        <div className="flex flex-col items-center">
                            <i className="fa-solid fa-circle-notch animate-spin text-3xl text-slate-300 mb-3"></i>
                            <span className="text-xs font-bold text-slate-300 uppercase tracking-widest">Accessing Registry...</span>
                        </div>
                    </div>
                ) : (
                    <div id="admin-client-list" className="flex-1 relative overflow-y-auto custom-scrollbar">
                        {clientData.length > 0 ? (
                            <VirtualizedList<ClientListItem>
                                scrollContainerId="admin-client-list"
                                items={clientData as ClientListItem[]}
                                itemHeight={50}
                                renderItem={(client) => (
                                    <div
                                        key={client.id}
                                        onClick={() => onManageUser(client as User)}
                                        className={`flex items-center px-4 h-full hover:bg-slate-800/50 transition-colors border-b border-slate-700/30 group cursor-pointer ${isSelected(client.id) ? 'bg-amber-500/5' : ''}`}
                                    >
                                        <div
                                            className="w-8 shrink-0 flex items-center justify-center"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isSelected(client.id)}
                                                onChange={() => toggle(client.id)}
                                                className="w-4 h-4 accent-amber-500 cursor-pointer"
                                                aria-label={`Select ${client.name}`}
                                            />
                                        </div>
                                        <div className="flex-1 flex items-center gap-3 min-w-0">
                                            <div className="relative shrink-0">
                                                <img src={client.avatarUrl} className="h-8 w-8 rounded-full border border-slate-600 object-cover group-hover:border-slate-500 transition-colors" alt="" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 min-w-0">
                                                    <p className="text-sm font-bold text-slate-200 truncate group-hover:text-white transition-colors">
                                                        {client.name}
                                                    </p>
                                                    <ClientFlagPills isAffiliate={client.isAffiliate} isVip={client.isVip} className="shrink-0" />
                                                </div>
                                                <p className="text-[10px] text-slate-500 font-mono truncate">{client.rsiHandle}</p>
                                                <div className="flex gap-3 @lg/clients:hidden mt-0.5">
                                                    <span className="text-[10px] text-slate-500">{client.requestCount} req</span>
                                                    <span className={`text-[10px] font-mono font-bold ${getReputationColor(client.reputation)}`}>{client.reputation} rep</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="w-48 hidden @3xl/clients:block text-xs text-slate-500 font-mono">
                                            {fmt(client.createdAt)}
                                        </div>

                                        <div className="w-32 text-center hidden @2xl/clients:block">
                                            <span className="bg-slate-800 text-slate-300 text-[10px] font-bold px-2 py-1 rounded-sm border border-slate-700">
                                                {client.requestCount}
                                            </span>
                                        </div>

                                        <div className="w-32 text-right hidden @lg/clients:block">
                                            <span className={`font-mono font-bold text-sm ${getReputationColor(client.reputation)}`}>
                                                {client.reputation}
                                            </span>
                                        </div>

                                        <div className="w-12 text-right opacity-60 group-hover:opacity-100 transition-opacity">
                                            <i className="fa-solid fa-chevron-right text-slate-500 group-hover:text-white"></i>
                                        </div>
                                    </div>
                                )}
                            />
                        ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-slate-500 italic">
                                No clients found.
                            </div>
                        )}
                    </div>
                )}
            </div>
            {bulkAction === 'promote' && (
                <BulkPromoteToMemberModal
                    selectedUsers={selectedUsers}
                    onClose={closeBulkModal}
                />
            )}
            {bulkAction === 'affiliate' && (
                <BulkSetClientFlagModal
                    flag="is_affiliate"
                    selectedUsers={selectedUsers}
                    onClose={closeBulkModal}
                />
            )}
            {bulkAction === 'vip' && (
                <BulkSetClientFlagModal
                    flag="is_vip"
                    selectedUsers={selectedUsers}
                    onClose={closeBulkModal}
                />
            )}
        </div>
    );
};

export default ClientManagementTab;
