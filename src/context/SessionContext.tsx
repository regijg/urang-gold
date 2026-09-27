"use client";

import React, { createContext, useContext } from "react";
import type { AppSession } from "@/server/auth/session";
import type { Permission } from "@/lib/auth/permissions";

// Server-verified session handed down from the (admin) layout. Used for UI only
// (showing names, hiding menus) — authorization is enforced on the server/RLS.
const SessionContext = createContext<AppSession | null>(null);

export function SessionProvider({ session, children }: { session: AppSession; children: React.ReactNode }) {
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function useSession(): AppSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}

export function useCan(permission: Permission): boolean {
  return useSession().permissions.includes(permission);
}
