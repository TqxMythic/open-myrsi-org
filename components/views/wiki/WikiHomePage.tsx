import React, { useState, useMemo, useCallback } from 'react';
import { WikiPage, WikiHomeConfig } from '../../../types';
import { useMembers } from '../../../contexts/MembersContext';
import { useFormatDate } from '../../../contexts/AuthContext';
import WikiEditor from './WikiEditor';
import PortalCard from '../../shared/ui/PortalCard';
import SectionLabel from '../../shared/ui/SectionLabel';
import EmptyState from '../../shared/ui/EmptyState';

const EMPTY_CONTENT: Record<string, never> = {};
const RECENTLY_UPDATED_LIMIT = 6;

interface WikiHomePageProps {
    config: WikiHomeConfig;
    visiblePages: WikiPage[];
    canEdit: boolean;
    onSelectPage: (page: WikiPage) => void;
    onSaveConfig: (config: WikiHomeConfig) => Promise<void>;
}

function extractPlainText(content: any, maxLen = 120): string {
    if (!content) return '';
    const texts: string[] = [];
    function walk(node: any) {
        if (!node) return;
        if (node.text) texts.push(node.text);
        if (node.content && Array.isArray(node.content)) {
            for (const child of node.content) walk(child);
        }
    }
    walk(content);
    const full = texts.join(' ').replace(/\s+/g, ' ').trim();
    if (full.length <= maxLen) return full;
    return full.slice(0, maxLen).trimEnd() + '…';
}

const PageCard: React.FC<{ page: WikiPage; classLabel: string; onClick: () => void }> = ({ page, classLabel, onClick }) => {
    const fmt = useFormatDate();
    const excerpt = extractPlainText(page.content);
    return (
        <PortalCard onClick={onClick} className="group hover:border-sky-500/40">
            <h3 className="text-sm font-bold text-white group-hover:text-sky-300 transition-colors truncate">
                {page.title}
            </h3>
            {excerpt && (
                <p className="text-xs text-slate-500 mt-1.5 line-clamp-3 leading-relaxed">{excerpt}</p>
            )}
            <div className="flex items-center gap-2 mt-3 text-[10px] text-slate-600 flex-wrap">
                {page.updatedBy && (
                    <span className="flex items-center gap-1">
                        {page.updatedBy.avatarUrl && (
                            <img src={page.updatedBy.avatarUrl} alt="" className="w-3.5 h-3.5 rounded-full" />
                        )}
                        {page.updatedBy.name}
                    </span>
                )}
                {page.updatedAt && (
                    <span className="font-mono">{fmt.date(page.updatedAt)}</span>
                )}
                {page.classificationLevel > 0 && classLabel && (
                    <span className={`px-1.5 py-0.5 rounded font-bold uppercase tracking-wider ${
                        page.classificationLevel >= 3
                            ? 'bg-red-900/30 text-red-400 border border-red-500/20'
                            : page.classificationLevel >= 2
                            ? 'bg-orange-900/30 text-orange-400 border border-orange-500/20'
                            : 'bg-yellow-900/30 text-yellow-400 border border-yellow-500/20'
                    }`}>
                        {classLabel}
                    </span>
                )}
            </div>
        </PortalCard>
    );
};

const WikiHomePage: React.FC<WikiHomePageProps> = ({ config, visiblePages, canEdit, onSelectPage, onSaveConfig }) => {
    const { securityClearances } = useMembers();
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [editFeaturedIds, setEditFeaturedIds] = useState<string[]>([]);
    const [addPageId, setAddPageId] = useState('');

    const featuredPages = useMemo(() => {
        if (!config.featuredPageIds?.length) return [];
        return config.featuredPageIds
            .map(id => visiblePages.find(p => p.id === id))
            .filter((p): p is WikiPage => !!p);
    }, [config.featuredPageIds, visiblePages]);

    const recentlyUpdated = useMemo(() => {
        const featuredIds = new Set(featuredPages.map((p) => p.id));
        return visiblePages
            .filter((p) => !featuredIds.has(p.id))
            .slice()
            .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
            .slice(0, RECENTLY_UPDATED_LIMIT);
    }, [visiblePages, featuredPages]);

    const editFeaturedPages = useMemo(() => {
        return editFeaturedIds
            .map(id => visiblePages.find(p => p.id === id))
            .filter((p): p is WikiPage => !!p);
    }, [editFeaturedIds, visiblePages]);

    const availableToFeature = useMemo(() => {
        const featured = new Set(editFeaturedIds);
        return visiblePages.filter(p => !featured.has(p.id));
    }, [visiblePages, editFeaturedIds]);

    const handleStartEdit = useCallback(() => {
        setEditFeaturedIds(config.featuredPageIds || []);
        setIsEditing(true);
    }, [config.featuredPageIds]);

    const handleCancel = useCallback(() => {
        setIsEditing(false);
        setAddPageId('');
    }, []);

    const handleSaveWelcome = useCallback(async (contentJson: any) => {
        setIsSaving(true);
        try {
            await onSaveConfig({ ...config, welcomeContent: contentJson });
            setIsEditing(false);
        } finally {
            setIsSaving(false);
        }
    }, [config, onSaveConfig]);

    const handleSaveFeatured = useCallback(async () => {
        setIsSaving(true);
        try {
            await onSaveConfig({ ...config, featuredPageIds: editFeaturedIds });
        } finally {
            setIsSaving(false);
        }
    }, [config, editFeaturedIds, onSaveConfig]);

    const handleRemoveFeatured = useCallback((id: string) => {
        setEditFeaturedIds(prev => prev.filter(fid => fid !== id));
    }, []);

    const handleAddFeatured = useCallback(() => {
        if (addPageId && !editFeaturedIds.includes(addPageId)) {
            setEditFeaturedIds(prev => [...prev, addPageId]);
            setAddPageId('');
        }
    }, [addPageId, editFeaturedIds]);

    const getClassificationName = (level: number) => {
        return securityClearances.find(c => c.level === level)?.name
            || (level === 0 ? '' : `Level ${level}`);
    };

    if (isEditing) {
        return (
            <div className="max-w-4xl space-y-6 animate-fade-in">
                <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
                    <div className="flex items-center gap-3">
                        <button onClick={handleCancel} className="text-slate-400 hover:text-white transition-colors">
                            <i className="fa-solid fa-arrow-left" />
                        </button>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                            <i className="fa-solid fa-house-chimney text-sky-500" />
                            Edit Wiki Home
                        </h1>
                    </div>
                </div>

                <div className="space-y-3">
                    <SectionLabel label="Welcome Content" icon="fa-message" />
                    <WikiEditor
                        content={config.welcomeContent || EMPTY_CONTENT}
                        editable={true}
                        onSave={handleSaveWelcome}
                        onCancel={handleCancel}
                    />
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-700/50">
                    <SectionLabel label="Featured Articles" icon="fa-star" />

                    {editFeaturedPages.length > 0 ? (
                        <div className="space-y-2">
                            {editFeaturedPages.map(page => (
                                <div key={page.id} className="flex items-center justify-between bg-slate-800/60 rounded-lg px-4 py-2.5 border border-slate-700/50">
                                    <span className="text-sm text-white font-medium">{page.title}</span>
                                    <button
                                        onClick={() => handleRemoveFeatured(page.id)}
                                        className="text-slate-500 hover:text-red-400 transition-colors text-xs"
                                        title="Remove from featured"
                                    >
                                        <i className="fa-solid fa-xmark" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-slate-600 italic">No featured articles selected.</p>
                    )}

                    {availableToFeature.length > 0 && (
                        <div className="flex items-center gap-2">
                            <select
                                value={addPageId}
                                onChange={e => setAddPageId(e.target.value)}
                                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-sky-500 outline-hidden"
                            >
                                <option value="">Select a page to feature...</option>
                                {availableToFeature.map(p => (
                                    <option key={p.id} value={p.id}>{p.title}</option>
                                ))}
                            </select>
                            <button
                                onClick={handleAddFeatured}
                                disabled={!addPageId}
                                className="px-3 py-2 text-sm font-bold text-sky-400 hover:text-white bg-sky-600/10 hover:bg-sky-600 border border-sky-500/30 rounded-lg transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                                <i className="fa-solid fa-plus mr-1" />Add
                            </button>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            onClick={handleCancel}
                            className="px-4 py-2 text-sm font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSaveFeatured}
                            disabled={isSaving}
                            className="px-4 py-2 text-sm font-bold text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors disabled:opacity-50"
                        >
                            <i className="fa-solid fa-floppy-disk mr-2" />{isSaving ? 'Saving...' : 'Save Featured'}
                        </button>
                    </div>
                </div>

                {/* Display Options — kept simple inline so we don't need a third edit-screen section. */}
                <div className="space-y-3 pt-4 border-t border-slate-700/50">
                    <SectionLabel label="Display Options" icon="fa-eye" />
                    <label className="flex items-center gap-3 cursor-pointer p-3 rounded-lg bg-slate-800/40 border border-slate-700/40 hover:border-sky-500/30 transition-colors">
                        <input
                            type="checkbox"
                            checked={!!config.hideRecentlyUpdated}
                            onChange={async (e) => {
                                setIsSaving(true);
                                try {
                                    await onSaveConfig({ ...config, hideRecentlyUpdated: e.target.checked });
                                } finally {
                                    setIsSaving(false);
                                }
                            }}
                            className="h-4 w-4 rounded-sm bg-slate-800 border-slate-600 text-sky-500 focus:ring-sky-500"
                        />
                        <div>
                            <span className="text-xs font-bold text-white block">Hide "Recently Updated"</span>
                            <span className="text-[10px] text-slate-500 block leading-tight mt-0.5">Don't show recent edits on the wiki home page.</span>
                        </div>
                    </label>
                </div>
            </div>
        );
    }

    const hasWelcome = !!config.welcomeContent && Object.keys(config.welcomeContent).length > 0;
    const hasFeatured = featuredPages.length > 0;
    const hasRecent = !config.hideRecentlyUpdated && recentlyUpdated.length > 0;
    const isCompletelyEmpty = !hasWelcome && !hasFeatured && !hasRecent;

    return (
        <div className="max-w-4xl space-y-8 animate-fade-in">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <i className="fa-solid fa-book text-sky-500" />
                    Org Wiki
                </h1>
                {canEdit && (
                    <button
                        onClick={handleStartEdit}
                        className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                    >
                        <i className="fa-solid fa-pen-to-square" />
                        <span className="hidden md:inline">Edit Home</span>
                    </button>
                )}
            </div>

            {hasWelcome ? (
                <PortalCard padding="lg">
                    <WikiEditor content={config.welcomeContent} editable={false} />
                </PortalCard>
            ) : !isCompletelyEmpty && (
                <PortalCard variant="dashed" padding="lg">
                    <p className="text-sm text-slate-500 text-center">
                        {canEdit
                            ? 'No welcome content yet. Click "Edit Home" to add a welcome message.'
                            : 'Welcome to the wiki. Pick a page from the tree or use the search to begin.'}
                    </p>
                </PortalCard>
            )}

            {hasFeatured && (
                <div>
                    <SectionLabel label="Featured Articles" icon="fa-star" count={featuredPages.length} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {featuredPages.map(page => (
                            <PageCard
                                key={page.id}
                                page={page}
                                classLabel={getClassificationName(page.classificationLevel)}
                                onClick={() => onSelectPage(page)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {hasRecent && (
                <div>
                    <SectionLabel label="Recently Updated" icon="fa-clock-rotate-left" count={recentlyUpdated.length} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {recentlyUpdated.map(page => (
                            <PageCard
                                key={page.id}
                                page={page}
                                classLabel={getClassificationName(page.classificationLevel)}
                                onClick={() => onSelectPage(page)}
                            />
                        ))}
                    </div>
                </div>
            )}

            {isCompletelyEmpty && (
                <EmptyState
                    icon="fa-book-open"
                    heading="The wiki is empty"
                    description={canEdit
                        ? 'Create your first page from the sidebar or top bar to get started.'
                        : 'No pages have been published yet. Check back soon.'}
                    accent="sky"
                />
            )}
        </div>
    );
};

export default WikiHomePage;
