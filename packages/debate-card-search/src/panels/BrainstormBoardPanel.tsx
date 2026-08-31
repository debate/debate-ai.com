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
 * @module panels/BrainstormBoardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { RadioGroup, RadioGroupItem } from "debate-ui/src/primitives/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "debate-ui/src/primitives/select"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  buildBrainstormBoardsPanelView,
  buildBrainstormBoardsPanelViewForTopic,
  mergePersistedBrainstormIdeas,
  saveBrainstormIdea,
  upvotePersistedBrainstormIdea,
} from "../state/brainstormIdeas"
import { listTrackedTopics } from "../state/trackedArguments"
import { requestTeamBrainstormAiIdeas } from "../lib/team-brainstorm-client"
import { buildBrainstormPrompt } from "../lib/team-brainstorm-assist"
import { isBrainstormBoardLiveUpdateStorageEvent } from "../state/live-update"
import type { BrainstormBoard, BrainstormCategory } from "../lib/team-brainstorm-assist"

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

  useEffect(() => {
    setTopics(listTrackedTopics())
    setBoards(buildBrainstormBoardsPanelView())
  }, [])

  useEffect(() => {
    if (!hasEditedContributorId && signedInContributorId) {
      setDraft((prev) => ({ ...prev, contributorId: signedInContributorId }))
    }
  }, [signedInContributorId, hasEditedContributorId])

  const refresh = (activeTopic = topic) => {
    setTopics(listTrackedTopics())
    const trimmed = activeTopic.trim()
    setBoards(trimmed ? buildBrainstormBoardsPanelViewForTopic(trimmed) : buildBrainstormBoardsPanelView())
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
    setDraft({
      ...EMPTY_DRAFT,
      category: draft.category,
      contributorId: hasEditedContributorId ? "" : signedInContributorId ?? "",
    })
    refresh()
  }

  const handleUpvote = (id: string) => {
    upvotePersistedBrainstormIdea(id)
    refresh()
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
                {board.ideas.map((idea) => (
                  <div
                    key={idea.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2"
                  >
                    <div className="space-y-1 text-sm">
                      <div className="flex flex-wrap items-center gap-2">
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
                      <Button size="sm" variant="outline" onClick={() => handleUpvote(idea.id)}>
                        Upvote ({idea.upvotes})
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
