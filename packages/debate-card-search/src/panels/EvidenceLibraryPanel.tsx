/**
 * @fileoverview Shared Evidence Library panel — the UI follow-up named "(a)
 * a search panel UI" under the "Shared Evidence Library" bullet in TODO.md,
 * plus a submission form that closes that same bullet's "No submission UI
 * yet" gap (see `docs/features/evidence-library.md`) and, by giving the
 * repository a real source of `argBlock`/`wordCount`-carrying entries,
 * follow-up (a) under the "📊 Topic Coverage Dashboard" bullet ("an
 * `argBlock`/word-count field wired into a real card-submission flow beyond
 * the existing `/cards/library` evidence-library form"). Edit/Delete actions
 * close `docs/features/evidence-library.md`'s "No edit/delete affordance"
 * gap, and editing an entry closes follow-up (a) under the "🔁 Revision
 * Incentives" bullet ("wiring an actual card-edit/save flow to call
 * `saveRevisionRecord` with a before/after snapshot").
 *
 * Reads the persisted evidence repository via
 * `state/evidenceLibraryEntries.ts`'s `searchPersistedEvidenceLibrary`
 * (itself a thin composition of `shared-evidence-library.ts`'s pure
 * `searchEvidenceLibrary` against the persisted store) and renders a
 * free-text/kind search box over it, reusing the existing search/ranking
 * logic directly rather than introducing new logic here. The submission
 * form saves a new `EvidenceLibraryEntry` via the already-persisted
 * `saveEvidenceLibraryEntry`, stamping `wordCount` from the submitted body
 * text via the pure `computeWordCount` rather than asking the submitter to
 * count it themselves. Editing an existing entry instead calls
 * `saveEvidenceLibraryEntryRevision`, which records the edit as a
 * `CardRevisionRecord` (via the pure `buildEvidenceEntryRevision`) so it
 * feeds the Revision Incentives leaderboard.
 *
 * @module panels/EvidenceLibraryPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  deleteEvidenceLibraryEntry,
  listEvidenceLibraryEntries,
  saveEvidenceLibraryEntry,
  saveEvidenceLibraryEntryRevision,
  searchPersistedEvidenceLibrary,
} from "../state/evidenceLibraryEntries"
import { buildEvidenceSearchSummaryText, computeWordCount } from "../lib/shared-evidence-library"
import type { EvidenceEntryKind, EvidenceLibraryEntry, EvidenceSearchResult } from "../lib/shared-evidence-library"

const KIND_FILTERS: { value: EvidenceEntryKind | "all"; label: string }[] = [
  { value: "all", label: "All" },
  { value: "card", label: "Cards" },
  { value: "block", label: "Blocks" },
]

const KIND_VARIANT: Record<EvidenceEntryKind, "default" | "secondary"> = {
  card: "default",
  block: "secondary",
}

type EntryDraft = {
  kind: EvidenceEntryKind
  topic: string
  caseArea: string
  argBlock: string
  cite: string
  tags: string
  text: string
}

const EMPTY_DRAFT: EntryDraft = { kind: "card", topic: "", caseArea: "", argBlock: "", cite: "", tags: "", text: "" }

function entryToDraft(entry: EvidenceLibraryEntry): EntryDraft {
  return {
    kind: entry.kind,
    topic: entry.topic,
    caseArea: entry.caseArea,
    argBlock: entry.argBlock,
    cite: entry.cite,
    tags: entry.tags.join(", "),
    text: entry.text,
  }
}

/**
 * Renders the Shared Evidence Library: a card/block submission form, plus a
 * free-text search box and a card/block kind filter over every persisted
 * `EvidenceLibraryEntry`, ranked by keyword relevance when a text query is
 * present.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function EvidenceLibraryPanel() {
  const [hasEntries, setHasEntries] = useState<boolean | null>(null)
  const [queryText, setQueryText] = useState("")
  const [kind, setKind] = useState<EvidenceEntryKind | "all">("all")
  const [results, setResults] = useState<EvidenceSearchResult[]>([])
  const [draft, setDraft] = useState<EntryDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorContributorId, setEditorContributorId] = useState("")

  useEffect(() => {
    setHasEntries(listEvidenceLibraryEntries().length > 0)
  }, [])

  useEffect(() => {
    if (hasEntries === null) return
    const query = { text: queryText, ...(kind !== "all" ? { kind } : {}) }
    setResults(searchPersistedEvidenceLibrary(query))
  }, [hasEntries, queryText, kind])

  const refreshResults = () => {
    const query = { text: queryText, ...(kind !== "all" ? { kind } : {}) }
    setResults(searchPersistedEvidenceLibrary(query))
    setHasEntries(true)
  }

  const handleSubmit = () => {
    const topic = draft.topic.trim()
    const caseArea = draft.caseArea.trim()
    const argBlock = draft.argBlock.trim()
    const text = draft.text.trim()
    if (!topic || !caseArea || !argBlock || !text) {
      setError("Topic, case area, argument block, and body text are all required.")
      return
    }

    if (editingId) {
      const contributorId = editorContributorId.trim()
      if (!contributorId) {
        setError("Your contributor ID is required to save an edit.")
        return
      }
    }

    const tags = draft.tags
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
    const entry: EvidenceLibraryEntry = {
      id: editingId ?? `${draft.kind}-${argBlock}-${Date.now()}`,
      kind: draft.kind,
      topic,
      caseArea,
      argBlock,
      tags,
      text,
      cite: draft.cite.trim(),
      wordCount: computeWordCount(text),
    }

    if (editingId) {
      saveEvidenceLibraryEntryRevision(entry, editorContributorId.trim())
    } else {
      saveEvidenceLibraryEntry(entry)
    }

    setError(null)
    setDraft(EMPTY_DRAFT)
    setEditingId(null)
    setEditorContributorId("")
    refreshResults()
  }

  const handleEdit = (entry: EvidenceLibraryEntry) => {
    setEditingId(entry.id)
    setDraft(entryToDraft(entry))
    setError(null)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setEditorContributorId("")
    setDraft(EMPTY_DRAFT)
    setError(null)
  }

  const handleDelete = (id: string) => {
    deleteEvidenceLibraryEntry(id)
    if (editingId === id) handleCancelEdit()
    refreshResults()
  }

  if (hasEntries === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading evidence library…</div>
  }

  const summaryQuery = { text: queryText, ...(kind !== "all" ? { kind } : {}) }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Shared Evidence Library</h1>
        <p className="text-sm text-muted-foreground">
          Submit a cut card or reusable analytic block, then search the team repository by
          keyword, citation, or argument.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        {editingId && (
          <p className="text-sm font-medium text-foreground">
            Editing entry <span className="text-muted-foreground">{editingId}</span>
          </p>
        )}
        <div className="flex gap-1">
          {(["card", "block"] as const).map((option) => (
            <Button
              key={option}
              type="button"
              size="sm"
              variant={draft.kind === option ? "default" : "outline"}
              onClick={() => setDraft((prev) => ({ ...prev, kind: option }))}
            >
              {option === "card" ? "Card" : "Block"}
            </Button>
          ))}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="evidence-topic">Topic</Label>
            <Input
              id="evidence-topic"
              value={draft.topic}
              onChange={(e) => setDraft((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="Energy Policy"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evidence-case-area">Case area</Label>
            <Input
              id="evidence-case-area"
              value={draft.caseArea}
              onChange={(e) => setDraft((prev) => ({ ...prev, caseArea: e.target.value }))}
              placeholder="DA"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evidence-argblock">Argument block</Label>
            <Input
              id="evidence-argblock"
              value={draft.argBlock}
              onChange={(e) => setDraft((prev) => ({ ...prev, argBlock: e.target.value }))}
              placeholder="Warming DA"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="evidence-cite">Citation {draft.kind === "block" && "(optional)"}</Label>
            <Input
              id="evidence-cite"
              value={draft.cite}
              onChange={(e) => setDraft((prev) => ({ ...prev, cite: e.target.value }))}
              placeholder="Smith 24"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="evidence-tags">Tags (comma-separated, optional)</Label>
            <Input
              id="evidence-tags"
              value={draft.tags}
              onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="climate, impact"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="evidence-text">{draft.kind === "card" ? "Card text" : "Block text"}</Label>
            <Textarea
              id="evidence-text"
              value={draft.text}
              onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
              placeholder="Paste the cut card or draft the reusable block…"
            />
            <p className="text-xs text-muted-foreground">{computeWordCount(draft.text)} words</p>
          </div>
          {editingId && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="evidence-editor-id">Your contributor ID</Label>
              <Input
                id="evidence-editor-id"
                value={editorContributorId}
                onChange={(e) => setEditorContributorId(e.target.value)}
                placeholder="alex"
                className="max-w-xs"
              />
              <p className="text-xs text-muted-foreground">
                Saving this edit records a revision credited to this contributor.
              </p>
            </div>
          )}
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={handleSubmit}>
            {editingId ? "Save edit" : `Submit ${draft.kind === "card" ? "card" : "block"}`}
          </Button>
          {editingId && (
            <Button variant="outline" onClick={handleCancelEdit}>
              Cancel
            </Button>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={queryText}
          onChange={(event) => setQueryText(event.target.value)}
          placeholder="Search by keyword, argument, or citation…"
          aria-label="Search the evidence library"
          className="sm:max-w-sm"
        />
        <div className="flex gap-1">
          {KIND_FILTERS.map((filter) => (
            <Button
              key={filter.value}
              size="sm"
              variant={kind === filter.value ? "default" : "outline"}
              onClick={() => setKind(filter.value)}
            >
              {filter.label}
            </Button>
          ))}
        </div>
      </div>
      <p className="text-sm text-muted-foreground">{buildEvidenceSearchSummaryText(results, summaryQuery)}</p>
      {results.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No entries match this search.
        </div>
      ) : (
        <div className="space-y-2">
          {results.map(({ entry, relevanceScore }) => (
            <div key={entry.id} className="rounded-lg border border-border p-3">
              <div className="mb-1 flex flex-wrap items-center gap-2">
                <span className="font-medium text-foreground">{entry.argBlock}</span>
                <Badge variant={KIND_VARIANT[entry.kind]} className="capitalize">
                  {entry.kind}
                </Badge>
                {entry.topic && (
                  <Badge variant="outline">{entry.topic}</Badge>
                )}
                {entry.caseArea && (
                  <Badge variant="outline">{entry.caseArea}</Badge>
                )}
                {queryText.trim() && (
                  <span className="text-xs text-muted-foreground">relevance {relevanceScore}</span>
                )}
                <div className="ml-auto flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => handleEdit(entry)}>
                    Edit
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)}>
                    Delete
                  </Button>
                </div>
              </div>
              <p className="mb-2 text-sm text-muted-foreground">{entry.text}</p>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {entry.cite && <span className="font-medium">{entry.cite}</span>}
                {entry.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
