
import React, { useState } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { useData } from '../../../contexts/DataContext';
import { useGovernment } from '../../../contexts/GovernmentContext';
import CallsignChip from '../../shared/ui/CallsignChip';
import { useNavigation } from '../../../contexts/NavigationContext';

const HelpCard: React.FC<{
    title: string;
    icon: string;
    iconBgClass: string;
    iconColorClass: string;
    children: React.ReactNode
}> = ({ title, icon, iconBgClass, iconColorClass, children }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className={`bg-slate-900/80 backdrop-blur-md border rounded-xl overflow-hidden transition-all duration-300 ${isOpen ? 'border-sky-500/30 shadow-lg shadow-sky-900/20' : 'border-slate-700/50 hover:border-slate-600'}`}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center p-5 text-left"
            >
                <div className={`w-12 h-12 rounded-lg ${iconBgClass} flex items-center justify-center shrink-0 mr-4 border border-white/5`}>
                    <i className={`${icon} text-xl ${iconColorClass}`}></i>
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold text-white">{title}</h3>
                    <p className="text-[10px] font-mono text-slate-500 mt-1 uppercase tracking-widest">
                        {isOpen ? 'Tap to collapse' : 'Tap to expand'}
                    </p>
                </div>
                <i className={`fa-solid fa-chevron-down text-slate-500 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isOpen ? 'max-h-[4000px] opacity-100' : 'max-h-0 opacity-0'}`}>
                <div className="px-6 pb-6 pt-0 text-slate-300 space-y-6 border-t border-white/5">
                    {children}
                </div>
            </div>
        </div>
    );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <div className="space-y-2 pt-4">
        <h4 className="text-[10px] font-black text-sky-300 uppercase tracking-widest border-b border-white/5 pb-2 mb-3">{title}</h4>
        <div className="text-sm leading-relaxed space-y-3 text-slate-300">
            {children}
        </div>
    </div>
);

const HelpView: React.FC = () => {
    const { setActiveView } = useNavigation();
    const { hasPermission } = useAuth();
    const { orgMeta } = useData();
    const { governmentsFeatureConfig } = useGovernment();

    const governmentEnabled = !!governmentsFeatureConfig?.enabled;
    const financesEnabled = orgMeta?.features?.finances?.enabled === true;
    const quartermasterEnabled = orgMeta?.features?.quartermaster?.enabled === true;
    const warehouseEnabled = orgMeta?.features?.warehouse?.enabled === true;

    return (
        <div className="h-full flex flex-col overflow-hidden animate-fade-in">
            <div className="shrink-0 relative overflow-hidden border-b border-white/5 bg-linear-to-b from-sky-950/30 via-slate-950/80 to-slate-950">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-sky-500/10 rounded-full blur-[120px] pointer-events-none" aria-hidden />

                <div className="relative px-4 sm:px-8 pt-10 pb-8">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
                        <div className="min-w-0">
                            <CallsignChip label="MODULE · FIELD MANUAL" icon="fa-book-open" accent="sky" pulse />
                            <h1 className="mt-3 text-3xl sm:text-4xl font-black text-white tracking-tight leading-tight">
                                Operational Field Manual
                            </h1>
                            <p className="mt-2 text-sm text-slate-400 max-w-2xl">
                                Quick reference for the most common workflows. Full documentation is published at <a href="https://docs.myrsi.org" target="_blank" rel="noreferrer" className="text-sky-400 hover:text-sky-300 underline">docs.myrsi.org</a>.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 shrink-0">
                            <button
                                onClick={() => setActiveView('changelog')}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 bg-slate-900/60 border border-slate-700 rounded-lg hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300 transition-colors"
                            >
                                <i className="fa-solid fa-scroll"></i> Changelog
                            </button>
                            <button
                                onClick={() => setActiveView('tos')}
                                className="flex items-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-widest text-slate-300 bg-slate-900/60 border border-slate-700 rounded-lg hover:border-sky-500/40 hover:bg-sky-500/10 hover:text-sky-300 transition-colors"
                            >
                                <i className="fa-solid fa-file-contract"></i> Terms of Service
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto w-full">
            <div className="grid grid-cols-1 gap-4">

                <HelpCard title="App Installation & Alerts" icon="fa-solid fa-mobile-screen" iconBgClass="bg-emerald-500/10" iconColorClass="text-emerald-400">
                    <Section title="Why Install?">
                        <p>
                            To receive <strong>EAM Broadcasts</strong>, <strong>service request alerts</strong>, and <strong>operation updates</strong> while the app is closed, install the terminal as a PWA on your device. Browser tabs alone don't deliver background push.
                        </p>
                    </Section>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        <div className="bg-slate-950/50 p-4 rounded-xl border border-slate-800">
                            <h5 className="text-white font-bold mb-3 flex items-center"><i className="fa-brands fa-apple text-xl mr-2"></i> iOS (iPhone/iPad)</h5>
                            <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-400">
                                <li>Open the site in <strong>Safari</strong> (Chrome on iOS does not support background push).</li>
                                <li>Tap the <strong>Share</strong> button <i className="fa-solid fa-arrow-up-from-bracket"></i>.</li>
                                <li>Scroll and tap <strong>Add to Home Screen</strong>.</li>
                                <li>Confirm and tap <strong>Add</strong>.</li>
                                <li>Always launch from the Home Screen icon — not from a Safari tab — for push to work.</li>
                            </ol>
                        </div>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-800">
                            <h5 className="text-white font-bold mb-3 flex items-center"><i className="fa-brands fa-android text-xl mr-2"></i> Android / Desktop</h5>
                            <ol className="list-decimal pl-5 space-y-2 text-xs text-slate-400">
                                <li>Open the site in <strong>Chrome</strong>, Edge, or Brave.</li>
                                <li>Tap the <strong>three-dot menu</strong> (mobile) or the <strong>install icon</strong> in the address bar (desktop).</li>
                                <li>Choose <strong>Install App</strong> or <strong>Add to Home screen</strong>.</li>
                                <li>Launch from the App Drawer / Start Menu.</li>
                            </ol>
                        </div>
                    </div>

                    <Section title="Activating Your Communications Uplink">
                        <p>On first login you'll see a <strong>Secure Comms Available</strong> banner — tap <strong>Enable Uplink</strong> and Allow when the browser prompts. Or activate any time:</p>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li>Open <strong>My Account</strong> from the sidebar.</li>
                            <li>Find the <strong>Communications Uplink</strong> card.</li>
                            <li>Click <strong>Register Device</strong>, accept the browser permission prompt.</li>
                            <li>Click <strong>Test Signal</strong> — a test push should arrive within seconds.</li>
                        </ol>
                        <p className="text-xs text-slate-500 italic mt-2">
                            If pushes stop after an OS update, unregister and re-register — phone updates can invalidate the push subscription.
                        </p>
                    </Section>
                </HelpCard>

                <HelpCard title="Service Requests (Client)" icon="fa-solid fa-headset" iconBgClass="bg-teal-500/10" iconColorClass="text-teal-400">
                    <Section title="Submitting a Request">
                        <p>Click <strong>New Request</strong> from the sidebar or dashboard. Fill in:</p>
                        <ol className="list-decimal pl-5 space-y-1">
                            <li><strong>Service Type</strong> — Security Escort, Medical, Logistics, etc.</li>
                            <li><strong>Location</strong> — search platform locations or type a custom system / planet.</li>
                            <li><strong>Threat Level</strong> — helps dispatch decide priority.</li>
                            <li><strong>Party Members</strong> by RSI handle — auto-cross-referenced against active caution notes.</li>
                            <li><strong>Description</strong> — detailed picture of your situation; the dispatcher reads this first.</li>
                            <li>Accept the Terms of Service and click <strong>Submit</strong>.</li>
                        </ol>
                    </Section>
                    <Section title="Tracking Your Request">
                        <p>
                            Lifecycle: <strong>Submitted</strong> → <strong>Triaged</strong> → <strong>Accepted</strong> → <strong>In-Progress</strong> → <strong>Success / Failed / Cancelled / Refused / Aborted</strong>.
                        </p>
                        <p>
                            You can only have <strong>one active request at a time</strong> while it's in Submitted, Triaged, Accepted, or In-Progress. Wait for the current request to reach a terminal state before starting another.
                        </p>
                        <p>
                            You'll get a sound + toast (and a push notification, if Uplink is active) at every status change and when responders are added.
                        </p>
                    </Section>
                    <Section title="Rating & Feedback">
                        <p>
                            When a request reaches <strong>Success</strong>, you're prompted to rate the team 1–5 stars and leave optional feedback. Ratings on Failed / Cancelled / Aborted requests aren't collected. Your rating is immutable by staff but you can update your own within the org's rating window.
                        </p>
                    </Section>
                </HelpCard>

                <HelpCard title="Staff Dashboard" icon="fa-solid fa-gauge-high" iconBgClass="bg-violet-500/10" iconColorClass="text-violet-400">
                    <Section title="Overview">
                        <p>
                            Real-time view of org operations: active requests, the duty roster, current operations, EAM state, and bulletins. Tiles update automatically over the realtime connection — no refresh required.
                        </p>
                    </Section>
                    <Section title="Quick Actions">
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Go On Duty:</strong> Toggle in the sidebar to be eligible for dispatch.</li>
                            <li><strong>New Request / Log Ad-Hoc:</strong> Create requests on behalf of clients (registered or not).</li>
                            <li><strong>Active Request tile:</strong> Click any tile to open the request detail and act on it.</li>
                            <li><strong>Op tile:</strong> Click an active operation to jump straight into Live Command / My Status.</li>
                        </ul>
                    </Section>
                    <Section title="Bulletin Board">
                        <p>
                            Admins and dispatchers post <strong>announcements</strong> visible at the top of the dashboard — shift briefings, policy updates, recall notices. Use sparingly so members keep reading them.
                        </p>
                    </Section>
                    <Section title="Action Required">
                        <p>
                            The <strong>Action Required</strong> panel surfaces things waiting on you personally: requests assigned to you that need a status advance, operations you've RSVP'd to that are now Active, and so on. Treat this as your daily to-do queue.
                        </p>
                    </Section>
                </HelpCard>

                <HelpCard title="Field Operations & Dispatch" icon="fa-solid fa-person-military-rifle" iconBgClass="bg-sky-500/10" iconColorClass="text-sky-400">
                    <Section title="Duty Status">
                        <p>
                            Toggle <strong>ON DUTY</strong> in the sidebar to enter the dispatch picker. The system auto-toggles you to <strong>Off Duty</strong> after <strong>30 minutes</strong> of inactivity (no clicks, keys, or API). Toggle back on when you return — there's no penalty.
                        </p>
                    </Section>
                    <Section title="Triage Console">
                        <p>
                            New requests land in <strong>Submitted</strong>. A dispatcher opens the <strong>Triage Console</strong> to review urgency, optionally override the threat level, optionally pre-assign a lead responder (which jumps it past Triaged straight to Accepted), or <strong>Refuse</strong> with a written reason.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Refusal requires notes.</strong> The client sees the reason.</li>
                            <li><strong>Party manifest cross-reference:</strong> Every party member handle is auto-checked against active caution notes — alerts surface on the request card.</li>
                            <li><strong>Log Ad-Hoc:</strong> For unregistered clients (random pickups). Bypasses the one-active-request limit since no client account is involved.</li>
                        </ul>
                    </Section>
                    <Section title="Managing Responders">
                        <p>
                            On the request, click <strong>Manage Team</strong> to add or remove responders and designate the mission lead. Adding the first responder automatically creates the red <strong>mission radio channel</strong>. Status pills are clickable buttons — click to advance the lifecycle, or use "More options…" for complex transitions like Aborted or GameError.
                        </p>
                    </Section>
                    <Section title="Mission Debrief">
                        <p>
                            Closing a request opens the <strong>Debrief modal</strong>. Captures the outcome (Success / Failed / Aborted / GameError), UEC earned, Medigel (L) consumed, the After-Action Report, and a <strong>client conduct assessment</strong> (Positive / Neutral / Negative) which immediately adjusts client reputation. A "File Intelligence Report" checkbox surfaces if the outcome is negative or the conduct was poor.
                        </p>
                    </Section>
                </HelpCard>

                <HelpCard title="Operations Center" icon="fa-solid fa-chess-board" iconBgClass="bg-purple-500/10" iconColorClass="text-purple-400">
                    <Section title="When to Use">
                        <p>
                            Use Operations Center for planned, multi-person events — patrols, mining ops, joint exercises, training, org battles. Distinct from reactive service requests, which are for ad-hoc client tickets.
                        </p>
                    </Section>
                    <Section title="Lifecycle">
                        <p>Four states, advanced manually by the owner or anyone with <code className="text-xs bg-slate-800 px-1 py-0.5 rounded-sm">operations:manage</code>:</p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Planning:</strong> Drafting roster, ORBAT, logistics. Hidden by default.</li>
                            <li><strong>Scheduled:</strong> Locked-in start time. RSVPs open.</li>
                            <li><strong>Active:</strong> Live tabs unlock — My Status, Overview, Live Command. Mission clock runs.</li>
                            <li><strong>Concluded:</strong> AAR tab unlocks for retrospective entries.</li>
                        </ul>
                    </Section>
                    <Section title="ORBAT (Order of Battle)">
                        <p>
                            Two views: <strong>Roster</strong> (flat list of participants with RSVP, ready flag, role, ship, live status) and <strong>Structure</strong> (drag-and-drop node graph with Command / Unit / Position nodes, optional assignees, colour grouping). Structure nodes are organisational scaffolding — they don't auto-sync to the roster.
                        </p>
                    </Section>
                    <Section title="Logistics, Ledger & Payouts">
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Logistics tab:</strong> Coordination tracker for items needed (Ammo / Medical / Transport / Fuel / General). Any participant can mark fulfilment; nothing auto-deducts from warehouse.</li>
                            <li><strong>Ledger:</strong> Optional UEC tracking. Deposits and costs are restricted to <code className="text-xs bg-slate-800 px-1 py-0.5 rounded-sm">operations:manage_finance</code> holders so members can't self-credit.</li>
                            <li><strong>Three payout modes:</strong> Equal (split evenly), Weighted (by time-in-op), or Custom (admin-set per-person %). Pie chart previews the split before payout.</li>
                        </ul>
                    </Section>
                    <Section title="Phases, Tasks & Templates">
                        <p>
                            Build a phase tree (Sequential or Contingent) with optional milestones offset in minutes from start, plus per-phase task checklists. Save any operation's phase tree as a <strong>template</strong> from the Administer tab → re-use it on the next op.
                        </p>
                    </Section>
                    <Section title="Discord Integration">
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Create Discord Event:</strong> Posts a Guild Scheduled Event server-wide (visible to everyone).</li>
                            <li><strong>Post Announcement Embed:</strong> Posts a rich embed with ✅ ❌ ❓ reactions to a specific channel — useful for role-restricted comms. Edit the operation and the embed updates in place; reactions are preserved.</li>
                        </ul>
                    </Section>
                    <Section title="Classified (Special) Operations">
                        <p>
                            Toggle <strong>Special Operation</strong> at create time to require a 4-digit PIN to view or join. The op stays hidden from the regular dashboard for non-participants. Combine with clearance level + limiting markers for tiered access.
                        </p>
                    </Section>
                    <Section title="After-Action Reports (AAR)">
                        <p>
                            Unlocks when the op concludes. Four entry categories: <strong>Observations</strong> (factual), <strong>Sustain</strong> (what went well), <strong>Improve</strong> (what to fix), <strong>Action Items</strong>. Members can upvote entries. Generate an AI-drafted summary from the upvoted entries (24-hour cooldown). Owner submits the final AAR; can re-open if late edits are needed.
                        </p>
                    </Section>
                </HelpCard>

                <HelpCard title="Tactical Radio" icon="fa-solid fa-tower-broadcast" iconBgClass="bg-red-500/10" iconColorClass="text-red-400">
                    <Section title="Push-to-Talk">
                        <p>
                            Open the radio widget from the sidebar. The first time you transmit, the browser will ask for microphone permission. Hold <strong>Push to Talk</strong> to transmit; release to stop. The horizontal meter under PTT is your <strong>TX level</strong> — green-to-yellow is healthy, red is clipping.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Desktop:</strong> Click and hold the PTT button or use a bound HID / gamepad button.</li>
                            <li><strong>Mobile:</strong> Press and hold. Non-passive touch listeners stop accidental scrolling while transmitting.</li>
                            <li><strong>HID / Gamepad PTT:</strong> Expand the section, click <strong>Bind Gamepad</strong> or <strong>Bind HID</strong>, press your button. Works while the app is in the background on Chrome / Edge; Firefox and Safari support is limited.</li>
                        </ul>
                    </Section>
                    <Section title="Channel Types">
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Preset channels:</strong> Admin-configured, staff-only (e.g. Dispatch, Patrol).</li>
                            <li><strong>Squad channels:</strong> Auto-derived from your unit assignment. A unit can opt out of a squad channel.</li>
                            <li><strong>Mission channels:</strong> Auto-created (in red) when a service request is Accepted or you join an op. Auto-close on terminal state.</li>
                        </ul>
                    </Section>
                    <Section title="Volume, Mute & Devices">
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Master volume</strong> (header slider): all system sounds — alerts, EAM, radio cues. Persists across sessions.</li>
                            <li><strong>Radio volume</strong> (inside widget): voice traffic only. Independent of master.</li>
                            <li><strong>Master mute</strong> (header icon): silences platform sounds.</li>
                            <li><strong>Radio mute</strong> (widget button): silences your microphone — you still hear others.</li>
                            <li><strong>Devices:</strong> Uses your OS default mic / output. There's no in-app device picker — set defaults at the OS level.</li>
                            <li><strong>Active Speakers</strong> section shows who's currently transmitting.</li>
                        </ul>
                        <p className="text-xs text-slate-500 italic mt-2">
                            Background tabs may degrade audio quality. For mission-critical comms, keep the tab in the foreground or use the installed PWA.
                        </p>
                    </Section>
                </HelpCard>

                <HelpCard title="Intelligence & Security" icon="fa-solid fa-eye" iconBgClass="bg-amber-500/10" iconColorClass="text-amber-400">
                    <Section title="Reports & The Dossier">
                        <p>
                            File an <strong>Intel Report</strong> on a person (RSI handle) or org. Each report carries a Threat Level, Classification (0–5), Limiting Markers, Tags, Evidence URLs, and an Author.
                        </p>
                        <p>
                            The <strong>Dossier</strong> aggregates all intel on a target across five sources: filed Reports (filtered by your clearance), Active + Standing Caution Notes, Service Request history, Operations participation, and Affiliates. Authors can always read their own reports regardless of clearance.
                        </p>
                    </Section>
                    <Section title="Bulletins">
                        <p>
                            Time-sensitive notices on the Live Bulletin Board. Each bulletin has a threat level (colour-coded), location, duration (15 min → 7 days, or indefinite), classification, and markers.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong className="text-red-400">Critical:</strong> Immediate danger — triggers staff notifications.</li>
                            <li><strong className="text-orange-400">High:</strong> Significant threat — heightened alert.</li>
                            <li><strong className="text-amber-400">Medium:</strong> Notable activity — monitor closely.</li>
                            <li><strong className="text-sky-400">Low:</strong> General awareness.</li>
                        </ul>
                        <p className="text-xs text-slate-500 italic">
                            Bulletins toggled "Shared with Allies" sync to the external feed unless they carry a sync-restricted marker (e.g. NOFORN).
                        </p>
                    </Section>
                    <Section title="Caution Notes">
                        <p>
                            Defensive advisories flagging handles your org should approach carefully. Caution levels: <strong>Caution</strong>, <strong>High Caution</strong>, <strong>Extreme Caution</strong>. Two states: <strong>Active</strong> (live now) and <strong>Standing</strong> (conditional — takes effect if the target is encountered). A caution note surfaces on the target's dossier, on the Caution Notes board, and as an <strong>Active Caution</strong> warning on any service request whose party manifest matches.
                        </p>
                        <p>
                            Members acknowledge a caution note by clicking <strong>Claim</strong> on the detail view. The platform records the acknowledgement but does not verify any field action — admins should audit. Issuers and admins can <strong>Cancel</strong> a caution note at any time.
                        </p>
                    </Section>
                    <Section title="Clearance Levels & Markers">
                        <p>
                            Two independent gates: a numeric <strong>Clearance Level (0–5)</strong> and named <strong>Limiting Markers</strong> (e.g. NOFORN, EYES_ONLY). You must pass both to read protected content.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Level 0:</strong> Public / Affiliate.</li>
                            <li><strong>Level 1–3:</strong> Standard Member tiers.</li>
                            <li><strong>Level 4–5:</strong> Command / Top Secret.</li>
                        </ul>
                        <p>
                            Markers are tags that compound the clearance gate. <strong>Sync-restricted</strong> markers exclude that content from the external feed even if the bulletin is "Shared with Allies".
                        </p>
                        <p className="text-xs text-slate-500 italic">
                            To request a clearance bump, open <strong>My Account</strong> → <strong>Request Clearance</strong>. The request is routed to HR for review.
                        </p>
                    </Section>
                    <Section title="AI Tactical Analysis">
                        <p>
                            If Gemini is configured, open any dossier → Overview → <strong>Generate</strong>. Produces a threat assessment, key facts, observed patterns, and suggested precautions. Caches for 24 hours per dossier to keep API costs sane. Treat as a briefing draft — AI can hallucinate.
                        </p>
                    </Section>
                </HelpCard>

                <HelpCard title="Personnel & HR" icon="fa-solid fa-id-card" iconBgClass="bg-indigo-500/10" iconColorClass="text-indigo-400">
                    <Section title="Duty Roster">
                        <p>
                            Two views: <strong>Hierarchy</strong> (tree by unit) and <strong>Flat</strong> (sortable table). Filter by Unit, Rank, and Duty status; search matches name, RSI handle, and rank. Hero stats show On Duty / Off Duty / Total at a glance.
                        </p>
                    </Section>
                    <Section title="Job Gazette">
                        <p>
                            Members browse open postings via <strong>HR Hub → Gazette</strong>, click <strong>Apply Now</strong>, write a Statement of Interest. That opens an ATS case under Recruitment. Track your applications under <strong>My Applications</strong>; HR moves them through Applied → Screening → Interviewing → Offered → Hired / Rejected / OnHold / Withdrawn.
                        </p>
                    </Section>
                    <Section title="Unit Transfers">
                        <p>
                            <strong>HR Hub → My Transfers → Request Transfer</strong>. Pick a target unit, write a reason. HR reviews and Approves (your unit changes immediately, including squad channel) or Denies (with a reason). The change is realtime — sidebar, roster, and squad channel update without reload.
                        </p>
                    </Section>
                    <Section title="Certifications vs Commendations">
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Certifications</strong> are skill / training credentials (e.g. "Advanced Piloting"). Implies <em>can-do</em>; used for role / op gating.</li>
                            <li><strong>Commendations</strong> are recognition / honours (e.g. "Medal of Valor"). Implies <em>did-do</em>; for public recognition.</li>
                        </ul>
                        <p>
                            View your own under <strong>HR Hub → My Certifications</strong> / <strong>My Commendations</strong>. HR awards them via <strong>Admin Panel → Member Achievements</strong> (bulk multi-select supported). Catalogues are now <a href="#" onClick={(e) => { e.preventDefault(); }} className="text-amber-400">JSON-importable</a> per type from that same page.
                        </p>
                    </Section>
                    <Section title="Conduct & Case Files">
                        <p>
                            <strong>Conduct entries</strong> are lightweight notes on a member's record: <em>Commendation, Observation, Counseling, Warning, Infraction</em> (colour-coded). Members read their own at <strong>HR Hub → My Conduct</strong>. HR adds new entries from the member detail card.
                        </p>
                        <p>
                            <strong>Case files</strong> are heavier — investigations, complex disciplinary, vetting. Opened from <strong>HR Hub → ATS → New Case</strong>. They share the same Applied → Screening → Interviewing → Resolved pipeline as recruitment.
                        </p>
                    </Section>
                    <Section title="Probation">
                        <p>
                            Admins set the probation window (typically 30 / 60 / 90 days) under <strong>HR Hub → Probation</strong>. New joiners are tracked automatically. The tracker shows days remaining (or "Overdue") with a colour-coded progress bar. Click <strong>Review</strong> to see service record + recent activity, then <strong>Confirm</strong> (clear probation, full member) or <strong>Demote</strong> (drops them to Client). Probationers see a banner on their dashboard with days remaining.
                        </p>
                    </Section>
                    <Section title="ATS — Applicant Tracking">
                        <p>
                            One unified queue for all five HR workflows: <strong>Recruitment, Vetting, Internal Cases, Transfers, Jobs</strong>. Filter by category, status, or search. Each case gets a unified file view: subject, append-only notes timeline, status pipeline, scheduled interviews, and links to related records (service requests, conduct entries, prior cases).
                        </p>
                        <p>
                            Schedule interviews from any case file: pick date / time, optional template, assign one or more interviewers. The subject (if a member) and interviewers all get notifications.
                        </p>
                    </Section>
                </HelpCard>

                {governmentEnabled && (
                    <HelpCard title="Government" icon="fa-solid fa-landmark" iconBgClass="bg-blue-500/10" iconColorClass="text-blue-400">
                        <Section title="Six Tabs">
                            <p>
                                Found at <strong>Sidebar → Government</strong>. Six tabs: <strong>Overview</strong> (branches, positions, current officials), <strong>Elections</strong>, <strong>Legislation</strong>, <strong>Motions</strong>, <strong>Orders</strong>, <strong>Constitution</strong> (an editable foundational document for the org).
                            </p>
                        </Section>
                        <Section title="Branches & Positions">
                            <p>
                                <strong>Branches</strong> are named bodies (Executive / Legislative / Judicial / Custom) that contain <strong>Positions</strong>. Each Position has a Fill Method (Elected / Appointed / Hereditary), a current Holder, and five independent power toggles: propose legislation, vote on legislation, veto, call elections, issue orders. The platform seeds eight common government models (Military Junta, Westminster Parliament, Pirate Code, etc.) — all editable.
                            </p>
                        </Section>
                        <Section title="Elections">
                            <p>
                                Five election types: Simple Majority, Plurality, Approval, Preferential (instant runoff), Proportional Representation. Phases: Draft → Candidacy → Voting → (optional Runoff) → Concluded. Members <strong>Declare Candidacy</strong> during Candidacy and can withdraw before voting opens. Ballots are <em>secret</em> — the platform records that you voted but not your choice.
                            </p>
                        </Section>
                        <Section title="Legislation, Motions & Orders">
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Legislation</strong> — Bills with a debate phase and a public vote. Optional veto window. Becomes law on passage. To repeal, draft a new bill.</li>
                                <li><strong>Motions</strong> — Lightweight yes/no procedural votes. Optional secret ballot. Non-binding unless your org treats them otherwise.</li>
                                <li><strong>Orders</strong> — Unilateral binding directives issued by a position with <code className="text-xs bg-slate-800 px-1 py-0.5 rounded-sm">canIssueOrders</code>. Optional expiry date for time-bounded directives. Active orders can be Revoked but not edited — revoke and re-issue if you need to change one.</li>
                            </ul>
                        </Section>
                        <Section title="Constitution">
                            <p>
                                A WikiEditor-backed reference document for your org's government model, term limits, legislative process, and amendments. Editable by <code className="text-xs bg-slate-800 px-1 py-0.5 rounded-sm">gov:admin</code> only. The platform doesn't enforce constitutional rules algorithmically — it's a written reference your members can cite.
                            </p>
                        </Section>
                    </HelpCard>
                )}

                {financesEnabled && (
                    <HelpCard title="Finances" icon="fa-solid fa-coins" iconBgClass="bg-amber-500/10" iconColorClass="text-amber-400">
                        <Section title="Finances Ledger">
                            <p>
                                Submit deposits (with a memo so the finance officer can match your in-game transfer) and withdrawals (with a reason) under <strong>Finances</strong>. Both enter a <strong>pending</strong> queue that finance officers Confirm or Deny. Confirmed entries move the recorded balance.
                            </p>
                            <p>
                                Five entry types: <strong>deposit, withdrawal, transfer, payout, adjustment</strong>. Direct adjustments (for opening balances or error corrections) bypass the pending queue. Reversing an entry creates a compensating opposite-sign entry — both stay in the audit trail.
                            </p>
                        </Section>
                        <Section title="Org Rating">
                            <p>
                                The <strong>aggregate org rating</strong> shown on the dashboard hero and your public page (if enabled) only counts rated <strong>Successful</strong> service requests — not Failed, Aborted, or Cancelled. Admins can curate 3–6 anonymized testimonial excerpts for the public page; client names are always stripped.
                            </p>
                        </Section>
                    </HelpCard>
                )}

                <HelpCard title="Fleet, Quartermaster & Warehouse" icon="fa-solid fa-warehouse" iconBgClass="bg-cyan-500/10" iconColorClass="text-cyan-400">
                    <Section title="My Hangar & Org Fleet">
                        <p>
                            <strong>My Hangar</strong> is your personal ship list. Click <strong>+ Add Ship</strong> to browse the catalog (filter by manufacturer / size / role) and multi-select. Edit a ship's custom name, status (Active / Stored / Damaged / Lent / Sold), and loadout notes.
                        </p>
                        <p>
                            <strong>Org Fleet</strong> aggregates every member's ships. Two views: Stacked (groups duplicates with owner avatars) or Individual (one card per ship instance).
                        </p>
                    </Section>
                    <Section title="Fleet Organization">
                        <p>
                            A drag-pan visual org chart. Group nodes (Division / Squadron / Wing / Taskforce / Custom, nestable parent → child), with assigned ships and a Commander. Officers can create groups, edit / delete them, drag ships to assign, or unassign individually.
                        </p>
                    </Section>
                    {quartermasterEnabled && <Section title="Quartermaster (Kit Issuance)">
                        <p>
                            Tracks specific equipment items issued to specific people — "Lt. Smith issued one S2 ballistic rifle, serial #45". Five tabs: <strong>Overview</strong>, <strong>Catalog</strong> (define equipment types), <strong>Armory</strong> (inventory grid), <strong>Issuances</strong> (ledger or grouped By Member), <strong>Settings</strong>.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>Members <strong>Request</strong> equipment (specifies quantity + notes). Officers Fulfil to mark Active.</li>
                            <li>Officers <strong>Issue Kit</strong> (bulk-assign multiple items + due-back date in one atomic operation).</li>
                            <li>Issuance statuses: <strong>requested → active → returned / written_off</strong>. Write-off = lost / destroyed; doesn't return to stock.</li>
                        </ul>
                    </Section>}
                    {warehouseEnabled && <Section title="Warehouse (Bulk Commodities)">
                        <p>
                            Tracks bulk goods by quantity — "12,500 kg titanium ore at Hurston Hangar 4". Counterpart to Quartermaster's serialized items.
                        </p>
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>Catalog:</strong> Define commodities with name, category, optional quality label, unit type. JSON import / export supported.</li>
                            <li><strong>Stock:</strong> Per-location inventory grid. Officer actions: Adjust (manual delta with reason), Transfer (move between locations, paired in/out), Delete.</li>
                            <li><strong>Movements ledger:</strong> Append-only audit log. Every quantity change recorded with reason, signed delta, actor, source link, notes. Reconcile via new movements — never edits.</li>
                        </ul>
                    </Section>}
                </HelpCard>

                <HelpCard title="Wiki & Search" icon="fa-solid fa-book" iconBgClass="bg-emerald-500/10" iconColorClass="text-emerald-400">
                    <Section title="Wiki Pages">
                        <p>
                            Authoring uses a rich-text WikiEditor. Pages live in a tree (drag-and-drop reorder). Each page can carry a <strong>clearance level</strong> + <strong>limiting markers</strong> — readers must pass both gates to see it. Pages below your clearance are hidden, not greyed.
                        </p>
                    </Section>
                    <Section title="Search Center">
                        <p>
                            One unified search across wiki pages, members, ranks, units, intel reports, caution notes, operations, and service requests. Results are filtered by your clearance + role permissions automatically — you'll never see a result you can't open.
                        </p>
                    </Section>
                    <Section title="External Tools">
                        <p>
                            Admins maintain a list of links to outside tools (e.g. UEX Corp, SC Trade Tools, your Discord) under <strong>Admin Panel → External Tools</strong>. They appear on the dashboard as quick-launch tiles. Members can't add their own.
                        </p>
                    </Section>
                </HelpCard>

                <HelpCard title="Notifications & Sounds" icon="fa-solid fa-bell" iconBgClass="bg-pink-500/10" iconColorClass="text-pink-400">
                    <Section title="Volume Control">
                        <p>
                            The <strong>master volume slider</strong> in the header controls all platform sounds: request alerts, assignment notifications, EAM sirens, and radio cues. Test it with the speaker icon next to the slider. The radio voice volume is independent — see Tactical Radio.
                        </p>
                    </Section>
                    <Section title="Alert Types">
                        <ul className="list-disc pl-5 space-y-1">
                            <li><strong>New Request:</strong> Plays for staff when a client submits a request.</li>
                            <li><strong>Assignment:</strong> Plays when you're added to a request, when responders join your request (clients), or when a status changes.</li>
                            <li><strong>EAM:</strong> Full-screen emergency alert with mandatory acknowledgment countdown.</li>
                            <li><strong>Radio Cues:</strong> Mic-click and squelch for PTT feedback.</li>
                            <li><strong>Operation alerts:</strong> Op transitions to Active, broadcast alerts, etc.</li>
                        </ul>
                    </Section>
                    <Section title="Push Notifications">
                        <p>
                            Push works only for <strong>installed</strong> PWAs. Register your device in <strong>My Account → Communications Uplink</strong>, then tap <strong>Test Signal</strong> to confirm. If pushes stop after a phone update, unregister + re-register.
                        </p>
                    </Section>
                </HelpCard>

                {hasPermission('admin:access') && (
                    <HelpCard title="System Administration" icon="fa-solid fa-screwdriver-wrench" iconBgClass="bg-slate-500/10" iconColorClass="text-slate-300">
                        <Section title="Admin Panel">
                            <p>
                                Single configuration view, organised into eleven groups: Dashboard, User Management, Organization, Recognition, Communications, Governance, Integrations, Operations, Appearance, Maintenance, Platform. Tabs are <em>permission-gated</em> — if your role lacks a permission, the tab is hidden, not greyed. Active tab persists on reload.
                            </p>
                        </Section>
                        <Section title="Branding & Sounds">
                            <p>
                                <strong>Branding Settings</strong> covers org identity (name, logo, callsign), site metadata (Open Graph, favicon, PWA icon), accent colour, and all alert sound URLs (must be HTTPS <code className="text-xs bg-slate-800 px-1 py-0.5 rounded-sm">.mp3</code>). Auto-saves on a 2-second debounce.
                            </p>
                        </Section>
                        <Section title="Discord Integration">
                            <p>
                                Members log in via Discord OAuth (Client ID / Secret are configured in Admin → Settings, or your server's .env). The bot (using Bot Token) posts notifications and reads server roles.
                            </p>
                            <ul className="list-disc pl-5 space-y-1">
                                <li><strong>Channel Settings:</strong> New Request, Intel, EAM, and the new <strong>Operation Announcement</strong> default channel. <strong>Test Send</strong> verifies bot access.</li>
                                <li><strong>Role Mapping:</strong> Click <strong>Fetch Roles</strong> to pull server roles. Map each Discord role to a Rank + (optionally) a platform Role. Click <strong>Update All Users</strong> to apply — Discord is the source of truth, the sync is one-way.</li>
                            </ul>
                        </Section>
                        <Section title="EAM Broadcasts">
                            <p>
                                Emergency Action Messages override every active session with a full-screen siren and mandatory ack. Friction by design: type the message → <strong>Initiate</strong> → confirm → <strong>Arm</strong> (3-sec countdown) → <strong>Transmit</strong>. Posts to the Discord EAM channel and pushes to PWA devices. Reserve for genuine emergencies.
                            </p>
                        </Section>
                        <Section title="AI Configuration">
                            <p>
                                Set the Gemini API key, model (e.g. <code className="text-xs bg-slate-800 px-1 py-0.5 rounded-sm">gemini-1.5-pro</code>, <code className="text-xs bg-slate-800 px-1 py-0.5 rounded-sm">gemini-1.5-flash</code>), temperature, and max tokens in <strong>AI Configuration</strong>. Auto-saves. The key is encrypted at rest. AI features (dossier analysis, AAR drafting) gracefully show "AI Key Not Installed" if missing.
                            </p>
                        </Section>
                        <Section title="Database & Intel Tools">
                            <p>
                                <strong>Database Tools:</strong> Integrity checks, prune old data (90-day default), exports, recompute derived fields. Pruning is destructive — confirm carefully.
                            </p>
                            <p>
                                <strong>Intelligence Management:</strong> Deduplicate reports, sync caution notes to dossiers, bulk clearance / marker operations.
                            </p>
                            <p>
                                <strong>Wiki Tools:</strong> Export / import pages (JSON or Markdown), bulk reclassify clearance, repair orphaned pages.
                            </p>
                        </Section>
                        <Section title="Achievement Catalogues">
                            <p>
                                <strong>Admin Panel → Member Achievements</strong> lets you import / export Specializations, Certifications, and Commendations as JSON — one file per type. Imports show a diff preview ("X new, Y will update") before commit. Useful for migrating between orgs or backing up your catalogue.
                            </p>
                        </Section>
                    </HelpCard>
                )}
            </div>

            <div className="bg-slate-900/60 backdrop-blur-md border border-slate-700/50 rounded-xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center mt-6 gap-4">
                <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">Compliance</h3>
                    <p className="text-sm text-slate-400 mt-1">Review the organization's terms of service and data policies.</p>
                </div>
                <button
                    onClick={() => setActiveView('tos')}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-white bg-sky-600 hover:bg-sky-500 border border-sky-500/40 rounded-lg shadow-lg shadow-sky-900/30 transition whitespace-nowrap"
                >
                    <i className="fa-solid fa-file-contract"></i> View Terms of Service
                </button>
            </div>
            </div>
        </div>
    );
};

export default HelpView;
