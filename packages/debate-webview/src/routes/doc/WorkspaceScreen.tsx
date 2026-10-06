import { ToolSyncBadge } from "../../components/tools/ToolSyncBadge"
import ResearchAgentEmbed from "./ResearchAgentEmbed"

/** The route the workspace's account-synced collections (chat tabs, file sources) are filed under. */
export const DOC_SYNC_HREF = "/research/docs"

/**
 * The research workspace's page frame, shared by both of its routes: `/research/docs`,
 * and `/research/docs/<a document name>`. One screen with two addresses, so the frame
 * lives here rather than being written out twice.
 *
 * The page is the research agent (`research-agent-ui`'s workspace), bundled
 * into this app. It renders its own full-height chrome, so the generic tool
 * sidebar skips it (`hostsOwnSidebarDock`): the sidebar on this page is the
 * research agent's files tree and "Open Tabs" list, with the app dock hosted
 * at the top of it. The agent's own app dock is not mounted here — that dock
 * is this app's — and its settings open as this app's `/settings/research`
 * pages (`SettingsModalProvider`).
 *
 * The workspace has no header slot, so the "Saved to your account" badge (and
 * "Save now" when something is unsaved) floats in the bottom-right corner. It
 * covers the collections filed under `/research/docs` (open chat tabs, file
 * sources).
 */
export function WorkspaceScreen() {
  return (
    <div className="relative h-screen">
      <ResearchAgentEmbed />
      <div className="pointer-events-none fixed bottom-3 right-3 z-40 flex items-center gap-1.5 [&>*]:pointer-events-auto" data-doc-sync-actions>
        <ToolSyncBadge href={DOC_SYNC_HREF} />
      </div>
    </div>
  )
}
