/**
 * @fileoverview Community Research Hub panel — the UI for the "Community
 * Research Hub" bullet under Research Crowdsourcing Organizer Features in
 * TODO.md ("A shared space where debaters contribute cards, evidence, and
 * summaries to a common argument pool").
 *
 * Every sibling bullet under that heading already has its own panel and
 * route, and `/research`'s `ResearchHub` already tabs across the
 * card-search-side ones. This panel is the directory neither of those is:
 * a single, searchable list of every one of those spaces — including the
 * round/practice-side ones `ResearchHub` doesn't cover (Opponent/Judge
 * Profiles, AI Coach Mode, Practice Round Simulator, AI Drill Generator) —
 * grouped into categories, backed by `lib/community-research-hub.ts`'s pure
 * `COMMUNITY_RESEARCH_HUB_ENTRIES`/`buildCommunityResearchHubSections`/
 * `searchCommunityResearchHubEntries`. It has no store of its own: every
 * entry just links out to a space that already persists (or doesn't need
 * to persist) its own state.
 *
 * The `favoriteHrefs` prop closes TODO.md's "a personalized 'for you'
 * section" follow-up for this idea: when the viewer has already favorited
 * one of these spaces from `/tools`, `buildForYouEntries` surfaces it in a
 * "For You" strip above the full directory, hidden while a search is active
 * or when nothing's favorited (see that function's doc comment).
 *
 * @module panels/CommunityResearchHubPanel
 */

"use client"

import { useMemo, useState } from "react"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
import {
  buildCommunityResearchHubSections,
  buildCommunityResearchHubSummaryText,
  buildForYouEntries,
  searchCommunityResearchHubEntries,
  COMMUNITY_RESEARCH_HUB_ENTRIES,
} from "../lib/community-research-hub"

export interface CommunityResearchHubPanelProps {
  /**
   * The viewer's favorited tool hrefs (from `/tools`' star toggle), for the
   * "For You" section — the hub entries they've already starred, surfaced
   * above the full directory. This package can't read that state itself
   * (it's account-synced app-layer state owned by
   * `apps/debate-ai.com/lib/hooks/useFavoriteTools.ts`), so the app composes
   * it in here the same way `NewsPageContent` composes `extraItems` into
   * `NewsStreamPanel`. Defaults to `[]` (no "For You" section) so this panel
   * still renders standalone, e.g. in tests or a future embed that hasn't
   * wired favorites through yet.
   */
  favoriteHrefs?: string[]
}

/**
 * Renders the Community Research Hub: an optional "For You" section over the
 * viewer's own favorited spaces, then a search box over every crowdsourcing
 * and pre-round/practice space in the app, grouped by category.
 */
export function CommunityResearchHubPanel({ favoriteHrefs = [] }: CommunityResearchHubPanelProps = {}) {
  const [query, setQuery] = useState("")

  const sections = useMemo(() => {
    const matches = searchCommunityResearchHubEntries(COMMUNITY_RESEARCH_HUB_ENTRIES, query)
    return buildCommunityResearchHubSections(matches)
  }, [query])

  const summaryText = useMemo(
    () => buildCommunityResearchHubSummaryText(buildCommunityResearchHubSections()),
    [],
  )

  // Only shown against the unfiltered directory, and only while the search
  // box is empty — once someone's actively searching, the matched sections
  // below are already the relevant view; a "For You" strip above them would
  // just be noise unrelated to the query.
  const forYouEntries = useMemo(
    () => (query.trim() ? [] : buildForYouEntries(COMMUNITY_RESEARCH_HUB_ENTRIES, favoriteHrefs)),
    [query, favoriteHrefs],
  )

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Community Research Hub</h1>
      <p className="mb-1 text-sm text-muted-foreground">
        Every shared research, collaboration, and pre-round/practice space in one place.
      </p>
      <p className="mb-4 text-xs text-muted-foreground">{summaryText}</p>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by name or what it does…"
        aria-label="Search the Community Research Hub"
        className="mb-6 max-w-md"
      />

      {forYouEntries.length > 0 && (
        <div className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            For You
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {forYouEntries.map((entry) => (
              <a
                key={`for-you-${entry.id}`}
                href={entry.href}
                className="rounded-lg border border-primary/40 bg-card p-3 text-left transition-colors hover:bg-accent"
              >
                <div className="text-sm font-medium text-foreground">{entry.title}</div>
                <div className="mt-1 text-xs text-muted-foreground">{entry.description}</div>
              </a>
            ))}
          </div>
        </div>
      )}

      {sections.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No spaces match "{query}".
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {sections.map((section) => (
            <div key={section.category}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.entries.map((entry) => (
                  <a
                    key={entry.id}
                    href={entry.href}
                    className="rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-accent"
                  >
                    <div className="text-sm font-medium text-foreground">{entry.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{entry.description}</div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
