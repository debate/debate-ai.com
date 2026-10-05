"use client"

// MUST stay the first import: sets the API base-URL global before
// research-agent-ui's bundled qwksearch-api-client captures it.
import "../base-url"

import { lazy, Suspense, useSyncExternalStore } from "react"
import { useRouter } from "next/navigation"
import { QwksearchProviders } from "../Providers"
import { AnimatedLoader } from "../../ui/AnimatedLoader"

// The settings panes are ~670 kB minified (the MCP section alone bundles the
// whole OpenConnector provider index), so they load with this page rather
// than with the /doc workspace.
const SettingsContent = lazy(() => import("./SettingsContent"))

const subscribeNever = () => () => {}

/**
 * The research agent's settings as a full page: the section tabs down the
 * side (a select on small screens) and the active section filling the rest.
 *
 * Browser-only, like the workspace: the panes read the agent's guest session
 * and talk to qwksearch.com's API, neither of which exists on the server, and
 * rendering them there would pull the whole settings bundle into the Worker.
 */
export function ResearchSettingsPage({ section }: { section?: string }) {
  const router = useRouter()
  const inBrowser = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )

  const loader = (
    <div className="flex h-full w-full items-center justify-center">
      <AnimatedLoader />
    </div>
  )

  return (
    // Clear of the floating app dock at the top-left, and of the mobile dock
    // fixed to the bottom.
    <div className="h-screen bg-background pt-14 pb-20 md:pb-0">
      <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden">
        {inBrowser ? (
          <QwksearchProviders>
            <Suspense fallback={loader}>
              <SettingsContent
                // Re-mount per section so a deep link picks the right initial tab.
                key={section ?? "default"}
                initialSection={section}
                onClose={() => router.push("/doc")}
              />
            </Suspense>
          </QwksearchProviders>
        ) : (
          loader
        )}
      </div>
    </div>
  )
}
