// AuthContext — compatibility shim over three narrow contexts:
//   - SessionContext      — currentUser, OAuth, refreshUser, realtime alerts, CRUD wrappers
//   - PushNotificationContext — isPushActive, subscribeToPush, checkPushSubscription
//   - ActivityContext     — idleTime, 60s heartbeat, idle/interaction listeners
//
// <AuthProvider> mounts the three providers in dependency order (Session
// outermost; Activity innermost because it needs Session's logout helper for
// force-logout enforcement). useAuth() returns the union of all three hook
// values, matching the original AuthContextType shape so existing consumers
// don't have to change.
//
// Also re-exports useFormatDate (which lives in SessionContext) for consumers
// that import it directly from this module path.

import React, { useMemo } from 'react';
import { SessionProvider, useSession, useFormatDate, type SessionContextValue } from './SessionContext';
import { PushNotificationProvider, usePushNotification, type PushNotificationContextValue } from './PushNotificationContext';
import { ActivityProvider, useActivity, type ActivityContextValue } from './ActivityContext';

/** Canonical shape returned by useAuth() — the merged surface of the three
 *  narrow contexts the shim wraps. */
export type AuthContextType = SessionContextValue & PushNotificationContextValue & ActivityContextValue;

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <SessionProvider>
        <PushNotificationProvider>
            <ActivityProvider>{children}</ActivityProvider>
        </PushNotificationProvider>
    </SessionProvider>
);

export const useAuth = (): AuthContextType => {
    const session = useSession();
    const push = usePushNotification();
    const activity = useActivity();
    // Memoise the merge so consumers destructuring stable references (e.g.
    // callbacks in useEffect deps) don't re-run on unrelated re-renders.
    return useMemo<AuthContextType>(() => ({ ...session, ...push, ...activity }), [session, push, activity]);
};

export { useFormatDate };
