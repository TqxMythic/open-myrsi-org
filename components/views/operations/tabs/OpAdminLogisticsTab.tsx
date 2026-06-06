import React, { useState } from 'react';
import { HydratedOperation } from '../../../../types';
import OpOrbatTab from './OpOrbatTab';
import OpLogisticsTab from './OpLogisticsTab';
import OpLedgerTab from './OpLedgerTab';

interface OpAdminLogisticsTabProps {
    operation: HydratedOperation;
    canManage: boolean;
    isParticipant: boolean;
    onRefresh: () => void;
    onManageParticipant: (participant: any) => void;
    onRemoveParticipant: (userId: number) => void;
    onOpenAddUec: () => void;
    onOpenAddCost: () => void;
    onAddParticipant?: () => void;
}

type SubTab = 'roster' | 'logistics' | 'ledger';

const OpAdminLogisticsTab: React.FC<OpAdminLogisticsTabProps> = ({
    operation, canManage, isParticipant, onRefresh, onManageParticipant, onRemoveParticipant, onOpenAddUec, onOpenAddCost, onAddParticipant
}) => {
    const [subTab, setSubTab] = useState<SubTab>('roster');

    const subTabs: { key: SubTab; label: string; icon: string; hidden?: boolean }[] = [
        { key: 'roster', label: 'Roster & ORBAT', icon: 'fa-solid fa-sitemap' },
        { key: 'logistics', label: 'Logistics', icon: 'fa-solid fa-boxes-stacked' },
        { key: 'ledger', label: 'Ledger', icon: 'fa-solid fa-coins', hidden: !operation.tracksUec },
    ];

    return (
        <div className="flex flex-col h-full">
            <div className="shrink-0 px-6 lg:px-8 pt-6 lg:pt-8 pb-4">
                <div className="flex items-center justify-between gap-4">
                    <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest flex items-center gap-2">
                        <i className="fa-solid fa-boxes-stacked text-purple-400/70"></i> Admin & Logistics
                    </p>
                    <div className="flex items-center gap-1 bg-slate-900/60 border border-slate-700 rounded-lg p-0.5">
                        {subTabs.filter(t => !t.hidden).map(tab => (
                            <button key={tab.key} onClick={() => setSubTab(tab.key)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[10px] font-black uppercase tracking-wider transition-all ${
                                    subTab === tab.key ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'text-slate-500 hover:text-slate-300 border border-transparent'
                                }`}>
                                <i className={tab.icon}></i> {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Sub-tab content - allow full height for ORBAT */}
            <div className={`flex-1 min-h-0 ${subTab === 'roster' ? 'overflow-hidden' : 'overflow-y-auto custom-scrollbar'}`}>
                {subTab === 'roster' && (
                    <OpOrbatTab
                        operation={operation}
                        canManage={canManage}
                        onRefresh={onRefresh}
                        onManageParticipant={onManageParticipant}
                        onRemoveParticipant={onRemoveParticipant}
                        onAddParticipant={onAddParticipant}
                    />
                )}

                {subTab === 'logistics' && (
                    <OpLogisticsTab
                        operation={operation}
                        canManage={canManage}
                        isParticipant={isParticipant}
                        onRefresh={onRefresh}
                    />
                )}

                {subTab === 'ledger' && operation.tracksUec && (
                    <OpLedgerTab
                        operation={operation}
                        canManage={canManage}
                        onOpenAddUec={onOpenAddUec}
                        onOpenAddCost={onOpenAddCost}
                    />
                )}
            </div>
        </div>
    );
};

export default OpAdminLogisticsTab;
