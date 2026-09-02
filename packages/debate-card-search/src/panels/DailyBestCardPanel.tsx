/**
 * @fileoverview Daily Best Card Challenge banner/widget panel — closes
 * follow-up (c) ("a challenge banner/widget UI") of the "🕵️ Daily Best Card
 * Challenge" bullet in TODO.md's Research Crowdsourcing Organizer Features
 * list. It renders today's live leader among persisted card contributions and
 * an "Announce today's winner" action wired to
 * `state/dailyBestCardAnnouncements.ts`'s idempotent `announceDailyBestCard`
 * (closing follow-up (b), "persists/announces the day's winner"), plus the
 * history of previously announced daily winners.
 *
 * Both the live leader and the announced history are
 * `AttributedDailyBestCard`s, so every winner is rendered with the persisted
 * `contributorId` who submitted it alongside the existing helpfulness
 * scoring — reusing `state/contributions.ts`'s day-grouping/winner selection
 * directly rather than introducing new logic here.
 *
 * Each announced day's winner also carries its own comment thread — the
 * bullet's "a comment thread on each day's winner" follow-up. A comment only
 * makes sense once a day has an announced winner (unlike the live,
 * not-yet-frozen leader, which can still change), so the thread only renders
 * on an `AnnouncementRow`. Threads read/write through
 * `hooks/useDailyBestCardComments.ts`, which is local-first and best-effort
 * account-synced (mirroring `debate-round`'s `useJudgeDecisions`), so a
 * signed-in contributor's comments follow them across devices. An optional
 * `signedInContributorId` prop (mirroring `TaskInboxPanel`'s identical
 * convention) prefills each thread's "Your name" field with a real signed-in
 * visitor's derived id — a starting value only; typing over it is always
 * respected afterward.
 *
 * @module panels/DailyBestCardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { MessageSquare, Sparkles, Trophy } from "lucide-react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  announceDailyBestCard,
  getAnnouncedDailyBestCard,
  getPersistedBestCardForDay,
  listAnnouncedDailyBestCards,
} from "../state/dailyBestCardAnnouncements"
import type { AttributedDailyBestCard } from "../state/contributions"
import { buildDailyBestCardHighlight } from "../lib/daily-best-card"
import { isDailyBestCardLiveUpdateStorageEvent } from "../state/live-update"
import {
  useDailyBestCardComments,
  type UseDailyBestCardCommentsResult,
} from "../hooks/useDailyBestCardComments"
import { MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH } from "../state/dailyBestCardComments"

/** A day's comment-draft form state, keyed by `dayKey` in the panel's own state. */
type CommentDraft = { authorId: string; text: string }

const EMPTY_COMMENT_DRAFT: CommentDraft = { authorId: "", text: "" }

/** Renders one announced day's comment thread plus its add-comment form. */
function CommentThread({
  dayKey,
  comments,
  draft,
  onDraftChange,
  onPost,
  onDelete,
}: {
  dayKey: string
  comments: UseDailyBestCardCommentsResult["comments"]
  draft: CommentDraft
  onDraftChange: (patch: Partial<CommentDraft>) => void
  onPost: () => void
  onDelete: (id: string) => void
}) {
  const thread = (comments ?? []).filter((comment) => comment.dayKey === dayKey)

  return (
    <div className="mt-3 border-t border-border pt-3">
      <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
        Comments ({thread.length})
      </div>
      {thread.length > 0 && (
        <div className="mb-3 space-y-2">
          {thread.map((comment) => (
            <div key={comment.id} className="rounded-md bg-muted/50 p-2 text-xs">
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="font-medium text-foreground">{comment.authorId}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-auto px-1.5 py-0.5 text-[11px]"
                  onClick={() => onDelete(comment.id)}
                >
                  Delete
                </Button>
              </div>
              <p className="text-muted-foreground">{comment.text}</p>
            </div>
          ))}
        </div>
      )}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,160px)_1fr_auto] sm:items-end">
        <div>
          <Label htmlFor={`daily-best-card-comment-author-${dayKey}`} className="text-xs">
            Your name
          </Label>
          <Input
            id={`daily-best-card-comment-author-${dayKey}`}
            value={draft.authorId}
            onChange={(e) => onDraftChange({ authorId: e.target.value })}
            className="h-8 text-xs"
          />
        </div>
        <div>
          <Label htmlFor={`daily-best-card-comment-text-${dayKey}`} className="text-xs">
            Comment
          </Label>
          <Textarea
            id={`daily-best-card-comment-text-${dayKey}`}
            value={draft.text}
            onChange={(e) => onDraftChange({ text: e.target.value })}
            maxLength={MAX_DAILY_BEST_CARD_COMMENT_TEXT_LENGTH}
            rows={1}
            className="min-h-8 text-xs"
          />
        </div>
        <Button size="sm" onClick={onPost} disabled={!draft.text.trim()}>
          Post
        </Button>
      </div>
    </div>
  )
}

/** Renders one announced day's winner, with the contributor who submitted it, and its comment thread. */
function AnnouncementRow({
  announcement,
  comments,
  draft,
  onDraftChange,
  onPost,
  onDelete,
}: {
  announcement: AttributedDailyBestCard
  comments: UseDailyBestCardCommentsResult["comments"]
  draft: CommentDraft
  onDraftChange: (patch: Partial<CommentDraft>) => void
  onPost: () => void
  onDelete: (id: string) => void
}) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
      <Trophy className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-foreground">{buildDailyBestCardHighlight(announcement)}</div>
        <div className="mt-1">
          <Badge variant="outline">{announcement.contribution.contributorId}</Badge>
        </div>
        <CommentThread
          dayKey={announcement.dayKey}
          comments={comments}
          draft={draft}
          onDraftChange={onDraftChange}
          onPost={onPost}
          onDelete={onDelete}
        />
      </div>
    </div>
  )
}

export interface DailyBestCardPanelProps {
  /**
   * A real signed-in visitor's derived contributor id (see
   * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`).
   * Prefills each announced day's comment-thread "Your name" field's
   * *initial* value only — never overwrites a visitor's own edit.
   */
  signedInContributorId?: string
}

/**
 * Renders today's live Daily Best Card leader, an action to freeze it as the
 * day's official announced winner, and the announced history — each
 * announced day carrying its own comment thread.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function DailyBestCardPanel({ signedInContributorId }: DailyBestCardPanelProps = {}) {
  const [today, setToday] = useState<AttributedDailyBestCard | null | undefined>(undefined)
  const [announcedToday, setAnnouncedToday] = useState<AttributedDailyBestCard | undefined>(undefined)
  const [history, setHistory] = useState<AttributedDailyBestCard[]>([])
  const [commentDrafts, setCommentDrafts] = useState<Record<string, CommentDraft>>({})
  const { comments, postComment, deleteComment } = useDailyBestCardComments()

  const refresh = () => {
    const now = Date.now()
    setToday(getPersistedBestCardForDay(now))
    setAnnouncedToday(getAnnouncedDailyBestCard(new Date(now).toISOString().slice(0, 10)))
    setHistory(listAnnouncedDailyBestCards())
  }

  useEffect(() => {
    refresh()
  }, [])

  /**
   * Live-update today's leader and history when another browser tab submits
   * a card contribution, announces a winner, or posts a comment. A `storage`
   * event never fires in the tab that made the write, only in other tabs —
   * same-tab changes already refresh via `handleAnnounce`/`handlePostComment`.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isDailyBestCardLiveUpdateStorageEvent(event)) return
      refresh()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleAnnounce = () => {
    announceDailyBestCard(Date.now())
    refresh()
  }

  const commentDraftFor = (dayKey: string): CommentDraft =>
    commentDrafts[dayKey] ?? { ...EMPTY_COMMENT_DRAFT, authorId: signedInContributorId ?? "" }

  const setCommentDraft = (dayKey: string, patch: Partial<CommentDraft>) => {
    setCommentDrafts((prev) => ({ ...prev, [dayKey]: { ...commentDraftFor(dayKey), ...patch } }))
  }

  const handlePostComment = (dayKey: string) => {
    const draft = commentDraftFor(dayKey)
    if (!draft.text.trim()) return
    postComment(dayKey, draft.authorId, draft.text)
    setCommentDrafts((prev) => ({ ...prev, [dayKey]: { ...draft, text: "" } }))
  }

  if (today === undefined) {
    return <div className="p-6 text-sm text-muted-foreground">Loading today's leader…</div>
  }

  const pastAnnouncements = history.filter((announcement) => announcement.dayKey !== announcedToday?.dayKey)

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Daily Best Card Challenge</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Today's highest-helpfulness card among submitted evidence, and the history of previously announced
        daily winners.
      </p>

      <div className="mb-6 rounded-lg border border-border bg-card p-4">
        <div className="mb-2 text-sm font-medium text-foreground">Today's leader</div>
        {announcedToday ? (
          <AnnouncementRow
            announcement={announcedToday}
            comments={comments}
            draft={commentDraftFor(announcedToday.dayKey)}
            onDraftChange={(patch) => setCommentDraft(announcedToday.dayKey, patch)}
            onPost={() => handlePostComment(announcedToday.dayKey)}
            onDelete={deleteComment}
          />
        ) : today ? (
          <>
            <div className="mb-3 flex items-start gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="text-xs font-medium uppercase tracking-wide text-amber-600 dark:text-amber-400">
                  Card of the day
                </div>
                <div className="mt-1 text-sm font-medium text-foreground">{today.contribution.id}</div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="secondary">{today.contribution.contributorId}</Badge>
                  <span>helpfulness {today.breakdown.helpfulnessScore}/100</span>
                  <span>{today.contribution.likes} likes</span>
                  <span>{today.contribution.saves} saves</span>
                  <span>not yet announced</span>
                </div>
              </div>
            </div>
            <Button size="sm" onClick={handleAnnounce}>
              Announce today's winner
            </Button>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            No card submitted today yet. Submit one in the Contributions Feed to compete for today's
            challenge.
          </p>
        )}
      </div>

      <div className="mb-2 text-sm font-medium text-foreground">Announced history</div>
      {pastAnnouncements.length === 0 ? (
        <p className="text-sm text-muted-foreground">No prior days have been announced yet.</p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {pastAnnouncements.map((announcement) => (
            <AnnouncementRow
              key={announcement.dayKey}
              announcement={announcement}
              comments={comments}
              draft={commentDraftFor(announcement.dayKey)}
              onDraftChange={(patch) => setCommentDraft(announcement.dayKey, patch)}
              onPost={() => handlePostComment(announcement.dayKey)}
              onDelete={deleteComment}
            />
          ))}
        </div>
      )}
    </div>
  )
}
