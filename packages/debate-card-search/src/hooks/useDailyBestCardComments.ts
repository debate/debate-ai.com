"use client"

/**
 * @fileoverview Account-synced Daily Best Card comment threads — the "🕵️
 * Daily Best Card Challenge" bullet's "a comment thread on each day's
 * winner" follow-up under Research Crowdsourcing Organizer Features in
 * TODO.md.
 *
 * Local-first, mirroring `debate-round`'s `hooks/useJudgeDecisions.ts`:
 * `DailyBestCardPanel` (the sole consumer of `state/dailyBestCardComments.ts`)
 * keeps reading/writing `localStorage` through this hook, which stays fully
 * usable signed out. On mount, a one-time account merge (deduped across
 * instances via a module-level `remoteMergePromise`) reconciles local and
 * remote comments — merged by each comment's own `id` (not `dayKey`, since
 * many comments share a day): a remote comment with no local counterpart is
 * adopted locally (`adoptDailyBestCardComment`), and a local-only comment
 * (posted before this feature existed, or posted offline) is best-effort
 * pushed up. Neither direction ever overwrites an `id` both sides already
 * have — a comment is posted once and never edited afterward, so there's
 * nothing to reconcile beyond filling gaps.
 *
 * @module hooks/useDailyBestCardComments
 */

import { useCallback, useEffect, useState } from "react"
import {
  adoptDailyBestCardComment,
  deleteDailyBestCardComment,
  listAllDailyBestCardComments,
  listDailyBestCardComments,
  postDailyBestCardComment,
  type DailyBestCardComment,
} from "../state/dailyBestCardComments"
import {
  deleteSavedDailyBestCardCommentFromAccount,
  listSavedDailyBestCardComments,
  saveDailyBestCardCommentToAccount,
} from "../lib/daily-best-card-comments-client"

// Module-level (not per-hook-instance) so multiple mounts of this hook in
// one page load share one account fetch and one "is this browser signed
// in" flag, rather than each firing its own GET on mount.
let remoteAvailable = false;
let remoteMergePromise: Promise<boolean> | null = null;

/** Merges the account's synced comments into local storage once per page load. Resolves to whether local storage changed. */
function ensureRemoteMerged(): Promise<boolean> {
  if (!remoteMergePromise) {
    remoteMergePromise = listSavedDailyBestCardComments()
      .then((remoteComments) => {
        if (remoteComments === null) return false;
        remoteAvailable = true;

        const localComments = listAllDailyBestCardComments();
        const localIds = new Set(localComments.map((comment) => comment.id));
        const remoteIds = new Set(remoteComments.map((comment) => comment.id));

        let changed = false;
        for (const remote of remoteComments) {
          if (!localIds.has(remote.id)) {
            adoptDailyBestCardComment(remote);
            changed = true;
          }
        }
        for (const local of localComments) {
          if (!remoteIds.has(local.id)) {
            saveDailyBestCardCommentToAccount(local).catch(() => {
              // Best-effort — this comment stays local-only until a later
              // successful sync (e.g. the next post/mount).
            });
          }
        }
        return changed;
      })
      .catch(() => false);
  }
  return remoteMergePromise;
}

export interface UseDailyBestCardCommentsResult {
  /** `null` until the initial local read (and, if signed in, account merge) completes. */
  comments: DailyBestCardComment[] | null;
  /** Whether this browser is signed in and syncing comments to the account. */
  synced: boolean;
  /** One day's comment thread, oldest first — derived from `comments`, `[]` while still loading. */
  commentsForDay: (dayKey: string) => DailyBestCardComment[];
  postComment: (dayKey: string, authorId: string, text: string) => void;
  deleteComment: (id: string) => void;
}

/**
 * Binds the current user's Daily Best Card comment threads: local-first
 * state (`state/dailyBestCardComments.ts`), merged with and best-effort
 * synced to the account when signed in.
 */
export function useDailyBestCardComments(): UseDailyBestCardCommentsResult {
  const [comments, setComments] = useState<DailyBestCardComment[] | null>(null);
  const [synced, setSynced] = useState(false);

  useEffect(() => {
    setComments(listAllDailyBestCardComments());
    ensureRemoteMerged().then((changed) => {
      setSynced(remoteAvailable);
      if (changed) setComments(listAllDailyBestCardComments());
    });
  }, []);

  const postComment = useCallback((dayKey: string, authorId: string, text: string) => {
    const comment = postDailyBestCardComment({ dayKey, authorId, text });
    setComments(listAllDailyBestCardComments());
    if (remoteAvailable) {
      saveDailyBestCardCommentToAccount(comment).catch(() => {
        // Best-effort — the comment is already saved locally above, matching
        // useJudgeDecisions's "local apply is never blocked by a sync
        // failure" convention.
      });
    }
  }, []);

  const deleteComment = useCallback((id: string) => {
    deleteDailyBestCardComment(id);
    setComments(listAllDailyBestCardComments());
    if (remoteAvailable) {
      deleteSavedDailyBestCardCommentFromAccount(id).catch(() => {
        // Best-effort, same as postComment above.
      });
    }
  }, []);

  const commentsForDay = useCallback(
    (dayKey: string) => (comments ? listDailyBestCardComments(dayKey) : []),
    [comments],
  );

  return { comments, synced, commentsForDay, postComment, deleteComment };
}
