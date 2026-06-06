
import React, { useState, useMemo } from 'react';
import { useData } from '../../../contexts/DataContext';
import { useMembers } from '../../../contexts/MembersContext';
import { User, ServiceRequestStatus } from '../../../types';
import HeroShell from '../../shared/ui/HeroShell';
import HeroStat from '../../shared/ui/HeroStat';
import EmptyState from '../../shared/ui/EmptyState';

type SortKey = 'totalMissions' | 'totalUec' | 'largestPayout' | 'avgRating' | 'medigel';

interface LeaderboardStat {
    user: User;
    totalMissions: number; // Successes
    failures: number; // Failed or Aborted
    clientMissions: number;
    adhocMissions: number;
    totalUec: number;
    largestPayout: number;
    ratingSum: number;
    ratingCount: number;
    totalMedigel: number;
}

const LeaderboardView: React.FC = () => {
    const { hydratedServiceRequests } = useData();
    const { members } = useMembers();
    const [sortKey, setSortKey] = useState<SortKey>('totalMissions');

    const leaderboardData = useMemo<LeaderboardStat[]>(() => {
        const stats = new Map<number, LeaderboardStat>();

        members.forEach(member => {
            stats.set(member.id, {
                user: member,
                totalMissions: 0,
                failures: 0,
                clientMissions: 0,
                adhocMissions: 0,
                totalUec: 0,
                largestPayout: 0,
                ratingSum: 0,
                ratingCount: 0,
                totalMedigel: 0,
            });
        });

        hydratedServiceRequests.forEach(req => {
            const isSuccess = req.status === ServiceRequestStatus.Success;
            const isFailure = req.status === ServiceRequestStatus.Failed || req.status === ServiceRequestStatus.Aborted;

            if (isSuccess || isFailure) {
                req.assignedMemberIds.forEach(memberId => {
                    const memberStat = stats.get(memberId);
                    if (memberStat) {
                        // Medigel (can occur in both success and fail if logged)
                        if (req.medigelConsumed) {
                            memberStat.totalMedigel += req.medigelConsumed;
                        }

                        if (isSuccess) {
                            memberStat.totalMissions += 1;

                            if (req.clientId) {
                                memberStat.clientMissions += 1;
                            } else {
                                memberStat.adhocMissions += 1;
                            }

                            const uec = req.uecEarned || 0;
                            memberStat.totalUec += uec;
                            if (uec > memberStat.largestPayout) {
                                memberStat.largestPayout = uec;
                            }

                            // Calculate Rating from Request Data (Source of Truth)
                            if (req.rated && req.clientRating) {
                                memberStat.ratingSum += req.clientRating;
                                memberStat.ratingCount += 1;
                            }
                        }

                        if (isFailure) {
                            memberStat.failures += 1;
                        }
                    }
                });
            }
        });

        return Array.from(stats.values());
    }, [members, hydratedServiceRequests]);

    const sortedData = useMemo(() => {
        return [...leaderboardData]
            .filter(stat => {
                if (sortKey === 'avgRating') {
                    return stat.ratingCount > 0;
                }
                if (sortKey === 'medigel') {
                    return stat.totalMedigel > 0;
                }
                // Show if they have at least one completed mission (success or fail) to appear on board
                return stat.totalMissions > 0 || stat.failures > 0;
            })
            .sort((a, b) => {
                if (sortKey === 'avgRating') {
                    const avgA = a.ratingCount > 0 ? a.ratingSum / a.ratingCount : 0;
                    const avgB = b.ratingCount > 0 ? b.ratingSum / b.ratingCount : 0;
                    // Sort by average, then by count if tied
                    if (avgA !== avgB) return avgB - avgA;
                    return b.ratingCount - a.ratingCount;
                }
                if (sortKey === 'medigel') {
                    return b.totalMedigel - a.totalMedigel;
                }
                if (sortKey === 'totalMissions') {
                    // Sort by successful missions descending.
                    return b.totalMissions - a.totalMissions;
                }
                return b[sortKey] - a[sortKey];
            });
    }, [leaderboardData, sortKey]);

    const getRankIcon = (index: number) => {
        if (index === 0) return <div className="w-8 h-8 rounded-sm bg-amber-900/40 border border-amber-500/50 flex items-center justify-center text-amber-400 shadow-[0_0_15px_rgba(245,158,11,0.4)]"><i className="fa-solid fa-trophy"></i></div>;
        if (index === 1) return <div className="w-8 h-8 rounded-sm bg-slate-700/40 border border-slate-500/50 flex items-center justify-center text-slate-300"><i className="fa-solid fa-medal"></i></div>;
        if (index === 2) return <div className="w-8 h-8 rounded-sm bg-orange-900/40 border border-orange-600/50 flex items-center justify-center text-orange-400"><i className="fa-solid fa-medal"></i></div>;
        return <div className="w-8 h-8 rounded-sm bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 font-mono font-bold">{index + 1}</div>;
    };

    // Aggregate stats for hero strip
    const heroStats = useMemo(() => {
        const totalMissions = leaderboardData.reduce((sum, s) => sum + s.totalMissions, 0);
        const totalUec = leaderboardData.reduce((sum, s) => sum + s.totalUec, 0);
        const activeOperators = leaderboardData.filter(s => s.totalMissions > 0).length;
        return { totalMissions, totalUec, activeOperators };
    }, [leaderboardData]);

    const sortTabs: Array<{ key: SortKey; label: string; icon: string }> = [
        { key: 'totalMissions', label: 'Missions', icon: 'fa-check-double' },
        { key: 'totalUec', label: 'Total UEC', icon: 'fa-coins' },
        { key: 'largestPayout', label: 'Top Payout', icon: 'fa-sack-dollar' },
        { key: 'medigel', label: 'Medigel', icon: 'fa-kit-medical' },
        { key: 'avgRating', label: 'Satisfaction', icon: 'fa-star' },
    ];

    return (
        <div className="h-full flex flex-col overflow-hidden animate-fade-in">
            <HeroShell
                chipLabel="MODULE · LEADERBOARD"
                chipIcon="fa-trophy"
                chipAccent="amber"
                title="Service Leaderboard"
                subtitle="Operational performance and ratings. Rankings refresh as missions resolve."
                statsCols={3}
                stats={<>
                    <HeroStat icon="fa-check-double" label="Missions Completed" value={heroStats.totalMissions} accent="emerald" emphasize={heroStats.totalMissions > 0} />
                    <HeroStat icon="fa-sack-dollar" label="Total UEC Earned" value={heroStats.totalUec.toLocaleString()} accent="amber" emphasize={heroStats.totalUec > 0} />
                    <HeroStat icon="fa-user-group" label="Active Operators" value={heroStats.activeOperators} accent="cyan" emphasize={heroStats.activeOperators > 0} />
                </>}
                tabs={sortTabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setSortKey(tab.key)}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-colors whitespace-nowrap ${
                            sortKey === tab.key
                                ? 'text-amber-300 border-amber-400'
                                : 'text-slate-500 border-transparent hover:text-slate-300'
                        }`}
                    >
                        <i className={`fa-solid ${tab.icon}`}></i>
                        {tab.label}
                    </button>
                ))}
            />

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3">
                {sortedData.map((stat, index) => {
                    const avgRating = stat.ratingCount > 0 ? (stat.ratingSum / stat.ratingCount).toFixed(1) : 'N/A';
                    const isTop = index < 3;

                    return (
                        <div key={stat.user.id} className={`relative bg-slate-900/80 backdrop-blur-md border rounded-xl p-4 flex flex-col sm:flex-row sm:items-center gap-4 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 group ${isTop ? 'border-amber-500/30 hover:shadow-amber-900/20 hover:border-amber-500/50' : 'border-slate-700/50 hover:shadow-amber-900/10 hover:border-amber-500/30'}`}>
                            <div className="flex items-center flex-1 min-w-0 gap-4">
                                <div className="shrink-0">
                                    {getRankIcon(index)}
                                </div>
                                <div className="relative">
                                    <img src={stat.user.avatarUrl} alt={stat.user.name} className="h-12 w-12 rounded-full border-2 border-slate-700 object-cover shrink-0" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-white truncate text-lg">{stat.user.name}</p>
                                    <p className="text-xs text-slate-500 font-mono uppercase tracking-wider">{stat.user.rank?.name || 'Member'}</p>
                                </div>
                            </div>

                            <div className="flex justify-between sm:justify-end gap-6 sm:gap-12 pt-4 sm:pt-0 border-t sm:border-t-0 border-slate-700/50 w-full sm:w-auto overflow-x-auto">

                                {sortKey === 'medigel' ? (
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Consumed</p>
                                        <p className="text-xl font-black text-red-400 font-mono">{stat.totalMedigel.toFixed(1)} L</p>
                                    </div>
                                ) : (
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Completed</p>
                                        <p className="text-xl font-black text-white">{stat.totalMissions}</p>
                                    </div>
                                )}

                                {(sortKey === 'totalMissions' || sortKey === 'avgRating' || sortKey === 'medigel') && (
                                    <div className="text-right hidden md:block min-w-[80px]">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Outcome</p>
                                        <div className="flex items-center justify-end gap-3 text-sm font-mono mt-0.5">
                                            <span className="text-green-400 flex items-center gap-1" title="Successful Missions">
                                                <i className="fa-solid fa-check text-[10px]"></i> {stat.totalMissions}
                                            </span>
                                            <span className="text-slate-600">/</span>
                                            <span className="text-red-400 flex items-center gap-1" title="Failed/Aborted Missions">
                                                <i className="fa-solid fa-xmark text-[10px]"></i> {stat.failures}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {(sortKey === 'totalUec' || sortKey === 'largestPayout') && (
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">{sortKey === 'totalUec' ? 'Total Earned' : 'Top Payout'}</p>
                                        <p className="text-xl font-black text-lime-400 font-mono">
                                            {(sortKey === 'totalUec' ? stat.totalUec : stat.largestPayout).toLocaleString()}
                                        </p>
                                    </div>
                                )}

                                {(sortKey === 'avgRating' || sortKey === 'totalMissions' || sortKey === 'medigel') && (
                                    <div className="text-right">
                                        <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Rating</p>
                                        <div className="flex items-center justify-end gap-1">
                                            <span className="text-xl font-black text-amber-400">{avgRating}</span>
                                            <i className="fa-solid fa-star text-amber-400 text-xs mb-1"></i>
                                        </div>
                                        {stat.ratingCount > 0 && <p className="text-[9px] text-slate-600 text-right">{stat.ratingCount} Votes</p>}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}

                {sortedData.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/30">
                        <EmptyState
                            icon="fa-trophy"
                            accent="amber"
                            heading="No mission data yet"
                            description={
                                sortKey === 'avgRating'
                                    ? 'No rated missions found. Client ratings appear here once requests are resolved.'
                                    : sortKey === 'medigel'
                                        ? 'No medigel consumption has been logged yet.'
                                        : 'Rankings will appear here as operators complete missions.'
                            }
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default LeaderboardView;
