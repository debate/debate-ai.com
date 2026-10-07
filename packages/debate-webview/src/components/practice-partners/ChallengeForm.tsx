"use client";

/**
 * @fileoverview The form that sends a practice-round request to one debater —
 * usually the anonymous match `MatchFinder` found: format, resolution, a
 * proposed time and a note.
 *
 * The format list leads with the formats both debaters listed, so the default
 * is always a round that can actually happen. Nothing is locked, though — a
 * debater may still pick a format the opponent did not list, and the opponent
 * can decline. No judge is picked here: the list of judge volunteers is not
 * public, and an accepted round without one is offered to every judge
 * volunteer to pick up.
 */

import { useMemo, useState, type FormEvent } from "react";
import { Loader2, Swords } from "lucide-react";

import { cn } from "../../lib/ui/lib/utils";
import {
  MAX_CHALLENGE_MESSAGE_LENGTH,
  MAX_TOPIC_LENGTH,
  PRACTICE_FORMATS,
  type NewChallenge,
  type PracticeFormat,
} from "../../lib/practice-partners/types";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** A `datetime-local` value (the reader's local time) as Unix seconds, or `null` when empty. */
export function localInputToSeconds(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

/** Who the request goes to, as far as the challenger may know. */
export interface ChallengeTarget {
  /** Unique per target, for element ids. */
  key: string;
  /** How the form names them — "your match" for an anonymous one. */
  label: string;
  formats: readonly PracticeFormat[];
}

export interface ChallengeFormProps {
  opponent: ChallengeTarget;
  /** The viewer's own formats, to lead the format list with the shared ones. */
  viewerFormats: readonly PracticeFormat[];
  /** Resolves once the request is stored; the caller adds who it goes to. */
  onSubmit: (challenge: Omit<NewChallenge, "opponentId" | "matchToken">) => Promise<void>;
  onCancel: () => void;
}

export function ChallengeForm({ opponent, viewerFormats, onSubmit, onCancel }: ChallengeFormProps) {
  const formatOptions = useMemo(() => {
    const shared = PRACTICE_FORMATS.filter(
      (format) => opponent.formats.includes(format.id) && viewerFormats.includes(format.id),
    );
    const theirs = PRACTICE_FORMATS.filter(
      (format) => opponent.formats.includes(format.id) && !shared.includes(format),
    );
    const rest = PRACTICE_FORMATS.filter((format) => !shared.includes(format) && !theirs.includes(format));
    return { shared, theirs, rest };
  }, [opponent.formats, viewerFormats]);

  const [format, setFormat] = useState<PracticeFormat>(
    (formatOptions.shared[0] ?? formatOptions.theirs[0] ?? PRACTICE_FORMATS[0]).id,
  );
  const [topic, setTopic] = useState("");
  const [when, setWhen] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit({
        format,
        topic: topic.trim(),
        message: message.trim(),
        proposedAt: localInputToSeconds(when),
      });
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not send your challenge.");
      setSending(false);
    }
  }

  const idPrefix = `challenge-${opponent.key}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
      aria-label={`Send a practice request to ${opponent.label}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-format`}>
          Format
          <select
            id={`${idPrefix}-format`}
            value={format}
            onChange={(event) => setFormat(event.target.value as PracticeFormat)}
            className={cn(inputClass, "h-9")}
          >
            {formatOptions.shared.length > 0 ? (
              <optgroup label="You both debate">
                {formatOptions.shared.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            {formatOptions.theirs.length > 0 ? (
              <optgroup label={`Only ${opponent.label} debates`}>
                {formatOptions.theirs.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.label}
                  </option>
                ))}
              </optgroup>
            ) : null}
            <optgroup label="Other formats">
              {formatOptions.rest.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-when`}>
          Proposed start (optional)
          <input
            id={`${idPrefix}-when`}
            type="datetime-local"
            value={when}
            onChange={(event) => setWhen(event.target.value)}
            className={cn(inputClass, "h-9")}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-topic`}>
        Resolution
        <input
          id={`${idPrefix}-topic`}
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          maxLength={MAX_TOPIC_LENGTH}
          required
          placeholder="This month's topic, or “open — let's pick together”"
          className={cn(inputClass, "h-9")}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-message`}>
        Message (optional)
        <textarea
          id={`${idPrefix}-message`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_CHALLENGE_MESSAGE_LENGTH}
          rows={2}
          placeholder="Side preference, what you want to practise…"
          className={cn(inputClass, "resize-y py-2 leading-6")}
        />
      </label>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={sending}
          className="h-8 rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={sending || !topic.trim()}
          className="inline-flex h-8 items-center gap-1.5 rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Swords className="h-3.5 w-3.5" aria-hidden="true" />}
          {sending ? "Sending…" : "Send request"}
        </button>
      </div>
    </form>
  );
}
