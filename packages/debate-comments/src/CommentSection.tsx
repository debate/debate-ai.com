"use client";

/**
 * @fileoverview The discussion section — the whole comment feature, mounted
 * against one resource.
 *
 * ```tsx
 * <CommentSection resourceType="video" resourceId={videoId} />
 * ```
 *
 * ## Why it fetches for itself
 *
 * The obvious shape is a server component that reads the thread and hands it to
 * a client component as a prop. That is right when the page is a server
 * component, and wrong here: the page this mounts on is a client component
 * deep in a workspace package (`debate-videos`), and the routes that would
 * otherwise own the read are three directories away in the app. So the read
 * happens on mount instead, and the response carries the viewer with it —
 *
 * ```json
 * { "comments": [...], "viewer": { "id": "…", "name": "…", "imageUrl": null } | null }
 * ```
 *
 * — which is the one thing a client-only mount cannot know for free. It needs
 * that to decide between a composer and a sign-in prompt, and to know which
 * comments it is allowed to offer a delete button on. One request instead of
 * two, and no prop drilling from a server boundary that does not exist.
 *
 * ## Signing in
 *
 * A signed-out reader can read every comment and post nothing. The prompt is a
 * plain link to `/login` by default; a host with its own sign-in modal passes
 * `onSignIn` instead.
 *
 * @module CommentSection
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";

import { CommentAvatar } from "./CommentAvatar";
import { CommentComposer } from "./CommentComposer";
import { CommentRow } from "./CommentRow";
import { cn } from "./cn";
import {
  createComment,
  deleteComment,
  fetchCommentThread,
  toggleCommentLike,
  type CommentClientOptions,
} from "./client";
import { countComments, insertReplyNode, updateCommentNode } from "./tree";
import type { Comment, CommentResourceType, CommentViewer } from "./types";

export interface CommentSectionProps {
  resourceType: CommentResourceType;
  resourceId: string;
  /** Heading text. Defaults to "Comments". */
  title?: string;
  /** Extra API surface (a non-default base path, or an injected fetch). */
  clientOptions?: CommentClientOptions;
  /** Replaces the default "sign in to comment" link. */
  onSignIn?: () => void;
  /**
   * Called after a comment is posted or removed.
   *
   * For a host that shows a reply count it read from somewhere else — the
   * forums' thread header does, because the count rides on the thread read and
   * not on the comment thread. Without this, that count is one behind until the
   * page is reloaded; re-reading the thread is the host's business, and this
   * only says that something changed.
   */
  onChanged?: () => void;
  className?: string;
}

type LoadState = "loading" | "ready" | "error";

export function CommentSection({
  resourceType,
  resourceId,
  title = "Comments",
  clientOptions,
  onSignIn,
  onChanged,
  className,
}: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [viewer, setViewer] = useState<CommentViewer | null>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [truncated, setTruncated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  // Read out of `clientOptions` one field at a time rather than depending on the
  // object. A caller that passes an inline literal — `<CommentSection
  // clientOptions={{ basePath }} />` — hands a fresh object to every render, and
  // an effect keyed on it would refetch the thread forever. The two fields are
  // primitives, so this reloads only when the thing being talked about does.
  const basePath = clientOptions?.basePath;
  const fetchImpl = clientOptions?.fetchImpl;

  useEffect(() => {
    let cancelled = false;

    setLoadState("loading");
    fetchCommentThread({ resourceType, resourceId, basePath, fetchImpl })
      .then((thread) => {
        if (cancelled) return;
        setComments(thread.comments);
        setViewer(thread.viewer);
        setTruncated(thread.truncated);
        setLoadState("ready");
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : "Could not load the discussion.");
        setLoadState("error");
      });

    return () => {
      // The resource can change under a client-side navigation (the watch
      // page moves between videos without remounting), and a thread that
      // arrives after the move would land on the wrong video.
      cancelled = true;
    };
  }, [resourceType, resourceId, retryToken, basePath, fetchImpl]);

  const total = useMemo(() => countComments(comments), [comments]);

  const handlePost = useCallback(
    async (parentId: string | null, body: string) => {
      const created = await createComment({
        resourceType,
        resourceId,
        parentId,
        body,
        basePath,
        fetchImpl,
      });
      setComments((current) =>
        parentId ? insertReplyNode(current, parentId, created) : [created, ...current],
      );
      onChanged?.();
    },
    [resourceType, resourceId, basePath, fetchImpl, onChanged],
  );

  const handleLike = useCallback(
    async (commentId: string) => {
      // The previous tree is captured before the optimistic swap so a failed
      // request can put it back exactly as it was, rather than trying to
      // reverse the edit.
      let previous: Comment[] = [];
      setComments((current) => {
        previous = current;
        return updateCommentNode(current, commentId, (comment) => ({
          ...comment,
          viewerHasLiked: !comment.viewerHasLiked,
          likeCount: comment.viewerHasLiked
            ? Math.max(0, comment.likeCount - 1)
            : comment.likeCount + 1,
        }));
      });

      try {
        const result = await toggleCommentLike(commentId, { basePath, fetchImpl });
        setComments((current) =>
          updateCommentNode(current, commentId, (comment) => ({
            ...comment,
            viewerHasLiked: result.liked,
            likeCount: result.likeCount,
          })),
        );
      } catch (cause) {
        setComments(previous);
        setError(cause instanceof Error ? cause.message : "Could not update your like.");
      }
    },
    [basePath, fetchImpl],
  );

  const handleDelete = useCallback(
    async (commentId: string) => {
      try {
        await deleteComment(commentId, { basePath, fetchImpl });
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Could not delete your comment.");
        return;
      }
      // Soft delete: the row goes, its replies stay. Removing the whole
      // subtree would take a sub-conversation down over one post.
      setComments((current) =>
        updateCommentNode(current, commentId, (comment) => ({
          ...comment,
          body: "",
          deletedAt: Date.now(),
          viewerHasLiked: false,
          likeCount: 0,
        })),
      );
      onChanged?.();
    },
    [basePath, fetchImpl, onChanged],
  );

  // A row's delete action is synchronous from its point of view, so it cannot be
  // handed `handleDelete` itself. Wrapping it once here rather than inline per
  // row keeps every row's props referentially stable, which is what stops a
  // delete at the bottom of a long thread from re-rendering all of it.
  const handleDeleteRequest = useCallback(
    (commentId: string) => {
      void handleDelete(commentId);
    },
    [handleDelete],
  );

  return (
    <section aria-label={title} className={cn("w-full", className)}>
      <div className="mb-1 flex items-center gap-2">
        <MessageSquare className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold text-foreground">
          {title}
          {loadState === "ready" && (
            <span className="ml-2 text-sm font-normal text-muted-foreground">{total}</span>
          )}
        </h2>
      </div>

      {viewer ? (
        <div className="mt-3 flex gap-2.5 sm:gap-3">
          <CommentAvatar
            name={viewer.name}
            imageUrl={viewer.imageUrl}
            seed={viewer.id}
            className="mt-1 h-8 w-8"
          />
          <div className="min-w-0 flex-1">
            <CommentComposer
              placeholder="Add a comment…"
              submitLabel="Comment"
              onSubmit={(body) => handlePost(null, body)}
            />
          </div>
        </div>
      ) : (
        loadState === "ready" && (
          <div className="mt-3 rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            {onSignIn ? (
              <button type="button" onClick={onSignIn} className="font-medium text-primary hover:underline">
                Sign in
              </button>
            ) : (
              <a href="/login" className="font-medium text-primary hover:underline">
                Sign in
              </a>
            )}{" "}
            to join this discussion.
          </div>
        )
      )}

      {/* A failed load offers a retry, because the reader has nothing to look
          at. A failed like or delete only says so — reloading the whole thread
          over one un-liked comment would throw away the reader's place in it. */}
      {error && (
        <p role="alert" className="mt-3 text-sm text-destructive">
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
      )}

      {loadState === "loading" && (
        <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          Loading comments…
        </div>
      )}

      {loadState === "ready" && truncated && (
        <p className="mt-2 text-xs text-muted-foreground">
          This discussion is longer than one page — showing its latest comments.
        </p>
      )}

      {loadState === "ready" && comments.length === 0 && (
        <p className="rounded-lg border border-dashed border-border py-8 text-center text-sm text-muted-foreground">
          No comments yet.
          {viewer ? " Be the first to post one." : " Sign in to start the discussion."}
        </p>
      )}

      {loadState === "ready" && comments.length > 0 && (
        <ul className="mt-2">
          {comments.map((comment) => (
            <CommentRow
              key={comment.id}
              comment={comment}
              depth={0}
              viewerId={viewer?.id ?? null}
              onLike={handleLike}
              onReply={handlePost}
              onDelete={handleDeleteRequest}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
