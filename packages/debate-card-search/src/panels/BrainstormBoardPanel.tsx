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
 * @module panels/BrainstormBoardPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { RadioGroup, RadioGroupItem } from "debate-ui/src/primitives/radio-group"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  buildBrainstormBoardsPanelView,
  saveBrainstormIdea,
  upvotePersistedBrainstormIdea,
} from "../state/brainstormIdeas"
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

/**
 * Renders the Team Brainstorm Assist panel: a form to submit a new idea
 * against an argument block and category, plus every persisted
 * `BrainstormIdea`'s board — ranked by popularity, with a near-duplicate
 * badge and an upvote action per idea.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function BrainstormBoardPanel() {
  const [boards, setBoards] = useState<BrainstormBoard[] | null>(null)
  const [draft, setDraft] = useState<IdeaDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setBoards(buildBrainstormBoardsPanelView())
  }, [])

  const refresh = () => setBoards(buildBrainstormBoardsPanelView())

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
    setDraft({ ...EMPTY_DRAFT, category: draft.category })
    refresh()
  }

  const handleUpvote = (id: string) => {
    upvotePersistedBrainstormIdea(id)
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
              onChange={(e) => setDraft((prev) => ({ ...prev, contributorId: e.target.value }))}
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
        <Button onClick={handleSubmit}>Submit idea</Button>
      </div>

      {boards.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No brainstorm ideas yet. Submit one above to start a board.
        </div>
      ) : (
        <div className="space-y-4">
          {boards.map((board) => (
            <div key={`${board.argBlock}::${board.category}`} className="rounded-lg border border-border p-4">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">{board.argBlock}</h2>
                <Badge variant="outline">{CATEGORY_LABEL[board.category]}</Badge>
              </div>
              <p className="mb-3 text-xs text-muted-foreground">{board.prompt}</p>
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
                      </div>
                      <p className="text-muted-foreground">{idea.text}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handleUpvote(idea.id)}>
                      Upvote ({idea.upvotes})
                    </Button>
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
