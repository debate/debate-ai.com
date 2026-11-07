"use client";

/**
 * @fileoverview One comment and the replies under it — the recursive half of
 * the discussion.
 *
 * A row is deliberately dumb: it holds the state of *its own* thread only
 * (collapsed or not, reply box open or not, like in flight or not) and asks its
 * parent to do anything that touches data. That is what keeps a 40-reply
 * thread from re-rendering as one unit when somebody likes a leaf at the
 * bottom, and what lets the reply tree be any depth without a single piece of
 * state threaded down through it.
 *
 * ## Two indent tiers, not one per level
 *
 * Indentation follows the tree, but only twice: a first-level reply is inset
 * from its parent, and everything deeper is inset slightly from that. A
 * conversation that goes six replies deep would otherwise indent a comment
 * clean off the side of a phone, which is the failure mode that makes threaded
 * discussions unusable on mobile. The connector line stays on every level, so
 * the parent-child structure is still legible once the indent stops growing.
 *
 * ## Collapsing a branch, Reddit-style
 *
 * Every comment can be folded down to one line — author, time, and how many
 * replies went with it — from the `[–]` button beside its timestamp, or by
 * clicking the connector line that runs down beside its replies. Folding hides
 * the body, the actions and the whole subtree; the fold is per-row state, so
 * folding one branch never moves another. This is separate from the "N
 * replies" toggle, which only hides the replies and keeps the comment itself.
 *
 * @module CommentRow
 */

import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Heart,
  MessageCircle,
  SquareMinus,
  SquarePlus,
  Trash2,
} from "lucide-react";

import { CommentAvatar } from "./CommentAvatar";
import { CommentComposer } from "./CommentComposer";
import { cn } from "./cn";
import { formatAbsoluteTime, formatRelativeTime, replyToggleLabel } from "./format";
import { countDescendants, countReplies } from "./tree";
import { DELETED_COMMENT_PLACEHOLDER, MAX_REPLY_DEPTH, type Comment } from "./types";

export interface CommentRowProps {
  comment: Comment;
  /** 0 for a top-level comment; 1 for a reply to one, and so on. */
  depth: number;
  /** The signed-in reader's id, or null — decides what this row may offer. */
  viewerId: string | null;
  onLike: (commentId: string) => Promise<void>;
  onReply: (parentId: string, body: string) => Promise<void>;
  onDelete: (commentId: string) => void;
  /**
   * Whether replies at every depth start open. Off (the default) opens only a
   * root's replies, which suits a comment strip under a video; a forum thread,
   * where the tree *is* the page, turns it on.
   */
  expandAllReplies?: boolean;
}

export function CommentRow({
  comment,
  depth,
  viewerId,
  onLike,
  onReply,
  onDelete,
  expandAllReplies = false,
}: CommentRowProps) {
  // A root's replies start open, so a thread reads as a thread on arrival;
  // anything deeper starts closed, or a busy video opens into a wall — unless
  // the host asked for the whole tree.
  const [expanded, setExpanded] = useState(expandAllReplies || depth === 0);
  // Folded to one line: body, actions and every reply hidden.
  const [collapsed, setCollapsed] = useState(false);
  const [replying, setReplying] = useState(false);
  const [liking, setLiking] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const replyCount = countReplies(comment);
  const isDeleted = comment.deletedAt !== null;
  const isOwn = viewerId !== null && viewerId === comment.author.id;
  // Past the depth ceiling the reply button goes away; a reply to a reply to a
  // reply to a reply is a new top-level comment in waiting. `depth` is
  // zero-based and `MAX_REPLY_DEPTH` counts a top-level comment as level 1, so
  // the deepest replyable row is the one at `MAX_REPLY_DEPTH - 2` — exactly
  // where `resolveReplyParent` stops accepting a parent.
  const canReply = !isDeleted && depth < MAX_REPLY_DEPTH - 1;

  async function handleLike() {
    if (liking || isDeleted) return;
    setLiking(true);
    try {
      await onLike(comment.id);
    } finally {
      setLiking(false);
    }
  }

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      onDelete(comment.id);
    } finally {
      setDeleting(false);
    }
  }

  const indentClass =
    depth === 0 ? "ml-3 pl-3 sm:ml-6 sm:pl-4" : "ml-1.5 pl-2 sm:ml-3 sm:pl-3";

  // A fold hides the whole subtree, so the labels count all of it.
  const hiddenCount = countDescendants(comment);
  const hiddenLabel = hiddenCount === 1 ? "1 reply" : `${hiddenCount} replies`;
  const collapseLabel = `Collapse ${comment.author.name}'s comment${
    hiddenCount > 0 ? ` and ${hiddenLabel}` : ""
  }`;

  if (collapsed) {
    return (
      <li className={cn(depth === 0 && "pt-4 first:pt-0")}>
        <div className="flex items-center gap-2 text-xs leading-5 text-muted-foreground">
          <button
            type="button"
            onClick={() => setCollapsed(false)}
            aria-expanded={false}
            aria-label={`Expand ${comment.author.name}'s comment`}
            className="inline-flex h-6 w-6 items-center justify-center rounded transition-colors hover:bg-muted hover:text-foreground"
          >
            <SquarePlus className="h-4 w-4" aria-hidden="true" />
          </button>
          <span className={cn("font-semibold", isDeleted ? "italic" : "text-foreground")}>
            {isDeleted ? "[deleted]" : comment.author.name}
          </span>
          <time
            dateTime={new Date(comment.createdAt).toISOString()}
            title={formatAbsoluteTime(comment.createdAt)}
          >
            {formatRelativeTime(comment.createdAt)}
          </time>
          {comment.likeCount > 0 && !isDeleted ? (
            <span className="inline-flex items-center gap-0.5 tabular-nums">
              <Heart className="h-3 w-3" aria-hidden="true" />
              {comment.likeCount}
            </span>
          ) : null}
          {hiddenCount > 0 ? <span>({hiddenLabel})</span> : null}
        </div>
      </li>
    );
  }

  return (
    <li className={cn(depth === 0 && "pt-4 first:pt-0")}>
      <div className="flex gap-2.5 sm:gap-3">
        <CommentAvatar
          name={comment.author.name}
          imageUrl={comment.author.imageUrl}
          seed={comment.author.id}
          className={cn(depth === 0 ? "h-8 w-8" : "h-6 w-6", isDeleted && "opacity-50")}
        />

        <div className="min-w-0 flex-1">
          {isDeleted ? (
            <p className="py-0.5 text-sm italic text-muted-foreground">
              {DELETED_COMMENT_PLACEHOLDER}
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-baseline gap-x-2 text-sm leading-5">
                <span className="font-semibold text-foreground">{comment.author.name}</span>
                <time
                  dateTime={new Date(comment.createdAt).toISOString()}
                  title={formatAbsoluteTime(comment.createdAt)}
                  className="text-xs text-muted-foreground"
                >
                  {formatRelativeTime(comment.createdAt)}
                </time>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-expanded={true}
                  aria-label={collapseLabel}
                  title="Collapse"
                  className="ml-auto inline-flex h-6 w-6 items-center justify-center self-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <SquareMinus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>

              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-6 text-foreground/90">
                {comment.body}
              </p>

              <div className="mt-1 flex items-center gap-1 text-muted-foreground">
                <button
                  type="button"
                  onClick={() => void handleLike()}
                  disabled={liking}
                  aria-pressed={comment.viewerHasLiked}
                  aria-label={
                    comment.viewerHasLiked
                      ? `Remove your like from ${comment.author.name}'s comment`
                      : `Like ${comment.author.name}'s comment`
                  }
                  className={cn(
                    "inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs",
                    "transition-colors hover:bg-muted disabled:opacity-50",
                    comment.viewerHasLiked && "text-rose-500",
                  )}
                >
                  <Heart
                    className={cn("h-4 w-4", comment.viewerHasLiked && "fill-current")}
                    aria-hidden="true"
                  />
                  {comment.likeCount > 0 && (
                    <span className="tabular-nums">{comment.likeCount}</span>
                  )}
                </button>

                {canReply && (
                  <button
                    type="button"
                    onClick={() => setReplying((open) => !open)}
                    aria-expanded={replying}
                    className="inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium transition-colors hover:bg-muted"
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    Reply
                  </button>
                )}

                {isOwn && (
                  <button
                    type="button"
                    onClick={() => void handleDelete()}
                    disabled={deleting}
                    aria-label="Delete your comment"
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
              </div>

              {replying && (
                <div className="mt-2 flex gap-2.5">
                  <div className="min-w-0 flex-1">
                    <CommentComposer
                      compact
                      autoFocus
                      placeholder={`Reply to ${comment.author.name}…`}
                      submitLabel="Reply"
                      onCancel={() => setReplying(false)}
                      onSubmit={async (body) => {
                        await onReply(comment.id, body);
                        setReplying(false);
                        // A thread that was collapsed is about to grow — open it,
                        // or the reply lands somewhere the reader cannot see.
                        setExpanded(true);
                      }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {replyCount > 0 && (
            <div className="mt-1">
              <button
                type="button"
                onClick={() => setExpanded((open) => !open)}
                aria-expanded={expanded}
                className="inline-flex items-center gap-1 rounded-full py-1 text-xs font-semibold text-primary transition-colors hover:opacity-80"
              >
                {expanded ? (
                  <ChevronDown className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                )}
                {replyToggleLabel(replyCount, expanded)}
              </button>

              {expanded && (
                <div className={cn("relative mt-1", indentClass)}>
                  {/*
                    The connector line is a button: clicking anywhere along it
                    folds this comment and everything under it, the way a
                    Reddit thread line does. The hit area is wider than the
                    1px line it draws so it can be found with a finger.
                  */}
                  <button
                    type="button"
                    onClick={() => setCollapsed(true)}
                    aria-label={collapseLabel}
                    title="Collapse thread"
                    className="group absolute inset-y-0 left-0 w-3 -translate-x-1/2 cursor-pointer"
                  >
                    <span
                      aria-hidden="true"
                      className="mx-auto block h-full w-px bg-border/70 transition-colors group-hover:w-0.5 group-hover:bg-primary"
                    />
                  </button>
                  <ul className="space-y-3">
                    {comment.replies.map((reply) => (
                      <CommentRow
                        key={reply.id}
                        comment={reply}
                        depth={depth + 1}
                        viewerId={viewerId}
                        onLike={onLike}
                        onReply={onReply}
                        onDelete={onDelete}
                        expandAllReplies={expandAllReplies}
                      />
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
