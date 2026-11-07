"use client";

/**
 * @fileoverview The like button on a thread's opening post — in a feed row and
 * on the thread page.
 *
 * Optimistic, like a comment's heart: the count moves on click, then settles
 * on what the server reports, and a failed request puts it back. It keeps its
 * own copy of the state so a feed row can be liked without the feed re-reading
 * itself; `onChange` lets a host keep its list in step.
 *
 * @module debate-comments/forums/ui/ForumLikeButton
 */

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";

import { cn } from "../../cn";
import { toggleForumThreadLike } from "../client";

export interface ForumLikeButtonProps {
  threadId: string;
  likeCount: number;
  viewerHasLiked: boolean;
  /** Signed out, the button explains itself instead of making a request that will 401. */
  canLike: boolean;
  /** Called with the settled state after the server answers. */
  onChange?: (state: { liked: boolean; likeCount: number }) => void;
  /** `stacked` puts the count under the heart, for a feed row's vote column. */
  layout?: "inline" | "stacked";
  className?: string;
}

export function ForumLikeButton({
  threadId,
  likeCount,
  viewerHasLiked,
  canLike,
  onChange,
  layout = "inline",
  className,
}: ForumLikeButtonProps) {
  const [state, setState] = useState({ liked: viewerHasLiked, likeCount });
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A re-read of the thread (after a reply, say) hands down fresh numbers.
  useEffect(() => {
    setState({ liked: viewerHasLiked, likeCount });
  }, [viewerHasLiked, likeCount]);

  async function handleClick() {
    if (pending) return;
    if (!canLike) {
      setError("Sign in to like threads.");
      return;
    }

    const previous = state;
    setPending(true);
    setError(null);
    setState({
      liked: !previous.liked,
      likeCount: Math.max(0, previous.likeCount + (previous.liked ? -1 : 1)),
    });
    try {
      const settled = await toggleForumThreadLike(threadId);
      setState(settled);
      onChange?.(settled);
    } catch (cause: unknown) {
      setState(previous);
      setError(cause instanceof Error ? cause.message : "Could not update your like.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={pending}
      aria-pressed={state.liked}
      aria-label={state.liked ? "Remove your like from this thread" : "Like this thread"}
      title={error ?? (state.liked ? "Unlike" : "Like")}
      className={cn(
        "inline-flex items-center justify-center rounded-full text-xs text-muted-foreground transition-colors hover:bg-muted disabled:opacity-60",
        layout === "stacked" ? "h-12 w-10 flex-col gap-0.5" : "h-8 gap-1.5 px-2.5",
        state.liked && "text-rose-500",
        className,
      )}
    >
      <Heart className={cn("h-4 w-4", state.liked && "fill-current")} aria-hidden="true" />
      <span className="tabular-nums">{state.likeCount}</span>
    </button>
  );
}
