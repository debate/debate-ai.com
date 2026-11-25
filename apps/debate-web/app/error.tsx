"use client"

/**
 * Route-level error boundary. Without one, a render error anywhere in a page
 * unmounts the whole tree and leaves a blank white document with nothing but a
 * console message — indistinguishable from a hung navigation. This keeps the
 * dock reachable and puts the error text on screen so it can be reported.
 *
 * Also detects stale-build chunk load failures (a tab open across a deploy
 * trying to load chunks that no longer exist) and triggers a reload to recover.
 * See lib/chunk-reload/script.ts for the inline <head> script that catches
 * most cases; this boundary catches failures that become render errors instead
 * of unhandled rejections (e.g., React.lazy import failures).
 */

import { useEffect } from "react"
import { Button } from "@debate-ai/webview/ui/primitives/button"
import { isChunkLoadFailure } from "@/lib/chunk-reload/script"
import { shouldReloadForStaleBuild } from "@debate-ai/webview/lib/layout/stale-build-recovery"

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Route error:", error)

    if (typeof window === "undefined") return

    if (isChunkLoadFailure(error.message)) {
      let store: Storage | undefined
      try {
        store = window.sessionStorage
      } catch {
        return
      }
      if (shouldReloadForStaleBuild(store)) window.location.reload()
    }
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
      <h2 className="text-xl font-semibold">This page failed to load</h2>
      <p className="max-w-xl break-words text-sm text-muted-foreground">
        {error.message || "An unexpected error occurred."}
        {error.digest ? ` (${error.digest})` : ""}
      </p>
      <div className="flex gap-2">
        <Button onClick={reset}>Try again</Button>
        <Button variant="outline" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  )
}
