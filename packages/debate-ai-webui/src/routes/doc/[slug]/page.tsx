import { WorkspaceScreen } from "../WorkspaceScreen"

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * A document in the research workspace, addressed by its own name —
 * `/doc/cp-answer-to-states`.
 *
 * The same workspace as `/doc`: which document the name refers to is resolved
 * in the browser (`lib/qwksearch/doc-paths`), because the documents live in
 * the reader's own `localStorage` and the server has nothing to look up. A
 * name that matches no file opens the workspace's usual document rather than
 * 404ing — a renamed or deleted file is a stale link, not an error page.
 */
export default function EditorDocumentPage() {
  return <WorkspaceScreen />
}
