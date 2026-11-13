import { ReasonEditorScreen } from "@debate-ai/reason-docs/editor/ReasonEditorScreen"

/**
 * A personal file's shareable, sellable address —
 * `/<username>/<side>/<slug>` (e.g. `/alexgul/aff/aca-affirmative-msci-2026`).
 *
 * Renders the same editor screen as `/reason-editor`; `ReasonDocsRouteSync`
 * reads the file's slug off the address bar and opens it against the reader's
 * own documents (and the public library). The username and side are the file's
 * namespace, so a shared or sold link names a file that each reader resolves
 * against their own library.
 */
export default function PersonalDocsPage() {
  return <ReasonEditorScreen />
}
