import { Rss } from "lucide-react"

import { ForumsHub } from "../../components/forums/ForumsHub"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * Latest News: the form that opens a thread, and the feed of every thread so
 * far, ordered by when each was last posted to.
 *
 * The feed is the news — a new post is an event, and ordering by last activity
 * puts the live argument at the top, which is the only ordering that makes a
 * "latest" list correct as the day goes on. The route is still `/practice/forums`:
 * threads and their replies are a discussion, and renaming the URL would break
 * every link already out there for no gain in meaning.
 *
 * `ToolPageHeader` takes the title, description and icon explicitly because
 * `/practice/forums` is not in the `/tools` catalog — it is a destination in the sidebar
 * tree and the dock's Settings menu, not one of the catalogued tools, and the
 * header's fallbacks all come from that catalog.
 */
export default function ForumsPage() {
  return (
    <ToolPage>
      <ToolPageHeader
        href="/practice/forums"
        backHref="/debate"
        backLabel="round workspace"
        title="Latest News"
        description="What the people who argue about this for a living are saying right now — newest activity first. Post a thread, and the replies live under it."
        icon={Rss}
        guide="research-collaboration"
      />
      <ForumsHub />
    </ToolPage>
  )
}
