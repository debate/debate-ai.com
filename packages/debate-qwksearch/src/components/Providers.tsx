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
import { authClient, useQwkSearchConnectOutcome, useQwkSearchSession } from "./connect-auth"
import { GrabBaseScope } from "./GrabBaseScope"
import { MainViewProvider } from "./MainViewProvider"
import { SettingsModalProvider } from "./Settings/SettingsModal"

configureResearchAgentUI({
  appName: "Debate AI",
  getAutoMediaSearch: () => true,
})

/**
 * Holds the embed back until the linked QwkSearch account (if any) is known,
 * so its first requests — the model list, chat history — already carry the
 * user's key instead of running as a guest. One same-origin request.
 */
function ConnectSessionGate({ children }: { children: ReactNode }) {
  const { isPending } = useQwkSearchSession()
  return isPending ? null : <>{children}</>
}

/**
 * Provider stack for the embedded qwksearch research workspace — the
 * debate-ai equivalent of qwksearch-web's `Providers`, minus the pieces the
 * host app already supplies globally (theme provider, toaster, category
 * dock) and with the "Sign in with QwkSearch" connect client in place of
 * better-auth.
 */
export function QwksearchProviders({ children }: { children: ReactNode }) {
  useQwkSearchConnectOutcome()
  return (
    <GrabBaseScope>
      <ConnectSessionGate>
        <SessionProvider authClient={authClient} enableGoogleOneTap={false}>
          <ExtractPanelProvider>
            <ChatProvider>
              <SettingsModalProvider>
                <MainViewProvider>{children}</MainViewProvider>
              </SettingsModalProvider>
            </ChatProvider>
          </ExtractPanelProvider>
        </SessionProvider>
      </ConnectSessionGate>
    </GrabBaseScope>
  )
}
