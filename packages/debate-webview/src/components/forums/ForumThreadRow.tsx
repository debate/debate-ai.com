/**
 * @fileoverview One row in the forum feed — the thread's title, who opened it,
 * a line of the opening post, and how much of it is left to read.
 *
 * A plain link, not a card of its own: the feed is a list of subjects, and the
 * excerpt is there to tell two similarly-titled threads apart, not to be read
 * in place. The whole post is on the thread's own page.
 */

import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { CommentAvatar } from "debate-comments";

import { formatAbsoluteTime, formatRelativeTime, replyCountLabel } from "../../lib/forums/format";
import type { ForumThreadSummary } from "../../lib/forums/types";

export interface ForumThreadRowProps {
  thread: ForumThreadSummary;
}

export function ForumThreadRow({ thread }: ForumThreadRowProps) {
  const posted = formatRelativeTime(thread.createdAt);

  return (
    <li className="border-b border-border last:border-b-0">
      <Link
        href={`/forums/${thread.id}`}
        prefetch={false}
        className="flex gap-3 px-3 py-3 transition-colors hover:bg-muted/50"
      >
        <CommentAvatar
          name={thread.author.name}
          imageUrl={thread.author.imageUrl}
          seed={thread.author.id}
          className="mt-0.5 h-8 w-8"
        />

        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold text-foreground">{thread.title}</h3>
          {thread.excerpt ? (
            <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{thread.excerpt}</p>
          ) : null}

          <p className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
            <span className="truncate">{thread.author.name}</span>
            <span aria-hidden="true">&middot;</span>
            {/* The post time, in absolute terms on hover: a relative stamp
                that says "6d ago" is no use at all to someone deciding whether
                a round is still current. */}
            <time dateTime={new Date(thread.createdAt * 1000).toISOString()} title={formatAbsoluteTime(thread.createdAt)}>
              {posted}
            </time>
            <span aria-hidden="true">&middot;</span>
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="h-3 w-3" aria-hidden="true" />
              {replyCountLabel(thread.replyCount)}
            </span>
            {thread.lastActivityAt > thread.createdAt ? (
              <>
                <span aria-hidden="true">&middot;</span>
                <span>active {formatRelativeTime(thread.lastActivityAt)}</span>
              </>
            ) : null}
          </p>
        </div>
      </Link>
    </li>
  );
}
