"use client"

/**
 * @fileoverview The signed-in state the REASON docs UI needs, handed in by the
 * host rather than read from an auth client.
 *
 * The auth client belongs to the app shell (its base URL and sign-in handoff
 * differ per host), so this package never imports it: `debate-webview` mounts
 * {@link ReasonSessionProvider} above the docs provider with the live session.
 * Without a provider the user reads as signed out.
 */

import { createContext, useContext, type ReactNode } from "react"

export interface ReasonSession {
  isAuthenticated: boolean
  /** Only the name is read, to label the user's cursor in a shared document. */
  user: { name?: string | null } | null
}

const SIGNED_OUT: ReasonSession = { isAuthenticated: false, user: null }

const ReasonSessionContext = createContext<ReasonSession>(SIGNED_OUT)

export function ReasonSessionProvider({ session, children }: { session: ReasonSession; children: ReactNode }) {
  return <ReasonSessionContext.Provider value={session}>{children}</ReasonSessionContext.Provider>
}

export function useReasonSession(): ReasonSession {
  return useContext(ReasonSessionContext)
}
