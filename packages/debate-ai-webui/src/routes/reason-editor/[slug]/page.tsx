import { ReasonEditorScreen } from "../../../components/reason-editor/ReasonEditorScreen"

interface PageProps {
  params: Promise<{ slug: string }>
}

/**
 * A document addressed by its own name — `/reason-editor/cp-answer-to-states`
 * rather than `/reason-editor?topic=2`.
 *
 * The segment is resolved on the client, against the document list the
 * sidebar has already loaded (`lib/reason-docs/route-selection`): the files
 * are per-reader and the topic-starter catalogue is fetched by the same
 * provider, so there is nothing here for the server to look up. Every
 * segment renders the editor; one that names no file lands on the editor's
 * normal fallback rather than a 404, which is also what an outdated link to a
 * renamed file should do.
 */
export default function ReasonEditorDocumentPage() {
  return <ReasonEditorScreen />
}
