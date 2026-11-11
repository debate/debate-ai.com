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
 * ## Boards and orders
 *
 * The feed can be narrowed to one board and read Active / New / Top. Both
 * choices live in the query string (`?category=policy&sort=new`, beside the
 * `section=forums` the News & Forums page already uses), read once on mount
 * and rewritten with `history.replaceState` on change — so a board's listing
 * is a link that can be shared, without this package reaching for a router.
 * Changing either starts the feed over from the top, because a cursor is only
 * meaningful in the order and board it was minted for.
 *
 * @module debate-comments/forums/ui/ForumsHub
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import { ForumCategoryNav } from "./ForumCategoryNav";
import { ForumThreadRow } from "./ForumThreadRow";
import { NewThreadForm } from "./NewThreadForm";
import { createForumThread, fetchForumThreads } from "../client";
import {
  DEFAULT_FEED_LIMIT,
  DEFAULT_FORUM_SORT,
  FORUM_CATEGORIES,
  isForumCategoryId,
  isForumSort,
  type ForumCategoryId,
  type ForumSort,
  type ForumThreadSummary,
  type ForumViewer,
} from "../types";

type LoadState = "loading" | "ready" | "error";

export interface ForumsHubProps {
  /** Whether the visitor is signed in, which picks the form or a sign-in prompt. */
  isAuthenticated: boolean;
  /** The board to open on when the URL names none. */
  initialCategory?: ForumCategoryId | null;
  /** The order to open on when the URL names none. */
  initialSort?: ForumSort;
}

/** The board and order the URL asks for, or `undefined` for each it does not name. */
function readFeedParams(): { category?: ForumCategoryId | null; sort?: ForumSort } {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  const category = params.get("category");
  const sort = params.get("sort");
  return {
    category: category === "all" ? null : isForumCategoryId(category) ? category : undefined,
    sort: isForumSort(sort) ? sort : undefined,
  };
}

/** Rewrites the query string to match the feed, keeping every other param. */
function writeFeedParams(category: ForumCategoryId | null, sort: ForumSort) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  if (category) url.searchParams.set("category", category);
  else url.searchParams.delete("category");
  if (sort !== DEFAULT_FORUM_SORT) url.searchParams.set("sort", sort);
  else url.searchParams.delete("sort");
  window.history.replaceState(window.history.state, "", url.toString());
}

export function ForumsHub({
  isAuthenticated,
  initialCategory = null,
  initialSort = DEFAULT_FORUM_SORT,
}: ForumsHubProps) {
  const [category, setCategory] = useState<ForumCategoryId | null>(initialCategory);
  const [sort, setSort] = useState<ForumSort>(initialSort);
  // Whether the URL has been read yet. The first fetch waits for it, so a
  // board link does not flash the whole forum before narrowing.
  const [paramsRead, setParamsRead] = useState(false);
  const [threads, setThreads] = useState<ForumThreadSummary[]>([]);
  const [viewer, setViewer] = useState<ForumViewer | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const fromUrl = readFeedParams();
    if (fromUrl.category !== undefined) setCategory(fromUrl.category);
    if (fromUrl.sort !== undefined) setSort(fromUrl.sort);
    setParamsRead(true);
  }, []);

  useEffect(() => {
    if (!paramsRead) return;
    let cancelled = false;

    setLoadState("loading");
    setThreads([]);
    setNextCursor(null);
    fetchForumThreads({ limit: DEFAULT_FEED_LIMIT, category, sort })
      .then((feed) => {
        if (cancelled) return;
        setThreads(feed.threads);
        setViewer(feed.viewer);
        setNextCursor(feed.nextCursor);
        setLoadState("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not load the forum.");
        setLoadState("error");
      });

    return () => {
      cancelled = true;
    };
  }, [retryToken, category, sort, paramsRead]);

  const handleCategoryChange = useCallback(
    (next: ForumCategoryId | null) => {
      setError(null);
      setCategory(next);
      writeFeedParams(next, sort);
    },
    [sort],
  );

  const handleSortChange = useCallback(
    (next: ForumSort) => {
      setError(null);
      setSort(next);
      writeFeedParams(category, next);
    },
    [category],
  );

  const handleCreate = useCallback(
    async (thread: { title: string; body: string; category: ForumCategoryId }) => {
      const created = await createForumThread(thread);
      // Shown at the top only where it belongs: a thread filed under another
      // board would otherwise appear in a listing it is not part of.
      if (category === null || created.category === category) {
        setThreads((current) => [created, ...current]);
      }
      setError(null);
    },
    [category],
  );

  const handleLikeChange = useCallback((threadId: string, liked: boolean, likeCount: number) => {
    setThreads((current) =>
      current.map((thread) =>
        thread.id === threadId ? { ...thread, viewerHasLiked: liked, likeCount } : thread,
      ),
    );
  }, []);

  const activeCategory = FORUM_CATEGORIES.find((entry) => entry.id === category) ?? null;

  const handleLoadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;

    setLoadingMore(true);
    setError(null);
    try {
      const page = await fetchForumThreads({
        limit: DEFAULT_FEED_LIMIT,
        cursor: nextCursor,
        category,
        sort,
      });
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
  }, [nextCursor, loadingMore, category, sort]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      {isAuthenticated ? (
        <section
          aria-label="Start a thread"
          className="rounded-lg border border-border bg-card p-3 text-card-foreground"
        >
          <NewThreadForm
            key={category ?? "all"}
            onSubmit={handleCreate}
            defaultCategory={category ?? undefined}
          />
        </section>
      ) : (
        <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
          <a href="/login" className="font-medium text-primary hover:underline">
            Sign in
          </a>{" "}
          to start a thread.
        </p>
      )}

      <ForumCategoryNav
        category={category}
        sort={sort}
        onCategoryChange={handleCategoryChange}
        onSortChange={handleSortChange}
      />

      {activeCategory ? (
        <p className="-mt-1 text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{activeCategory.label}</span> &middot;{" "}
          {activeCategory.description}
        </p>
      ) : null}

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
          Loading threads…
        </div>
      ) : null}

      {loadState === "ready" && threads.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted-foreground">
          {activeCategory ? `No threads in ${activeCategory.label} yet.` : "No threads yet."}
          {viewer ? " Start the first one." : " Sign in to start the discussion."}
        </p>
      ) : null}

      {threads.length > 0 ? (
        <ul className="rounded-lg border border-border bg-card">
          {threads.map((thread) => (
            <ForumThreadRow
              key={thread.id}
              thread={thread}
              canLike={viewer !== null}
              showCategory={category === null}
              onLikeChange={handleLikeChange}
            />
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
