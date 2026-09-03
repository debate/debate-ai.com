"use client"

/**
 * @fileoverview Landing page for the native-wrapper sign-in handoff, step 2 of 3.
 *
 * Reached in the SYSTEM BROWSER (not the wrapper's webview) as the
 * `callbackURL` of a normal social/magic-link sign-in that
 * `LoginForm`/`LoginPage` opened here for that exact reason. By the time this
 * runs, better-auth has already set a session cookie in this browser. It
 * mints a short-lived, single-use token off that session and redirects the
 * browser to the wrapper's custom URL scheme, which hands the OS back to the
 * installed app — see packages/native-wrapper/docs/OAUTH.md for the full
 * round trip and step 3 (`/auth/native-callback`, which runs inside the
 * wrapper and spends the token).
 */

import { useEffect, useState } from "react"

import { authClient } from "@/lib/auth/client"
import { NATIVE_DEEP_LINK_SCHEME } from "@/lib/config/site"

export default function NativeCompletePage() {
  const [status, setStatus] = useState<"working" | "done" | "error">("working")

  useEffect(() => {
    let cancelled = false

    async function handoff() {
      const { data, error } = await authClient.oneTimeToken.generate()
      if (cancelled) return
      if (error || !data?.token) {
        console.error("[auth] one-time token generation failed:", error)
        setStatus("error")
        return
      }
      setStatus("done")
      window.location.href = `${NATIVE_DEEP_LINK_SCHEME}://auth-callback?token=${encodeURIComponent(data.token)}`
    }

    void handoff()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-3">
        {status === "working" && (
          <p className="text-sm text-muted-foreground animate-pulse">Signing you in…</p>
        )}
        {status === "done" && (
          <>
            <p className="text-sm font-medium">You&apos;re signed in.</p>
            <p className="text-sm text-muted-foreground">
              Return to the app — it should open automatically. If it doesn&apos;t, you can close
              this tab and reopen the app yourself.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm font-medium">Something went wrong finishing sign-in.</p>
            <p className="text-sm text-muted-foreground">
              Please close this tab and try &quot;Continue in your browser&quot; again from the app.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
