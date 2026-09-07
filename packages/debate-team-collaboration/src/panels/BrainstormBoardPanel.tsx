/**
 * @fileoverview Team Brainstorm Assist panel — the "(b) a brainstorm-panel
 * UI for live squad submission/upvoting" follow-up named under the "🧠 Team
 * Brainstorm Assist" bullet in TODO.md.
 *
 * Lets a user submit a new brainstorm idea against an argument block and
 * category, then renders every persisted idea grouped into its board via
 * `state/brainstormIdeas.ts`'s `buildBrainstormBoardsPanelView` (itself a
 * thin grouping of the already-persisted ideas through
 * `team-brainstorm-assist.ts`'s pure `groupIdeasByBoard`/`buildBrainstormBoard`
 * ranking), with an upvote action per idea that calls the already-persisted
 * `upvotePersistedBrainstormIdea`. No new ranking, duplicate-flagging, or
 * mutation logic is introduced here.
 *
 * A "Generate AI ideas" action closes follow-up (a) named under the "🧠 Team
 * Brainstorm Assist" bullet in TODO.md ("an actual AI-generation call that
 * drafts candidate ideas from `buildBrainstormPrompt`'s output") — it POSTs
 * the form's argument block/category to the existing `/api/reason-ai`
 * Anthropic proxy via `lib/team-brainstorm-client.ts`, then saves each
 * drafted idea as a normal, AI-attributed `BrainstormIdea` (`isAiGenerated:
 * true`) through the already-persisted `saveBrainstormIdea`, so drafted
 * ideas rank, dedupe-flag, and upvote exactly like a teammate's. A failed
 * or malformed AI response shows an inline error instead of crashing the
 * panel.
 *
 * A topic switcher (mirroring `TopicCoverageDashboardPanel`'s) closes the
 * "boards aren't seeded from the coverage-gap prompts" gap noted in
 * `docs/features/brainstorm-board.md` — picking a tracked topic swaps the
 * board list to `state/brainstormIdeas.ts`'s
 * `buildBrainstormBoardsPanelViewForTopic`, which shows one board per
 * under-covered tracked argument/category pair (with its seeding prompt
 * visible even before any idea is submitted) merged with every other board
 * that already has a submitted idea.
 *
 * Each rendered board also gets its own "Generate AI ideas" action, closing
 * the "the AI-generation call requires an argument block to already be
 * filled in on the form; it doesn't infer one from an existing board"
 * Known gap — it calls the exact same `requestTeamBrainstormAiIdeas`
 * request as the form's action, using that board's own argBlock/category
 * directly instead of requiring the form to be filled in first.
 *
 * A "Merge into…" action on any idea flagged `isLikelyDuplicate` closes the
 * "no reviewer/moderator merge action for ideas flagged as likely
 * duplicates" Known gap — it calls the already-persisted
 * `mergePersistedBrainstormIdeas`, which folds the duplicate's upvotes into
 * a chosen target idea and removes the duplicate, rather than leaving the
 * badge purely informational. The target picker lists every other idea on
 * the same board (not just the top-ranked one), so two lower-ranked
 * duplicates can be merged directly into each other.
 *
 * A "Send to Argument Library" action on each board's top-ranked idea closes
 * the "a one-click 'send top idea to Argument Library' action" follow-up
 * named under the "🧠 Team Brainstorm Assist" bullet in TODO.md. Clicking it
 * opens an inline Topic/Case area form (the Argument Library's own required
 * fields, which a `BrainstormIdea` doesn't carry) defaulting Topic to
 * whichever topic is currently selected above; confirming calls the new
 * `state/brainstormIdeas.ts` `sendBrainstormIdeaToArgumentLibrary`, which
 * saves the idea as a `block`-kind `EvidenceLibraryEntry` through the
 * already-persisted `evidenceLibraryEntries.ts` store — the same store
 * `EvidenceLibraryPanel`/`ArgumentLibraryPanel` already read. Once sent, that
 * idea's action is replaced with a "✓ In Argument Library" badge (via
 * `isBrainstormIdeaInArgumentLibrary`) rather than offering to send it again,
 * though re-confirming would just overwrite the same entry (the entry's id
 * is deterministic from the idea's own id).
 *
 * An optional `signedInContributorId` prop (mirroring `TaskInboxPanel`'s
 * identical convention) prefills the idea form's "Contributor ID" field's
 * *initial* value only — never overwrites a visitor's own edit, and a
 * signed-out visitor sees the same blank field as before. A successful
 * submission's form reset restores that same prefilled value (rather than
 * clearing it back to blank) so a signed-in visitor can submit several
 * ideas in a row without retyping their id each time.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isBrainstormBoardLiveUpdateStorageEvent`, so an idea submitted, upvoted,
 * merged, or AI-generated in another browser tab (or a tracked topic added
 * elsewhere) refreshes this panel's rendered boards and topic list here too
 * — the `storage` event never fires in the tab that made the write, only in
 * other tabs.
 *
 * A "Session timer" widget closes the "an optional brainstorm-session timer"
 * follow-up named under the "🧠 Team Brainstorm Assist" bullet in TODO.md —
 * a squad-wide countdown (duration preset, Start/Pause/Reset) a moderator can
 * run to time-box a sprint before reviewing boards, backed by
 * `lib/brainstorm-session-timer.ts`'s pure state machine through
 * `state/brainstormSessionTimer.ts`'s persistence wrapper. It's a single
 * `localStorage`-backed record (not per-board), refreshed once a second while
 * running and by the same `storage`-event listener as the boards above, so a
 * countdown started in one tab is visible — live — in every other open tab.
 *
 * Each idea's rank badge (🏆 #1 / 🥈 #2 / 🥉 #3 / plain #N, via
 * `lib/team-brainstorm-assist.ts`'s `buildBrainstormIdeaRankBadge`) and the
 * board's top idea getting a highlighted card close the "polish the
 * idea-ranking UI" half of the "upvote affordance/animation" follow-up named
 * under the "🧠 Team Brainstorm Assist" bullet in TODO.md — previously
 * `board.ideas`' already-ranked order was the only ranking signal visible,
 * with no per-idea indicator of *why* it was ranked where it was. The
 * "upvote animation" half closes alongside it: clicking "Upvote" now briefly
 * scales the button up (`bumpedIdeaId`, cleared via `setTimeout` after
 * `UPVOTE_BUMP_ANIMATION_MS`) as a click acknowledgement, and the button
 * itself gained a chevron-up icon. Both are presentation-only — no new
 * ranking, scoring, or persistence logic — so, matching this panel's
 * existing convention (see "Cross-tab live update" in
 * `docs/features/brainstorm-board.md`), the animation's own timer/state
 * wiring is intentionally untested; only the new pure `buildBrainstormIdeaRankBadge`
 * helper is Vitest-covered.
 *
 * @module panels/BrainstormBoardPanel
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { ChevronUp } from "lucide-react"
import {
  BRAINSTORM_SESSION_TIMER_PRESETS_SECONDS,
  formatBrainstormSessionTimerRemaining,
  getBrainstormSessionTimerRemainingSeconds,
  isBrainstormSessionTimerExpired,
  type BrainstormSessionTimerState,
} from "../lib/brainstorm-session-timer"
import {
  loadBrainstormSessionTimer,
  pauseSessionTimer,
  resetSessionTimer,
  setSessionTimerDuration,
  startSessionTimer,
} from "../state/brainstormSessionTimer"
import { Badge } from "debate-research-evidence/src/ui/primitives/badge"
import { Button } from "debate-research-evidence/src/ui/primitives/button"
import { Input } from "debate-research-evidence/src/ui/primitives/input"
import { Label } from "debate-research-evidence/src/ui/primitives/label"
import { RadioGroup, RadioGroupItem } from "debate-research-evidence/src/ui/primitives/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "debate-research-evidence/src/ui/primitives/select"
import { Textarea } from "debate-research-evidence/src/ui/primitives/textarea"
import {
  buildBrainstormBoardsPanelView,
  buildBrainstormBoardsPanelViewForTopic,
  isBrainstormIdeaInArgumentLibrary,
  mergePersistedBrainstormIdeas,
  saveBrainstormIdea,
  sendBrainstormIdeaToArgumentLibrary,
  upvotePersistedBrainstormIdea,
} from "../state/brainstormIdeas"
import { listTrackedTopics } from "debate-research-evidence/src/state/trackedArguments"
import { requestTeamBrainstormAiIdeas } from "../lib/team-brainstorm-client"
import { buildBrainstormPrompt } from "../lib/team-brainstorm-assist"
import { isBrainstormBoardLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update"
import { buildBrainstormIdeaRankBadge, type BrainstormBoard, type BrainstormCategory } from "../lib/team-brainstorm-assist"

/** How long the upvote button's click "bump" animation stays applied before clearing. */
const UPVOTE_BUMP_ANIMATION_MS = 300

const CATEGORY_OPTIONS: { value: BrainstormCategory; label: string }[] = [
  { value: "argument", label: "New Arguments" },
  { value: "impact_framing", label: "Impact Framing" },
  { value: "frontline", label: "Frontline Answers" },
  { value: "response", label: "Responses & Turns" },
]

const CATEGORY_LABEL: Record<BrainstormCategory, string> = Object.fromEntries(
  CATEGORY_OPTIONS.map((option) => [option.value, option.label]),
) as Record<BrainstormCategory, string>

type IdeaDraft = { argBlock: string; category: BrainstormCategory; contributorId: string; text: string }

const EMPTY_DRAFT: IdeaDraft = { argBlock: "", category: "argument", contributorId: "", text: "" }

function boardKey(board: BrainstormBoard): string {
  return `${board.argBlock}::${board.category}`
}

/**
 * Every idea id that's already been sent to the Argument Library
 * (`isBrainstormIdeaInArgumentLibrary`), so the panel can swap that idea's
 * "Send to Argument Library" action for a confirmation badge instead of
 * offering to send it again. Any idea can be sent, not just a board's
 * top-ranked one, so every idea is checked.
 */
function computeSentIdeaIds(boards: BrainstormBoard[]): Set<string> {
  return new Set(
    boards
      .flatMap((board) => board.ideas)
      .filter((idea) => isBrainstormIdeaInArgumentLibrary(idea.id))
      .map((idea) => idea.id),
  )
}

export interface BrainstormBoardPanelProps {
  /**
   * A real signed-in visitor's derived contributor id (see
   * `lib/session-identity.ts`'s `deriveContributorIdFromSessionIdentity`).
   * Prefills the idea form's "Contributor ID" field's *initial* value only
   * — never overwrites a visitor's own edit.
   */
  signedInContributorId?: string
}

/**
 * Renders the Team Brainstorm Assist panel: a form to submit a new idea
 * against an argument block and category, plus every persisted
 * `BrainstormIdea`'s board — ranked by popularity, with a near-duplicate
 * badge and an upvote action per idea.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function BrainstormBoardPanel({ signedInContributorId }: BrainstormBoardPanelProps = {}) {
  const [boards, setBoards] = useState<BrainstormBoard[] | null>(null)
  const [draft, setDraft] = useState<IdeaDraft>(EMPTY_DRAFT)
  const [hasEditedContributorId, setHasEditedContributorId] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiLoadingBoardKey, setAiLoadingBoardKey] = useState<string | null>(null)
  const [aiErrorByBoard, setAiErrorByBoard] = useState<Record<string, string>>({})
  const [topics, setTopics] = useState<string[]>([])
  const [topic, setTopic] = useState("")
  const [sendOpenBoardKey, setSendOpenBoardKey] = useState<string | null>(null)
  const [sendIdeaId, setSendIdeaId] = useState<string | null>(null)
  const [sendDraft, setSendDraft] = useState<{ topic: string; caseArea: string }>({ topic: "", caseArea: "" })
  const [sendError, setSendError] = useState<string | null>(null)
  const [sentIdeaIds, setSentIdeaIds] = useState<Set<string>>(new Set())
  const [timer, setTimer] = useState<BrainstormSessionTimerState | null>(null)
  const [timerNow, setTimerNow] = useState(() => Date.now())
  const [bumpedIdeaId, setBumpedIdeaId] = useState<string | null>(null)
  const bumpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Clears any pending "bump" animation timeout on unmount so it never fires a state update after.
  useEffect(() => {
    return () => {
      if (bumpTimeoutRef.current) clearTimeout(bumpTimeoutRef.current)
    }
  }, [])

  useEffect(() => {
    setTopics(listTrackedTopics())
    const initialBoards = buildBrainstormBoardsPanelView()
    setBoards(initialBoards)
    setSentIdeaIds(computeSentIdeaIds(initialBoards))
    setTimer(loadBrainstormSessionTimer())
  }, [])

  /** Ticks the displayed remaining time once a second while the session timer is running. */
  useEffect(() => {
    if (timer?.status !== "running") return
    const interval = setInterval(() => setTimerNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [timer?.status])

  useEffect(() => {
    if (!hasEditedContributorId && signedInContributorId) {
      setDraft((prev) => ({ ...prev, contributorId: signedInContributorId }))
    }
  }, [signedInContributorId, hasEditedContributorId])

  const refresh = (activeTopic = topic) => {
    setTopics(listTrackedTopics())
    const trimmed = activeTopic.trim()
    const nextBoards = trimmed ? buildBrainstormBoardsPanelViewForTopic(trimmed) : buildBrainstormBoardsPanelView()
    setBoards(nextBoards)
    setSentIdeaIds(computeSentIdeaIds(nextBoards))
  }

  /**
   * Live-update the boards and topic list when another browser tab submits,
   * upvotes, merges, or AI-generates an idea, or adds a tracked topic.
   * Depends on `topic` so a change to it re-registers the listener with a
   * fresh closure rather than refreshing against a stale topic.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isBrainstormBoardLiveUpdateStorageEvent(event)) return
      refresh(topic)
      setTimer(loadBrainstormSessionTimer())
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic])

  const handleTopicChange = (nextTopic: string) => {
    setTopic(nextTopic)
    refresh(nextTopic)
  }

  const handleSubmit = () => {
    const argBlock = draft.argBlock.trim()
    const contributorId = draft.contributorId.trim()
    const text = draft.text.trim()
    if (!argBlock || !contributorId || !text) {
      setError("Argument block, contributor ID, and idea text are all required.")
      return
    }
    saveBrainstormIdea({
      id: `${argBlock}-${draft.category}-${contributorId}-${Date.now()}`,
      argBlock,
      category: draft.category,
      contributorId,
      text,
      upvotes: 0,
    })
    setError(null)
    // Keep the just-used contributor id (typed or prefilled) so several
    // ideas can be submitted in a row without retyping it.
    setDraft({
      ...EMPTY_DRAFT,
      category: draft.category,
      contributorId,
    })
    refresh()
  }

  const handleUpvote = (id: string) => {
    upvotePersistedBrainstormIdea(id)
    refresh()
    if (bumpTimeoutRef.current) clearTimeout(bumpTimeoutRef.current)
    setBumpedIdeaId(id)
    bumpTimeoutRef.current = setTimeout(() => setBumpedIdeaId(null), UPVOTE_BUMP_ANIMATION_MS)
  }

  const handleGenerateAiIdeas = async () => {
    const argBlock = draft.argBlock.trim()
    if (!argBlock) {
      setAiError("Enter an argument block above before generating AI ideas.")
      return
    }
    setAiLoading(true)
    setAiError(null)
    try {
      const ideas = await requestTeamBrainstormAiIdeas(buildBrainstormPrompt(argBlock, draft.category))
      ideas.forEach((text, index) => {
        saveBrainstormIdea({
          id: `${argBlock}-${draft.category}-ai-${Date.now()}-${index}`,
          argBlock,
          category: draft.category,
          contributorId: "AI",
          text,
          upvotes: 0,
          isAiGenerated: true,
        })
      })
      refresh()
    } catch (e) {
      setAiError(e instanceof Error ? e.message : "AI idea generation failed.")
    } finally {
      setAiLoading(false)
    }
  }

  const handleGenerateAiIdeasForBoard = async (board: BrainstormBoard) => {
    const key = boardKey(board)
    setAiLoadingBoardKey(key)
    setAiErrorByBoard((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
    try {
      const ideas = await requestTeamBrainstormAiIdeas(buildBrainstormPrompt(board.argBlock, board.category))
      ideas.forEach((text, index) => {
        saveBrainstormIdea({
          id: `${board.argBlock}-${board.category}-ai-${Date.now()}-${index}`,
          argBlock: board.argBlock,
          category: board.category,
          contributorId: "AI",
          text,
          upvotes: 0,
          isAiGenerated: true,
        })
      })
      refresh()
    } catch (e) {
      setAiErrorByBoard((prev) => ({
        ...prev,
        [key]: e instanceof Error ? e.message : "AI idea generation failed.",
      }))
    } finally {
      setAiLoadingBoardKey(null)
    }
  }

  const handleMergeInto = (duplicateId: string, targetId: string) => {
    if (!targetId || targetId === duplicateId) return
    mergePersistedBrainstormIdeas(targetId, duplicateId)
    refresh()
  }

  const handleOpenSend = (board: BrainstormBoard, ideaId: string) => {
    setSendOpenBoardKey(boardKey(board))
    setSendIdeaId(ideaId)
    setSendDraft({ topic, caseArea: "" })
    setSendError(null)
  }

  const handleCancelSend = () => {
    setSendOpenBoardKey(null)
    setSendIdeaId(null)
    setSendError(null)
  }

  const handleConfirmSend = (board: BrainstormBoard) => {
    const idea = board.ideas.find((candidate) => candidate.id === sendIdeaId)
    if (!idea) return
    const sendTopic = sendDraft.topic.trim()
    const caseArea = sendDraft.caseArea.trim()
    if (!sendTopic || !caseArea) {
      setSendError("Topic and case area are both required.")
      return
    }
    sendBrainstormIdeaToArgumentLibrary(idea, sendTopic, caseArea)
    setSendOpenBoardKey(null)
    setSendIdeaId(null)
    setSendError(null)
    refresh()
  }

  const handleStartTimer = () => {
    setTimer(startSessionTimer())
    setTimerNow(Date.now())
  }
  const handlePauseTimer = () => setTimer(pauseSessionTimer())
  const handleResetTimer = () => setTimer(resetSessionTimer())
  const handleSetTimerDuration = (durationSeconds: number) => setTimer(setSessionTimerDuration(durationSeconds))

  if (boards === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading brainstorm boards…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Team Brainstorm Assist</h1>
        <p className="text-sm text-muted-foreground">
          Submit and upvote squad ideas for an argument block, grouped into boards by category.
        </p>
      </div>

      {timer && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-foreground">Session timer</h2>
              <p className="text-xs text-muted-foreground">Optional — time-box the sprint before reviewing boards.</p>
            </div>
            <span
              className={`text-2xl font-semibold tabular-nums ${
                isBrainstormSessionTimerExpired(timer, timerNow) ? "text-destructive" : "text-foreground"
              }`}
            >
              {formatBrainstormSessionTimerRemaining(getBrainstormSessionTimerRemainingSeconds(timer, timerNow))}
            </span>
          </div>
          {isBrainstormSessionTimerExpired(timer, timerNow) && (
            <p className="text-xs font-medium text-destructive">Time's up!</p>
          )}
          {timer.status === "idle" && (
            <div className="flex flex-wrap gap-2">
              {BRAINSTORM_SESSION_TIMER_PRESETS_SECONDS.map((seconds) => (
                <Button
                  key={seconds}
                  size="sm"
                  variant={timer.durationSeconds === seconds ? "default" : "outline"}
                  onClick={() => handleSetTimerDuration(seconds)}
                >
                  {Math.round(seconds / 60)} min
                </Button>
              ))}
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {timer.status !== "running" && <Button onClick={handleStartTimer}>Start</Button>}
            {timer.status === "running" && (
              <Button variant="outline" onClick={handlePauseTimer}>
                Pause
              </Button>
            )}
            {timer.status !== "idle" && (
              <Button variant="outline" onClick={handleResetTimer}>
                Reset
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="brainstorm-topic">Seed boards from a topic's coverage gaps (optional)</Label>
        <Input
          id="brainstorm-topic"
          value={topic}
          onChange={(e) => handleTopicChange(e.target.value)}
          placeholder="Energy Policy"
          className="max-w-sm"
        />
        {topics.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {topics.map((existing) => (
              <Button
                key={existing}
                size="sm"
                variant={existing === topic.trim() ? "default" : "outline"}
                onClick={() => handleTopicChange(existing)}
              >
                {existing}
              </Button>
            ))}
          </div>
        )}
        {topic.trim() !== "" && (
          <p className="text-xs text-muted-foreground">
            Showing every under-covered tracked argument's board for "{topic.trim()}" from the Topic Coverage
            Dashboard, even before anyone has submitted an idea, plus every other board with a submitted idea.
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="brainstorm-arg-block">Argument block</Label>
            <Input
              id="brainstorm-arg-block"
              value={draft.argBlock}
              onChange={(e) => setDraft((prev) => ({ ...prev, argBlock: e.target.value }))}
              placeholder="solvency"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="brainstorm-contributor-id">Contributor ID</Label>
            <Input
              id="brainstorm-contributor-id"
              value={draft.contributorId}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, contributorId: e.target.value }))
                setHasEditedContributorId(true)
              }}
              placeholder="alice"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label>Category</Label>
          <RadioGroup
            value={draft.category}
            onValueChange={(value) => setDraft((prev) => ({ ...prev, category: value as BrainstormCategory }))}
            className="flex flex-wrap items-center gap-3"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <div key={option.value} className="flex items-center gap-1.5">
                <RadioGroupItem value={option.value} id={`brainstorm-category-${option.value}`} />
                <Label htmlFor={`brainstorm-category-${option.value}`} className="font-normal">
                  {option.label}
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="brainstorm-idea-text">Idea</Label>
          <Textarea
            id="brainstorm-idea-text"
            value={draft.text}
            onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Federal funding unlocks state-level matching grants"
            className="min-h-[72px]"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleSubmit}>Submit idea</Button>
          <Button variant="outline" disabled={aiLoading} onClick={handleGenerateAiIdeas}>
            {aiLoading ? "Generating…" : "Generate AI ideas"}
          </Button>
        </div>
        {aiError && <p className="text-sm text-destructive">{aiError}</p>}
      </div>

      {boards.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {topic.trim() !== ""
            ? `No coverage-gap boards for "${topic.trim()}" — its checklist has no under-covered arguments.`
            : "No brainstorm ideas yet. Submit one above to start a board."}
        </div>
      ) : (
        <div className="space-y-4">
          {boards.map((board) => (
            <div key={boardKey(board)} className="rounded-lg border border-border p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{board.argBlock}</h2>
                <Badge variant="outline">{CATEGORY_LABEL[board.category]}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={aiLoadingBoardKey === boardKey(board)}
                  onClick={() => handleGenerateAiIdeasForBoard(board)}
                >
                  {aiLoadingBoardKey === boardKey(board) ? "Generating…" : "Generate AI ideas"}
                </Button>
              </div>
              <p className="mb-1 text-xs text-muted-foreground">{board.prompt}</p>
              {aiErrorByBoard[boardKey(board)] && (
                <p className="mb-2 text-xs text-destructive">{aiErrorByBoard[boardKey(board)]}</p>
              )}
              {board.ideas.length === 0 && (
                <p className="mb-2 text-xs text-muted-foreground">No ideas submitted yet.</p>
              )}
              <div className="space-y-2">
                {board.ideas.map((idea, index) => (
                  <div
                    key={idea.id}
                    className={`flex items-center justify-between gap-3 rounded-md border px-3 py-2 ${
                      index === 0 ? "border-primary/40 bg-primary/5" : "border-border"
                    }`}
                  >
                    <div className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={index === 0 ? "default" : "outline"}>
                          {buildBrainstormIdeaRankBadge(index + 1)}
                        </Badge>
                        <span className="font-medium text-foreground">{idea.contributorId}</span>
                        <span className="text-xs text-muted-foreground">
                          {idea.popularityScore}/100 popularity
                        </span>
                        {idea.isLikelyDuplicate && <Badge variant="secondary">possible duplicate</Badge>}
                        {idea.isAiGenerated && <Badge variant="outline">AI</Badge>}
                      </div>
                      <p className="text-muted-foreground">{idea.text}</p>
                    </div>
                    <div className="flex flex-none items-center gap-2">
                      {idea.isLikelyDuplicate && board.ideas.length > 1 && (
                        <Select onValueChange={(targetId) => handleMergeInto(idea.id, targetId)}>
                          <SelectTrigger size="sm" className="w-[160px] text-xs">
                            <SelectValue placeholder="Merge into…" />
                          </SelectTrigger>
                          <SelectContent>
                            {board.ideas
                              .filter((other) => other.id !== idea.id)
                              .map((other) => (
                                <SelectItem key={other.id} value={other.id}>
                                  {other.contributorId}: {other.text.slice(0, 40)}
                                  {other.text.length > 40 ? "…" : ""}
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      )}
                      {sentIdeaIds.has(idea.id) ? (
                        <Badge variant="outline">✓ In Argument Library</Badge>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => handleOpenSend(board, idea.id)}>
                          Send to Argument Library
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleUpvote(idea.id)}
                        className={`gap-1 transition-transform duration-200 ${
                          idea.id === bumpedIdeaId ? "scale-110" : "scale-100"
                        }`}
                      >
                        <ChevronUp className="size-3.5" />
                        Upvote ({idea.upvotes})
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              {sendOpenBoardKey === boardKey(board) && (
                <div className="mt-3 space-y-2 rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">
                    Send this idea to the Argument Library as a reusable analytic block.
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor={`send-topic-${boardKey(board)}`}>Topic</Label>
                      <Input
                        id={`send-topic-${boardKey(board)}`}
                        value={sendDraft.topic}
                        onChange={(e) => setSendDraft((prev) => ({ ...prev, topic: e.target.value }))}
                        placeholder="Energy Policy"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label htmlFor={`send-case-area-${boardKey(board)}`}>Case area</Label>
                      <Input
                        id={`send-case-area-${boardKey(board)}`}
                        value={sendDraft.caseArea}
                        onChange={(e) => setSendDraft((prev) => ({ ...prev, caseArea: e.target.value }))}
                        placeholder="Aff"
                      />
                    </div>
                  </div>
                  {sendError && <p className="text-xs text-destructive">{sendError}</p>}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => handleConfirmSend(board)}>
                      Confirm send
                    </Button>
                    <Button size="sm" variant="outline" onClick={handleCancelSend}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
