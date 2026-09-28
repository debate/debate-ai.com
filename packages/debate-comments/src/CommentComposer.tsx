"use client";

/**
 * @fileoverview The box a comment is typed into — used both for a new top-level
 * comment and, in its `compact` form, for a reply.
 *
 * The root composer starts as a single quiet line and only grows into a real
 * textarea once it is focused, which is the YouTube/Instagram shape: the page
 * does not open with a wall of empty input boxes above the conversation. The
 * reply composer is always open, because it is only ever opened on purpose.
 *
 * @module CommentComposer
 */

import { useId, useState, type KeyboardEvent } from "react";

import { cn } from "./cn";
import { MAX_COMMENT_BODY_LENGTH } from "./types";

export interface CommentComposerProps {
  placeholder: string;
  submitLabel: string;
  /** A reply: single-line height, always open, with a Cancel beside it. */
  compact?: boolean;
  submitting?: boolean;
  disabled?: boolean;
  onSubmit: (body: string) => Promise<void>;
  onCancel?: () => void;
  className?: string;
  autoFocus?: boolean;
}

export function CommentComposer({
  placeholder,
  submitLabel,
  compact = false,
  submitting = false,
  disabled = false,
  onSubmit,
  onCancel,
  className,
  autoFocus = false,
}: CommentComposerProps) {
  const [body, setBody] = useState("");
  const [focused, setFocused] = useState(false);
  const inputId = useId();

  const trimmed = body.trim();
  const canSubmit = trimmed.length > 0 && !submitting && !disabled;
  // The root composer hides its buttons until it is in use; a reply composer
  // shows them from the first keystroke so the way out is always visible.
  const revealed = compact || focused || body.length > 0;
  const remaining = MAX_COMMENT_BODY_LENGTH - body.length;

  async function submit() {
    if (!canSubmit) return;
    await onSubmit(trimmed);
    setBody("");
    setFocused(false);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    // Enter sends, Shift+Enter is a newline — except in the compact composer,
    // where a single Enter is a newline and the send key is the one nobody
    // discovers. Both submit on Ctrl/Cmd+Enter, so the muscle memory works.
    const submitCombo = (event.metaKey || event.ctrlKey) && event.key === "Enter";
    const plainEnter = !compact && !event.shiftKey && event.key === "Enter";
    if (!submitCombo && !plainEnter) return;
    event.preventDefault();
    void submit();
  }

  function cancel() {
    setBody("");
    setFocused(false);
    onCancel?.();
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <textarea
        id={inputId}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={compact ? 1 : revealed ? 3 : 1}
        maxLength={MAX_COMMENT_BODY_LENGTH}
        disabled={disabled}
        autoFocus={autoFocus}
        aria-label={placeholder}
        className={cn(
          "w-full resize-none rounded-md bg-transparent px-0 text-sm leading-6",
          "text-foreground placeholder:text-muted-foreground",
          "border-0 border-b border-border bg-transparent shadow-none outline-none",
          "transition-colors focus:border-foreground/40",
          compact ? "min-h-9 pb-1" : "min-h-9",
        )}
      />

      {revealed && (
        <div className="flex items-center justify-end gap-2">
          {remaining < 500 && (
            <span
              className={cn(
                "mr-auto text-xs tabular-nums",
                remaining < 0 ? "text-destructive" : "text-muted-foreground",
              )}
            >
              {remaining}
            </span>
          )}

          <button
            type="button"
            onClick={cancel}
            disabled={submitting}
            className={cn(
              "h-9 rounded-full px-4 text-sm font-medium text-muted-foreground",
              "transition-colors hover:text-foreground disabled:opacity-50",
            )}
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSubmit}
            className={cn(
              "h-9 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground",
              "transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40",
            )}
          >
            {submitting ? "Posting…" : submitLabel}
          </button>
        </div>
      )}
    </div>
  );
}
