"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/auth/session";

const SessionRoleContext = createContext<UserRole | null>(null);

/**
 * Makes the current user's role available to client components nested under
 * the dashboard layout without prop-drilling it through every page (Topbar
 * is rendered separately on 13+ pages, none of which otherwise pass session
 * data down to it).
 */
export function SessionRoleProvider({ role, children }: { role: UserRole; children: React.ReactNode }) {
  return <SessionRoleContext.Provider value={role}>{children}</SessionRoleContext.Provider>;
}

export function useSessionRole(): UserRole {
  const role = useContext(SessionRoleContext);
  if (!role) throw new Error("useSessionRole must be used within SessionRoleProvider");
  return role;
}
