import React from 'react';
import { WikiPage } from '../../../types';
import WikiBreadcrumb from './WikiBreadcrumb';

interface Props {
    currentPage: WikiPage | null;
    allPages: WikiPage[];
    onSelectPage: (pageId: string | null) => void;
    onOpenTree: () => void;
    onOpenQuickJump: () => void;
    onAddPage?: () => void;
    canCreate: boolean;
    isCreating?: boolean;
}

const WikiTopBar: React.FC<Props> = ({
    currentPage, allPages, onSelectPage, onOpenTree, onOpenQuickJump, onAddPage, canCreate, isCreating,
}) => {
    return (
        <div className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/10">
            <div className="flex items-center gap-2 px-3 md:px-5 py-2">
                <button
                    onClick={onOpenTree}
                    className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
                    aria-label="Open page tree"
                >
                    <i className="fa-solid fa-bars" />
                </button>

                <div className="flex-1 min-w-0">
                    {isCreating ? (
                        <div className="flex items-center gap-2 text-xs">
                            <i className="fa-solid fa-pen text-sky-400" />
                            <span className="text-white font-bold">New page</span>
                        </div>
                    ) : (
                        <WikiBreadcrumb
                            page={currentPage}
                            allPages={allPages}
                            onSelect={onSelectPage}
                        />
                    )}
                </div>

                <button
                    onClick={onOpenQuickJump}
                    className="flex items-center gap-2 px-2.5 md:px-3 h-9 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent md:border-slate-700/60 md:bg-slate-900/40 transition-colors"
                    title="Search pages (Ctrl+K)"
                    aria-label="Search pages"
                >
                    <i className="fa-solid fa-magnifying-glass text-xs" />
                    <span className="hidden md:inline text-xs">Search</span>
                    <span className="hidden lg:inline text-[10px] font-mono uppercase tracking-widest text-slate-500 ml-2 px-1.5 py-0.5 rounded-sm border border-slate-700">⌘K</span>
                </button>

                {canCreate && onAddPage && (
                    <button
                        onClick={onAddPage}
                        className="flex items-center justify-center gap-2 w-9 md:w-auto md:px-3 h-9 rounded-lg text-sky-400 hover:text-white bg-sky-600/10 hover:bg-sky-600 border border-sky-500/30 text-xs font-bold transition-colors"
                        title="New page"
                        aria-label="New page"
                    >
                        <i className="fa-solid fa-plus" />
                        <span className="hidden md:inline">New</span>
                    </button>
                )}
            </div>
        </div>
    );
};

export default WikiTopBar;
