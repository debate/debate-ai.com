"use client";

/**
 * @fileoverview "Find me a match" — the anonymous replacement for the public
 * board of volunteers.
 *
 * Pressing the button asks `POST /api/practice-partners/match` for one
 * debater open to challenges, drawn at random from the most compatible few
 * for the viewer's profile (`pickPracticeMatch`). What comes back says what
 * they debate and how well it fits — never who they are. "Send request" opens
 * the challenge form inline and sends it with the match's opaque token;
 * "Find another" asks again, skipping everyone already shown. Both debaters
 * learn who the other is only once the request is accepted.
 */

import { useState, type ReactNode } from "react";
import { Loader2, Send, Shuffle, Sparkles, UserRound } from "lucide-react";

import { cn } from "../../lib/ui/lib/utils";
import { findPracticeMatch } from "../../lib/practice-partners/client";
import {
  MAX_MATCH_EXCLUDES,
  PRACTICE_FORMATS,
  PRACTICE_LEVELS,
  PRACTICE_SPEEDS,
  PRACTICE_STYLES,
  optionLabel,
  type AnonymousPracticeMatch,
  type NewChallenge,
  type PracticeFormat,
  type PracticePreferences,
} from "../../lib/practice-partners/types";
import { ChallengeForm } from "./ChallengeForm";

export interface MatchFinderProps {
  /** The viewer's preferences — matching needs them; `null` before they have a profile. */
  viewerPreferences: PracticePreferences | null;
  /** Sends the request; resolves once it is stored. */
  onRequest: (challenge: NewChallenge) => Promise<void>;
}

function Tag({ children, strong = false }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        strong ? "border-primary/50 bg-primary/10 font-medium text-foreground" : "border-border text-muted-foreground",
      )}
    >
      {children}
    </span>
  );
}

export function MatchFinder({ viewerPreferences, onRequest }: MatchFinderProps) {
  const [format, setFormat] = useState<PracticeFormat | "any">("any");
  const [match, setMatch] = useState<AnonymousPracticeMatch | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [noneFound, setNoneFound] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function find(another: boolean) {
    setSearching(true);
    setError(null);
    setNoneFound(false);
    setRequesting(false);
    setSent(false);
    const exclude = another ? seen.slice(-MAX_MATCH_EXCLUDES) : [];
    try {
      const next = await findPracticeMatch({ format: format === "any" ? null : format, exclude });
      setMatch(next);
      setNoneFound(next === null);
      if (next) setSeen(another ? [...exclude, next.token] : [next.token]);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not find a match right now.");
    } finally {
      setSearching(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className="sr-only" htmlFor="practice-match-format">
          Format
        </label>
        <select
          id="practice-match-format"
          value={format}
          onChange={(event) => setFormat(event.target.value as PracticeFormat | "any")}
          className="h-8 rounded-full border border-border bg-background px-3 text-xs text-foreground"
        >
          <option value="any">Any format</option>
          {PRACTICE_FORMATS.map((option) => (
            <option key={option.id} value={option.id}>
              {option.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => void find(false)}
          disabled={searching}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {searching ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
          ) : (
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          )}
          {searching ? "Finding a match…" : "Find me a match"}
        </button>
      </div>

      {!viewerPreferences ? (
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Save your practice profile above first — matches are ranked by the formats, styles, speed and level you list.
        </p>
      ) : null}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {noneFound ? (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          {seen.length > 0
            ? "No one else fits right now — try another format, or check back later."
            : "Nobody suitable is open to challenges right now — try any format, or check back later."}
        </p>
      ) : null}

      {match ? (
        <div className="rounded-lg border border-border bg-background p-3" aria-live="polite">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <UserRound className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <p className="text-sm font-medium">Anonymous debater</p>
                <span className="text-xs text-muted-foreground">
                  {optionLabel(PRACTICE_LEVELS, match.level)} · {optionLabel(PRACTICE_SPEEDS, match.speed)}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                  <Sparkles className="h-3 w-3" aria-hidden="true" />
                  {match.label ?? "Match"} · {match.score}% compatible
                </span>
                {match.alsoJudges ? <span className="text-[11px] text-muted-foreground">Also judges</span> : null}
              </div>
              <div className="mt-1.5 flex flex-wrap gap-1">
                {match.formats.length === 0 ? <Tag>Any format</Tag> : null}
                {match.formats.map((formatId) => (
                  <Tag key={formatId} strong={match.sharedFormats.includes(formatId)}>
                    {optionLabel(PRACTICE_FORMATS, formatId)}
                  </Tag>
                ))}
                {match.styles.map((styleId) => (
                  <Tag key={styleId} strong={match.sharedStyles.includes(styleId)}>
                    {optionLabel(PRACTICE_STYLES, styleId)}
                  </Tag>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                You&rsquo;ll both see who the other is once they accept.
              </p>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => void find(true)}
              disabled={searching}
              className="inline-flex h-8 items-center gap-1.5 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent disabled:opacity-50"
            >
              <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
              Find another
            </button>
            <button
              type="button"
              onClick={() => setRequesting(true)}
              disabled={requesting || sent}
              className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" aria-hidden="true" />
              {sent ? "Request sent" : "Send request"}
            </button>
          </div>

          {sent ? (
            <p role="status" className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
              Request sent — your match has been notified. It&rsquo;s under &ldquo;Your challenges&rdquo; above.
            </p>
          ) : null}

          {requesting ? (
            <ChallengeForm
              opponent={{ key: "match", label: "your match", formats: match.formats }}
              viewerFormats={viewerPreferences?.formats ?? []}
              onCancel={() => setRequesting(false)}
              onSubmit={async (challenge) => {
                await onRequest({ ...challenge, matchToken: match.token });
                setRequesting(false);
                setSent(true);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
