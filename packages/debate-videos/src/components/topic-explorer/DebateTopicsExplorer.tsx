/**
 * @fileoverview Browsable, searchable list of every season's debate
 * resolutions (Policy, College/NDT, LD, PF), for the Topic & Video
 * Statistics page (`/videos/statistics`).
 * @module components/topic-explorer/DebateTopicsExplorer
 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { buildCardsSearchHref } from "debate-research-evidence/src/lib/search-query";
import { Input } from "../../ui/primitives/input";
import { Button } from "../../ui/primitives/button";
import { Card, CardContent, CardHeader, CardTitle } from "../../ui/primitives/card";
import { Badge } from "../../ui/primitives/badge";
import { DEBATE_STYLE_LABELS, type DebateStyle } from "../../types/videos";
import {
  getStyleTopicItems,
  getStyleTopicText,
  type DebateTopicYear,
  type TopicItem,
} from "../../lib/debate-topics";

/** Display order: Policy, College (NDT), LD, PF. */
const EXPLORER_STYLES: DebateStyle[] = [1, 4, 3, 2];

/** Each explorer style's value for the CARDS search's `event` filter. */
const STYLE_SEARCH_EVENT: Record<DebateStyle, string> = {
  1: "CX",
  2: "PF",
  3: "LD",
  4: "NDT",
};

/** The `/cards` search for one resolution: its short title (or, untitled, its
 *  full text) as the term, narrowed to that season and format. Every card,
 *  outline and round in that slice of the corpus comes back. Exported for its
 *  own unit test. */
export function topicSearchHref(year: DebateTopicYear["year"], style: DebateStyle, item: TopicItem): string {
  return buildCardsSearchHref({
    q: item.title ?? item.text,
    year,
    event: STYLE_SEARCH_EVENT[style],
  });
}

export interface DebateTopicsExplorerProps {
  /** Every season's resolutions, from `/api/videos/meta`'s `topics` field.
   *  `undefined` while that request is still in flight. */
  topics: DebateTopicYear[] | undefined;
}

/** The style filter's own value type: every real `DebateStyle`, plus "all". */
export type StyleFilter = DebateStyle | "all";

/** True when any style's resolution title or text for `entry` contains `term`
 *  (already lowercased), or `entry.year` itself does. `styles` narrows which
 *  styles' text counts as a match — defaults to every explorer style, so a
 *  bare search box still searches everything. Exported for its own unit
 *  test, since a search box's filtering can't be driven through
 *  `renderToStaticMarkup`. */
export function entryMatches(entry: DebateTopicYear, term: string, styles: DebateStyle[] = EXPLORER_STYLES): boolean {
  if (String(entry.year).toLowerCase().includes(term)) return true;
  return styles.some((style) =>
    getStyleTopicItems(entry, style).some((item) =>
      [item.title, item.text].some((s) => (s ?? "").toLowerCase().includes(term)),
    ),
  );
}

/** True when `entry` should survive `styleFilter` — always true for "all",
 *  otherwise only when the entry actually has a resolution for that style
 *  (a year with no Policy topic drops out of "Policy" instead of showing an
 *  empty card). Exported for its own unit test, same reason as
 *  {@link entryMatches}. */
export function matchesStyleFilter(entry: DebateTopicYear, styleFilter: StyleFilter): boolean {
  if (styleFilter === "all") return true;
  return !!getStyleTopicText(entry, styleFilter);
}

/**
 * A year-by-year grid of debate resolutions, filterable by year or topic
 * text. Pure presentational component — `topics` is passed down from
 * {@link LecturesPage}'s own `/api/videos/meta` fetch (`useVideoMeta`) so
 * this doesn't duplicate that request.
 */
export function DebateTopicsExplorer({ topics }: DebateTopicsExplorerProps) {
  const [search, setSearch] = useState("");
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("all");

  const sortedYears = useMemo(
    () => [...(topics ?? [])].sort((a, b) => Number(b.year) - Number(a.year)),
    [topics],
  );

  const visibleStyles = styleFilter === "all" ? EXPLORER_STYLES : [styleFilter];

  const filteredYears = useMemo(() => {
    const term = search.trim().toLowerCase();
    return sortedYears.filter((entry) => {
      if (!matchesStyleFilter(entry, styleFilter)) return false;
      if (!term) return true;
      return entryMatches(entry, term, visibleStyles);
    });
  }, [sortedYears, search, styleFilter, visibleStyles]);

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

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filter by style">
        <Button
          type="button"
          size="sm"
          variant={styleFilter === "all" ? "default" : "outline"}
          aria-pressed={styleFilter === "all"}
          onClick={() => setStyleFilter("all")}
        >
          All
        </Button>
        {EXPLORER_STYLES.map((style) => (
          <Button
            key={style}
            type="button"
            size="sm"
            variant={styleFilter === style ? "default" : "outline"}
            aria-pressed={styleFilter === style}
            onClick={() => setStyleFilter(style)}
          >
            {DEBATE_STYLE_LABELS[style]}
          </Button>
        ))}
      </div>

      {topics === undefined ? (
        <p className="text-sm text-muted-foreground">Loading topics…</p>
      ) : filteredYears.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {sortedYears.length === 0 ? "No debate topics are available yet." : "No topics match your search or filter."}
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {filteredYears.map((entry) => (
            <Card key={String(entry.year)}>
              <CardHeader>
                <CardTitle className="text-base">{entry.year}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {visibleStyles.map((style) => {
                  const items = getStyleTopicItems(entry, style);
                  if (items.length === 0) return null;
                  return (
                    <div key={style} className="flex items-start gap-2 text-sm">
                      <Badge variant="outline" className="mt-0.5 shrink-0">
                        {DEBATE_STYLE_LABELS[style]}
                      </Badge>
                      <ul className="min-w-0 space-y-1">
                        {items.map((item, i) => (
                          <li key={i} className="whitespace-pre-line text-muted-foreground">
                            <Link
                              href={topicSearchHref(entry.year, style, item)}
                              title={`Search ${entry.year} ${DEBATE_STYLE_LABELS[style]} cards, outlines and rounds`}
                              className="block rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              {item.title && (
                                <span className="font-medium text-foreground">
                                  {item.emoji && <span aria-hidden="true">{item.emoji} </span>}
                                  {item.title}
                                  {": "}
                                </span>
                              )}
                              {item.month && <span>{item.month}: </span>}
                              {item.text}
                            </Link>
                          </li>
                        ))}
                      </ul>
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
