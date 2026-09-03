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
 * and a likely-duplicate flag. The heuristic scorer itself is unchanged.
 *
 * Each ranked row also offers a "Get AI assessment" action that closes
 * follow-up (a) ("an actual LLM-scoring call for the more subjective
 * dimensions") — it POSTs the card's text and keywords to the existing
 * `/api/reason-ai` Anthropic proxy via `lib/llm-card-scoring-client.ts`,
 * persists the resulting verdict/notes via `state/aiCardAssessments.ts`,
 * and renders it inline alongside the heuristic breakdown. A malformed or
 * failed AI response shows a per-card error instead of crashing the panel.
 *
 * A topic switcher plus a "Use tracked keywords" action closes follow-up (b)
 * ("real argument-block keywords and a real submitted-card corpus"): picking
 * one of the topics already tracked by the Topic Coverage Dashboard
 * (`state/trackedArguments.ts`) and clicking the action fills the keywords
 * field from that topic's own checklist via
 * `state/cardScores.ts`'s `deriveArgBlockKeywordsForTopic`, still editable
 * before submitting. The keywords field stays a plain text input rather than
 * a picker so a card can also be scored ad hoc, without a tracked topic. The
 * ranking itself already compares uniqueness against the real, persisted
 * Shared Evidence Library corpus — no panel change needed there, see
 * `buildPersistedCardScoreRanking`.
 *
 * A "Bulk import" section closes the "batch-score an uploaded set of cards
 * at once" follow-up (listed alongside a per-contributor score-trend chart
 * and an inline Evidence Library score badge, both still open): a textarea
 * accepts a `---`-delimited batch of `id:`/`keywords:`/`quality:` + text
 * entries, parsed and persisted in one pass via
 * `state/cardScores.ts`'s `bulkImportScoredCards` (itself a thin composition
 * of `lib/llm-card-scoring.ts`'s pure `parseBulkCardSubmissions`), reporting
 * an imported/skipped-entry count rather than failing the whole batch on one
 * malformed entry.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isCardScoringLiveUpdateStorageEvent`, so a card scored, an AI assessment
 * requested, or a tracked topic added in another browser tab refreshes this
 * panel's ranking, AI assessments, and topic list here too — the `storage`
 * event never fires in the tab that made the write, only in other tabs.
 *
 * @module panels/CardScoringPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import { Textarea } from "../ui/primitives/textarea"
import {
  bulkImportScoredCards,
  buildPersistedCardScoreRanking,
  deriveArgBlockKeywordsForTopic,
  getScoredCard,
  saveScoredCard,
} from "../state/cardScores"
import { listTrackedTopics } from "../state/trackedArguments"
import { getAiAssessment, saveAiAssessment } from "../state/aiCardAssessments"
import { requestCardScoringAiAssessment } from "../lib/llm-card-scoring-client"
import { isCardScoringLiveUpdateStorageEvent } from "../state/live-update"
import type { CardScoreBreakdown } from "../lib/llm-card-scoring"
import type { CardScoringAiAssessment } from "../lib/llm-card-scoring-ai"

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
  const [aiAssessments, setAiAssessments] = useState<Record<string, CardScoringAiAssessment>>({})
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null)
  const [aiErrors, setAiErrors] = useState<Record<string, string>>({})
  const [topics, setTopics] = useState<string[]>([])
  const [topic, setTopic] = useState("")
  const [bulkText, setBulkText] = useState("")
  const [bulkStatus, setBulkStatus] = useState<string | null>(null)

  const refreshAll = () => {
    const persisted = buildPersistedCardScoreRanking()
    setRanking(persisted)
    setTopics(listTrackedTopics())
    const assessments: Record<string, CardScoringAiAssessment> = {}
    for (const breakdown of persisted) {
      const assessment = getAiAssessment(breakdown.cardId)
      if (assessment) assessments[breakdown.cardId] = assessment
    }
    setAiAssessments(assessments)
  }

  useEffect(() => {
    refreshAll()
  }, [])

  /**
   * Live-update the ranking, AI assessments, and topic list when another
   * browser tab scores a card, requests an AI assessment, or adds a tracked
   * topic.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isCardScoringLiveUpdateStorageEvent(event)) return
      refreshAll()
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const handleUseTrackedKeywords = () => {
    const activeTopic = topic.trim()
    if (!activeTopic) {
      setError("Choose a topic first.")
      return
    }
    const keywords = deriveArgBlockKeywordsForTopic(activeTopic)
    if (keywords.length === 0) {
      setError(`"${activeTopic}" has no tracked arguments yet — add some on the Topic Coverage Dashboard first.`)
      return
    }
    setError(null)
    setDraft((prev) => ({ ...prev, argBlockKeywords: keywords.join(", ") }))
  }

  const refresh = () => setRanking(buildPersistedCardScoreRanking())

  const handleGetAiAssessment = async (cardId: string) => {
    const card = getScoredCard(cardId)
    if (!card) return
    setAiLoadingId(cardId)
    setAiErrors((prev) => ({ ...prev, [cardId]: "" }))
    try {
      const assessment = await requestCardScoringAiAssessment({
        text: card.text,
        argBlockKeywords: card.argBlockKeywords,
      })
      saveAiAssessment(cardId, assessment)
      setAiAssessments((prev) => ({ ...prev, [cardId]: assessment }))
    } catch (e) {
      setAiErrors((prev) => ({
        ...prev,
        [cardId]: e instanceof Error ? e.message : "AI assessment failed.",
      }))
    } finally {
      setAiLoadingId(null)
    }
  }

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

  const handleBulkImport = () => {
    if (!bulkText.trim()) {
      setBulkStatus("Paste at least one card first.")
      return
    }
    const { importedCount, skippedCount } = bulkImportScoredCards(bulkText)
    setBulkStatus(
      importedCount === 0
        ? `No cards imported — ${skippedCount} entr${skippedCount === 1 ? "y was" : "ies were"} missing an id or text.`
        : `Imported ${importedCount} card${importedCount === 1 ? "" : "s"}.` +
            (skippedCount > 0 ? ` Skipped ${skippedCount} malformed entr${skippedCount === 1 ? "y" : "ies"}.` : ""),
    )
    if (importedCount > 0) setBulkText("")
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
        <div className="space-y-1.5">
          <Label htmlFor="card-score-topic">Topic (optional — for tracked keywords)</Label>
          <div className="flex flex-wrap gap-2">
            <Input
              id="card-score-topic"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Energy Policy"
              className="max-w-sm"
            />
            <Button type="button" variant="outline" size="sm" onClick={handleUseTrackedKeywords}>
              Use tracked keywords
            </Button>
          </div>
          {topics.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {topics.map((existing) => (
                <Button
                  key={existing}
                  type="button"
                  size="sm"
                  variant={existing === topic.trim() ? "default" : "outline"}
                  onClick={() => setTopic(existing)}
                >
                  {existing}
                </Button>
              ))}
            </div>
          )}
        </div>
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

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Bulk import</h2>
          <p className="text-xs text-muted-foreground">
            Paste multiple cards separated by a line of dashes (<code>---</code>). Each entry may
            start with optional <code>id:</code>, <code>keywords:</code>, and <code>quality:</code>{" "}
            lines, followed by the card text.
          </p>
        </div>
        <Textarea
          value={bulkText}
          onChange={(e) => setBulkText(e.target.value)}
          placeholder={"id: warming-da-1\nkeywords: warming, emissions\nquality: 0.6\nRising emissions accelerate...\n---\nid: warming-da-2\nSolvency evidence text..."}
          rows={6}
        />
        {bulkStatus && <p className="text-sm text-muted-foreground">{bulkStatus}</p>}
        <Button variant="outline" onClick={handleBulkImport}>
          Import cards
        </Button>
      </div>

      {ranking.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No cards scored yet. Submit one above to start the ranking.
        </div>
      ) : (
        <div className="space-y-2">
          {ranking.map((breakdown) => {
            const aiAssessment = aiAssessments[breakdown.cardId]
            const aiError = aiErrors[breakdown.cardId]
            const isLoadingAi = aiLoadingId === breakdown.cardId
            return (
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

                <div className="border-t border-border pt-2 space-y-1.5">
                  {aiAssessment ? (
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="secondary">AI assessment</Badge>
                        <span className="text-muted-foreground">
                          overall {aiAssessment.overallScore}/100
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{aiAssessment.verdict}</p>
                      <div className="grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                        <span>Relevance: {aiAssessment.notes.relevance}</span>
                        <span>Clarity: {aiAssessment.notes.clarity}</span>
                        <span>Uniqueness: {aiAssessment.notes.uniqueness}</span>
                        <span>Evidence quality: {aiAssessment.notes.evidenceQuality}</span>
                        <span>Usability: {aiAssessment.notes.usability}</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={isLoadingAi}
                        onClick={() => handleGetAiAssessment(breakdown.cardId)}
                      >
                        {isLoadingAi ? "Re-scoring…" : "Refresh AI assessment"}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={isLoadingAi}
                      onClick={() => handleGetAiAssessment(breakdown.cardId)}
                    >
                      {isLoadingAi ? "Scoring…" : "Get AI assessment"}
                    </Button>
                  )}
                  {aiError && <p className="text-sm text-destructive">{aiError}</p>}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
