"use client"

// MUST stay the first import: sets the API base-URL global before
// research-agent-ui's bundled qwksearch-api-client captures it (see
// packages/debate-qwksearch/src/components/base-url.ts).
import "@debate-ai/qwksearch/components/base-url"

import { lazy, Suspense, useSyncExternalStore, type ReactElement } from "react"
import { WorkspaceLoading } from "./WorkspaceLoading"

/**
 * The full qwksearch research workspace at /research/docs, rendered directly
 * as React components (no iframe): research chat, the REASON docs editor with
 * its files/outline sidebar, and the settings modal — all talking to
 * qwksearch.com's public API.
 *
 * The workspace is pulled in with `import()` rather than a static import so
 * the server build can drop it entirely (see `Workspace` below). Its chunks
 * are several megabytes, so until they arrive the page shows
 * {@link WorkspaceLoading} (the orbital sphere and a progress bar) rather than
 * an empty page.
 */

/** How many of the workspace's dynamic imports have resolved, for the bar. */
const WORKSPACE_IMPORTS = 3
let importsLoaded = 0
const progressListeners = new Set<() => void>()

function markImportLoaded<T>(module: T): T {
  importsLoaded = Math.min(WORKSPACE_IMPORTS, importsLoaded + 1)
  for (const listener of progressListeners) listener()
  return module
}

function subscribeProgress(listener: () => void) {
  progressListeners.add(listener)
  return () => {
    progressListeners.delete(listener)
  }
}

const readProgress = () => importsLoaded
const readServerProgress = () => 0

const loadWorkspace = async () => {
  const [{ QwksearchProviders }, { QwksearchWorkspace }, { SidebarWithAppDock }] = await Promise.all([
    import("@debate-ai/qwksearch/components/Providers").then(markImportLoaded),
    import("@debate-ai/qwksearch/components/Workspace").then(markImportLoaded),
    import("../../components/qwksearch/SidebarWithAppDock").then(markImportLoaded),
  ])

  return {
    default: function EmbeddedWorkspace() {
      return (
        <QwksearchProviders>
          <QwksearchWorkspace SidebarComponent={SidebarWithAppDock} />
        </QwksearchProviders>
      )
    },
  }
}

/**
 * The server never renders the workspace (see below), so the server build
 * swaps the loader for a stub. `import.meta.env.SSR` is a literal `true`
 * there, which drops the `import()`s above from the Worker entirely: the
 * workspace, react-reason-editor and everything they pull in (~15 MB of
 * modules). The Worker holds every module's source in memory whether it runs
 * or not, so leaving them in cost that much of the 128 MB isolate cap.
 */
const Workspace = lazy<() => ReactElement | null>(
  import.meta.env.SSR ? async () => ({ default: () => null }) : loadWorkspace,
)

const subscribeNever = () => () => {}

function WorkspaceProgress() {
  const loaded = useSyncExternalStore(subscribeProgress, readProgress, readServerProgress)
  return <WorkspaceLoading loaded={loaded} total={WORKSPACE_IMPORTS} />
}

/**
 * Renders the workspace in the browser only. It is browser-only UI whose
 * server render came out empty anyway, but rendering it on the server still
 * made the Worker import the whole ~7 MB workspace chunk, about 45 MB of
 * isolate memory against Cloudflare's 128 MB cap. The server (and the first
 * client render) draws the loader instead, so the page is never blank.
 */
export default function ResearchAgentEmbed() {
  const inBrowser = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
  if (!inBrowser) return <WorkspaceProgress />
  return (
    <Suspense fallback={<WorkspaceProgress />}>
      <Workspace />
    </Suspense>
  )
}
