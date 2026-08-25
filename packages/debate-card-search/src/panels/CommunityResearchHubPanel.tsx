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
 * @module panels/CommunityResearchHubPanel
 */

"use client"

import { useMemo, useState } from "react"
import { Input } from "debate-ui/src/primitives/input"
import {
  buildCommunityResearchHubSections,
  buildCommunityResearchHubSummaryText,
  searchCommunityResearchHubEntries,
  COMMUNITY_RESEARCH_HUB_ENTRIES,
} from "../lib/community-research-hub"

/**
 * Renders the Community Research Hub: a search box over every crowdsourcing
 * and pre-round/practice space in the app, grouped by category.
 */
export function CommunityResearchHubPanel() {
  const [query, setQuery] = useState("")

  const sections = useMemo(() => {
    const matches = searchCommunityResearchHubEntries(COMMUNITY_RESEARCH_HUB_ENTRIES, query)
    return buildCommunityResearchHubSections(matches)
  }, [query])

  const summaryText = useMemo(
    () => buildCommunityResearchHubSummaryText(buildCommunityResearchHubSections()),
    [],
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
