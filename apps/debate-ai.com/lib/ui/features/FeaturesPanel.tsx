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
 * It has no store: every card just links to a surface that already manages
 * its own state.
 *
 * @module features/FeaturesPanel
 */

"use client";

import { useMemo, useState } from "react";

import { Input } from "../primitives/input";
import { cn } from "../lib/utils";
import {
  APP_FEATURES,
  buildFeatureCatalogSummaryText,
  buildFeatureSections,
  featureDocUrl,
  searchFeatures,
  type FeatureEntry,
} from "./feature-catalog";

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

  // The header count describes the catalog, not the current filter, so it
  // stays a stable "how big is this app" answer while someone types.
  const summaryText = useMemo(
    () => buildFeatureCatalogSummaryText(buildFeatureSections(entries)),
    [entries],
  );

  return (
    <div className={cn("p-4 sm:p-6", className)} data-testid="features-panel">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Features</h1>
      <p className="mb-1 text-sm text-muted-foreground">
        Everything the app does, in one place — search it, or skim a category.
      </p>
      <p className="mb-4 text-xs text-muted-foreground">{summaryText}</p>

      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search features by name, description, route, or keyword…"
        aria-label="Search features"
        className="mb-4 max-w-md"
      />

      {sections.length > 1 ? (
        <nav aria-label="Jump to a category" className="mb-6 flex flex-wrap gap-2">
          {sections.map((section) => (
            <a
              key={section.category}
              href={`#${section.category}`}
              className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              {section.label} ({section.entries.length})
            </a>
          ))}
        </nav>
      ) : null}

      {sections.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No features match &quot;{query}&quot;.
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {sections.map((section) => (
            <section key={section.category} id={section.category} className="scroll-mt-16">
              <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {section.label}
              </h2>
              <p className="mt-1 mb-3 text-sm text-muted-foreground">{section.description}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {section.entries.map((entry) => {
                  const docUrl = featureDocUrl(entry);
                  return (
                    <div
                      key={entry.id}
                      className="flex flex-col rounded-lg border border-border bg-card p-3 transition-colors hover:bg-accent"
                    >
                      <a href={entry.href} className="text-sm font-medium text-foreground">
                        {entry.title}
                      </a>
                      <p className="mt-1 flex-1 text-xs text-muted-foreground">{entry.description}</p>
                      <div className="mt-2 flex items-center justify-between gap-2">
                        <code className="text-[11px] text-muted-foreground">{entry.href}</code>
                        {docUrl ? (
                          <a
                            href={docUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                          >
                            Docs
                          </a>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
