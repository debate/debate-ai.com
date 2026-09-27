"use client";

/**
 * @fileoverview The /forums page body: the form that opens a thread, and the
 * feed of everything opened so far, newest activity first.
 *
 * ## Why it fetches for itself
 *
 * Same answer as `debate-comments`' `CommentSection`: the routes that would
 * otherwise own the read are three directories away in the app, and the read is
 * per-visitor anyway — the server sends the viewer with the feed, which is what
 * decides between the form above and a sign-in prompt, and it is one request
 * instead of two.
 *
 * ## Why the feed pages by cursor
 *
 * "Load more" resumes from the response's `nextCursor` rather than asking for
 * page two. The feed is ordered by when a thread was last posted to, and a
 * reply landing between two requests pushes a row up — so a page number would
 * show that row twice. The cursor names the last row of this page and the next
 * read starts strictly after it (see `lib/forums/queries.ts`).
 *
 * @module components/forums/ForumsHub
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ForumThreadRow } from "./ForumThreadRow";
import { NewThreadForm } from "./NewThreadForm";
import { createForumThread, fetchForumThreads } from "../../lib/forums/client";
import { DEFAULT_FEED_LIMIT, type ForumThreadSummary, type ForumViewer } from "../../lib/forums/types";
import { useSession } from "../../lib/hooks/useSession";

type LoadState = "loading" | "ready" | "error";

export function ForumsHub() {
  const { isAuthenticated } = useSession();
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [viewer, setViewer] = useState<ForumViewer | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    let cancelled = false;

    setLoadState("loading");
    fetchForumThreads({ limit: DEFAULT_FEED_LIMIT })
      .then((feed) => {
        if (cancelled) return;
        setThreads(feed.threads);
        setViewer(feed.viewer);
        setNextCursor(feed.nextCursor);
        setLoadState("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not load the latest news.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [retryToken]);

  const handleCreate = useCallback(async (thread: { title: string; body: string }) => {
    const created = await createForumThread(thread);
    setThreads((current) => [created, ...current]);
    setError(null);
  }, []);

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchForumThreads({ limit: DEFAULT_FEED_LIMIT, cursor: nextCursor });
      // Appended rather than replaced: the cursor walks strictly forward, and
      // re-sorting the whole list here would be the one thing that could put a
      // row back where the reader has already been.
      setThreads((current) => [...current, ...page.threads]);
      setNextCursor(page.nextCursor);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not load more threads.");
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {isAuthenticated ? (
        <section
          aria-label="Start a thread"
          className="rounded-lg border border-border bg-card p-3 text-card-foreground"
        >
          <NewThreadForm onSubmit={handleCreate} />
        </section>
      ) : (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <a href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </a>{" "}
          to start a thread.
        </p>
      )}

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}{" "}
          {loadState === "error" && (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setRetryToken((token) => token + 1);
              }}
              className="font-medium underline"
            >
              Try again
            </button>
          )}
        </p>
      ) : null}

      {loadState === "loading" ? (
        <div className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading the latest news…
        </div>
      ) : null}

      {loadState === "ready" && threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          No threads yet.
          {viewer ? " Start the first one." : " Sign in to start the discussion."}
        </p>
      ) : null}

      {threads.length > 0 ? (
        <ul className="rounded-lg border border-border bg-card">
          {threads.map((thread) => (
            <ForumThreadRow key={thread.id} thread={thread} />
          ))}
        </ul>
      ) : null}

      {nextCursor ? (
        <button
          type="button"
          onClick={() => void handleLoadMore()}
          disabled={loadingMore}
          className="inline-flex h-9 items-center justify-center gap-2 self-center rounded-full border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:opacity-50"
        >
          {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
          {loadingMore ? "Loading…" : "Load more"}
        </button>
      ) : null}
    </div>
  );
}
