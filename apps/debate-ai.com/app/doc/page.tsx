import type { Metadata } from "next"
import { WorkspaceScreen } from "./WorkspaceScreen"

export const metadata: Metadata = {
  title: "REASON Docs",
  description: "Research Editor for Annotated Summaries in Outline Notation",
}

/**
 * The workspace with no document named in the URL. Opening one renames the
 * address to `/doc/<its title>` in place — the route below.
 */
export default function EditorPage() {
  return <WorkspaceScreen />
}
