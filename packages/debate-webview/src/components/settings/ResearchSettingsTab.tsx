"use client"

// MUST stay the first import: sets the API base-URL global before
// research-agent-ui's bundled qwksearch-api-client captures it.
import "../qwksearch/base-url"

import { lazy, Suspense, useSyncExternalStore } from "react"
import { QwksearchProviders } from "../qwksearch/Providers"
import { AnimatedLoader } from "../ui/AnimatedLoader"

// The research panes are ~670 kB minified, so they load with the first
// research tab opened rather than with `/settings`.
const ResearchSettingsSection = lazy(() => import("../qwksearch/Settings/ResearchSettingsSection"))

const subscribeNever = () => () => {}

/**
 * One research-agent settings section as a tab of `/settings`.
 *
 * Browser-only: the panes read the agent's guest session and talk to
 * qwksearch.com's API, neither of which exists on the server.
 */
export function ResearchSettingsTab({ section }: { section: string }) {
  const inBrowser = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )

  const loader = (
    <div className="flex w-full items-center justify-center py-10">
      <AnimatedLoader />
    </div>
  )

  if (!inBrowser) return loader

  return (
    <QwksearchProviders>
      <Suspense fallback={loader}>
        <ResearchSettingsSection key={section} sectionKey={section} />
      </Suspense>
    </QwksearchProviders>
  )
}
