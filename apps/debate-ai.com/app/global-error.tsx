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

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Root layout error:", error)
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
