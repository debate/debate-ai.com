"use client"

// MUST stay the first import: sets the API base-URL global before
// research-agent-ui's bundled qwksearch-api-client captures it (see
// components/qwksearch/base-url.ts).
import "../../components/qwksearch/base-url"

import { lazy, useSyncExternalStore } from "react"

/**
 * The full qwksearch research workspace embedded at /doc: research chat,
 * the REASON docs editor with its files/outline sidebar, and the settings
 * modal — all talking to qwksearch.com's public API as a guest.
 *
 * The workspace is pulled in with `import()` rather than a static import so
 * that `Prism` is on the global object before any of it evaluates. Deep
 * inside research-agent-ui, `extract-webpage` registers syntax-highlighting
 * grammars by importing `prismjs/components/*` — plain browser scripts that
 * read `Prism` as a free variable off the global object rather than importing
 * it. Nothing in the module graph pins them after whoever publishes that
 * global, so once the bundler splits this route into its own chunk the two can
 * land in either order; when they land the wrong way round the chunk throws
 * `ReferenceError: Prism is not defined` while it is still evaluating and /doc
 * renders nothing but the route error boundary. Awaiting the publication here
 * makes the order a fact rather than something the bundler happens to get
 * right.
 */
const Workspace = lazy(async () => {
  const { default: Prism } = await import("prismjs")
  ;(globalThis as typeof globalThis & { Prism?: unknown }).Prism ??= Prism

  const [{ QwksearchProviders }, { QwksearchWorkspace }] = await Promise.all([
    import("../../components/qwksearch/Providers"),
    import("../../components/qwksearch/Workspace"),
  ])

  return {
    default: function EmbeddedWorkspace() {
      return (
        <QwksearchProviders>
          <QwksearchWorkspace />
        </QwksearchProviders>
      )
    },
  }
})

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
