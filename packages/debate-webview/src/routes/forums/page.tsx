import { MessagesSquare } from "lucide-react"

import { ForumsHub } from "../../components/forums/ForumsHub"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * The forum: the form that opens a thread, and the feed of every thread so far,
 * ordered by when each was last posted to.
 *
 * `ToolPageHeader` takes the title, description and icon explicitly because
 * `/forums` is not in the `/tools` catalog — it is a destination in the sidebar
 * tree and the dock's Settings menu, not one of the catalogued tools, and the
 * header's fallbacks all come from that catalog.
 */
export default function ForumsPage() {
  return (
    <ToolPage>
      <ToolPageHeader
        href="/forums"
        backHref="/tools"
        backLabel="tools"
        title="Forums"
        description="Ask the people who argue about this for a living. Post a thread, and the replies live under it."
        icon={MessagesSquare}
        guide="research-collaboration"
      />
      <ForumsHub />
    </ToolPage>
  )
}
