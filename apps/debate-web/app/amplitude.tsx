"use client"

import { useEffect, useState } from "react"
import * as amplitude from "@amplitude/unified"
import { useSession } from "@debate-ai/webview/lib/hooks/useSession"
import { syncAmplitudeIdentity } from "@debate-ai/webview/lib/analytics/amplitude/identity"
import { SESSION_REPLAY_OPTIONS } from "@debate-ai/webview/lib/analytics/amplitude/replay-config"
import { resolveAmplitudeKey } from "@debate-ai/webview/lib/analytics/amplitude/key"

/**
 * Amplitude starts once, in the browser, before anything else can emit an
 * event. The Analytics project API key is public and ingestion-scoped — it
 * ships in the client bundle by design — so `NEXT_PUBLIC_` is correct here, and
 * being `NEXT_PUBLIC_` means it is inlined at build time: adding it to
 * `.env.local` while the dev server is already running needs a restart.
 *
 * The guard matters because without a key `initAll` fails silently and the
 * first real event looks like an SDK bug rather than missing configuration.
 *
 * Once initialised, the signed-in user's database id is set as Amplitude's
 * user id (see @debate-ai/webview/lib/analytics/amplitude/identity.ts) so their events and Session Replay
 * recordings are attributed to them. `useSession` re-renders on sign-in,
 * sign-up, a restored session on page load, and sign-out, which covers every
 * point the identity has to change.
 */
export function Amplitude() {
  const [ready, setReady] = useState(false)
  const { user, isLoading } = useSession()

  useEffect(() => {
    const key = resolveAmplitudeKey(process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY, window.location.hostname)
    if (!key) {
      // Expected in local dev and preview builds; production falls back to
      // the public project key (lib/amplitude/key.ts)
      console.info("[amplitude] NEXT_PUBLIC_AMPLITUDE_API_KEY is not set — no events will be sent")
      return
    }
    let cancelled = false
    amplitude
      .initAll(key, {
        serverZone: "US",
        analytics: { autocapture: true },
        // The card editor is blocked from replay; see @debate-ai/webview/lib/analytics/amplitude/replay-config.ts.
        sessionReplay: SESSION_REPLAY_OPTIONS,
      })
      .then(() => {
        if (!cancelled) setReady(true)
      })
      .catch((error: unknown) => console.error("[amplitude] init failed", error))
    return () => {
      cancelled = true
    }
  }, [])

  const userId = user?.id
  const isAnonymous = (user as { isAnonymous?: boolean | null } | null)?.isAnonymous ?? false

  useEffect(() => {
    // Wait for both: before init, getUserId() can't see the id Amplitude
    // persisted last visit; while the session is loading, a signed-in user
    // would briefly look signed out and be reset.
    if (!ready || isLoading) return
    try {
      syncAmplitudeIdentity(amplitude, userId ? { id: userId, isAnonymous } : null)
    } catch (error) {
      console.error("[amplitude] could not set user identity", error)
    }
  }, [ready, isLoading, userId, isAnonymous])

  return null
}
