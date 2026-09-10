import { ReasonEditorScreen } from "@/components/reason-editor/ReasonEditorScreen"

/**
 * Native REASON editor route — the debate-editor (TipTap/CardMirror) shell
 * wired to per-user document persistence (/api/doc/documents). Reachable
 * from the Settings menu alongside the existing /doc iframe.
 *
 * The screen itself lives in `ReasonEditorScreen` (`components/reason-editor`)
 * so it stays a single implementation.
 */
export default function ReasonEditorPage() {
  return <ReasonEditorScreen />
}
