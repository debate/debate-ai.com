"use client"

/**
 * Last-resort boundary. `app/error.tsx` only catches throws from inside a
 * page — anything that fails in the root layout itself (the theme provider,
 * the app shell, a chrome component above every route) escapes it, and with
 * no boundary above that the server render fails and the Worker answers a
 * bare 500.
 *
 * The chrome that actually sits in the layout is bounded piece by piece in
 * `lib/ui/layout/chrome-error-boundary.tsx`, so reaching this file should
 * mean the layout's own scaffolding broke. This replaces the whole document
 * — Next requires it to render `<html>` and `<body>` itself — so it stays
 * deliberately plain: no theme, no fonts, no imports that could fail the
 * same way the layout just did.
 */

import { useEffect } from "react"
import { shouldReloadForStaleBuild } from "debate-ai-webui/lib/layout/stale-build-recovery"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Root layout error:", error)

    // A tab open across a deploy is running chunk hashes the origin no longer
    // serves, so its lazy imports resolve to null and the first component to
    // touch one throws out here. `reset()` re-renders that same dead graph and
    // can never recover it — only a reload can, and documents are
    // network-first in the service worker, so it comes back on the current
    // build. Rate-limited to one attempt per tab per cooldown, so a build
    // that is genuinely broken shows the message below instead of looping.
    // See lib/layout/stale-build-recovery.ts.
    if (typeof window === "undefined") return
    let store: Storage | undefined
    try {
      store = window.sessionStorage
    } catch {
      // Storage is blocked (privacy mode); recovery is skipped, not attempted
      // unguarded.
      return
    }
    if (shouldReloadForStaleBuild(store)) window.location.reload()
  }, [error])

  return (
    <html lang="en">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif" }}>
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "1rem",
            padding: "2rem",
            textAlign: "center",
          }}
        >
          <h2 style={{ fontSize: "1.25rem", fontWeight: 600 }}>Debate AI failed to start</h2>
          <p style={{ maxWidth: "36rem", fontSize: "0.875rem", color: "#666", wordBreak: "break-word" }}>
            {error.message || "An unexpected error occurred."}
            {error.digest ? ` (${error.digest})` : ""}
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={reset}
              style={{ padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #ccc", cursor: "pointer" }}
            >
              Try again
            </button>
            <a
              href="/"
              style={{
                padding: "0.5rem 1rem",
                borderRadius: "0.375rem",
                border: "1px solid #ccc",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              Go home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
