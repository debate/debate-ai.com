import { WorkspaceScreen } from "./WorkspaceScreen"

/**
 * The workspace with no document named in the URL. Opening one renames the
 * address to `/doc/<its title>` in place — the route below.
 */
export default function EditorPage() {
  return <WorkspaceScreen />
}
