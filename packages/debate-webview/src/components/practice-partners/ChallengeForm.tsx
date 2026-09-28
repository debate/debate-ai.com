"use client";

/**
 * @fileoverview The form that challenges one volunteer to a practice round:
 * format, resolution, a proposed time, an optional judge, and a note.
 *
 * The format list leads with the formats both debaters listed, and the judge
 * list only offers volunteers who judge that format (or listed none), so the
 * defaults are always a round that can actually happen. Nothing is locked,
 * though — a debater may still pick a format the opponent did not list, and the
 * opponent can decline.
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
  type PracticeVolunteer,
} from "../../lib/practice-partners/types";

const inputClass =
  "w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

/** A `datetime-local` value (the reader's local time) as Unix seconds, or `null` when empty. */
export function localInputToSeconds(value: string): number | null {
  if (!value) return null;
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

export interface ChallengeFormProps {
  opponent: PracticeVolunteer;
  /** The viewer's own formats, to lead the format list with the shared ones. */
  viewerFormats: readonly PracticeFormat[];
  /** Every judge volunteer on the board. */
  judges: readonly PracticeVolunteer[];
  onSubmit: (challenge: NewChallenge) => Promise<void>;
  onCancel: () => void;
}

export function ChallengeForm({ opponent, viewerFormats, judges, onSubmit, onCancel }: ChallengeFormProps) {
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
  const [judgeId, setJudgeId] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const judgeOptions = judges.filter(
    (judge) =>
      judge.person.id !== opponent.person.id && (judge.formats.length === 0 || judge.formats.includes(format)),
  );

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!topic.trim()) return;
    setSending(true);
    setError(null);
    try {
      await onSubmit({
        opponentId: opponent.person.id,
        judgeId: judgeId || null,
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

  const idPrefix = `challenge-${opponent.person.id}`;

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 flex flex-col gap-3 rounded-lg border border-primary/30 bg-primary/5 p-3"
      aria-label={`Challenge ${opponent.person.name}`}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-format`}>
          Format
          <select
            id={`${idPrefix}-format`}
            value={format}
            onChange={(event) => {
              setFormat(event.target.value as PracticeFormat);
              setJudgeId("");
            }}
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
              <optgroup label={`${opponent.person.name} debates`}>
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

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-judge`}>
        Judge (optional)
        <select
          id={`${idPrefix}-judge`}
          value={judgeId}
          onChange={(event) => setJudgeId(event.target.value)}
          className={cn(inputClass, "h-9")}
        >
          <option value="">No judge yet — let a volunteer pick it up</option>
          {judgeOptions.map((judge) => (
            <option key={judge.person.id} value={judge.person.id}>
              {judge.person.name}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" htmlFor={`${idPrefix}-message`}>
        Message (optional)
        <textarea
          id={`${idPrefix}-message`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={MAX_CHALLENGE_MESSAGE_LENGTH}
          rows={2}
          placeholder="Side preference, what you want to practise, how to reach you…"
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
          {sending ? "Sending…" : "Send challenge"}
        </button>
      </div>
    </form>
  );
}
