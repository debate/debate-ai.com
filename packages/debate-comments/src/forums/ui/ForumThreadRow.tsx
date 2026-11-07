"use client";

/**
 * @fileoverview One row in the forum feed — a like column, then the thread's
 * title, its board, who opened it, a line of the opening post, and how much of
 * it is left to read.
 *
 * The text is a plain link to the thread page; the like button sits outside
 * it, because a button inside an anchor is both invalid markup and a click
 * that navigates away from the thing just liked.
 */

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { CommentAvatar } from "../../index";

import { ForumLikeButton } from "./ForumLikeButton";
import { forumFeedHref, formatAbsoluteTime, formatRelativeTime, replyCountLabel } from "../format";
import { forumCategoryLabel, type ForumThreadSummary } from "../types";

export interface ForumThreadRowProps {
  thread: ForumThreadSummary;
  /** Whether the reader is signed in, which decides what the like button does. */
  canLike?: boolean;
  /** Show the board chip — on in the all-boards feed, redundant inside one board. */
  showCategory?: boolean;
  onLikeChange?: (threadId: string, liked: boolean, likeCount: number) => void;
}

export function ForumThreadRow({
  thread,
  canLike = false,
  showCategory = true,
  onLikeChange,
}: ForumThreadRowProps) {
  const posted = formatRelativeTime(thread.createdAt);

  return (
    <li className="flex gap-1 border-b border-border px-1 last:border-b-0 sm:px-2">
      <ForumLikeButton
        threadId={thread.id}
        likeCount={thread.likeCount ?? 0}
        viewerHasLiked={thread.viewerHasLiked ?? false}
        canLike={canLike}
        layout="stacked"
        className="mt-2 shrink-0"
        onChange={(state) => onLikeChange?.(thread.id, state.liked, state.likeCount)}
      />

      <div className="flex min-w-0 flex-1 gap-3 py-3 pr-2">
        <CommentAvatar
          name={thread.author.name}
          imageUrl={thread.author.imageUrl}
          seed={thread.author.id}
          className="mt-0.5 hidden h-8 w-8 sm:flex"
        />

        <div className="min-w-0 flex-1">
          <Link
            href={`/practice/forums/${thread.id}`}
            prefetch={false}
            className="block rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <h3 className="truncate text-sm font-semibold text-foreground">{thread.title}</h3>
          </Link>
          {thread.excerpt ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{thread.excerpt}</p>
          ) : null}

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            {showCategory && thread.category ? (
              <>
                <a
                  href={forumFeedHref(thread.category)}
                  className="rounded-full bg-muted px-2 py-0.5 font-medium text-foreground hover:bg-accent"
                >
                  {forumCategoryLabel(thread.category)}
                </a>
              </>
            ) : null}
            <span className="truncate">{thread.author.name}</span>
            <span aria-hidden="true">&middot;</span>
            {/* The post time, in absolute terms on hover: a relative stamp
                that says "6d ago" is no use at all to someone deciding whether
                a round is still current. */}
            <time dateTime={new Date(thread.createdAt * 1000).toISOString()} title={formatAbsoluteTime(thread.createdAt)}>
              {posted}
            </time>
            <span aria-hidden="true">&middot;</span>
            <Link
              href={`/practice/forums/${thread.id}`}
              prefetch={false}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <MessageSquare className="h-3 w-3" aria-hidden="true" />
              {replyCountLabel(thread.replyCount)}
            </Link>
            {thread.lastActivityAt > thread.createdAt ? (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>active {formatRelativeTime(thread.lastActivityAt)}</span>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </li>
  );
}
