import { ReasonEditorScreen } from "@debate-ai/reason-docs/editor/ReasonEditorScreen"

/**
 * A personal file's address — `/<username>/<folder path>/<doc slug>`
 * (e.g. `/alexgul/aff/k-aff-answers`).
 *
 * Renders the same editor screen as `/reason-editor`; `ReasonDocsRouteSync`
 * reads the file's path off the address bar and opens it against the reader's
 * own documents (and the public library). The username is the file's
 * namespace (`lib/reason-docs/personal-doc-paths` in @debate-ai/reason-docs).
 */
export default function PersonalDocsPage() {
  return <ReasonEditorScreen />
}
