
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRadio } from '../../contexts/RadioContext';
import { useData } from '../../contexts/DataContext';
import { useConfig } from '../../contexts/ConfigContext';
import { useAuth } from '../../contexts/AuthContext';

import { useHIDPTT } from '../../contexts/HIDPTTContext';
import { RadioChannel, UserRole, ServiceRequestStatus } from '../../types';
import TXLevelMeter from './TXLevelMeter';
import { useNavigation } from '../../contexts/NavigationContext';

const RadioWidget: React.FC = () => {
    const {
        isConnected, isConnecting, currentChannel, setChannel,
        isTransmitting, volume, setVolume, isMuted, toggleMute,
        isEnabled, setIsEnabled, disconnect, activeSpeakers, handlePTT,
        participants, localAudioLevel
    } = useRadio();
    const { hydratedServiceRequests, rpcAction } = useData();
    const { radioChannels, radioConfig } = useConfig();
    const { currentUser } = useAuth();
    const { isRadioOpen, setIsRadioOpen } = useNavigation();
    const { isSupported: isDevicePTTSupported, pairedDeviceName, boundButtonLabel, isBinding, bindingPrompt, bindingError, bindGamepad, bindHID, cancelBinding, unpair, isPTTActive } = useHIDPTT();

    const [showHIDInfo, setShowHIDInfo] = useState(false);
    const [showHIDLimits, setShowHIDLimits] = useState(false);

    const isClient = currentUser?.role === UserRole.Client;

    // Squad Channel Logic
    const squadChannel = useMemo<RadioChannel | null>(() => {
        if (!currentUser?.unit || currentUser.unit.hasRadioChannel === false) return null;
        if (currentUser.unit.linkedChannelId) {
            const linked = radioChannels.find(ch => ch.id === currentUser.unit!.linkedChannelId);
            if (linked) return linked;
        }
        return {
            id: `unit-${currentUser.unit.id}`,
            name: `SQD-${currentUser.unit.name.substring(0, 3).toUpperCase()}`,
            color: '#a3e635',
            isPreset: false
        };
    }, [currentUser, radioChannels]);

    // Mission Channels (For Clients AND Responders)
    const missionChannels = useMemo<RadioChannel[]>(() => {
        if (!currentUser) return [];

        // Find active requests relevant to the user
        const activeReqs = hydratedServiceRequests.filter(r => {
            const isActive = [ServiceRequestStatus.Accepted, ServiceRequestStatus.InProgress].includes(r.status);
            const isRelated = r.clientId === currentUser.id || r.assignedMemberIds.includes(currentUser.id);
            return isActive && isRelated;
        });

        return activeReqs.map(req => ({
            id: `req-${req.id}`,
            name: `OPS-${req.id.split('-')[1]}`,
            color: '#ef4444', // Red for active op
            isPreset: false
        }));
    }, [currentUser, hydratedServiceRequests]);

    const channels = useMemo(() => {
        const list: RadioChannel[] = [];

        // Base channels: Only for non-clients (Staff)
        if (!isClient) {
            list.push(...(radioChannels || []));
            if (squadChannel) list.push(squadChannel);
        }

        // Add Mission Channels (always visible if assigned)
        missionChannels.forEach(mc => {
            // Avoid duplicates
            if (!list.some(c => c.id === mc.id)) {
                list.push(mc);
            }
        });

        return list.sort((a, b) => {
            const orderA = a.sortOrder || (a.id.startsWith('req-') ? -10 : 0);
            const orderB = b.sortOrder || (b.id.startsWith('req-') ? -10 : 0);
            return orderA - orderB;
        });
    }, [radioChannels, squadChannel, missionChannels, isClient]);

    // Disconnect if user is on a channel they shouldn't access.
    useEffect(() => {
        if (isEnabled && isConnected && currentChannel && currentUser) {
            const isAllowed = channels.some(c => c.id === currentChannel.id);
            if (!isAllowed) {
                console.warn(`[Radio] Access Violation: User ${currentUser.name} attempted to access restricted channel ${currentChannel.name}. Disconnecting.`);
                disconnect();
                // Clear backend state to prevent auto-reconnect
                rpcAction('user:set_radio_channel', { userId: currentUser.id, channelName: null });
            }
        }
    }, [isEnabled, isConnected, currentChannel, channels, currentUser, disconnect, rpcAction]);

    // Cleanup: Disconnect if user logs out
    useEffect(() => {
        if (!currentUser) {
            if (isEnabled) {
                setIsEnabled(false);
                disconnect();
            }
        }
    }, [currentUser, isEnabled, disconnect, setIsEnabled]);

    // Handle Power Toggle based on Open State
    const togglePower = (on: boolean) => {
        if (on) {
            setIsEnabled(true);

            // Auto-tune logic
            if (missionChannels.length > 0) {
                setChannel(missionChannels[0]);
                return;
            }

            // Only tune to default if no mission active, and default exists in visible list
            if (!currentChannel) {
                const defaultChannelId = radioConfig?.channelName || 'dispatch-global';
                const defaultChannel = channels.find(c => c.id === defaultChannelId) || channels[0];
                if (defaultChannel) {
                    setChannel(defaultChannel);
                }
            }
        } else {
            setIsEnabled(false);
            disconnect();
        }
    };

    const pttButtonRef = useRef<HTMLButtonElement>(null);

    const handleMouseDownPTT = (e: React.MouseEvent) => {
        e.preventDefault();
        handlePTT(true);
    };

    const handleMouseUpPTT = () => {
        handlePTT(false);
    };

    // Mobile Touch Handlers - use ref-based listeners with { passive: false } to allow preventDefault
    const handleTouchStartPTT = useCallback((e: TouchEvent) => {
        e.preventDefault(); // Prevents scroll during PTT
        handlePTT(true);
    }, [handlePTT]);

    const handleTouchEndPTT = useCallback(() => {
        handlePTT(false);
    }, [handlePTT]);

    useEffect(() => {
        const btn = pttButtonRef.current;
        if (!btn) return;
        btn.addEventListener('touchstart', handleTouchStartPTT, { passive: false });
        btn.addEventListener('touchend', handleTouchEndPTT);
        btn.addEventListener('touchcancel', handleTouchEndPTT);
        return () => {
            btn.removeEventListener('touchstart', handleTouchStartPTT);
            btn.removeEventListener('touchend', handleTouchEndPTT);
            btn.removeEventListener('touchcancel', handleTouchEndPTT);
        };
    }, [handleTouchStartPTT, handleTouchEndPTT]);

    if (!currentUser) return null;

    if (!isRadioOpen) return null;

    // If LiveKit is not configured, show an unconfigured state
    if (!radioConfig.configured) {
        return (
            <div className="fixed bottom-6 right-6 z-100 w-80 bg-slate-950 border border-slate-700/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden animate-fade-in-up">
                <div className="flex flex-col select-none">
                    <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-800">
                        <div className="flex items-center space-x-2">
                            <div className="w-2.5 h-2.5 rounded-full bg-slate-700 border border-slate-600"></div>
                            <span className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-600">Tactical Radio Unit</span>
                        </div>
                        <button onClick={() => setIsRadioOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                            <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                    <div className="p-6 flex flex-col items-center justify-center space-y-4">
                        <div className="w-12 h-12 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center">
                            <i className="fa-solid fa-walkie-talkie text-xl text-slate-600"></i>
                        </div>
                        <div className="text-center space-y-1.5">
                            <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Radio Offline</p>
                            <p className="text-[10px] text-slate-600 leading-relaxed max-w-[220px]">
                                LiveKit voice infrastructure has not been configured by the organization admin.
                            </p>
                        </div>
                        <div className="flex items-center gap-1.5 text-[9px] text-slate-700 uppercase font-bold tracking-wider">
                            <i className="fa-solid fa-lock text-[8px]"></i>
                            Admin setup required
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 z-100 w-80 bg-slate-950 border border-slate-700/50 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] backdrop-blur-xl overflow-hidden animate-fade-in-up ${isTransmitting ? 'ring-4 ring-red-600/60 shadow-[0_0_25px_rgba(220,38,38,0.4)]' : ''}`}>
            <div className="flex flex-col select-none">
                {/* Top Bar */}
                <div className="bg-slate-900 p-3 flex justify-between items-center border-b border-slate-800">
                    <div className="flex items-center space-x-2">
                        <div className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${isEnabled ? (isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.8)] animate-pulse') : 'bg-red-950 border border-red-500/20'}`}></div>
                        <span className="font-black text-[10px] uppercase tracking-[0.2em] text-slate-400">Tactical Radio Unit</span>
                    </div>
                    <div className="flex items-center space-x-3">
                        <button
                            onClick={() => togglePower(!isEnabled)}
                            className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-sm border transition-all ${isEnabled ? 'bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20' : 'bg-green-500/10 border-green-500/30 text-green-400 hover:bg-green-500/20'}`}
                        >
                            {isEnabled ? 'SYSTEM OFF' : 'SYSTEM ON'}
                        </button>
                        <button onClick={() => setIsRadioOpen(false)} className="text-slate-500 hover:text-white transition-colors">
                            <i className="fa-solid fa-xmark text-sm"></i>
                        </button>
                    </div>
                </div>

                <div className="p-4 space-y-4">
                    {/* LCD Display Panel */}
                    <div className={`relative rounded-lg p-4 border-2 transition-all duration-500 overflow-hidden min-h-[140px] flex flex-col justify-start ${isEnabled ? 'bg-sky-950/30 border-sky-500/30 shadow-[inset_0_0_30px_rgba(14,165,233,0.15)]' : 'bg-slate-900/50 border-slate-800 justify-center'}`}>
                        {isEnabled && (
                            <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.06),rgba(0,255,0,0.02),rgba(0,0,255,0.06))] bg-size-[100%_4px,3px_100%]"></div>
                        )}

                        {isEnabled ? (
                            currentChannel ? (
                                <div className="relative z-10 space-y-2 animate-fade-in flex flex-col h-full">
                                    <div className="flex justify-between items-start shrink-0">
                                        <div className="flex items-center space-x-2">
                                            <p className="text-[9px] text-sky-400/60 uppercase font-black tracking-widest">Active Comm</p>
                                            <div className="flex space-x-0.5">
                                                {[1, 2, 3, 4, 5].map(i => (
                                                    <div key={i} className={`w-0.5 h-1.5 rounded-full ${isConnected ? (i <= 4 ? 'bg-green-500' : 'bg-green-500/20') : 'bg-slate-700'}`}></div>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex space-x-1">
                                            {isConnecting && <span className="flex h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse"></span>}
                                            {isConnected && <span className="flex h-1.5 w-1.5 rounded-full bg-green-400 shadow-[0_0_5px_rgba(34,197,94,0.6)]"></span>}
                                        </div>
                                    </div>

                                    <div className="shrink-0">
                                        <p className="text-2xl font-mono font-black tracking-tighter truncate" style={{ color: currentChannel.color, textShadow: `0 0 15px ${currentChannel.color}66` }}>
                                            {currentChannel.name}
                                        </p>
                                    </div>

                                    <div className="flex-1 overflow-hidden relative mt-2 border-t border-sky-500/10 pt-2">
                                        <p className="text-[9px] text-sky-500/50 font-black uppercase tracking-widest mb-1">{participants.length} LINKED UNITS</p>
                                        <div className="flex flex-wrap content-start gap-1.5 h-full overflow-y-auto custom-scrollbar pr-1 pb-1">
                                            {participants.map(p => {
                                                const isSpeaking = activeSpeakers.includes(p) || (p === currentUser?.name && isTransmitting);
                                                return (
                                                    <span
                                                        key={p}
                                                        className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold transition-all border ${isSpeaking
                                                                ? 'bg-green-500 text-black border-green-400 shadow-[0_0_8px_rgba(34,197,94,0.6)] animate-pulse'
                                                                : 'text-slate-500 bg-slate-900/50 border-slate-800'
                                                            }`}
                                                    >
                                                        {isSpeaking ? <i className="fa-solid fa-microphone mr-1 text-[8px]"></i> : ''}
                                                        {p}
                                                    </span>
                                                )
                                            })}
                                            {participants.length === 0 && <span className="text-[9px] text-slate-600 italic">...</span>}
                                        </div>
                                    </div>

                                    <div className="relative z-10 border-t border-sky-500/10 pt-2 mt-1">
                                        <TXLevelMeter
                                            level={localAudioLevel}
                                            active={isTransmitting}
                                            label="TX"
                                            segments={12}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center justify-center py-4 space-y-2">
                                    <div className="flex space-x-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.3s]"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce [animation-delay:-0.15s]"></div>
                                        <div className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-bounce"></div>
                                    </div>
                                    <p className="text-sky-400 text-[10px] uppercase font-black tracking-[0.3em]">{channels.length > 0 ? 'Scanning...' : 'No Signal'}</p>
                                    {channels.length === 0 && <p className="text-[9px] text-slate-500 uppercase">No Available Channels</p>}
                                </div>
                            )
                        ) : (
                            <div className="flex flex-col items-center justify-center py-4 space-y-3">
                                <div className="flex space-x-1">
                                    {[1, 2, 3].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-slate-800"></div>)}
                                </div>
                                <p className="text-slate-700 text-[10px] uppercase font-black tracking-[0.3em]">Hardware Standby</p>
                                <button
                                    onClick={() => togglePower(true)}
                                    className="text-[9px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-400 px-4 py-1.5 rounded-sm border border-slate-700 active:scale-95 transition-all uppercase tracking-widest"
                                >
                                    Init Link
                                </button>
                            </div>
                        )}

                        {isConnecting && isEnabled && (
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] flex flex-col items-center justify-center z-20">
                                <div className="w-full h-[2px] bg-sky-500/40 animate-[scan_1s_linear_infinite]"></div>
                                <p className="text-[10px] font-black text-sky-400 uppercase tracking-widest animate-pulse mt-2">Syncing Link...</p>
                            </div>
                        )}
                    </div>

                    {/* Channel Selector */}
                    {isEnabled && (
                        <div className={`grid grid-cols-2 gap-2 transition-all duration-500 ${isEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none grayscale'}`}>
                            {channels.map((ch) => {
                                const isCurrent = currentChannel?.id === ch.id;
                                return (
                                    <button
                                        key={ch.id}
                                        onClick={() => setChannel(ch)}
                                        className={`relative group overflow-hidden text-[10px] font-black uppercase py-2.5 px-1 rounded-md border transition-all 
                                            ${isCurrent ? 'bg-slate-800 border-sky-500 text-white shadow-[0_0_10px_rgba(14,165,233,0.1)]' : 'bg-slate-900 border-slate-800 text-slate-600 hover:border-slate-600 hover:text-slate-300'}
                                            ${ch.id.startsWith('req-') ? 'col-span-2 border-l-4 border-l-red-500' : ''}
                                        `}
                                    >
                                        <span className="relative z-10">{ch.name}</span>
                                        {isCurrent && (
                                            <span className="absolute bottom-0 left-0 h-0.5 bg-sky-500 w-full animate-pulse shadow-[0_0_5px_rgba(14,165,233,0.8)]"></span>
                                        )}
                                        <div className="absolute top-0 left-0 w-full h-full bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                    </button>
                                );
                            })}
                        </div>
                    )}

                    {isEnabled && channels.length === 0 && (
                        <div className="text-center py-4 bg-slate-900/30 rounded-sm border border-slate-800 border-dashed">
                            <p className="text-[10px] text-slate-500">No available frequencies for your role.</p>
                        </div>
                    )}

                    <div className={`flex items-center space-x-3 pt-2 transition-all duration-500 ${isEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none grayscale'}`}>
                        <button
                            onClick={toggleMute}
                            className={`w-12 h-10 rounded-lg flex items-center justify-center transition-all border ${isMuted ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-slate-900 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-white'}`}
                            title={isMuted ? "Unmute Mic" : "Mute Mic"}
                        >
                            <i className={`fa-solid ${isMuted ? 'fa-microphone-slash' : 'fa-microphone'}`}></i>
                        </button>
                        <div className="flex-1 px-3 flex items-center space-x-3 bg-slate-900/50 rounded-lg h-10 border border-slate-800">
                            <i className="fa-solid fa-volume-high text-[10px] text-slate-500"></i>
                            <input
                                type="range"
                                min="0" max="100"
                                value={volume}
                                onChange={(e) => setVolume(parseInt(e.target.value))}
                                className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                        </div>
                    </div>

                    {/* Device PTT Configuration */}
                    {isEnabled && isDevicePTTSupported && (
                        <div className="border border-amber-500/20 rounded-lg p-2.5 bg-amber-950/10 space-y-2">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5">
                                    <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">
                                        <i className="fa-solid fa-gamepad mr-1.5 text-[8px]"></i>
                                        Device PTT
                                    </span>
                                    <span className="text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/20">
                                        Experimental
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    {pairedDeviceName && !isBinding && (
                                        <button onClick={unpair} className="text-[8px] text-red-400/60 hover:text-red-400 uppercase tracking-wider transition-colors">
                                            Remove
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* How It Works — collapsible */}
                            <button
                                onClick={() => setShowHIDInfo(prev => !prev)}
                                className="w-full flex items-center justify-between text-[9px] text-slate-500 hover:text-slate-400 transition-colors"
                            >
                                <span className="font-semibold uppercase tracking-wider"><i className="fa-solid fa-circle-info mr-1 text-[8px]"></i>How It Works</span>
                                <i className={`fa-solid fa-chevron-${showHIDInfo ? 'up' : 'down'} text-[7px]`}></i>
                            </button>
                            {showHIDInfo && (
                                <div className="text-[9px] text-slate-500 bg-slate-900/60 rounded-sm p-2 space-y-1.5 border border-slate-800/50 leading-relaxed">
                                    <p className="text-slate-400">Bind a button on a controller or USB device as your PTT key instead of using the on-screen button or Right Ctrl.</p>
                                    <p className="text-slate-500"><strong className="text-sky-400/70">Controller</strong> — Xbox, PlayStation, HOTAS, joystick. Works on all browsers. Best for dual-monitor setups where the dashboard stays visible.</p>
                                    <p className="text-slate-500"><strong className="text-sky-400/70">HID Device</strong> — USB foot pedals, macro pads, dedicated PTT hardware. Chrome/Edge only. Can work while another app is focused.</p>
                                </div>
                            )}

                            {/* Limitations — collapsible */}
                            <button
                                onClick={() => setShowHIDLimits(prev => !prev)}
                                className="w-full flex items-center justify-between text-[9px] text-slate-500 hover:text-slate-400 transition-colors"
                            >
                                <span className="font-semibold uppercase tracking-wider"><i className="fa-solid fa-triangle-exclamation mr-1 text-[8px] text-amber-500/60"></i>Limitations</span>
                                <i className={`fa-solid fa-chevron-${showHIDLimits ? 'up' : 'down'} text-[7px]`}></i>
                            </button>
                            {showHIDLimits && (
                                <div className="text-[9px] text-slate-500 bg-slate-900/60 rounded-sm p-2 space-y-1.5 border border-slate-800/50 leading-relaxed">
                                    <p className="text-slate-400 font-semibold">Controller (Gamepad API)</p>
                                    <div className="flex flex-col gap-0.5 pl-1">
                                        <span className="text-green-400/70"><i className="fa-solid fa-check text-[7px] mr-1"></i>Xbox, PlayStation, HOTAS, joysticks</span>
                                        <span className="text-green-400/70"><i className="fa-solid fa-check text-[7px] mr-1"></i>Works in all major browsers</span>
                                        <span className="text-red-400/70"><i className="fa-solid fa-xmark text-[7px] mr-1"></i>Only works while the dashboard tab is visible</span>
                                        <span className="text-red-400/70"><i className="fa-solid fa-xmark text-[7px] mr-1"></i>Won't work while another app (e.g. Star Citizen) is focused on a single monitor</span>
                                    </div>
                                    <p className="text-slate-400 font-semibold pt-1">HID Device (WebHID API)</p>
                                    <div className="flex flex-col gap-0.5 pl-1">
                                        <span className="text-green-400/70"><i className="fa-solid fa-check text-[7px] mr-1"></i>Works while another app is focused</span>
                                        <span className="text-green-400/70"><i className="fa-solid fa-check text-[7px] mr-1"></i>Elgato Stream Deck, Elgato Pedal, custom HID hardware</span>
                                        <span className="text-red-400/70"><i className="fa-solid fa-xmark text-[7px] mr-1"></i>Chrome &amp; Edge only</span>
                                        <span className="text-red-400/70"><i className="fa-solid fa-xmark text-[7px] mr-1"></i>Keyboards, mice, and game controllers are blocked by the browser</span>
                                        <span className="text-red-400/70"><i className="fa-solid fa-xmark text-[7px] mr-1"></i>Most USB foot pedals report as keyboards and are also blocked</span>
                                    </div>
                                    <p className="text-slate-400 font-semibold pt-1">Recommended Setup</p>
                                    <p className="text-slate-500 pl-1">Use a <strong className="text-slate-400">second monitor</strong> with the dashboard visible and bind a controller button. Or use an Elgato Stream Deck / Pedal via HID for true background PTT.</p>
                                </div>
                            )}

                            {bindingError && (
                                <div className="text-[9px] text-red-400 bg-red-500/10 rounded-sm p-2 border border-red-500/20 leading-relaxed">
                                    <i className="fa-solid fa-triangle-exclamation mr-1"></i>
                                    {bindingError}
                                </div>
                            )}

                            {isBinding ? (
                                <div className="space-y-2 py-1">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse"></span>
                                        <span className="text-[10px] text-amber-400">{bindingPrompt}</span>
                                    </div>
                                    <button
                                        onClick={cancelBinding}
                                        className="w-full py-1 text-[9px] text-slate-500 hover:text-slate-300 bg-slate-800/50 rounded-sm border border-slate-700/50 transition-all uppercase tracking-wider"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : pairedDeviceName ? (
                                <div className="space-y-1.5">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full transition-all ${isPTTActive ? 'bg-green-400 shadow-[0_0_6px_rgba(34,197,94,0.9)] scale-125' : 'bg-green-500/40'}`}></span>
                                            <span className="text-[10px] text-slate-400 truncate max-w-[160px]">{pairedDeviceName}</span>
                                        </div>
                                        <span className={`text-[8px] font-bold uppercase tracking-wider transition-all ${isPTTActive ? 'text-green-400' : 'text-slate-700'}`}>
                                            {isPTTActive ? 'ACTIVE' : 'IDLE'}
                                        </span>
                                    </div>
                                    {boundButtonLabel && (
                                        <span className="text-[9px] text-slate-600 font-mono">{boundButtonLabel}</span>
                                    )}
                                    <div className="flex gap-1.5 pt-0.5">
                                        <button
                                            onClick={bindGamepad}
                                            className="flex-1 py-1 text-[8px] text-sky-400/60 hover:text-sky-400 uppercase tracking-wider bg-slate-800/30 rounded-sm border border-slate-700/30 hover:border-sky-500/30 transition-all"
                                        >
                                            Rebind Controller
                                        </button>
                                        <button
                                            onClick={bindHID}
                                            className="flex-1 py-1 text-[8px] text-sky-400/60 hover:text-sky-400 uppercase tracking-wider bg-slate-800/30 rounded-sm border border-slate-700/30 hover:border-sky-500/30 transition-all"
                                        >
                                            Rebind HID
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="flex gap-1.5">
                                    <button
                                        onClick={bindGamepad}
                                        className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-sky-400 bg-slate-800/50 hover:bg-slate-800 rounded-sm border border-slate-700/50 hover:border-sky-500/30 transition-all"
                                    >
                                        <i className="fa-solid fa-gamepad mr-1.5"></i>
                                        Controller
                                    </button>
                                    <button
                                        onClick={bindHID}
                                        className="flex-1 py-2 text-[10px] font-bold uppercase tracking-wider text-slate-500 hover:text-sky-400 bg-slate-800/50 hover:bg-slate-800 rounded-sm border border-slate-700/50 hover:border-sky-500/30 transition-all"
                                    >
                                        <i className="fa-solid fa-usb mr-1.5"></i>
                                        HID Device
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className={`pt-2 transition-all duration-500 ${isEnabled ? 'opacity-100' : 'opacity-20 pointer-events-none grayscale'}`}>
                        <button
                            ref={pttButtonRef}
                            disabled={!isEnabled || !isConnected || isMuted}
                            onMouseDown={handleMouseDownPTT}
                            onMouseUp={handleMouseUpPTT}
                            onMouseLeave={handleMouseUpPTT}
                            className={`w-full py-5 rounded-xl font-black uppercase tracking-[0.25em] text-sm transition-all shadow-xl active:translate-y-1 active:border-b-0 disabled:cursor-not-allowed border-b-4 ${isTransmitting ? 'bg-red-600 border-red-800 text-white shadow-[0_0_20px_rgba(220,38,38,0.5)] scale-[0.97]' : 'bg-slate-800 border-slate-900 text-slate-400 hover:bg-slate-700 hover:text-white hover:shadow-sky-500/10'}`}
                        >
                            {isTransmitting ? (
                                <span className="flex items-center justify-center">
                                    <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping mr-4"></span>
                                    LIVE TX
                                </span>
                            ) : (
                                'PUSH TO TALK'
                            )}
                        </button>
                        <p className="text-[9px] text-center text-slate-600 uppercase font-black mt-2 tracking-widest">Hold to Transmit</p>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scan {
                    from { transform: translateY(-100%); }
                    to { transform: translateY(400%); }
                }
                .animate-fade-in-up {
                    animation: fadeInUp 0.3s ease-out forwards;
                }
                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `}</style>
        </div>
    );
};

export default RadioWidget;
