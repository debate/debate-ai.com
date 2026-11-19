"use client"

import { useEffect, useRef } from "react"

/** Reloads the page; a seam so tests can watch it. */
export const reloadPage = { current: () => window.location.reload() }

/**
 * For the sign-in dialog's "Add another account" mode: remembers the account
 * signed in when the dialog opened, and once a *different* one lands, closes
 * the dialog and reloads. A sign-in that finishes in place (a passkey, One Tap)
 * swaps the session under a page whose data belongs to the previous account;
 * redirecting sign-ins (OAuth, magic link) come back through `callbackURL`
 * with a fresh page anyway.
 */
export function useCloseOnNewAccount({
  enabled,
  open,
  userId,
  onOpenChange,
}: {
  enabled: boolean
  open: boolean
  userId: string | null
  onOpenChange: (open: boolean) => void
}) {
  const openedAs = useRef<string | null>(null)

  useEffect(() => {
    if (!enabled) return
    if (!open) {
      openedAs.current = null
      return
    }
    if (!userId) return
    if (openedAs.current === null) {
      openedAs.current = userId
    } else if (userId !== openedAs.current) {
      onOpenChange(false)
      reloadPage.current()
    }
  }, [enabled, open, userId, onOpenChange])
}
