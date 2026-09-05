"use client"

import {
  ChatProvider,
  SessionProvider,
  ExtractPanelProvider,
  ChatWindow,
  configureResearchAgentUI,
  type ResearchAgentAuthClient,
} from "research-agent-ui"

// research-agent-ui's network calls (grab-url's default baseURL, used by
// chatConfig/sendMessage/voice/etc.) default to same-origin `/api/`, which
// doesn't exist on debate-ai.com. Point them at qwksearch.com's public API
// instead — the same backend the previous iframe embedded. This only needs
// to run once the real `grab` function (assigned by grab-url's own module
// side effect) exists, which is guaranteed here since it's a transitive
// import of `research-agent-ui` evaluated above.
if (typeof window !== "undefined") {
  const win = window as unknown as {
    grab?: { defaults?: Record<string, unknown> }
  }
  win.grab = win.grab || {}
  win.grab.defaults = {
    ...win.grab.defaults,
    baseURL: "https://qwksearch.com/api/",
  }
}

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
