import { QWKSEARCH_ORIGIN } from "../../components/qwksearch/base-url"

/**
 * The research workspace's page frame, shared by both of its routes: `/research/docs`,
 * and `/research/docs/<a document name>`. One screen with two addresses, so the frame
 * lives here rather than being written out twice.
 *
 * The page is quick search itself (qwksearch.com) in an iframe, rather than
 * the research-agent-ui workspace bundled into this app
 * (`ResearchAgentEmbed`, kept but no longer mounted). The site runs with its
 * own session and its own documents, and the app's generic sidebar wraps the
 * frame like any other tool page, which is where the dock sits.
 */
export function WorkspaceScreen() {
  return (
    <div className="h-screen flex flex-col pb-20 lg:pb-0">
      <iframe
        src={QWKSEARCH_ORIGIN}
        title="Quick search"
        className="block w-full flex-1 min-h-0 border-0"
        allow="clipboard-read; clipboard-write; microphone; fullscreen"
        referrerPolicy="strict-origin-when-cross-origin"
      />
    </div>
  )
}
