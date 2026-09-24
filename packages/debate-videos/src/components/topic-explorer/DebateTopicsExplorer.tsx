/**
 * @fileoverview Browsable, searchable timeline of every season's debate
 * resolutions (Policy, College/NDT, LD, PF) alongside that year's video
 * numbers, for the Topic & Video Statistics page (`/videos/statistics`).
 * @module components/topic-explorer/DebateTopicsExplorer
 */

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { buildCardsSearchHref } from "debate-research-evidence/src/lib/search-query";
import { Input } from "../../ui/primitives/input";
import { Button } from "../../ui/primitives/button";
import { Badge } from "../../ui/primitives/badge";
import { Timeline, type TimelineEntry } from "../timeline/Timeline";
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

/** One year's row of `/api/youtube-stats`'s `byYear`. */
export interface YearVideoStats {
  year: string;
  totalViews: number;
  videoCount: number;
  avgViewsPerVideo: number;
}

export interface DebateTopicsExplorerProps {
  /** Every season's resolutions, from `/api/videos/meta`'s `topics` field.
   *  `undefined` while that request is still in flight. */
  topics: DebateTopicYear[] | undefined;
  /** `/api/youtube-stats`'s `byYear`, when that optional fetch resolved —
   *  shown in each year's pane. Omitted, the panes carry topics only. */
  videoStatsByYear?: YearVideoStats[];
  /** Year selected on first render; defaults to the newest shown. */
  defaultYear?: DebateTopicYear["year"];
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

const compactNumber = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

/**
 * A timeline of debate resolutions — a rail of every year beside the
 * selected year's topics and video numbers — filterable by year, topic text
 * or style. Pure presentational component — `topics` is passed down from
 * {@link LecturesPage}'s own `/api/videos/meta` fetch (`useVideoMeta`) so
 * this doesn't duplicate that request.
 */
export function DebateTopicsExplorer({ topics, videoStatsByYear, defaultYear }: DebateTopicsExplorerProps) {
  const [search, setSearch] = useState("");
  const [styleFilter, setStyleFilter] = useState<StyleFilter>("all");
  // Held as the year, not an index, so the selection survives filtering.
  const [activeYear, setActiveYear] = useState<string | undefined>(
    defaultYear === undefined ? undefined : String(defaultYear),
  );

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

  const statsByYear = useMemo(
    () => new Map((videoStatsByYear ?? []).map((row) => [String(row.year), row])),
    [videoStatsByYear],
  );

  const timelineItems: TimelineEntry[] = filteredYears.map((entry) => ({
    key: String(entry.year),
    label: String(entry.year),
  }));
  const activeIndex = Math.max(0, timelineItems.findIndex((item) => item.key === activeYear));

  const renderYear = (item: TimelineEntry, index: number) => {
    const entry = filteredYears[index]!;
    const stats = statsByYear.get(item.key);
    return (
      <div className="grid w-full grid-cols-1 items-start gap-6 lg:grid-cols-11">
        <div className="flex flex-col items-start gap-3 lg:col-span-4 xl:ps-10">
          <Badge variant="secondary" className="h-6 rounded-full px-2 py-1 font-normal">
            Season
          </Badge>
          <h3 className="text-5xl font-medium tracking-tight text-foreground lg:text-8xl">{entry.year}</h3>
          {stats ? (
            <dl className="grid w-full max-w-sm grid-cols-3 gap-3 pt-2">
              {[
                ["Videos", stats.videoCount],
                ["Views", stats.totalViews],
                ["Avg views", stats.avgViewsPerVideo],
              ].map(([label, value]) => (
                <div key={label} className="rounded-lg border border-border bg-muted/40 p-3">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-lg font-semibold tabular-nums text-foreground">
                    {compactNumber.format(Number(value))}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7">
          {visibleStyles.map((style) => {
            const items = getStyleTopicItems(entry, style);
            if (items.length === 0) return null;
            return (
              <div key={style} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className="mt-0.5 shrink-0">
                  {DEBATE_STYLE_LABELS[style]}
                </Badge>
                <ul className="min-w-0 space-y-1">
                  {items.map((topic, i) => (
                    <li key={i} className="whitespace-pre-line text-muted-foreground">
                      <Link
                        href={topicSearchHref(entry.year, style, topic)}
                        title={`Search ${entry.year} ${DEBATE_STYLE_LABELS[style]} cards, outlines and rounds`}
                        className="block rounded-sm hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        {topic.title && (
                          <span className="font-medium text-foreground">
                            {topic.emoji && <span aria-hidden="true">{topic.emoji} </span>}
                            {topic.title}
                            {": "}
                          </span>
                        )}
                        {topic.month && <span>{topic.month}: </span>}
                        {topic.text}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

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

      <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by style">
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
        <Timeline
          label="Debate seasons"
          items={timelineItems}
          activeIndex={activeIndex}
          onActiveIndexChange={(i) => setActiveYear(timelineItems[i]?.key)}
          renderContent={renderYear}
        />
      )}
    </div>
  );
}
