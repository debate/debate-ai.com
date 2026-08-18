/**
 * @fileoverview LLM Card Scoring panel — closes follow-up (c) named under
 * the "🧠 LLM Card Scoring" bullet in TODO.md ("a scoring/duplicate-flag
 * panel UI").
 *
 * Lets a contributor submit a card's text, argument-block keywords, and a
 * quality signal, then renders every persisted card via
 * `state/cardScores.ts`'s `buildPersistedCardScoreRanking` — itself a thin
 * composition of `lib/llm-card-scoring.ts`'s pure `rankCardScores` against
 * the persisted store — ranked by overall score, with each dimension score
 * and a likely-duplicate flag. No new scoring logic is introduced here; the
 * heuristic scorer remains a stand-in for an eventual LLM call (follow-up
 * (a)), and keywords/corpus are still caller-submitted rather than wired
 * into a real card-submission flow (follow-up (b)).
 *
 * @module panels/CardScoringPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import { buildPersistedCardScoreRanking, saveScoredCard } from "../state/cardScores"
import type { CardScoreBreakdown } from "../lib/llm-card-scoring"

type CardDraft = { id: string; text: string; argBlockKeywords: string; quality: string }

const EMPTY_DRAFT: CardDraft = { id: "", text: "", argBlockKeywords: "", quality: "0.5" }

const DIMENSIONS: { key: keyof CardScoreBreakdown; label: string }[] = [
  { key: "relevanceScore", label: "Relevance" },
  { key: "clarityScore", label: "Clarity" },
  { key: "uniquenessScore", label: "Uniqueness" },
  { key: "evidenceQualityScore", label: "Evidence quality" },
  { key: "usabilityScore", label: "Usability" },
]

function parseKeywords(raw: string): string[] {
  return raw
    .split(",")
    .map((keyword) => keyword.trim())
    .filter(Boolean)
}

function parseQuality(raw: string): number {
  const value = Number.parseFloat(raw)
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

/**
 * Renders the LLM Card Scoring panel: a form to submit a card, plus every
 * persisted card ranked by overall score with its per-dimension breakdown
 * and a likely-duplicate flag.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function CardScoringPanel() {
  const [ranking, setRanking] = useState<CardScoreBreakdown[] | null>(null)
  const [draft, setDraft] = useState<CardDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRanking(buildPersistedCardScoreRanking())
  }, [])

  const refresh = () => setRanking(buildPersistedCardScoreRanking())

  const handleSubmit = () => {
    const id = draft.id.trim()
    const text = draft.text.trim()
    if (!id) {
      setError("Card ID is required.")
      return
    }
    if (!text) {
      setError("Card text is required.")
      return
    }
    saveScoredCard({
      id,
      text,
      argBlockKeywords: parseKeywords(draft.argBlockKeywords),
      qualitySignals: [parseQuality(draft.quality)],
    })
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh()
  }

  if (ranking === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading card scores…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">LLM Card Scoring</h1>
        <p className="text-sm text-muted-foreground">
          Submit a card to score it for relevance, clarity, uniqueness, evidence quality, and
          usability — ranked by overall score, with likely duplicates flagged.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="card-score-id">Card ID</Label>
            <Input
              id="card-score-id"
              value={draft.id}
              onChange={(e) => setDraft((prev) => ({ ...prev, id: e.target.value }))}
              placeholder="warming-da-1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="card-score-keywords">Argument-block keywords (comma-separated)</Label>
            <Input
              id="card-score-keywords"
              value={draft.argBlockKeywords}
              onChange={(e) => setDraft((prev) => ({ ...prev, argBlockKeywords: e.target.value }))}
              placeholder="warming, emissions"
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="card-score-text">Card text</Label>
          <Textarea
            id="card-score-text"
            value={draft.text}
            onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Paste the card's summary and underlined/highlighted evidence…"
            rows={4}
          />
        </div>
        <div className="space-y-1.5 sm:max-w-xs">
          <Label htmlFor="card-score-quality">Quality signal (0-1)</Label>
          <Input
            id="card-score-quality"
            type="number"
            min={0}
            max={1}
            step={0.1}
            value={draft.quality}
            onChange={(e) => setDraft((prev) => ({ ...prev, quality: e.target.value }))}
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button onClick={handleSubmit}>Score card</Button>
      </div>

      {ranking.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No cards scored yet. Submit one above to start the ranking.
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((breakdown) => (
            <div key={breakdown.cardId} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{breakdown.cardId}</span>
                <span className="text-xs text-muted-foreground">
                  overall {breakdown.overallScore}/100
                </span>
                {breakdown.isLikelyDuplicate && <Badge variant="destructive">Likely duplicate</Badge>}
              </div>
              <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                {DIMENSIONS.map((dimension) => (
                  <span key={dimension.key}>
                    {dimension.label}: {breakdown[dimension.key]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
