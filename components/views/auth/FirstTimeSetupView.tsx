import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfig } from '../../../contexts/ConfigContext';
import CallsignChip from '../../shared/ui/CallsignChip';

interface FirstTimeSetupViewProps {
    onFinalizeAdminSetup: (claimKey: string) => void;
}

const formatUTC = (d: Date) => {
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
};

const FirstTimeSetupView: React.FC<FirstTimeSetupViewProps> = ({ onFinalizeAdminSetup }) => {
    const { currentUser, claimAdminAccount } = useAuth();
    const { brandingConfig } = useConfig();
    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [now, setNow] = useState(() => new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    const handleClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsSubmitting(true);
        try {
            await claimAdminAccount(code);
        } catch (err: any) {
            console.error(err);
            setError(err.message || 'Invalid Claim Code');
            setIsSubmitting(false);
        }
    };

    const isAuthenticated = !!currentUser;

    return (
        <div className="relative flex flex-col min-h-dvh bg-slate-950 text-slate-200 font-sans overflow-hidden animate-fade-in">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" aria-hidden />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[40px_40px] pointer-events-none" aria-hidden />
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
                <div className="absolute left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-amber-400/50 to-transparent" style={{ animation: 'setupScan 7s linear infinite' }} />
            </div>

            <div className="relative z-10 px-5 pt-6 sm:px-8 sm:pt-8 flex justify-center">
                <CallsignChip label="ADMIN CLAIM PROTOCOL" icon="fa-key" accent="amber" pulse />
            </div>

            <div className="relative z-10 flex-1 flex items-center justify-center px-5 sm:px-8 py-6">
                <div className="w-full max-w-md flex flex-col items-center text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-amber-500 blur-3xl opacity-25 rounded-full" style={{ animation: 'setupGlow 3s ease-in-out infinite' }} aria-hidden />
                        <div className="relative z-10 w-20 h-20 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-[0_0_40px_rgba(245,158,11,0.25)]">
                            <img src={brandingConfig.iconUrl} alt="" className="w-12 h-12 drop-shadow-[0_0_15px_rgba(245,158,11,0.8)]" />
                        </div>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-[0.15em] uppercase mb-1 leading-tight">
                        {brandingConfig.name}
                    </h1>
                    <p className="text-[11px] text-amber-300/70 font-mono uppercase tracking-[0.3em] mb-5">System Initialization</p>
                    <div className="h-px w-20 bg-linear-to-r from-transparent via-amber-500 to-transparent opacity-60 mb-6" />

                    <p className="text-sm text-slate-400 leading-relaxed mb-6 max-w-sm">
                        {isAuthenticated
                            ? <>Identity verified. Enter your <span className="text-slate-200 font-bold">Setup Code</span> to complete administrator setup.</>
                            : <>No administrator accounts detected. Authenticate with Discord to begin the claim process.</>
                        }
                    </p>

                    {!isAuthenticated ? (
                        <div className="w-full space-y-3">
                            <button
                                onClick={() => onFinalizeAdminSetup('')}
                                className="w-full flex items-center justify-center bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-[#5865F2]/25 group/btn relative overflow-hidden active:scale-[0.98]"
                            >
                                <span className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                                <i className="fa-brands fa-discord mr-3" aria-hidden />
                                <span className="relative z-10 uppercase tracking-wider">Authenticate &amp; Claim</span>
                            </button>

                            <div className="p-3 bg-black/30 rounded-lg border border-slate-700/50 text-[11px] text-slate-500 font-mono text-left">
                                <p className="font-bold text-slate-400 mb-1 uppercase tracking-wider text-[10px]">Configuration Debug</p>
                                <p className="break-all">Redirect URI: <span className="text-amber-300 select-all">{window.location.origin}</span></p>
                                <p className="mt-1 opacity-75 leading-relaxed">Ensure exactly this URI is added to your Discord Application&rsquo;s Redirects.</p>
                            </div>
                        </div>
                    ) : (
                        <form onSubmit={handleClaim} className="w-full space-y-3">
                            <input
                                type="text"
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                placeholder="SETUP-XXXXXX"
                                className="w-full bg-slate-900/60 border border-slate-700 rounded-xl p-4 text-center text-xl font-mono tracking-widest text-white focus:border-amber-500 focus:outline-hidden focus:ring-1 focus:ring-amber-500/50 placeholder:text-slate-600 placeholder:text-sm placeholder:tracking-normal placeholder:font-sans transition-all"
                                autoFocus
                            />

                            {error && (
                                <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-3 rounded-xl text-xs font-bold flex items-start gap-3 text-left">
                                    <i className="fa-solid fa-circle-exclamation mt-0.5" aria-hidden />
                                    <p>{error}</p>
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={isSubmitting || code.length < 6}
                                className="w-full bg-amber-600 hover:bg-amber-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-black uppercase tracking-[0.2em] py-3.5 px-6 rounded-xl text-xs transition-all shadow-lg shadow-amber-900/25 active:scale-[0.98]"
                            >
                                {isSubmitting
                                    ? <><i className="fa-solid fa-circle-notch animate-spin mr-2" aria-hidden />Verifying...</>
                                    : 'Finalize Setup'
                                }
                            </button>
                            <p className="text-[10px] text-slate-500 leading-relaxed pt-2">
                                Codes are case-insensitive. After 10 failed attempts the code regenerates.
                            </p>
                        </form>
                    )}
                </div>
            </div>

            <div className="relative z-10 px-5 sm:px-8 pb-5 sm:pb-6 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    {isAuthenticated ? `Signed in as ${currentUser?.name}` : 'Awaiting Authentication'}
                </span>
                <span className="text-slate-400">UTC {formatUTC(now)}</span>
            </div>

            <style>{`
                @keyframes setupScan { 0% { top: -2px } 100% { top: 100% } }
                @keyframes setupGlow { 0%, 100% { opacity: 0.2; transform: scale(1) } 50% { opacity: 0.45; transform: scale(1.1) } }
            `}</style>
        </div>
    );
};

export default FirstTimeSetupView;
