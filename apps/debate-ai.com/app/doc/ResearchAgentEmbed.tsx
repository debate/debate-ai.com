"use client"

// MUST stay the first import: sets the API base-URL global before
// research-agent-ui's bundled qwksearch-api-client captures it (see
// components/qwksearch/base-url.ts).
import "@/components/qwksearch/base-url"

import { QwksearchProviders } from "@/components/qwksearch/Providers"
import { QwksearchWorkspace } from "@/components/qwksearch/Workspace"

/**
 * The full qwksearch research workspace embedded at /doc: research chat,
 * the REASON docs editor with its files/outline sidebar, and the settings
 * modal — all talking to qwksearch.com's public API as a guest.
 */
export default function ResearchAgentEmbed() {
  return (
    <QwksearchProviders>
      <QwksearchWorkspace />
    </QwksearchProviders>
  )
}
