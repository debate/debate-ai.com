"use client"

// MUST stay the first import: sets the API base-URL global before
// research-agent-ui's bundled qwksearch-api-client captures it (see
// packages/debate-qwksearch/src/components/base-url.ts).
import "@debate-ai/qwksearch/components/base-url"

import { lazy, useSyncExternalStore, type ReactElement } from "react"

/**
 * The full qwksearch research workspace embedded at /doc: research chat,
 * the REASON docs editor with its files/outline sidebar, and the settings
 * modal — all talking to qwksearch.com's public API as a guest.
 *
 * Not mounted at the moment: `/doc` shows qwksearch.com in an iframe instead
 * (see `WorkspaceScreen`). Kept so the bundled workspace can come back.
 *
 * The workspace is pulled in with `import()` rather than a static import so
 * the server build can drop it entirely (see `Workspace` below).
 */
const loadWorkspace = async () => {
  const [{ QwksearchProviders }, { QwksearchWorkspace }, { SidebarWithAppDock }] = await Promise.all([
    import("@debate-ai/qwksearch/components/Providers"),
    import("@debate-ai/qwksearch/components/Workspace"),
    import("../../components/qwksearch/SidebarWithAppDock"),
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

/**
 * Renders the workspace in the browser only. It is browser-only UI whose
 * server render came out empty anyway, but rendering it on the server still
 * made the Worker import the whole ~7 MB workspace chunk, about 45 MB of
 * isolate memory against Cloudflare's 128 MB cap.
 */
export default function ResearchAgentEmbed() {
  const inBrowser = useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
  return inBrowser ? <Workspace /> : null
}
