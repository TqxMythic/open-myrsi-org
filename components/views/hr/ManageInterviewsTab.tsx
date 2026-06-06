
import React, { useState, useMemo, useEffect } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useHR } from '../../../contexts/HRContext';
import { useAuth, useFormatDate } from '../../../contexts/AuthContext';

import { VirtualizedList } from '../../ui/VirtualizedList';
import { HydratedHRInterview } from '../../../types';
import { useNotification } from '../../../contexts/NotificationContext';
import { useModalRegistry } from '../../../contexts/ModalRegistryContext';

const ManageInterviewsTab: React.FC = () => {
    const { rpcAction, refreshHR } = useData();
    const { hrInterviews } = useHR();
    const { currentUser } = useAuth();
    const fmt = useFormatDate();
    const { addToast, confirm } = useNotification();
    const { openConductInterviewModal, openEditInterviewModal } = useModalRegistry();
    const [searchTerm, setSearchTerm] = useState('');
    const [itemHeight, setItemHeight] = useState(70);

    // Responsive height adjustment
    useEffect(() => {
        const handleResize = () => setItemHeight(window.innerWidth < 768 ? 140 : 70);
        window.addEventListener('resize', handleResize);
        handleResize();
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const allInterviews = useMemo(() => {
        // hrInterviews already has applicantName populated by the mapper.
        let interviews = [...hrInterviews].sort((a, b) => new Date(b.scheduledAt || 0).getTime() - new Date(a.scheduledAt || 0).getTime());

        if (searchTerm.trim()) {
            const lowerSearch = searchTerm.toLowerCase();
            interviews = interviews.filter(i =>
                (i.applicantName || '').toLowerCase().includes(lowerSearch) ||
                i.template.name.toLowerCase().includes(lowerSearch) ||
                i.interviewer.name.toLowerCase().includes(lowerSearch)
            );
        }
        return interviews;
    }, [hrInterviews, searchTerm]);

    const handleDelete = async (interviewId: string) => {
        const confirmed = await confirm({ title: 'Delete Interview', message: 'Are you sure you want to delete this interview record? This action cannot be undone.', confirmText: 'Delete', variant: 'danger' });
        if (!confirmed) return;
        try {
            await rpcAction('hr:delete_interview', { interviewId, userId: currentUser?.id });
            await refreshHR();
        } catch (e) {
            console.error(e);
            addToast("Delete Failed", <i className="fa-solid fa-xmark"></i>, "bg-red-500/10 text-red-400 border-red-500/50", { description: "Failed to delete the interview." });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in flex flex-col h-full">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shrink-0">
                <div>
                    <h2 className="text-xl font-black text-white flex items-center gap-3 uppercase tracking-tight">
                        <i className="fa-solid fa-calendar-check text-emerald-300"></i>
                        Manage Interviews
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">Overview of all scheduled and completed interview protocols.</p>
                </div>
                <div className="relative w-full sm:w-64">
                    <i className="fa-solid fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none text-xs" />
                    <input
                        type="search"
                        placeholder="Search interviews..."
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="w-full bg-slate-900/60 border border-slate-700 rounded-lg py-2.5 pl-10 pr-4 text-white placeholder:text-slate-500 font-mono text-sm focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/40 outline-hidden transition-all"
                    />
                </div>
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-700/50 overflow-hidden flex flex-col h-[600px]">
                <div className="hidden md:flex bg-white/5 border-b border-white/5 text-slate-500 text-[10px] uppercase tracking-widest font-black">
                    <div className="p-4 w-32">Status</div>
                    <div className="p-4 flex-1">Subject</div>
                    <div className="p-4 flex-1">Protocol</div>
                    <div className="p-4 flex-1">Interviewer</div>
                    <div className="p-4 w-40">Date</div>
                    <div className="p-4 w-36 text-right">Actions</div>
                </div>

                <div className="flex-1 relative">
                    {allInterviews.length > 0 ? (
                        <VirtualizedList<HydratedHRInterview & { applicantName?: string }>
                            items={allInterviews}
                            itemHeight={itemHeight}
                            renderItem={(int) => (
                                <div key={int.id} className="flex flex-col md:flex-row items-start md:items-center hover:bg-slate-700/20 transition-colors border-b border-slate-700/50 h-full md:h-[70px] p-4 md:p-0 relative">
                                    {/* Mobile View Structure */}
                                    <div className="md:hidden w-full space-y-2">
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="font-bold text-white text-lg">{int.applicantName || 'Unknown Applicant'}</div>
                                                <div className="text-xs text-emerald-300 font-semibold">{int.template.name}</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {int.status === 'Completed' && int.isRecommended !== undefined && (
                                                    <span className={`px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border ${int.isRecommended ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                        <i className={`fa-solid ${int.isRecommended ? 'fa-thumbs-up' : 'fa-thumbs-down'} mr-1`}></i>
                                                        {int.isRecommended ? 'Recommended' : 'Not Recommended'}
                                                    </span>
                                                )}
                                                <span className={`px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border ${int.status === 'Completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                    {int.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-center text-sm text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <i className="fa-solid fa-user-secret text-xs"></i>
                                                <span>{int.interviewer.name}</span>
                                                {int.panelMembers?.length > 0 && (
                                                    <span className="text-[10px] text-indigo-400 font-semibold">+{int.panelMembers.length} panel</span>
                                                )}
                                            </div>
                                            <div className="font-mono text-xs">{fmt(int.scheduledAt)}</div>
                                        </div>
                                        <div className="flex justify-end gap-3 mt-2 pt-2 border-t border-slate-700/30">
                                            {int.status !== 'Completed' && (
                                                <button
                                                    onClick={() => openEditInterviewModal(int)}
                                                    className="text-amber-300 font-black text-[10px] uppercase tracking-widest"
                                                >
                                                    <i className="fa-solid fa-pen-to-square mr-1"></i>Edit
                                                </button>
                                            )}
                                            <button
                                                onClick={() => openConductInterviewModal(int)}
                                                className="text-sky-400 font-bold text-xs uppercase"
                                            >
                                                View
                                            </button>
                                            <button
                                                onClick={() => handleDelete(int.id)}
                                                className="text-red-400 font-bold text-xs uppercase"
                                            >
                                                Delete
                                            </button>
                                        </div>
                                    </div>

                                    {/* Desktop View Structure */}
                                    <div className="hidden md:contents">
                                        <div className="p-4 w-32">
                                            <span className={`px-2 py-1 rounded-sm text-[10px] font-black uppercase tracking-wider border ${int.status === 'Completed' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'}`}>
                                                {int.status}
                                            </span>
                                            {int.status === 'Completed' && int.isRecommended !== undefined && (
                                                <span className={`ml-1 inline-flex items-center px-1.5 py-0.5 rounded-sm text-[9px] font-black uppercase border ${int.isRecommended ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                    <i className={`fa-solid ${int.isRecommended ? 'fa-thumbs-up' : 'fa-thumbs-down'}`}></i>
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-4 flex-1 font-bold text-white truncate">{int.applicantName || 'Unknown Applicant'}</div>
                                        <div className="p-4 flex-1 text-sm text-emerald-300 font-semibold truncate">{int.template.name}</div>
                                        <div className="p-4 flex-1 text-sm text-slate-300">
                                            <div className="flex items-center gap-2">
                                                <img src={int.interviewer.avatarUrl} className="h-5 w-5 rounded-full object-cover shrink-0" alt="" />
                                                <span className="truncate">{int.interviewer.name}</span>
                                            </div>
                                            {int.panelMembers?.length > 0 && (
                                                <div className="flex items-center gap-1 mt-1">
                                                    <div className="flex -space-x-1.5">
                                                        {int.panelMembers.slice(0, 3).map(pm => (
                                                            <img key={pm.id} src={pm.avatarUrl} className="h-4 w-4 rounded-full border border-slate-800 object-cover shrink-0" alt={pm.name} title={pm.name} />
                                                        ))}
                                                    </div>
                                                    <span className="text-[10px] text-indigo-400 font-semibold ml-1">+{int.panelMembers.length} panel</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="p-4 w-40 text-sm text-slate-400 font-mono">{fmt(int.scheduledAt)}</div>
                                        <div className="p-4 w-36 text-right">
                                            <div className="flex justify-end gap-2">
                                                {int.status !== 'Completed' && (
                                                    <button
                                                        onClick={() => openEditInterviewModal(int)}
                                                        className="p-1.5 text-amber-400 hover:bg-amber-500/10 rounded-sm transition-colors"
                                                        title="Edit / Reschedule"
                                                    >
                                                        <i className="fa-solid fa-pen-to-square"></i>
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => openConductInterviewModal(int)}
                                                    className="p-1.5 text-emerald-300 hover:bg-emerald-500/10 rounded-sm transition-colors"
                                                    title="View Details"
                                                >
                                                    <i className="fa-solid fa-eye"></i>
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(int.id)}
                                                    className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-sm transition-colors"
                                                    title="Delete Interview"
                                                >
                                                    <i className="fa-solid fa-trash-can"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        />
                    ) : (
                        <div className="flex items-center justify-center h-full text-slate-500 italic">No interviews found.</div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManageInterviewsTab;
