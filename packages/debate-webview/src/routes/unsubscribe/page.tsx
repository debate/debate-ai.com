"use client"

/**
 * Landing page for the Unsubscribe link in every Debate AI email footer.
 * Reads `?t=` (signed token), confirms, and POSTs to `/api/emails/unsubscribe`.
 */

import { Suspense, useEffect, useState } from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"

type Status = "loading" | "ready" | "done" | "error"

function UnsubscribeInner() {
  const params = useSearchParams()
  const token = params.get("t") ?? ""
  const [status, setStatus] = useState<Status>("loading")
  const [email, setEmail] = useState<string | null>(null)
  const [already, setAlready] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) {
      setStatus("error")
      setError("That unsubscribe link is missing its token. Open Settings → Notifications to manage email instead.")
      return
    }
    let live = true
    fetch(`/api/emails/unsubscribe?t=${encodeURIComponent(token)}`)
      .then(async (res) => {
        const body = (await res.json().catch(() => null)) as {
          email?: string
          unsubscribed?: boolean
          error?: string
        } | null
        if (!live) return
        if (!res.ok) {
          setStatus("error")
          setError(body?.error ?? "That unsubscribe link is invalid or expired.")
          return
        }
        setEmail(body?.email ?? null)
        setAlready(Boolean(body?.unsubscribed))
        setStatus(body?.unsubscribed ? "done" : "ready")
      })
      .catch(() => {
        if (!live) return
        setStatus("error")
        setError("Could not reach the server. Try again in a moment.")
      })
    return () => {
      live = false
    }
  }, [token])

  const confirm = async () => {
    setBusy(true)
    setError(null)
    try {
      const res = await fetch("/api/emails/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action: "unsubscribe" }),
      })
      const body = (await res.json().catch(() => null)) as { error?: string; email?: string } | null
      if (!res.ok) {
        setError(body?.error ?? "Could not unsubscribe.")
        return
      }
      setEmail(body?.email ?? email)
      setStatus("done")
    } catch {
      setError("Could not reach the server. Try again in a moment.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-[70dvh] max-w-lg flex-col justify-center gap-4 px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight">Unsubscribe from emails</h1>
      {status === "loading" && <p className="text-sm text-muted-foreground">Checking that link…</p>}
      {status === "error" && <p className="text-sm text-destructive">{error}</p>}
      {status === "ready" && (
        <>
          <p className="text-sm text-muted-foreground">
            Stop all Debate AI emails to <span className="font-medium text-foreground">{email}</span>? You
            can turn them back on later in Settings.
          </p>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="button"
            disabled={busy}
            onClick={() => void confirm()}
            className="inline-flex w-fit items-center rounded-md bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-60"
          >
            {busy ? "Unsubscribing…" : "Unsubscribe from all emails"}
          </button>
        </>
      )}
      {status === "done" && (
        <p className="text-sm text-muted-foreground">
          {already ? "Already unsubscribed" : "Unsubscribed"}
          {email ? (
            <>
              : <span className="font-medium text-foreground">{email}</span>
            </>
          ) : (
            "."
          )}{" "}
          You will not get further Debate AI emails at this address (sign-in links still work).
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        <Link href="/settings?category=notifications" className="underline underline-offset-4">
          Notification settings
        </Link>
        {" · "}
        <Link href="/" className="underline underline-offset-4">
          Back to Debate AI
        </Link>
      </p>
    </main>
  )
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto flex min-h-[70dvh] max-w-lg items-center px-4 py-12 text-sm text-muted-foreground">
          Loading…
        </main>
      }
    >
      <UnsubscribeInner />
    </Suspense>
  )
}
