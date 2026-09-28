"use client"

import { useEffect, useState } from "react"
import { authClient } from "../../../lib/auth/client"
import { EXTENSION_TOKEN_HASH_KEY } from "../../../lib/config/site"

export default function ExtensionCompletePage() {
  const [status, setStatus] = useState<"working" | "done" | "error">("working")

  useEffect(() => {
    let cancelled = false

    async function handoff() {
      const { data, error } = await authClient.oneTimeToken.generate()
      if (cancelled) return
      if (error || !data?.token) {
        console.error("[auth] extension one-time token generation failed:", error)
        setStatus("error")
        return
      }
      setStatus("done")
      // Replacing rather than assigning keeps the token out of this tab's
      // history. The extension reads it off the tab URL and closes the tab.
      window.location.replace(
        `#${EXTENSION_TOKEN_HASH_KEY}=${encodeURIComponent(data.token)}`,
      )
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
              This tab closes itself once the extension picks the sign-in up. If it stays open,
              close it and try signing in again from the extension.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-sm font-medium">Something went wrong finishing sign-in.</p>
            <p className="text-sm text-muted-foreground">
              Please close this tab and start sign-in again from the extension.
            </p>
          </>
        )}
      </div>
    </div>
  )
}
