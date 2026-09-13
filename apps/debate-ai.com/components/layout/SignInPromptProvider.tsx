"use client"

/**
 * @fileoverview Renders the sign-in dialog when a tool tells a guest their work
 * is only being saved in this browser.
 *
 * The tools stay usable signed out on purpose, and every store writes
 * `localStorage` first — so a guest who favourites a video, scores a card or
 * saves a drill set really has saved it, just nowhere that survives a new
 * device or a cleared cache. They had no way to find that out until they lost
 * it. `debate-data-sync`'s `state/sign-in-prompt.ts` lets the store say so at
 * the click; this is the half that shows it.
 *
 * It lives in the app rather than in a package because the sign-in UI does:
 * `LoginDialog`, `LoginForm`, the session and the callback URL are all app
 * concerns, and `debate-data-sync` is a leaf package that cannot import any of
 * them. The bus in between is a plain subscribe/publish pair with no React and
 * no `fetch`, so the tool packages stay testable without a DOM.
 *
 * @module components/layout/SignInPromptProvider
 */

import { useEffect, useRef, useState } from "react"
import {
  subscribeToSignInPrompts,
  type SignInPrompt,
} from "debate-data-sync/src/state/sign-in-prompt"
import { LoginDialog } from "./LoginDialog"
import { useSession } from "@/lib/hooks/useSession"
import { isSignInPromptOptedOut, setSignInPromptOptedOut } from "@/lib/sign-in-prompt-preference"

/**
 * How long to wait before prompting the same feature again, in ms.
 *
 * Favouriting is a rapid, repeated action — a debater working through a
 * results page favourites a dozen rounds in a row — and a dialog on every one
 * of those clicks is not a helpful offer, it is a tool that has stopped
 * working. One prompt per feature per session-ish window is the offer; after
 * that the guest has been told, and their saves go on working locally.
 */
const PROMPT_COOLDOWN_MS = 30 * 60 * 1000

/** Remembers which features have already prompted, across reloads in this tab. */
const DISMISSED_KEY = "signInPromptsShownAt"

function readShown(): Record<string, number> {
  if (typeof sessionStorage === "undefined") return {}
  try {
    const raw = sessionStorage.getItem(DISMISSED_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : {}
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

function markShown(feature: string, at: number): void {
  if (typeof sessionStorage === "undefined") return
  try {
    sessionStorage.setItem(DISMISSED_KEY, JSON.stringify({ ...readShown(), [feature]: at }))
  } catch {
    // A browser refusing session storage prompts once per page load instead of
    // once per window — chattier, never wrong.
  }
}

export function SignInPromptProvider() {
  const { isAuthenticated } = useSession()
  const [prompt, setPrompt] = useState<SignInPrompt | null>(null)
  // The subscription is registered once; reading the session through a ref
  // keeps a sign-in from tearing down and re-adding the listener, which would
  // drop a prompt raised in the same tick.
  const authedRef = useRef(isAuthenticated)
  authedRef.current = isAuthenticated

  useEffect(() => {
    return subscribeToSignInPrompts((raised) => {
      // A prompt racing a session that has just landed (One Tap, or a magic
      // link finishing in another tab) would put a sign-in form in front of
      // somebody who is already signed in.
      if (authedRef.current) return

      // A guest who has explicitly asked not to be asked again. Checked here
      // rather than in the bus itself: `requireSignIn` still reports "no
      // account" so the caller's own local-save/offer logic doesn't change,
      // only whether the app actually renders the dialog for it.
      if (isSignInPromptOptedOut()) return

      const now = Date.now()
      const shownAt = readShown()[raised.feature]
      if (typeof shownAt === "number" && now - shownAt < PROMPT_COOLDOWN_MS) return

      markShown(raised.feature, now)
      setPrompt(raised)
    })
  }, [])

  // Signing in is the thing the dialog was asking for; leaving it open over an
  // authenticated app is just stale UI.
  useEffect(() => {
    if (isAuthenticated) setPrompt(null)
  }, [isAuthenticated])

  if (!prompt) return null

  return (
    <LoginDialog
      open
      onOpenChange={(open) => {
        if (!open) setPrompt(null)
      }}
      title={`Sign in to save your ${prompt.feature}`}
      description={prompt.message}
      returnTo={prompt.returnTo}
      secondaryAction={{
        label: "Don't ask me again",
        onClick: () => {
          setSignInPromptOptedOut(true)
          setPrompt(null)
        },
      }}
    />
  )
}

export default SignInPromptProvider
