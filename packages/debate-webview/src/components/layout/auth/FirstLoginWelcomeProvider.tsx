"use client"

/**
 * @fileoverview Shows the first-sign-in welcome notification.
 *
 * The first time an account signs in, the reader gets the
 * key-links dialog (`FirstLoginWelcomeDialog`): the docs, the
 * practice rounds, the video library, and the NDT 2015 Finals
 * practice debate as the suggested first round. Showing it
 * records the dismissal on the account
 * (`user_settings.welcome_dismissed_at`, via
 * `lib/first-login-welcome`), so it never appears again, on
 * this browser or any other.
 *
 * Mounted in the app shell next to the other session-aware
 * chrome (the sign-in prompt, the plan-limit dialog), so the
 * welcome can appear over whatever page the sign-in redirect
 * lands on.
 *
 * @module components/layout/auth/FirstLoginWelcomeProvider
 */

import { useEffect, useRef, useState } from "react"

import { useSession } from "../../../lib/hooks/useSession"
import {
  fetchFirstLoginWelcomeDismissed,
  markFirstLoginWelcomeShown,
  markFirstLoginWelcomeSynced,
  saveFirstLoginWelcomeDismissed,
  wasFirstLoginWelcomeShown,
  wasFirstLoginWelcomeSynced,
} from "../../../lib/first-login-welcome"
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

  // One check per mounted shell: a session refetch lands a new
  // `user` object and re-runs the effect, which must neither
  // stack a second request nor cancel the first one's answer.
  const checked = useRef(false)

  useEffect(() => {
    // Wait for the session to resolve: `isPending` is true on
    // the first render, and a guest session is not a sign-in.
    if (isLoading || !isAuthenticated) return
    if (isAnonymousUser(user)) return
    if (checked.current) return
    checked.current = true
    // This browser already showed it (or learned the account
    // dismissed it). Readers who saw it before the flag moved
    // to the account get it recorded there once.
    if (wasFirstLoginWelcomeShown()) {
      if (!wasFirstLoginWelcomeSynced()) {
        void saveFirstLoginWelcomeDismissed().then((saved) => {
          if (saved) markFirstLoginWelcomeSynced()
        })
      }
      return
    }
    void fetchFirstLoginWelcomeDismissed().then((dismissed) => {
      // `null` means the account's answer is unknown; stay quiet
      // rather than repeat the welcome for someone who saw it.
      if (dismissed === null) return
      markFirstLoginWelcomeShown()
      markFirstLoginWelcomeSynced()
      if (dismissed) return
      // Recorded as soon as it shows, so a reload or another
      // device never brings it back.
      void saveFirstLoginWelcomeDismissed()
      setOpen(true)
    })
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
