/**
 * @fileoverview Card search — the app's `/cards` workspace, narrowed to what
 * fits an embedded panel.
 *
 * Full-text search over the shared evidence index via `searchCards`, with the
 * scope switch the route's own page carries (all text, highlighted only,
 * underlined only, summaries) because that switch is the difference between
 * finding a card and finding every card that mentions a word in passing.
 *
 * Card bodies are HTML with `<mark>`/`<u>` in them, and this package does not
 * render them: an extension page has no sanitizer of its own, and an
 * `<div dangerouslySetInnerHTML>` over evidence someone else uploaded is an
 * XSS hole in a privileged page. The summary and citation are plain text, and
 * "Open in the app" hands the full card to the web app, which does have one.
 *
 * @module screens/CardSearchScreen
 */

import { useState } from "react";
import { searchCards, type DebateCard } from "debate-api-client";

import { unwrap } from "../api";
import { AsyncBoundary, Card, ResultCount, SearchField, SelectField } from "../primitives";
import { useAsync, useDebounced } from "../useAsync";
import type { WebUIContext } from "../types";

/** The scope flags `/search` accepts, as one mutually exclusive choice. */
const SCOPES = [
  { value: "searchAllText", label: "All card text" },
  { value: "searchHighlighted", label: "Highlighted text only" },
  { value: "searchUnderlined", label: "Underlined text only" },
  { value: "searchSummaries", label: "Summaries only" },
  { value: "searchBlockAndFileTitles", label: "Block and file titles" },
] as const;

/** One of {@link SCOPES}' flag names. */
type ScopeFlag = (typeof SCOPES)[number]["value"];

/**
 * The chosen scope as the route's query flags.
 *
 * Only one flag is sent: the route reads each independently, so two of them
 * widen the search rather than intersecting — which is why the UI offers the
 * scope as a single choice in the first place.
 */
function scopeQuery(scope: ScopeFlag): Partial<Record<ScopeFlag, "1">> {
  return { [scope]: "1" };
}

const SORTS = [
  { value: "_text_match:desc", label: "Best match" },
  { value: "readCount:desc", label: "Most read" },
  { value: "year:desc", label: "Newest" },
  { value: "highlightLength:desc", label: "Longest highlight" },
] as const;

interface CardResults {
  results: DebateCard[];
  total: number;
}

export function CardSearchScreen({ client, openRoute }: WebUIContext) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ScopeFlag>("searchAllText");
  const [sort, setSort] = useState<string>("_text_match:desc");
  const debouncedQuery = useDebounced(query);

  const { data, loading, error, reload } = useAsync<CardResults>(
    async () => {
      const payload = await unwrap(
        searchCards(
          {
            query: { q: debouncedQuery, sort, ...scopeQuery(scope) },
          },
          { client },
        ),
      );
      return {
        results: Array.isArray(payload.results) ? payload.results : [],
        total: Number(payload.total) || 0,
      };
    },
    [debouncedQuery, scope, sort],
    // An empty box would ask the index for everything; the screen waits.
    { skip: debouncedQuery.trim().length === 0 },
  );

  const results = data?.results ?? [];
  const idle = debouncedQuery.trim().length === 0;

  return (
    <>
      <div className="dai-filters">
        <SearchField
          id="dai-cards-q"
          label="Search cut cards"
          placeholder="warming impact, deterrence turn…"
          value={query}
          onChange={setQuery}
        />
        <SelectField
          id="dai-cards-scope"
          label="Search in"
          value={scope}
          options={SCOPES}
          onChange={(value) => setScope(value as ScopeFlag)}
        />
        <SelectField
          id="dai-cards-sort"
          label="Sort by"
          value={sort}
          options={SORTS}
          onChange={setSort}
        />
      </div>

      {idle ? (
        <p className="dai-muted">Type a query to search the shared evidence index.</p>
      ) : (
        <>
          {data && <ResultCount count={data.total} noun="card" />}
          <AsyncBoundary
            loading={loading}
            error={error}
            empty={results.length === 0}
            emptyText="No cards match that query."
            onRetry={reload}
          >
            <div className="dai-list">
              {results.map((card, index) => (
                <Card
                  key={card.id ?? index}
                  title={card.argBlock || card.cite_short || card.researchField || "Untitled card"}
                  subtitle={card.summary || card.cite}
                  onOpen={() => openRoute(card.id === undefined ? "/cards" : `/cards?id=${card.id}`)}
                  meta={[
                    card.category,
                    card.event,
                    card.side,
                    card.school,
                    card.year ? `'${card.year}` : undefined,
                    card.readCount ? `read ${card.readCount}×` : undefined,
                  ]}
                />
              ))}
            </div>
          </AsyncBoundary>
        </>
      )}
    </>
  );
}
