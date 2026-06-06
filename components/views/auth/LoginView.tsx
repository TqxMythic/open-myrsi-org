import React, { useEffect, useState } from 'react';
import { BrandingConfig, Announcement } from '../../../types';
import Notice from '../../ui/Notice';
import CallsignChip from '../../shared/ui/CallsignChip';

interface LoginViewProps {
    onLoginClick: () => void;
    brandingConfig: BrandingConfig;
    announcements: Announcement[];
    /** Auth error from a previous callback attempt (e.g. Discord rejected the org's OAuth credentials). */
    authError?: string | null;
    onDismissAuthError?: () => void;
}

const formatUTC = (d: Date) => {
    const hh = d.getUTCHours().toString().padStart(2, '0');
    const mm = d.getUTCMinutes().toString().padStart(2, '0');
    const ss = d.getUTCSeconds().toString().padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
};

const LoginView: React.FC<LoginViewProps> = ({ onLoginClick, brandingConfig, announcements, authError, onDismissAuthError }) => {
    const [now, setNow] = useState(() => new Date());
    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    // Newest-first; LoginScreen already filters expired upstream in DashboardApp.
    const sortedAnnouncements = [...announcements].sort((a, b) => {
        const ta = Date.parse(a.publishDate || '') || 0;
        const tb = Date.parse(b.publishDate || '') || 0;
        return tb - ta;
    });

    return (
        <div className="relative flex flex-col min-h-dvh bg-slate-950 text-slate-200 font-sans overflow-hidden animate-fade-in">
            <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[700px] h-[500px] bg-sky-500/10 rounded-full blur-[140px] pointer-events-none" aria-hidden />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[40px_40px] pointer-events-none" aria-hidden />
            <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
                <div className="absolute left-0 right-0 h-[2px] bg-linear-to-r from-transparent via-sky-400/50 to-transparent" style={{ animation: 'loginScan 7s linear infinite' }} />
            </div>

            <div className="relative z-10 px-5 pt-6 sm:px-8 sm:pt-8 flex justify-center">
                <CallsignChip label="SECURE CHANNEL · AUTHENTICATION" icon="fa-shield-halved" accent="emerald" pulse />
            </div>

            {/* Announcements — surfaced above the auth card so visitors see active comms before signing in. */}
            {sortedAnnouncements.length > 0 && (
                <div className="relative z-10 px-5 sm:px-8 pt-5 max-w-2xl mx-auto w-full space-y-3">
                    {sortedAnnouncements.map(a => (
                        <Notice key={a.id} announcement={a} />
                    ))}
                </div>
            )}

            <div className="relative z-10 flex-1 flex items-center justify-center px-5 sm:px-8 py-6">
                <div className="w-full max-w-md flex flex-col items-center text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-sky-500 blur-3xl opacity-25 rounded-full" style={{ animation: 'loginGlow 3s ease-in-out infinite' }} aria-hidden />
                        <div className="relative z-10 w-20 h-20 rounded-2xl bg-slate-900/60 border border-white/10 backdrop-blur-md flex items-center justify-center shadow-[0_0_40px_rgba(14,165,233,0.25)]">
                            <img src={brandingConfig.iconUrl} alt="" className="w-12 h-12 drop-shadow-[0_0_15px_rgba(14,165,233,0.8)]" />
                        </div>
                    </div>

                    <h1 className="text-3xl sm:text-4xl font-black text-white tracking-[0.15em] uppercase mb-1 leading-tight">
                        {brandingConfig.name}
                    </h1>
                    <p className="text-[11px] text-sky-300/70 font-mono uppercase tracking-[0.3em] mb-5">Operations Terminal</p>
                    <div className="h-px w-20 bg-linear-to-r from-transparent via-sky-500 to-transparent opacity-60 mb-6" />

                    {(brandingConfig.loginTitle || brandingConfig.loginSubtitle) && (
                        <div className="max-w-sm mb-6">
                            {brandingConfig.loginTitle && (
                                <h2 className="text-sm font-bold text-slate-100 mb-1">{brandingConfig.loginTitle}</h2>
                            )}
                            {brandingConfig.loginSubtitle && (
                                <p className="text-xs text-slate-400 leading-relaxed">{brandingConfig.loginSubtitle}</p>
                            )}
                        </div>
                    )}

                    {/* Auth error — shown when Discord rejected the org's OAuth credentials. */}
                    {authError && (
                        <div className="w-full mb-4 p-3 bg-amber-500/10 border border-amber-500/30 rounded-lg text-left">
                            <div className="flex items-start gap-2">
                                <i className="fa-solid fa-triangle-exclamation text-amber-400 text-sm mt-0.5 shrink-0"></i>
                                <div className="min-w-0 flex-1">
                                    <p className="text-[11px] font-bold text-amber-300 uppercase tracking-widest mb-1">Login failed</p>
                                    <p className="text-xs text-amber-100/90 leading-relaxed">{authError}</p>
                                </div>
                                {onDismissAuthError && (
                                    <button
                                        onClick={onDismissAuthError}
                                        className="text-amber-400/60 hover:text-amber-200 shrink-0"
                                        aria-label="Dismiss"
                                    >
                                        <i className="fa-solid fa-xmark text-xs"></i>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}

                    <button
                        onClick={() => { onDismissAuthError?.(); onLoginClick(); }}
                        className="w-full flex items-center justify-center bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold py-3.5 px-6 rounded-xl text-sm transition-all duration-200 shadow-lg shadow-[#5865F2]/25 group/btn relative overflow-hidden active:scale-[0.98]"
                    >
                        <span className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
                        <i className="fa-brands fa-discord h-5 w-5 mr-3" aria-hidden />
                        <span className="relative z-10 uppercase tracking-wider">{authError ? 'Try Again' : 'Continue with Discord'}</span>
                    </button>

                    <p className="mt-4 text-[11px] text-slate-500 leading-relaxed">
                        First time? After Discord auth you&rsquo;ll link your RSI handle.
                    </p>
                </div>
            </div>

            <div className="relative z-10 px-5 sm:px-8 pb-5 sm:pb-6 pt-3 border-t border-white/5 flex items-center justify-between text-[10px] font-mono uppercase tracking-[0.2em] text-slate-500">
                <span className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    System Online
                </span>
                <span className="text-slate-400">UTC {formatUTC(now)}</span>
            </div>

            <style>{`
                @keyframes loginScan { 0% { top: -2px } 100% { top: 100% } }
                @keyframes loginGlow { 0%, 100% { opacity: 0.2; transform: scale(1) } 50% { opacity: 0.45; transform: scale(1.1) } }
            `}</style>
        </div>
    );
};

export default LoginView;
