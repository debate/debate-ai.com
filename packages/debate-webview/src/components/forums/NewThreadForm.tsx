"use client";

/**
 * @fileoverview The form that opens a forum thread: a title, an opening post,
 * and a button.
 *
 * Both fields are always visible rather than hidden behind a disclosure. A
 * thread is a title *and* a post — there is no useful half-formed state of it —
 * so a collapsed "start a thread" affordance would only add a click to the one
 * action on this page that a signed-in member came to take.
 *
 * The character counters are the server's limits (`lib/forums/types.ts`), not
 * this form's: the API is what refuses the post, and a counter showing a
 * different number from the one that rejects you is worse than none.
 */

import { useState, type FormEvent } from "react";

import { MAX_THREAD_BODY_LENGTH, MAX_THREAD_TITLE_LENGTH } from "../../lib/forums/types";

export interface NewThreadFormProps {
  /** Resolves once the thread is stored; the form clears itself and the feed grows a row. */
  onSubmit: (thread: { title: string; body: string }) => Promise<void>;
  className?: string;
}

export function NewThreadForm({ onSubmit, className }: NewThreadFormProps) {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ title: title.trim(), body: body.trim() });
      setTitle("");
      setBody("");
    } catch (cause: unknown) {
      // The text is deliberately left in place: a post rejected at the far end
      // is the one case where clearing the box costs the writer their words.
      setError(cause instanceof Error ? cause.message : "Could not post your thread.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={className}>
      <div className="flex flex-col gap-2">
        <label className="sr-only" htmlFor="forum-thread-title">
          Thread title
        </label>
        <input
          id="forum-thread-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={MAX_THREAD_TITLE_LENGTH}
          placeholder="Title — the claim, the question, the round you are stuck on"
          disabled={submitting}
          className="h-9 w-full rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground outline-none transition-colors placeholder:font-normal placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />

        <label className="sr-only" htmlFor="forum-thread-body">
          Opening post
        </label>
        <textarea
          id="forum-thread-body"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          maxLength={MAX_THREAD_BODY_LENGTH}
          rows={4}
          placeholder="Open the thread — what you tried, what you found, what you want to know."
          disabled={submitting}
          className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />

        <div className="flex items-center justify-end gap-2">
          {title.length > MAX_THREAD_TITLE_LENGTH - 20 ? (
            <span className="mr-auto text-xs tabular-nums text-muted-foreground">
              {MAX_THREAD_TITLE_LENGTH - title.length}
            </span>
          ) : null}

          <button
            type="submit"
            disabled={!canSubmit}
            className="h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? "Posting…" : "Post thread"}
          </button>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </form>
  );
}
