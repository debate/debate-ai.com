"use client"

/**
 * @fileoverview News & Forums — the News Stream and the community forums on
 * one tabbed page at `/news`, behind one sidebar row.
 *
 * They used to be two pages: the News Stream at `/news` (product updates,
 * Daily Best Card winners, Contributor Awards, followed teams) and the forums
 * at `/practice/forums`, which the sidebar listed as "Latest News". Both are
 * "what is new in the community", so they now sit side by side as one tab
 * each. `/practice/forums` redirects here with `?section=forums`; a single
 * thread still lives at `/practice/forums/<id>`.
 *
 * Navigation only, on the same tab strip and `?section=` URL sync as the Prep
 * Workspace (`components/hubs/HubSectionNav.tsx`).
 *
 * @module components/news/NewsAndForums
 */

import { MessagesSquare, Rss } from "lucide-react"
import { ForumsHub } from "@debate-ai/comments/forums/ui"
import { useSession } from "../../lib/hooks/useSession"
import { NewsPageContent } from "../../routes/news/NewsPageContent"
import { panel, type HubSection } from "../hubs/hub-sections"
import { HubSectionIntro, HubSectionNav, HubSectionPanel, useHubSection } from "../hubs/HubSectionNav"

/** localStorage key remembering the last open tab. */
const SECTION_KEY = "newsAndForumsSection"

/** One tab per feed. Also the `?section=` values. */
export type NewsAndForumsSectionId = "news" | "forums"

/** The page's tabs: the announcement feed first, then the discussion threads. */
export const NEWS_AND_FORUMS_SECTIONS: readonly HubSection<NewsAndForumsSectionId>[] = [
  {
    id: "news",
    label: "News",
    icon: Rss,
    description: "New rounds, new files, forum activity, and the teams you follow.",
    guide: "research-collaboration",
    panels: [panel("News Stream")],
  },
  {
    id: "forums",
    label: "Forums",
    icon: MessagesSquare,
    description: "What debaters are talking about right now, newest activity first. Post a thread, and the replies live under it.",
    guide: "research-collaboration",
    panels: [panel("Forums")],
  },
]

/**
 * The News & Forums URL for one tab.
 *
 * @param section - The tab to open.
 */
export function newsAndForumsHref(section: NewsAndForumsSectionId): string {
  return section === "news" ? "/news" : `/news?section=${section}`
}

/** Props for {@link NewsAndForums}. */
export interface NewsAndForumsProps {
  /** Tab to open when the URL names none (the old route's tab, outside Next). */
  initialSection?: NewsAndForumsSectionId
}

/**
 * Tabbed page over the News Stream and the forums.
 *
 * @param props - See {@link NewsAndForumsProps}.
 */
export function NewsAndForums({ initialSection }: NewsAndForumsProps) {
  const [section, setSection] = useHubSection(NEWS_AND_FORUMS_SECTIONS, SECTION_KEY, initialSection)
  const active = NEWS_AND_FORUMS_SECTIONS.find((entry) => entry.id === section) ?? NEWS_AND_FORUMS_SECTIONS[0]
  const { isAuthenticated } = useSession()

  return (
    <div className="flex flex-col gap-4">
      <HubSectionNav
        sections={NEWS_AND_FORUMS_SECTIONS}
        active={section}
        onChange={setSection}
        label="News and forums"
        showPanelCounts={false}
      />
      <HubSectionIntro section={active} />
      <HubSectionPanel id={section}>
        {section === "news" ? (
          <div className="mx-auto w-full max-w-2xl">
            <NewsPageContent />
          </div>
        ) : null}
        {section === "forums" ? <ForumsHub isAuthenticated={isAuthenticated} /> : null}
      </HubSectionPanel>
    </div>
  )
}

export default NewsAndForums
