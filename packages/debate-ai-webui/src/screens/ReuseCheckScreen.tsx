/**
 * @fileoverview The on-page card reuse check — "has anyone on the squad
 * already cut a card from this source?"
 *
 * The same question the extension's toolbar popup answers, on the same
 * `GET /evidence-reuse-check` route, and the reason this package is worth
 * embedding in the Options page at all: the popup can only ask about the tab
 * you are standing on, while this asks about any URL you can paste — a link
 * from a partner, a citation in a doc, a source you are about to spend an hour
 * reading.
 *
 * @module screens/ReuseCheckScreen
 */

import { useState, type FormEvent } from "react";
import { checkEvidenceReuse, type EvidenceReuseMatch } from "debate-api-client";

import { unwrap } from "../api";
import { AsyncBoundary, Card } from "../primitives";
import { useAsync } from "../useAsync";
import type { WebUIContext } from "../types";

interface ReuseResult {
  alreadyCut: boolean;
  matches: EvidenceReuseMatch[];
}

export function ReuseCheckScreen({ client }: WebUIContext) {
  const [url, setUrl] = useState("");
  /** Only a submitted URL is checked, so typing one does not query per keystroke. */
  const [submitted, setSubmitted] = useState("");

  const { data, loading, error, reload } = useAsync<ReuseResult>(
    async () => {
      const payload = await unwrap(
        checkEvidenceReuse({ query: { url: submitted } }, { client }),
      );
      return {
        alreadyCut: Boolean(payload.alreadyCut),
        matches: Array.isArray(payload.matches) ? payload.matches : [],
      };
    },
    [submitted],
    { skip: submitted.length === 0 },
  );

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = url.trim();
    if (trimmed) setSubmitted(trimmed);
  }

  return (
    <>
      <form className="dai-inline-form" onSubmit={onSubmit}>
        <div className="dai-field dai-field-grow">
          <label className="dai-label" htmlFor="dai-reuse-url">
            Source URL
          </label>
          <input
            id="dai-reuse-url"
            className="dai-input"
            type="url"
            inputMode="url"
            placeholder="https://www.example.com/article"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
        <button type="submit" className="dai-button dai-button-primary">
          Check
        </button>
      </form>

      {submitted === "" ? (
        <p className="dai-muted">
          Paste a source URL to see whether it has already been cut into the shared
          evidence index.
        </p>
      ) : (
        <AsyncBoundary
          loading={loading}
          error={error}
          // A "not cut yet" answer is a result, not an empty state, so the
          // boundary is only empty before the first response arrives.
          empty={data === undefined}
          emptyText="No answer yet."
          onRetry={reload}
        >
          {data && (
            <>
              <div
                className={`dai-notice ${data.alreadyCut ? "dai-notice-warn" : "dai-notice-ok"}`}
                role="status"
              >
                {data.alreadyCut
                  ? "Already cut — someone has run a card from this source."
                  : "Not cut yet — no card in the shared index cites this source."}
              </div>
              {data.matches.length > 0 && (
                <div className="dai-list">
                  {data.matches.map((match) => (
                    <Card
                      key={match.id}
                      title={match.argBlock || match.cite || match.sourceUrl}
                      subtitle={match.cite}
                      href={match.sourceUrl}
                      meta={[match.topic]}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </AsyncBoundary>
      )}
    </>
  );
}
