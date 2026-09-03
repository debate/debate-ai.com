"use client"

/**
 * @fileoverview Landing page for the native-wrapper sign-in handoff, step 3 of 3.
 *
 * Reached INSIDE the wrapper's own webview: the wrapper's Rust side catches
 * the `<scheme>://auth-callback?token=...` deep link from
 * `/auth/native-complete` (step 2, running in the system browser) and
 * navigates its window here, same-origin, with the token as a query param.
 * Spending the token via better-auth's one-time-token verify endpoint sets a
 * session cookie scoped to *this* webview's cookie jar — the actual point of
 * the handoff, since the system browser's cookies and this webview's cookies
 * are separate jars that can't otherwise see each other's session. See
 * packages/native-wrapper/docs/OAUTH.md.
 */

import { useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"

import { authClient } from "@/lib/auth/client"

export default function NativeCallbackPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [status, setStatus] = useState<"working" | "error">("working")

  useEffect(() => {
    const token = searchParams.get("token")
    if (!token) {
      setStatus("error")
      return
    }

    let cancelled = false

    async function verify() {
      const { error } = await authClient.oneTimeToken.verify({ token: token! })
      if (cancelled) return
      if (error) {
        console.error("[auth] one-time token verify failed:", error)
        setStatus("error")
        return
      }
      router.replace("/")
    }

    void verify()
    return () => {
      cancelled = true
    }
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-sm text-center space-y-3">
        {status === "working" && (
          <p className="text-sm text-muted-foreground animate-pulse">Finishing sign-in…</p>
        )}
        {status === "error" && (
          <>
            <p className="text-sm font-medium">This sign-in link is no longer valid.</p>
            <p className="text-sm text-muted-foreground">
              One-time sign-in links expire a few minutes after they&apos;re issued. Go back and
              try &quot;Continue in your browser&quot; again.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
