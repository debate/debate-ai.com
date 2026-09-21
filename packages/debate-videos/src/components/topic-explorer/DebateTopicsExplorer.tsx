/**
 * @fileoverview Browsable, searchable list of every season's debate
 * resolutions (Policy, College/NDT, LD, PF), for the Topic & Video
 * Statistics page (`/videos/statistics`).
 * @module components/topic-explorer/DebateTopicsExplorer
 */

"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { Input } from "../../ui/primitives/input";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/primitives/card";
import { Badge } from "../../ui/primitives/badge";
import { DEBATE_STYLE_LABELS, type DebateStyle } from "../../types/videos";
import { getStyleTopicText, topicDisplayLines, type DebateTopicYear } from "../../lib/debate-topics";

/** Display order: Policy, College (NDT), LD, PF. */
const EXPLORER_STYLES: DebateStyle[] = [1, 4, 3, 2];

export interface DebateTopicsExplorerProps {
  /** Every season's resolutions, from `/api/videos/meta`'s `topics` field.
   *  `undefined` while that request is still in flight. */
  topics: DebateTopicYear[] | undefined;
}

/** True when any style's resolution text for `entry` contains `term`
 *  (already lowercased), or `entry.year` itself does. Exported for its own
 *  unit test, since a search box's filtering can't be driven through
 *  `renderToStaticMarkup`. */
export function entryMatches(entry: DebateTopicYear, term: string): boolean {
  if (String(entry.year).toLowerCase().includes(term)) return true;
  return EXPLORER_STYLES.some((style) => (getStyleTopicText(entry, style) ?? "").toLowerCase().includes(term));
}

/**
 * A year-by-year grid of debate resolutions, filterable by year or topic
 * text. Pure presentational component — `topics` is passed down from
 * {@link LecturesPage}'s own `/api/videos/meta` fetch (`useVideoMeta`) so
 * this doesn't duplicate that request.
 */
export function DebateTopicsExplorer({ topics }: DebateTopicsExplorerProps) {
  const [search, setSearch] = useState("");

  const sortedYears = useMemo(
    () => [...(topics ?? [])].sort((a, b) => Number(b.year) - Number(a.year)),
    [topics],
  );

  const filteredYears = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sortedYears;
    return sortedYears.filter((entry) => entryMatches(entry, term));
  }, [sortedYears, search]);

  return (
    <div>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Debate Topics by Year</h2>
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search year or topic…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 pr-8 h-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              aria-label="Clear search"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {topics === undefined ? (
        <p className="text-sm text-muted-foreground">Loading topics…</p>
      ) : filteredYears.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {sortedYears.length === 0 ? "No debate topics are available yet." : "No topics match your search."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredYears.map((entry) => (
            <Card key={String(entry.year)}>
              <CardHeader>
                <CardTitle className="text-base">{entry.year}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {EXPLORER_STYLES.map((style) => {
                  const text = getStyleTopicText(entry, style);
                  if (!text) return null;
                  return (
                    <div key={style} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="mt-0.5 shrink-0">
                        {DEBATE_STYLE_LABELS[style]}
                      </Badge>
                      <span className="whitespace-pre-line text-muted-foreground">
                        {topicDisplayLines(text)}
                      </span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
