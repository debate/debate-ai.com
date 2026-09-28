"use client"

// MUST stay the first import: sets the API base-URL global before
// research-agent-ui's bundled qwksearch-api-client captures it.
import "./base-url"

import type { ReactNode } from "react"
import {
  ChatProvider,
  SessionProvider,
  ExtractPanelProvider,
  configureResearchAgentUI,
} from "research-agent-ui"
import { authClient } from "./guest-auth"
import { GrabBaseScope } from "./GrabBaseScope"
import { MainViewProvider } from "./MainViewProvider"
import { SettingsModalProvider } from "./Settings/SettingsModal"

configureResearchAgentUI({
  appName: "Debate AI",
  getAutoMediaSearch: () => true,
})

/**
 * Provider stack for the embedded qwksearch research workspace — the
 * debate-ai equivalent of qwksearch-web's `Providers`, minus the pieces the
 * host app already supplies globally (theme provider, toaster, category
 * dock) and with the guest auth client in place of better-auth.
 */
export function QwksearchProviders({ children }: { children: ReactNode }) {
  return (
    <GrabBaseScope>
      <SessionProvider authClient={authClient} enableGoogleOneTap={false}>
        <ExtractPanelProvider>
          <ChatProvider>
            <SettingsModalProvider>
              <MainViewProvider>{children}</MainViewProvider>
            </SettingsModalProvider>
          </ChatProvider>
        </ExtractPanelProvider>
      </SessionProvider>
    </GrabBaseScope>
  )
}
