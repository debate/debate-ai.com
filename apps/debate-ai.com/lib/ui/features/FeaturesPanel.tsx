/**
 * @fileoverview Features page panel — the single page that outlines every
 * user-facing surface in the app.
 *
 * The dock's Settings menu already links to most of these, but as a flat,
 * unexplained list of forty-odd items; `/research`, `/coach`, and
 * `/community-hub` each cover one slice. This panel is the whole map:
 * `feature-catalog.ts`'s `APP_FEATURES` grouped into categories, filtered by
 * one free-text box (which also matches each entry's route and hidden
 * search tags), with a jump-to-category row for skimming and a link to each
 * feature's long-form doc where one exists.
 *
 * The presentation is a marketing page rather than a settings list, using the
 * primitives in `./effects` — an aurora hero, counted-up totals, a ticker of
 * every surface, and spotlight cards that reveal as they scroll in. Their
 * colour comes from `globals.css`'s `--accent-hue` / `--accent-secondary-hue`
 * pair rather than a palette of the page's own, so the page reads as part of
 * the app in both light and dark.
 *
 * It has no store: every card just links to a surface that already manages
 * its own state.
 *
 * @module features/FeaturesPanel
 */

"use client";

import { useMemo, useState, type ComponentType } from "react";
import {
  BarChart3,
  Dumbbell,
  LayoutGrid,
  Library,
  Radar,
  Search,
  Table2,
  Trophy,
  Users,
} from "lucide-react";

import { Input } from "../primitives/input";
import { cn } from "../lib/utils";
import { EmptyState } from "../panels/panel-shell";
import { AuroraBackdrop, CountUp, Marquee, Pill, Reveal, SpotlightCard } from "./effects";
import {
  APP_FEATURES,
  buildFeatureCatalogSummaryText,
  buildFeatureSections,
  featureDocUrl,
  searchFeatures,
  type FeatureCategory,
  type FeatureEntry,
} from "./feature-catalog";

/**
 * A glyph per category, so a section is identifiable before its heading is
 * read. Keyed by the same slugs `FEATURE_CATEGORY_LABELS` uses.
 */
const CATEGORY_ICONS: Record<FeatureCategory, ComponentType<{ className?: string }>> = {
  workspaces: LayoutGrid,
  evidence: Library,
  collaboration: Users,
  round: Table2,
  intelligence: Radar,
  practice: Dumbbell,
  recognition: Trophy,
  standings: BarChart3,
};

/** Props for {@link FeaturesPanel}. */
export interface FeaturesPanelProps {
  /** Catalog to render; defaults to every feature in the app. */
  entries?: FeatureEntry[];
  /** Extra classes for the outer element. */
  className?: string;
}

/**
 * Renders the features page: a searchable, category-grouped outline of every
 * surface in the app.
 *
 * @param props - See {@link FeaturesPanelProps}.
 * @returns The features page element.
 */
export function FeaturesPanel({ entries = APP_FEATURES, className }: FeaturesPanelProps) {
  const [query, setQuery] = useState("");

  const sections = useMemo(
    () => buildFeatureSections(searchFeatures(entries, query)),
    [entries, query],
  );

  const allSections = useMemo(() => buildFeatureSections(entries), [entries]);

  // The header count describes the catalog, not the current filter, so it
  // stays a stable "how big is this app" answer while someone types.
  const summaryText = useMemo(
    () => buildFeatureCatalogSummaryText(allSections),
    [allSections],
  );

  const documentedCount = useMemo(
    () => entries.filter((entry) => entry.doc).length,
    [entries],
  );

  // Two ticker rows out of one list, so the second can run the other way and
  // the pair doesn't read as one long line wrapped twice.
  const tickerRows = useMemo(() => {
    const half = Math.ceil(entries.length / 2);
    return [entries.slice(0, half), entries.slice(half)].filter((row) => row.length > 0);
  }, [entries]);

  return (
    <div className={cn("da-features relative", className)} data-testid="features-panel">
      {/* `Reveal` renders its hidden state during SSR too, so without this the
          whole page would stay faded out for a reader with JS disabled — the
          reveal never runs to un-hide it. */}
      <noscript>
        <style>{`[data-da-reveal="hidden"]{opacity:1;transform:none}`}</style>
      </noscript>

      <section className="relative overflow-hidden px-4 pt-14 pb-10 sm:px-6 sm:pt-20 lg:px-8">
        <AuroraBackdrop />

        <div className="mx-auto max-w-4xl text-center">
          <Reveal>
            <Pill className="mb-5">
              <LayoutGrid className="size-3.5" />
              Every surface, one page
            </Pill>
          </Reveal>

          <Reveal delay={80}>
            <h1 className="text-4xl leading-[1.08] font-bold tracking-tight text-balance text-foreground sm:text-5xl">
              Everything the app does.
              <br />
              <span className="da-shimmer-text">In one place.</span>
            </h1>
          </Reveal>

          <Reveal delay={160}>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-pretty text-muted-foreground sm:text-lg">
              Search it by name, description, route, or the jargon you would actually type —
              or skim a category and open the surface straight from its card.
            </p>
          </Reveal>

          <Reveal delay={220}>
            <div className="relative mx-auto mt-8 max-w-xl">
              {/* Above the input, not just before it: the field's own
                  `backdrop-blur` paints a layer that would otherwise wash the
                  glyph out. */}
              <Search
                aria-hidden
                className="pointer-events-none absolute top-1/2 left-3.5 z-10 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search features by name, description, route, or keyword…"
                aria-label="Search features"
                className="h-11 rounded-full border-border bg-card/80 pl-10 backdrop-blur-sm"
              />
            </div>
          </Reveal>

          <Reveal delay={280}>
            <dl className="mx-auto mt-10 grid max-w-2xl grid-cols-3 gap-px overflow-hidden rounded-2xl border border-border bg-border">
              {[
                { label: "Features", value: entries.length },
                { label: "Categories", value: allSections.length },
                { label: "With full docs", value: documentedCount },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="bg-card/60 px-4 py-5 backdrop-blur-sm transition-colors hover:bg-card"
                >
                  <dt className="text-3xl font-bold tracking-tight tabular-nums text-foreground">
                    <CountUp value={stat.value} />
                  </dt>
                  <dd className="mt-1 text-[11px] tracking-wide text-muted-foreground uppercase">
                    {stat.label}
                  </dd>
                </div>
              ))}
            </dl>
          </Reveal>

          {/* The same sentence the page used to lead with. Now a footnote to
              the counted-up totals above, which say it faster. */}
          <Reveal delay={320}>
            <p className="sr-only">{summaryText}</p>
          </Reveal>
        </div>
      </section>

      {tickerRows.length > 0 ? (
        <section className="relative py-6" aria-hidden>
          <div className="space-y-3">
            {tickerRows.map((row, index) => (
              <Marquee key={index} durationSeconds={index === 0 ? 48 : 56} reverse={index === 1}>
                {row.map((entry) => (
                  <span
                    key={entry.id}
                    className="da-chip rounded-full border border-border bg-card/70 px-4 py-1.5 text-sm whitespace-nowrap text-muted-foreground"
                  >
                    {entry.title}
                  </span>
                ))}
              </Marquee>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mx-auto max-w-6xl px-4 pb-20 sm:px-6 lg:px-8">
        {sections.length > 1 ? (
          <Reveal>
            <nav
              aria-label="Jump to a category"
              className="mb-10 flex flex-wrap justify-center gap-2"
            >
              {sections.map((section) => {
                const Icon = CATEGORY_ICONS[section.category];
                return (
                  <a
                    key={section.category}
                    href={`#${section.category}`}
                    className="da-chip inline-flex items-center gap-1.5 rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm"
                  >
                    <Icon className="size-3.5" />
                    {section.label}
                    <span className="tabular-nums opacity-60">({section.entries.length})</span>
                  </a>
                );
              })}
            </nav>
          </Reveal>
        ) : null}

        {sections.length === 0 ? (
          <EmptyState title={`No features match "${query}".`} />
        ) : (
          <div className="flex flex-col gap-16">
            {sections.map((section) => {
              const Icon = CATEGORY_ICONS[section.category];
              return (
                <section key={section.category} id={section.category} className="scroll-mt-20">
                  <Reveal className="mx-auto mb-8 max-w-2xl text-center">
                    <span className="da-accent-fill mb-4 inline-flex size-10 items-center justify-center rounded-xl">
                      <Icon className="size-5" />
                    </span>
                    <h2 className="text-2xl font-semibold tracking-tight text-balance text-foreground">
                      {section.label}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-pretty text-muted-foreground">
                      {section.description}
                    </p>
                  </Reveal>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {section.entries.map((entry, index) => {
                      const docUrl = featureDocUrl(entry);
                      return (
                        <Reveal
                          key={entry.id}
                          // Stagger across the row, then restart — a long
                          // section shouldn't end up with a two-second delay
                          // on its last card.
                          delay={(index % 3) * 70}
                        >
                          <SpotlightCard className="h-full">
                            <div className="group/feature flex h-full flex-col p-5">
                              <a
                                href={entry.href}
                                className="text-sm font-semibold text-foreground transition-colors group-hover/feature:text-[var(--da-accent)]"
                              >
                                <span className="absolute inset-0" aria-hidden />
                                {entry.title}
                              </a>
                              <p className="mt-1.5 flex-1 text-xs leading-relaxed text-muted-foreground">
                                {entry.description}
                              </p>
                              <div className="relative mt-3 flex items-center justify-between gap-2">
                                <code className="text-[11px] text-muted-foreground">
                                  {entry.href}
                                </code>
                                {docUrl ? (
                                  <a
                                    href={docUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="da-accent-text text-[11px] underline underline-offset-2 opacity-80 transition-opacity hover:opacity-100"
                                  >
                                    Docs
                                  </a>
                                ) : null}
                              </div>
                            </div>
                          </SpotlightCard>
                        </Reveal>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
