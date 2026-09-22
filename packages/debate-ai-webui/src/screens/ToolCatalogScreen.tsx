/**
 * @fileoverview The tool catalog — the app's `/features` page, embedded.
 *
 * Unlike every other screen here this one needs no network: the catalog is
 * `debate-feature-catalog`, the same pure data the live `/features` page and
 * the News Stream spotlights read, so an embedded host can list every surface
 * in the app while offline and still link each one into the deployment it is
 * configured against.
 *
 * @module screens/ToolCatalogScreen
 */

import { useMemo, useState } from "react";
import {
  APP_FEATURES,
  buildFeatureCatalogSummaryText,
  buildFeatureSections,
  searchFeatures,
} from "debate-feature-catalog";

import { SearchField } from "../primitives";
import type { WebUIContext } from "../types";

export function ToolCatalogScreen({ openRoute }: WebUIContext) {
  const [query, setQuery] = useState("");

  const sections = useMemo(
    () => buildFeatureSections(searchFeatures(APP_FEATURES, query)),
    [query],
  );

  // The header count describes the catalog rather than the current filter, so
  // it stays a stable "how big is this app" answer while someone types — the
  // same choice the live /features page makes.
  const summary = useMemo(() => buildFeatureCatalogSummaryText(buildFeatureSections()), []);

  return (
    <>
      <SearchField
        id="dai-tools-q"
        label="Find a tool"
        placeholder="flow, rfd, verbatim, drills…"
        value={query}
        onChange={setQuery}
        hint={summary}
      />

      {sections.length === 0 ? (
        <p className="dai-muted">No tool matches that search.</p>
      ) : (
        sections.map((section) => (
          <section className="dai-section" key={section.category}>
            <h3 className="dai-section-title">{section.label}</h3>
            <p className="dai-section-description">{section.description}</p>
            <div className="dai-grid">
              {section.entries.map((entry) => (
                <button
                  type="button"
                  className="dai-tool"
                  key={entry.id}
                  onClick={() => openRoute(entry.href)}
                >
                  <span className="dai-tool-title">{entry.title}</span>
                  <span className="dai-tool-description">{entry.description}</span>
                  <span className="dai-tool-route">{entry.href}</span>
                </button>
              ))}
            </div>
          </section>
        ))
      )}
    </>
  );
}
