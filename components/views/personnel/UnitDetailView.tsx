import React from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useMembers } from '../../../contexts/MembersContext';
import MyUnitView from '../hr/MyUnitView';
import EmptyState from '../../shared/ui/EmptyState';

interface UnitDetailViewProps {
    unitId: number;
    onBack: () => void;
}

// Detail page for any unit reached from the Org Chart. Renders the same
// MyUnitView component used by HR Hub's "My Unit" tab — but for the picked
// unit instead of the viewer's own. When the unit is restricted and the
// viewer isn't a member or admin, we render a lock screen instead of the
// detail; the data fetches (unit:get_feed) are also gated server-side so the
// lock isn't bypassable by the client.
const UnitDetailView: React.FC<UnitDetailViewProps> = ({ unitId, onBack }) => {
    const { units } = useMembers();
    const { currentUser, hasPermission } = useAuth();

    const unit = units.find(u => u.id === unitId);

    if (!unit) {
        return (
            <div className="h-full flex flex-col p-4 sm:p-6 animate-fade-in">
                <BackButton onBack={onBack} />
                <div className="flex-1 flex items-center justify-center">
                    <EmptyState
                        icon="fa-circle-question"
                        accent="slate"
                        heading="Unit not found"
                        description="This unit may have been deleted or you don't have access to it."
                    />
                </div>
            </div>
        );
    }

    const isMember = currentUser?.unit?.id === unit.id;
    const canViewAll = hasPermission('units:view_all');
    const accessible = !unit.isRestricted || isMember || canViewAll;

    if (!accessible) {
        return (
            <div className="h-full flex flex-col p-4 sm:p-6 animate-fade-in">
                <BackButton onBack={onBack} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="max-w-md w-full text-center bg-slate-900/40 border border-amber-500/20 rounded-xl p-8 space-y-4">
                        <div className="w-16 h-16 mx-auto rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                            <i className="fa-solid fa-lock text-amber-300 text-2xl"></i>
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-white tracking-tight uppercase">{unit.name}</h2>
                            {unit.motto && (
                                <p className="text-amber-300 italic text-sm mt-1">"{unit.motto}"</p>
                            )}
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed">
                            This unit is restricted to its members. Contact the unit's leader{unit.leader?.name ? <> (<span className="text-slate-300 font-bold">{unit.leader.name}</span>)</> : null} or an org admin if you need access.
                        </p>
                        <button
                            onClick={onBack}
                            className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        >
                            <i className="fa-solid fa-arrow-left mr-2"></i>Back to Org Chart
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col p-4 sm:p-6 animate-fade-in overflow-y-auto custom-scrollbar">
            <BackButton onBack={onBack} />
            <MyUnitView unit={unit} />
        </div>
    );
};

const BackButton: React.FC<{ onBack: () => void }> = ({ onBack }) => (
    <button
        onClick={onBack}
        className="self-start mb-4 flex items-center gap-2 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 border border-slate-700 rounded-lg transition-colors"
    >
        <i className="fa-solid fa-arrow-left"></i> Back to Org Chart
    </button>
);

export default UnitDetailView;
