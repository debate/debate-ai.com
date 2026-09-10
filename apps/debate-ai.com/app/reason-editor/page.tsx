import { ReasonEditorScreen } from "@/components/reason-editor/ReasonEditorScreen"

/**
 * The editor with no file named in the URL — it opens the reader's first
 * document and, once it knows that file's title, renames the address to
 * `/reason-editor/<that title>` (see `ReasonDocsRouteSync`). Links from the
 * sidebar go straight to the named form below.
 */
export default function ReasonEditorPage() {
  return <ReasonEditorScreen />
}
