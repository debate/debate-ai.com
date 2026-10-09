"use client"

/**
 * @fileoverview Shows the first-sign-in welcome notification.
 *
 * The first time this browser carries a signed-in session,
 * the reader gets the key-links dialog (`FirstLoginWelcomeDialog`):
 * the docs, the practice rounds, the video library, and the
 * NDT 2015 Finals practice debate as the suggested first
 * round. After that the flag in `lib/first-login-welcome`
 * keeps it from ever showing again here.
 *
 * Mounted in the app shell next to the other session-aware
 * chrome (the sign-in prompt, the plan-limit dialog), so the
 * welcome can appear over whatever page the sign-in redirect
 * lands on.
 *
 * @module components/layout/FirstLoginWelcomeProvider
 */

import { useEffect, useState } from "react"

import { useSession } from "../../lib/hooks/useSession"
import {
  markFirstLoginWelcomeShown,
  wasFirstLoginWelcomeShown,
} from "../../lib/first-login-welcome"
import { FirstLoginWelcomeDialog } from "./FirstLoginWelcomeDialog"

/**
 * The session user's anonymous flag. better-auth returns every
 * user column (the `is_anonymous` column exists for its
 * anonymous plugin), and it is nullable, so read it defensively.
 */
function isAnonymousUser(user: { isAnonymous?: boolean | null } | null): boolean {
  return !!user?.isAnonymous
}

export function FirstLoginWelcomeProvider() {
  const { user, isAuthenticated, isLoading } = useSession()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // Wait for the session to resolve: `isPending` is true on
    // the first render, and a guest session is not a sign-in.
    if (isLoading || !isAuthenticated) return
    if (isAnonymousUser(user)) return
    // Once per browser — the flag is set before the dialog
    // opens, so a re-run of this effect (a session refetch
    // lands a new `user` object) cannot stack a second copy.
    if (wasFirstLoginWelcomeShown()) return
    markFirstLoginWelcomeShown()
    setOpen(true)
  }, [isAuthenticated, isLoading, user])

  if (!open) return null

  return (
    <FirstLoginWelcomeDialog
      open={open}
      onOpenChange={setOpen}
      name={user?.name ?? null}
    />
  )
}

export default FirstLoginWelcomeProvider
