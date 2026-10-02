"use client";

/**
 * @fileoverview One forum thread: its opening post, and the replies under it.
 *
 * The replies are not this component's business. They are comments on the
 * `comments` table keyed on the thread's id (`resourceType: "thread"`), so they
 * are rendered by the same `CommentSection` every other discussion in the app
 * uses — which is what gives a forum reply nested replies, likes, and soft
 * delete without any of it being written twice.
 *
 * The thread itself is fetched here rather than passed in: the same
 * fetch-for-itself reasoning as `debate-comments`' `CommentSection` — the
 * thread id arrives from the route, and reading it on the client keeps this
 * page mountable by any host that routes `/practice/forums/<id>`.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2 } from "lucide-react";
import { CommentAvatar, CommentSection } from "@debate/comments";

import { fetchForumThread } from "../../lib/forums/client";
import { formatAbsoluteTime, formatRelativeTime, replyCountLabel } from "../../lib/forums/format";
import type { ForumThreadDetail } from "../../lib/forums/types";

export interface ForumThreadViewProps {
  threadId: string;
}

export function ForumThreadView({ threadId }: ForumThreadViewProps) {
  const [thread, setThread] = useState<ForumThreadDetail | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  // The thread currently on screen, as far as the loader is concerned. A ref
  // rather than state because it is only ever read to decide whether to show a
  // spinner, and putting it in state would re-run the effect that writes it.
  const loadedId = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Spinner only for a thread that is not on screen yet. The re-reads this
    // component triggers after a reply are for a thread the reader is already
    // looking at, and blanking the page to update a reply count would throw
    // away the place they were typing in.
    if (loadedId.current !== threadId) {
      setLoadState("loading");
    }

    fetchForumThread(threadId)
      .then((loaded) => {
        if (cancelled) return;
        loadedId.current = loaded.id;
        setThread(loaded);
        setLoadState("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not load that thread.");
        setLoadState("error");
      });

    return () => {
      // The route can change under a client-side navigation (the feed opens one
      // thread after another), and a reply that arrives after the move would
      // land on the thread just left.
      cancelled = true;
    };
  }, [threadId, retryToken]);

  const handleChanged = useCallback(() => {
    // A reply is a comment, and the comment feature owns the rows it returns —
    // but the count in this page's header came from the thread read above, so it
    // is now out of step until the thread is read again. Re-reading is one small
    // request; guessing the new count would be a number nothing can justify.
    setRetryToken((token) => token + 1);
  }, []);

  if (loadState === "loading") {
    return (
      <div className="flex items-center gap-2 py-10 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Loading thread…
      </div>
    );
  }

  if (loadState === "error" || !thread) {
    return (
      <div className="rounded-lg border border-border px-4 py-6 text-sm text-muted-foreground">
        <p role="alert" className="text-destructive">
          {error ?? "That thread no longer exists."}
        </p>
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setError(null);
              setRetryToken((token) => token + 1);
            }}
            className="font-medium text-primary underline"
          >
            Try again
          </button>
          <Link href="/practice/forums" className="text-muted-foreground underline">
            Back to Latest News
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Link
        href="/practice/forums"
        className="inline-flex h-9 w-fit items-center gap-1.5 self-start rounded-md border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        <span>
          Back <span className="hidden text-muted-foreground sm:inline">to Latest News</span>
        </span>
      </Link>

      <article className="rounded-lg border border-border bg-card p-4 text-card-foreground">
        <h1 className="text-lg font-semibold leading-tight text-foreground sm:text-xl">
          {thread.title}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
          <CommentAvatar
            name={thread.author.name}
            imageUrl={thread.author.imageUrl}
            seed={thread.author.id}
            className="h-5 w-5 text-[9px]"
          />
          <span className="font-medium text-foreground">{thread.author.name}</span>
          <span aria-hidden="true">&middot;</span>
          <time
            dateTime={new Date(thread.createdAt * 1000).toISOString()}
            title={formatAbsoluteTime(thread.createdAt)}
          >
            {formatRelativeTime(thread.createdAt)}
          </time>
          <span aria-hidden="true">&middot;</span>
          <span>{replyCountLabel(thread.replyCount)}</span>
        </div>

        <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground">
          {thread.body}
        </div>
      </article>

      {/*
        The comment section owns the rows it posts and deletes, so the header
        count above is the only thing that can go stale — `onChanged` re-reads
        the thread to bring it back in step.
      */}
      <CommentSection
        key={thread.id}
        resourceType="thread"
        resourceId={thread.id}
        title="Replies"
        onChanged={handleChanged}
      />
    </div>
  );
}
