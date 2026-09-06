"use client"

import { useEffect } from "react"
import {
  ChatProvider,
  SessionProvider,
  ExtractPanelProvider,
  ChatWindow,
  configureResearchAgentUI,
  type ResearchAgentAuthClient,
} from "research-agent-ui"

configureResearchAgentUI({
  appName: "Debate AI",
  // Media auto-search is a nice-to-have that adds extra cross-origin calls;
  // keep this embed's request footprint minimal.
  getAutoMediaSearch: () => false,
})

// This embed talks to qwksearch.com's public, unauthenticated API surface
// (search + chat), so there's no shared session with debate-ai.com to
// report and no sign-in flow to offer here — chat history for guests is
// kept client-side via localStorage by research-agent-ui itself.
const guestAuthClient: ResearchAgentAuthClient = {
  getSession: async () => ({ data: null }),
  oneTap: () => {},
  signIn: { social: () => {} },
  signOut: async () => {},
}

export default function ResearchAgentEmbed() {
  // research-agent-ui's network calls (grab-url's default baseURL, used by
  // chatConfig/sendMessage/voice/etc.) default to same-origin `/api/`, which
  // doesn't exist on debate-ai.com. Point them at qwksearch.com's public API
  // instead — the same backend the previous iframe embedded.
  //
  // `grab.defaults` is a page-wide singleton (grab-url has no per-instance
  // config), so this MUST be scoped to this component's lifetime and undone
  // on unmount — otherwise it leaks past this route: after visiting /doc,
  // every other page's same-origin `grab()` calls (e.g. the video library's
  // `/api/videos` fetch in useVideoFeed) would keep resolving against
  // qwksearch.com instead and fail with a CORS error until a full reload.
  useEffect(() => {
    const win = window as unknown as {
      grab?: { defaults?: Record<string, unknown> }
    }
    win.grab = win.grab || {}
    const previousDefaults = win.grab.defaults
    win.grab.defaults = {
      ...previousDefaults,
      baseURL: "https://qwksearch.com/api/",
    }
    return () => {
      if (win.grab) win.grab.defaults = previousDefaults
    }
  }, [])

  return (
    <SessionProvider authClient={guestAuthClient} enableGoogleOneTap={false}>
      <ExtractPanelProvider>
        <ChatProvider>
          <ChatWindow />
        </ChatProvider>
      </ExtractPanelProvider>
    </SessionProvider>
  )
}
