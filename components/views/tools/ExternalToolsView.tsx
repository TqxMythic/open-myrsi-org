
import React, { useMemo } from 'react';
import { useConfig } from '../../../contexts/ConfigContext';
import { useAuth } from '../../../contexts/AuthContext';
import HeroShell from '../../shared/ui/HeroShell';
import HeroStat from '../../shared/ui/HeroStat';
import EmptyState from '../../shared/ui/EmptyState';
import { ExternalTool } from '../../../types';

const UNCATEGORISED_LABEL = 'General';

const ExternalToolsView: React.FC = () => {
    const { externalTools } = useConfig();
    const { currentUser } = useAuth();

    const visibleTools = useMemo(
        () => currentUser ? externalTools.filter(tool => tool.audience.includes(currentUser.role)) : [],
        [externalTools, currentUser],
    );

    // Group by category. Server already pre-sorts (category → sortOrder → title)
    // so we just bucket as we iterate. Uncategorised tools land in "General" at
    // the end. When everything is uncategorised we skip the section header so
    // the surface stays visually identical to the pre-feature single grid.
    const grouped = useMemo(() => {
        const map = new Map<string, ExternalTool[]>();
        for (const t of visibleTools) {
            const key = (t.category && t.category.trim()) || UNCATEGORISED_LABEL;
            const list = map.get(key) || [];
            list.push(t);
            map.set(key, list);
        }
        // Stable category ordering: alpha, with the uncategorised bucket last.
        const keys = Array.from(map.keys());
        keys.sort((a, b) => {
            if (a === UNCATEGORISED_LABEL) return 1;
            if (b === UNCATEGORISED_LABEL) return -1;
            return a.localeCompare(b);
        });
        return keys.map(key => ({ key, tools: map.get(key)! }));
    }, [visibleTools]);

    if (!currentUser) return null;

    const showHeaders = grouped.length > 1 || (grouped.length === 1 && grouped[0].key !== UNCATEGORISED_LABEL);

    return (
        <div className="h-full flex flex-col overflow-hidden animate-fade-in">
            <HeroShell
                chipLabel="MODULE · EXTERNAL TOOLS"
                chipIcon="fa-toolbox"
                chipAccent="cyan"
                title="External Tools"
                subtitle="Third-party resources and utilities curated for your access level."
                actions={<HeroStat icon="fa-link" label="Available" value={visibleTools.length} accent="cyan" emphasize={visibleTools.length > 0} />}
            />

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-8">
                {visibleTools.length > 0 ? (
                    grouped.map(group => (
                        <div key={group.key}>
                            {showHeaders && (
                                <h2 className="text-[10px] font-black text-cyan-300/80 uppercase tracking-[0.2em] mb-3 flex items-center gap-2">
                                    <i className="fa-solid fa-folder-open text-cyan-500/60 text-xs"></i>
                                    {group.key}
                                    <span className="text-slate-600 font-mono">({group.tools.length})</span>
                                </h2>
                            )}
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {group.tools.map(tool => (
                                    <a
                                        key={tool.id}
                                        href={tool.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="group relative flex flex-col h-full bg-slate-900/80 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 overflow-hidden shadow-lg hover:shadow-cyan-900/20 hover:border-cyan-500/30 hover:-translate-y-0.5 transition-all duration-300"
                                    >
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="w-12 h-12 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 group-hover:bg-cyan-500/20 group-hover:border-cyan-500/40 transition-colors">
                                                <i className={`${tool.icon || 'fa-solid fa-link'} text-xl group-hover:scale-110 transition-transform`}></i>
                                            </div>
                                            <i className="fa-solid fa-arrow-up-right-from-square text-slate-600 group-hover:text-cyan-300 transition-colors text-xs"></i>
                                        </div>
                                        <h3 className="font-bold text-white text-base group-hover:text-cyan-200 transition-colors mb-2 line-clamp-2">{tool.title}</h3>
                                        <p className="text-sm text-slate-400 leading-relaxed grow line-clamp-3">{tool.description}</p>
                                        <div className="mt-4 pt-3 border-t border-slate-800 text-[10px] text-slate-500 font-mono truncate">
                                            {tool.url}
                                        </div>
                                    </a>
                                ))}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30">
                        <EmptyState
                            icon="fa-folder-open"
                            accent="cyan"
                            heading="No external tools available"
                            description="No third-party tools have been configured for your access level. Contact an administrator to request access."
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ExternalToolsView;
