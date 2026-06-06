import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useConfig } from '../../../contexts/ConfigContext';

import { useNotification } from '../../../contexts/NotificationContext';

const RsiVerificationRequiredView: React.FC = () => {
    const { currentUser, verifyRsiHandleUpdate, cancelRsiHandleUpdate, logout } = useAuth();
    const { brandingConfig } = useConfig();
    const { confirm } = useNotification();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    if (!currentUser) return null;

    const { rsiHandlePending, rsiVerificationCode } = currentUser;

    const handleVerify = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await verifyRsiHandleUpdate();
        } catch (err: any) {
            setError(err.message || "Identity signal not found. Ensure the code is saved in your bio.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleCancel = async () => {
        const confirmed = await confirm({
            title: 'Abort Identity Update',
            message: 'Abort identity update? Your RSI handle will remain unchanged.',
            confirmText: 'Abort',
            variant: 'warning'
        });
        if (confirmed) {
            try {
                await cancelRsiHandleUpdate(currentUser.id);
            } catch (err: any) {
                setError(err.message || "Signal interruption during abort sequence.");
            }
        }
    }

    const copyToClipboard = () => {
        if (rsiVerificationCode) {
            navigator.clipboard.writeText(rsiVerificationCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-6 relative overflow-hidden font-sans">
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(14,165,233,0.1)_0%,transparent_70%)] pointer-events-none"></div>
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-size-[40px_40px] pointer-events-none"></div>

            <div className="w-full max-w-lg relative z-10 animate-fade-in-up space-y-6">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-linear-to-r from-sky-600 via-indigo-500 to-sky-600"></div>

                    <div className="p-8 text-center border-b border-white/5 bg-white/5">
                        <div className="w-16 h-16 bg-sky-500/10 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-sky-500/20 shadow-[0_0_30px_rgba(14,165,233,0.2)]">
                            <img src={brandingConfig.iconUrl} alt="Logo" className="w-10 h-10 drop-shadow-md" />
                        </div>
                        <h1 className="text-2xl font-black text-white tracking-tight uppercase mb-1">Identity Verification</h1>
                        <p className="text-sky-200/60 font-mono text-[10px] uppercase tracking-[0.3em]">{brandingConfig.name} {'//'} Security_Protocol</p>
                    </div>

                    <div className="p-8 space-y-8">
                        <div className="flex items-center gap-4 bg-black/40 p-4 rounded-xl border border-slate-700/50 shadow-inner">
                            <img src={currentUser.avatarUrl} alt="Avatar" className="w-14 h-14 rounded-full border-2 border-slate-700 grayscale-[0.3]" />
                            <div className="min-w-0">
                                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-0.5">Anchoring Identity</p>
                                <p className="text-white font-mono text-xl font-bold truncate">{rsiHandlePending}</p>
                            </div>
                        </div>

                        <div className="space-y-5">
                            <div className="flex items-start gap-4">
                                <div className="w-6 h-6 rounded-sm bg-slate-800 flex items-center justify-center text-[10px] font-black text-sky-500 border border-sky-500/20 shrink-0 mt-0.5 font-mono">01</div>
                                <div>
                                    <p className="text-slate-300 text-sm font-bold">Access RSI Control</p>
                                    <p className="text-xs text-slate-500 mt-1">Visit <a href="https://robertsspaceindustries.com/account/profile" target="_blank" rel="noopener noreferrer" className="text-sky-400 hover:underline">rsi.com/account/profile</a> &rarr; Settings.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-6 h-6 rounded-sm bg-slate-800 flex items-center justify-center text-[10px] font-black text-sky-500 border border-sky-500/20 shrink-0 mt-0.5 font-mono">02</div>
                                <div className="w-full">
                                    <p className="text-slate-300 text-sm font-bold mb-3">Sync Verification Payload</p>
                                    <div className="flex items-center bg-black/60 border border-sky-500/30 rounded-xl p-1 pr-2 group transition-all hover:border-sky-500/60 overflow-hidden">
                                        <code className="flex-1 font-mono text-sky-400 text-sm px-3 tracking-widest select-all">{rsiVerificationCode}</code>
                                        <button
                                            onClick={copyToClipboard}
                                            className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase transition-all shadow-lg ${copied ? 'bg-green-600 text-white' : 'bg-sky-600/10 text-sky-400 hover:bg-sky-600 hover:text-white'}`}
                                        >
                                            {copied ? 'Success' : 'Copy'}
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-2 italic px-1">Paste into your RSI "Bio" section and commit changes.</p>
                                </div>
                            </div>

                            <div className="flex items-start gap-4">
                                <div className="w-6 h-6 rounded-sm bg-slate-800 flex items-center justify-center text-[10px] font-black text-sky-500 border border-sky-500/20 shrink-0 mt-0.5 font-mono">03</div>
                                <div>
                                    <p className="text-slate-300 text-sm font-bold">Initiate Identity Handshake</p>
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 p-4 rounded-xl text-xs font-bold flex items-start gap-3 animate-pulse uppercase tracking-tight">
                                <i className="fa-solid fa-circle-exclamation mt-0.5"></i>
                                <p>{error}</p>
                            </div>
                        )}

                        <div className="pt-4 flex flex-col gap-4">
                            <button
                                onClick={handleVerify}
                                disabled={isLoading}
                                className="w-full bg-sky-600 hover:bg-sky-500 text-white py-4 rounded-xl font-black uppercase tracking-[0.25em] text-sm transition-all shadow-xl shadow-sky-900/30 active:scale-95 disabled:opacity-50 disabled:cursor-wait border border-sky-400/30"
                            >
                                {isLoading ? (
                                    <><i className="fa-solid fa-circle-notch animate-spin mr-2" /> Syncing Signal...</>
                                ) : "Verify Profile"}
                            </button>

                            <button
                                onClick={handleCancel}
                                disabled={isLoading}
                                className="w-full text-slate-600 hover:text-slate-400 text-[10px] font-black uppercase tracking-[0.2em] py-2 transition-colors"
                            >
                                Cancel Request
                            </button>
                        </div>
                    </div>

                    <div className="bg-black/20 p-5 border-t border-white/5 text-center flex justify-center">
                        <button onClick={logout} className="text-[9px] text-slate-600 hover:text-red-400 uppercase font-black tracking-widest transition-colors flex items-center gap-2">
                            <i className="fa-solid fa-power-off"></i> Terminate Uplink
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RsiVerificationRequiredView;