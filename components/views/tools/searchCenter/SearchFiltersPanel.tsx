import React, { useEffect, useRef } from 'react';
import {
    SEARCH_TYPE_LABELS,
    SEARCH_TYPE_ICONS,
    ALL_SEARCH_TYPES,
    SearchType,
    SearchFiltersState,
    HrSubtype,
} from './types';
import { SearchFiltersApi } from './hooks/useSearchFilters';
import {
    WarrantStatus,
    OperationStatus,
    IntelThreatLevel,
    ApplicationStatus,
} from '../../../../types';
import { PrefetchState } from './hooks/usePrefetchSearchSubsets';

interface Props {
    api: SearchFiltersApi;
    prefetch: PrefetchState & { retryHr: () => void; retryWiki: () => void };
    /** When true, renders the mobile drawer variant. When false, renders the desktop rail. */
    isDrawerOpen?: boolean;
    onCloseDrawer?: () => void;
    /** When true (mobile drawer mode), the panel is a fixed overlay. */
    asDrawer?: boolean;
}

const sectionH = 'text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2';
const subInputCls = 'w-full text-xs bg-slate-900/60 border border-white/10 rounded-lg px-2.5 py-1.5 text-slate-200 focus:ring-1 focus:ring-sky-500 focus:border-sky-500 outline-hidden transition-colors';
const checkboxCls = 'flex items-center gap-2 text-xs text-slate-300 hover:text-white cursor-pointer select-none';

const SearchFiltersPanel: React.FC<Props> = ({
    api,
    prefetch,
    isDrawerOpen,
    onCloseDrawer,
    asDrawer,
}) => {
    const { filters, activeCount, selectedTypeCount, toggleType, setAllTypes, setSubFilter, clearAll } = api;
    const drawerRef = useRef<HTMLDivElement>(null);

    // Mobile drawer: focus trap + Esc + body scroll lock
    useEffect(() => {
        if (!asDrawer || !isDrawerOpen) return;
        const prevOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';

        // Focus first focusable element inside the drawer.
        const firstFocusable = drawerRef.current?.querySelector<HTMLElement>(
            'input, select, button, [tabindex="0"]',
        );
        firstFocusable?.focus();

        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                onCloseDrawer?.();
            }
        };
        document.addEventListener('keydown', handler);
        return () => {
            document.body.style.overflow = prevOverflow;
            document.removeEventListener('keydown', handler);
        };
    }, [asDrawer, isDrawerOpen, onCloseDrawer]);

    const renderSubFilter = (type: SearchType) => {
        if (!filters.types[type]) return null;
        switch (type) {
            case 'personnel':
                return (
                    <div className="ml-6 mt-1.5 space-y-1.5">
                        <select
                            value={filters.personnel.tier}
                            onChange={e => setSubFilter('personnel', { tier: e.target.value as 'all' | 'staff' | 'clients' })}
                            className={subInputCls}
                        >
                            <option value="all">All Tiers</option>
                            <option value="staff">Staff Only</option>
                            <option value="clients">Clients Only</option>
                        </select>
                        <label className={checkboxCls}>
                            <input
                                type="checkbox"
                                checked={filters.personnel.onlyOnDuty}
                                onChange={e => setSubFilter('personnel', { onlyOnDuty: e.target.checked })}
                                className="accent-sky-500"
                            />
                            On Duty Only
                        </label>
                    </div>
                );
            case 'mission':
                return (
                    <div className="ml-6 mt-1.5">
                        <select
                            value={filters.mission.status}
                            onChange={e => setSubFilter('mission', { status: e.target.value as SearchFiltersState['mission']['status'] })}
                            className={subInputCls}
                        >
                            <option value="all">All Statuses</option>
                            <option value="pending">Pending</option>
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                        </select>
                    </div>
                );
            case 'warrant':
                return (
                    <div className="ml-6 mt-1.5">
                        <select
                            value={filters.warrant.status}
                            onChange={e => setSubFilter('warrant', { status: e.target.value as SearchFiltersState['warrant']['status'] })}
                            className={subInputCls}
                        >
                            <option value="all">All Statuses</option>
                            <option value={WarrantStatus.Active}>Active</option>
                            <option value={WarrantStatus.Standing}>Standing</option>
                            <option value="closed">Closed (Claimed/Cancelled)</option>
                        </select>
                    </div>
                );
            case 'operation':
                return (
                    <div className="ml-6 mt-1.5 space-y-1.5">
                        <select
                            value={filters.operation.status}
                            onChange={e => setSubFilter('operation', { status: e.target.value as SearchFiltersState['operation']['status'] })}
                            className={subInputCls}
                        >
                            <option value="all">All Statuses</option>
                            {Object.values(OperationStatus).map(s => (
                                <option key={s} value={s}>{s}</option>
                            ))}
                        </select>
                        <label className={checkboxCls}>
                            <input
                                type="checkbox"
                                checked={filters.operation.classifiedOnly}
                                onChange={e => setSubFilter('operation', { classifiedOnly: e.target.checked })}
                                className="accent-sky-500"
                            />
                            Classified Only
                        </label>
                    </div>
                );
            case 'intel':
                return (
                    <div className="ml-6 mt-1.5 space-y-1.5">
                        <select
                            value={filters.intel.threat}
                            onChange={e => setSubFilter('intel', { threat: e.target.value as SearchFiltersState['intel']['threat'] })}
                            className={subInputCls}
                        >
                            <option value="all">All Threat Levels</option>
                            {Object.values(IntelThreatLevel).map(l => (
                                <option key={l} value={l}>{l}</option>
                            ))}
                        </select>
                        <label className={checkboxCls}>
                            <input
                                type="checkbox"
                                checked={filters.intel.classifiedOnly}
                                onChange={e => setSubFilter('intel', { classifiedOnly: e.target.checked })}
                                className="accent-sky-500"
                            />
                            Classified Only
                        </label>
                    </div>
                );
            case 'hr':
                if (prefetch.hr === 'forbidden') return null;
                if (prefetch.hr === 'error') {
                    return (
                        <div className="ml-6 mt-1.5">
                            <button
                                onClick={prefetch.retryHr}
                                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
                            >
                                HR data unavailable — retry
                            </button>
                        </div>
                    );
                }
                return (
                    <div className="ml-6 mt-1.5 space-y-1.5">
                        <select
                            value={filters.hr.subtype}
                            onChange={e => setSubFilter('hr', { subtype: e.target.value as 'all' | HrSubtype })}
                            className={subInputCls}
                        >
                            <option value="all">All HR Records</option>
                            <option value="application">Applications</option>
                            <option value="interview">Interviews</option>
                            <option value="posting">Job Postings</option>
                        </select>
                        {filters.hr.subtype !== 'interview' && (
                            <select
                                value={filters.hr.status}
                                onChange={e => setSubFilter('hr', { status: e.target.value })}
                                className={subInputCls}
                            >
                                <option value="all">All Statuses</option>
                                {filters.hr.subtype === 'posting' ? (
                                    <>
                                        <option value="Open">Open</option>
                                        <option value="Draft">Draft</option>
                                        <option value="Closed">Closed</option>
                                        <option value="Filled">Filled</option>
                                    </>
                                ) : (
                                    Object.values(ApplicationStatus).map(s => (
                                        <option key={s} value={s}>{s}</option>
                                    ))
                                )}
                            </select>
                        )}
                        {prefetch.hr === 'loading' && (
                            <p className="text-[10px] text-slate-500 italic font-mono">
                                <i className="fa-solid fa-circle-notch animate-spin mr-1" /> Loading HR data...
                            </p>
                        )}
                    </div>
                );
            case 'wiki':
                if (prefetch.wiki === 'error') {
                    return (
                        <div className="ml-6 mt-1.5">
                            <button
                                onClick={prefetch.retryWiki}
                                className="text-[10px] text-amber-400 hover:text-amber-300 underline font-mono"
                            >
                                Wiki data unavailable — retry
                            </button>
                        </div>
                    );
                }
                return (
                    <div className="ml-6 mt-1.5 space-y-1.5">
                        <label className={checkboxCls}>
                            <input
                                type="checkbox"
                                checked={filters.wiki.classifiedOnly}
                                onChange={e => setSubFilter('wiki', { classifiedOnly: e.target.checked })}
                                className="accent-sky-500"
                            />
                            Classified Only
                        </label>
                        {prefetch.wiki === 'loading' && (
                            <p className="text-[10px] text-slate-500 italic font-mono">
                                <i className="fa-solid fa-circle-notch animate-spin mr-1" /> Loading wiki...
                            </p>
                        )}
                    </div>
                );
            default:
                return null;
        }
    };

    const visibleTypes = ALL_SEARCH_TYPES.filter(t => !(t === 'hr' && prefetch.hr === 'forbidden'));

    const body = (
        <div className="flex flex-col gap-5 p-5 h-full overflow-y-auto custom-scrollbar">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-white">Filters</h2>
                    {activeCount > 0 && (
                        <p className="text-[10px] text-sky-400 font-mono mt-0.5">{activeCount} active</p>
                    )}
                </div>
                <button
                    onClick={clearAll}
                    disabled={activeCount === 0}
                    className="text-[10px] uppercase font-black tracking-widest text-slate-400 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                >
                    Clear All
                </button>
            </div>

            <div>
                <h3 className={sectionH}>Result Types</h3>
                <div className="flex items-center gap-2 mb-2">
                    <button
                        onClick={() => setAllTypes(true)}
                        disabled={selectedTypeCount === visibleTypes.length}
                        className="text-[10px] px-2 py-0.5 rounded-sm border bg-slate-900/60 border-white/10 text-slate-300 hover:border-sky-500/40 hover:text-sky-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors uppercase font-black tracking-widest"
                    >
                        All
                    </button>
                    <button
                        onClick={() => setAllTypes(false)}
                        disabled={selectedTypeCount === 0}
                        className="text-[10px] px-2 py-0.5 rounded-sm border bg-slate-900/60 border-white/10 text-slate-300 hover:border-sky-500/40 hover:text-sky-300 disabled:opacity-30 disabled:cursor-not-allowed transition-colors uppercase font-black tracking-widest"
                    >
                        None
                    </button>
                </div>
                <div className="space-y-1">
                    {visibleTypes.map(t => (
                        <div key={t}>
                            <label className={checkboxCls}>
                                <input
                                    type="checkbox"
                                    checked={filters.types[t]}
                                    onChange={() => toggleType(t)}
                                    className="accent-sky-500"
                                />
                                <i className={`fa-solid ${SEARCH_TYPE_ICONS[t]} text-slate-500 w-4 text-center`} aria-hidden />
                                {SEARCH_TYPE_LABELS[t]}
                            </label>
                            {renderSubFilter(t)}
                        </div>
                    ))}
                </div>
            </div>

            <div className="text-[10px] text-slate-600 font-mono uppercase tracking-widest mt-auto pt-3 border-t border-white/5">
                Sort: most recent first
            </div>
        </div>
    );

    if (asDrawer) {
        return (
            <>
                <div
                    onClick={onCloseDrawer}
                    className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-xs transition-opacity ${
                        isDrawerOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                    }`}
                    aria-hidden
                />
                <div
                    ref={drawerRef}
                    role="dialog"
                    aria-modal="true"
                    aria-label="Search filters"
                    className={`fixed left-0 top-0 bottom-0 z-50 w-[320px] max-w-[85vw] bg-slate-950 border-r border-white/10 shadow-2xl transition-transform duration-200 ease-out ${
                        isDrawerOpen ? 'translate-x-0' : '-translate-x-full'
                    }`}
                >
                    <div className="absolute top-3 right-3 z-10">
                        <button
                            onClick={onCloseDrawer}
                            aria-label="Close filters"
                            className="w-8 h-8 rounded-lg border border-white/10 bg-slate-900/60 text-slate-400 hover:text-white hover:border-white/20 transition-colors"
                        >
                            <i className="fa-solid fa-xmark" />
                        </button>
                    </div>
                    {body}
                </div>
            </>
        );
    }

    return (
        <aside className="hidden lg:flex flex-col w-[280px] shrink-0 rounded-xl border border-white/10 bg-slate-900/40 overflow-hidden">
            {body}
        </aside>
    );
};

export default SearchFiltersPanel;
