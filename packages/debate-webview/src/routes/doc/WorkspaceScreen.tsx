import ResearchAgentEmbed from "./ResearchAgentEmbed"

/**
 * The research workspace's page frame, shared by both of its routes: `/doc`,
 * and `/doc/<a document name>`. One screen with two addresses, so the frame
 * lives here rather than being written out twice.
 *
 * The page is the research agent (`research-agent-ui`'s workspace), bundled
 * into this app. It renders its own full-height chrome, so the generic tool
 * sidebar skips it (`hostsOwnSidebarDock`): the sidebar on this page is the
 * research agent's files tree and "Open Tabs" list, with the app dock hosted
 * at the top of it. The agent's own app dock is not mounted here — that dock
 * is this app's — and its settings open as this app's `/settings/research`
 * pages (`SettingsModalProvider`).
 */
export function WorkspaceScreen() {
  return (
    <div className="h-screen">
      <ResearchAgentEmbed />
    </div>
  )
}
