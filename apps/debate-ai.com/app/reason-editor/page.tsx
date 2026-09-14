import { ReasonEditorScreen } from "@/components/reason-editor/ReasonEditorScreen"

/**
 * Native REASON editor route — the debate-editor (TipTap/CardMirror) shell
 * wired to per-user document persistence (/api/doc/documents). Reachable
 * from the Settings menu alongside the existing /doc iframe.
 *
 * No file named in the URL: the screen opens the reader's first document, and
 * `ReasonDocsRouteSync` then names it in the address bar as `?doc=<file
 * name>`. The path spelling of that same name, `/reason-editor/<file name>`,
 * is served by `[slug]/page.tsx` and resolves through the same lookup.
 *
 * The screen itself lives in `ReasonEditorScreen` (`components/reason-editor`)
 * so it stays a single implementation.
 */
export default function ReasonEditorPage() {
  return <ReasonEditorScreen />
}
