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
 * `saveRevisionRecord` with a before/after snapshot"). A "Stale evidence"
 * badge on card results closes that same bullet's follow-up (c) — a
 * forward-looking staleness signal via `getEvidenceStaleness`, rather than
 * only rewarding a refresh after the fact.
 *
 * The "Check this page" box and the submission form's Source URL field also
 * call the server-backed shared reuse index (`lib/evidence-reuse-check-client.ts`,
 * `/api/evidence-reuse-check`) alongside the existing local check — the
 * persisted `localStorage` repository only sees entries saved in this one
 * browser, so it can't answer "has anyone on the team cut this" across
 * devices; the shared index can. This closes the last open follow-up (a)
 * under TODO.md idea #7 ("On Page Card Reuse Search") together with the new
 * `apps/browser-extension`, which calls the same API against the active
 * tab's URL.
 *
 * Reads the persisted evidence repository via
 * `state/evidenceLibraryEntries.ts`'s `searchPersistedEvidenceLibraryWithIndex`
 * (itself a thin composition of `evidence-search-index.ts`'s pure
 * `buildEvidenceSearchIndex`/`searchEvidenceLibraryWithIndex` against the
 * persisted store) and renders a free-text/kind search box over it, reusing
 * the existing search/ranking logic directly rather than introducing new
 * logic here — this closes the remaining half of follow-up (c) named under
 * the "📋 Shared Evidence Library" bullet in TODO.md ("wiring the panel to
 * [the real search index]"), left open by the index's original PR. The
 * older keyword-overlap `searchPersistedEvidenceLibrary` stays exported for
 * any other caller, unchanged. The submission
 * form saves a new `EvidenceLibraryEntry` via the already-persisted
 * `saveEvidenceLibraryEntry`, stamping `wordCount` from the submitted body
 * text via the pure `computeWordCount` rather than asking the submitter to
 * count it themselves. Editing an existing entry instead calls
 * `saveEvidenceLibraryEntryRevision`, which records the edit as a
 * `CardRevisionRecord` (via the pure `buildEvidenceEntryRevision`) so it
 * feeds the Revision Incentives leaderboard. The Tags field suggests
 * existing tags from the persisted repository as the contributor types (via
 * `listPersistedTags`/`suggestTags`), closing follow-up (c) — "a
 * tag-autocomplete/tag-management affordance" — under the "📚 Common
 * Argument Library" bullet in TODO.md.
 *
 * A "Check this page" box implements the first slice of the "On Page Card
 * Reuse Search" idea in TODO.md's Product Feature Ideas list — pasting a
 * page URL calls `state/evidenceLibraryEntries.ts`'s
 * `checkPersistedPageForExistingCards` (itself a thin composition of
 * `shared-evidence-library.ts`'s pure `checkPageForExistingCards`) and
 * renders whether that page has already been cut, plus every matching
 * entry. The submission form's new optional Source URL field is how an
 * entry's `sourceUrl` gets recorded in the first place. A `?checkUrl=`
 * query param (read via `next/navigation`'s `useSearchParams`) pre-fills
 * and auto-runs the same check — the deep link the `extension/card-reuse-
 * checker` browser extension opens against the active tab's URL, since the
 * evidence repository lives in this app's own localStorage and an
 * extension (a different origin) can't read it directly. See
 * `buildReuseCheckDeepLink` in `lib/shared-evidence-library.ts` and the
 * extension's own README.
 *
 * Every local check is now also recorded to a small history log
 * (`state/reuseCheckHistory.ts`) instead of only showing the latest
 * lookup's result — closes idea #7's next named follow-up, "Surface each
 * check's result inline in a small history list on `/cards/library` instead
 * of a one-shot lookup." A "Recent checks" list under the box shows the last
 * `MAX_REUSE_CHECK_HISTORY` lookups (URL, already-cut/new badge, match
 * count, relative time); clicking an entry re-runs that same check. A
 * "Clear history" action removes the whole log.
 *
 * @module panels/EvidenceLibraryPanel
 */

"use client"

import { useEffect, useState } from "react"
import { useSearchParams } from "next/navigation"
import { Badge } from "../ui/primitives/badge"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import { Textarea } from "../ui/primitives/textarea"
import { EmptyState } from "../ui/panels/panel-shell"
import {
  checkPersistedPageForExistingCards,
  deleteEvidenceLibraryEntry,
  getEvidenceLibraryEntry,
  listEvidenceLibraryEntries,
  listPendingReviewEntries,
  listPersistedTags,
  saveEvidenceLibraryEntry,
  saveEvidenceLibraryEntryRevision,
  searchPersistedEvidenceLibraryWithIndex,
} from "../state/evidenceLibraryEntries"
import { getPeerReview } from "../state/peerReviews"
import {
  appendReuseCheckHistory,
  clearReuseCheckHistory,
  listReuseCheckHistory,
  type ReuseCheckHistoryRecord,
} from "../state/reuseCheckHistory"
import {
  buildEvidenceSearchFormQuery,
  buildEvidenceSearchSummaryText,
  buildPageReuseCheckSummaryText,
  computeWordCount,
  getEvidenceStaleness,
} from "../lib/shared-evidence-library"
import {
  applyTagSuggestion,
  normalizeTagsToKnownCasing,
  parseTagsInput,
  suggestTags,
} from "../lib/argument-library"
import { checkRemotePageForExistingCards, registerRemoteReuseEntry } from "../lib/evidence-reuse-check-client"
import type {
  EvidenceEntryKind,
  EvidenceLibraryEntry,
  EvidenceSearchResult,
  PageReuseCheckResult,
} from "../lib/shared-evidence-library"
import type { RemotePageReuseCheckResult } from "../lib/evidence-reuse-check-client"

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
  sourceUrl: string
}

const EMPTY_DRAFT: EntryDraft = {
  kind: "card",
  topic: "",
  caseArea: "",
  argBlock: "",
  cite: "",
  tags: "",
  text: "",
  sourceUrl: "",
}

function entryToDraft(entry: EvidenceLibraryEntry): EntryDraft {
  return {
    kind: entry.kind,
    topic: entry.topic,
    caseArea: entry.caseArea,
    argBlock: entry.argBlock,
    cite: entry.cite,
    tags: entry.tags.join(", "),
    text: entry.text,
    sourceUrl: entry.sourceUrl ?? "",
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
  const [filterTopic, setFilterTopic] = useState("")
  const [filterCaseArea, setFilterCaseArea] = useState("")
  const [filterTags, setFilterTags] = useState("")
  const [results, setResults] = useState<EvidenceSearchResult[]>([])
  const [pendingEntries, setPendingEntries] = useState<EvidenceLibraryEntry[]>([])
  const [draft, setDraft] = useState<EntryDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editorContributorId, setEditorContributorId] = useState("")
  const [knownTags, setKnownTags] = useState<string[]>([])
  const [reuseCheckUrl, setReuseCheckUrl] = useState("")
  const [reuseCheckResult, setReuseCheckResult] = useState<PageReuseCheckResult | null>(null)
  const [remoteReuseCheckResult, setRemoteReuseCheckResult] = useState<RemotePageReuseCheckResult | null>(null)
  const [remoteReuseCheckError, setRemoteReuseCheckError] = useState<string | null>(null)
  const [checkHistory, setCheckHistory] = useState<ReuseCheckHistoryRecord[]>([])
  const searchParams = useSearchParams()

  useEffect(() => {
    setHasEntries(listEvidenceLibraryEntries().length > 0)
    setKnownTags(listPersistedTags())
    setPendingEntries(listPendingReviewEntries())
    setCheckHistory(listReuseCheckHistory())
  }, [])

  // Deep-linked from the `extension/card-reuse-checker` browser extension
  // (or any other caller) via a `?checkUrl=` query param — pre-fills and
  // runs the "Check this page" box automatically, standing in for a
  // same-origin API the extension can't reach directly (see
  // `buildReuseCheckDeepLink` in `lib/shared-evidence-library.ts`).
  useEffect(() => {
    const checkUrl = searchParams?.get("checkUrl")
    if (!checkUrl) return
    setReuseCheckUrl(checkUrl)
    const result = checkPersistedPageForExistingCards(checkUrl)
    setReuseCheckResult(result)
    appendReuseCheckHistory(result)
    setCheckHistory(listReuseCheckHistory())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  const buildQuery = () =>
    buildEvidenceSearchFormQuery({
      text: queryText,
      kind: kind === "all" ? undefined : kind,
      topic: filterTopic,
      caseArea: filterCaseArea,
      tags: filterTags,
    })

  useEffect(() => {
    if (hasEntries === null) return
    setResults(searchPersistedEvidenceLibraryWithIndex(buildQuery()))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasEntries, queryText, kind, filterTopic, filterCaseArea, filterTags])

  const refreshResults = () => {
    setResults(searchPersistedEvidenceLibraryWithIndex(buildQuery()))
    setHasEntries(true)
    setKnownTags(listPersistedTags())
    setPendingEntries(listPendingReviewEntries())
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

    const tags = normalizeTagsToKnownCasing(
      draft.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      knownTags,
    )
    // A brand-new entry is stamped with the "first saved" moment
    // `state/newsStream.ts`'s `argumentLibraryNews()` sources its News
    // Stream timestamp from (mirroring `SprintNotesPanel.tsx`'s identical
    // `createdAt: Date.now()` on a new note); an edit keeps the original
    // entry's `createdAt` rather than resetting it to now.
    const createdAt = editingId ? getEvidenceLibraryEntry(editingId)?.createdAt : Date.now()
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
      ...(draft.sourceUrl.trim() ? { sourceUrl: draft.sourceUrl.trim() } : {}),
      ...(createdAt !== undefined ? { createdAt } : {}),
    }

    if (editingId) {
      saveEvidenceLibraryEntryRevision(entry, editorContributorId.trim())
    } else {
      saveEvidenceLibraryEntry(entry)
    }

    if (entry.sourceUrl) {
      // Best-effort: the shared reuse index is a cross-device convenience,
      // not required for the entry to save locally, so a network failure
      // here doesn't block the submission.
      registerRemoteReuseEntry({
        id: entry.id,
        sourceUrl: entry.sourceUrl,
        cite: entry.cite,
        argBlock: entry.argBlock,
        topic: entry.topic,
        contributorId: editorContributorId.trim(),
      }).catch(() => {})
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

  const handleReuseCheck = (urlOverride?: string) => {
    const url = (urlOverride ?? reuseCheckUrl).trim()
    if (!url) {
      setReuseCheckResult(null)
      setRemoteReuseCheckResult(null)
      setRemoteReuseCheckError(null)
      return
    }
    setReuseCheckUrl(url)
    const result = checkPersistedPageForExistingCards(url)
    setReuseCheckResult(result)
    setRemoteReuseCheckResult(null)
    setRemoteReuseCheckError(null)
    appendReuseCheckHistory(result)
    setCheckHistory(listReuseCheckHistory())
    checkRemotePageForExistingCards(url)
      .then(setRemoteReuseCheckResult)
      .catch((err: unknown) => setRemoteReuseCheckError(err instanceof Error ? err.message : "Shared reuse check failed."))
  }

  const handleClearCheckHistory = () => {
    clearReuseCheckHistory()
    setCheckHistory([])
  }

  if (hasEntries === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading evidence library…</div>
  }

  const summaryQuery = buildQuery()
  const currentYear = new Date().getFullYear()
  const { completedTags, draftTag } = parseTagsInput(draft.tags)
  const tagSuggestions = suggestTags(knownTags, draftTag, completedTags)

  const applySuggestion = (suggestion: string) => {
    setDraft((prev) => ({ ...prev, tags: applyTagSuggestion(prev.tags, suggestion) }))
  }

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
          <div className="space-y-1.5">
            <Label htmlFor="evidence-source-url">Source URL {draft.kind === "block" && "(optional)"}</Label>
            <Input
              id="evidence-source-url"
              value={draft.sourceUrl}
              onChange={(e) => setDraft((prev) => ({ ...prev, sourceUrl: e.target.value }))}
              placeholder="https://example.com/article"
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
            {tagSuggestions.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground">Existing tags:</span>
                {tagSuggestions.map((suggestion) => (
                  <Button
                    key={suggestion}
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => applySuggestion(suggestion)}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
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

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <h2 className="text-sm font-medium text-foreground">Check this page</h2>
          <p className="text-xs text-muted-foreground">
            Paste a page URL to see whether anyone has already cut a card from it before you start
            cutting. The <code>card-reuse-checker</code> browser extension runs this same check
            automatically for the page you're on — see{" "}
            <code>extension/card-reuse-checker</code> in the repo to install it.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input
            value={reuseCheckUrl}
            onChange={(e) => setReuseCheckUrl(e.target.value)}
            placeholder="https://example.com/article"
            aria-label="Page URL to check for existing cards"
            className="sm:max-w-sm"
          />
          <Button type="button" variant="outline" onClick={() => handleReuseCheck()}>
            Check for existing cards
          </Button>
        </div>
        {reuseCheckResult && (
          <div className="space-y-2">
            <p
              className={`text-sm ${reuseCheckResult.alreadyCut ? "text-destructive" : "text-muted-foreground"}`}
            >
              {buildPageReuseCheckSummaryText(reuseCheckResult)}
            </p>
            {reuseCheckResult.matches.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-dashed border-border p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{entry.argBlock}</span>
                  {entry.cite && <span className="text-xs text-muted-foreground">{entry.cite}</span>}
                </div>
                <p className="text-sm text-muted-foreground">{entry.text}</p>
              </div>
            ))}
          </div>
        )}
        {remoteReuseCheckError && (
          <p className="text-xs text-muted-foreground">
            Shared team index unavailable ({remoteReuseCheckError}) — showing only this browser&apos;s local check above.
          </p>
        )}
        {remoteReuseCheckResult && (
          <div className="space-y-2 border-t border-dashed border-border pt-2">
            <p className="text-xs font-medium text-foreground">Team-wide check (shared index)</p>
            <p
              className={`text-sm ${remoteReuseCheckResult.alreadyCut ? "text-destructive" : "text-muted-foreground"}`}
            >
              {remoteReuseCheckResult.alreadyCut
                ? `Already cut by the team: ${remoteReuseCheckResult.matches.length} matching ${remoteReuseCheckResult.matches.length === 1 ? "entry" : "entries"}.`
                : "No teammate has registered a cut for this page yet."}
            </p>
            {remoteReuseCheckResult.matches.map((match) => (
              <div key={match.id} className="rounded-lg border border-dashed border-border p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{match.argBlock}</span>
                  {match.cite && <span className="text-xs text-muted-foreground">{match.cite}</span>}
                  {match.topic && <Badge variant="outline">{match.topic}</Badge>}
                </div>
              </div>
            ))}
          </div>
        )}
        {checkHistory.length > 0 && (
          <div className="space-y-2 border-t border-dashed border-border pt-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-foreground">Recent checks</p>
              <button
                type="button"
                onClick={handleClearCheckHistory}
                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
              >
                Clear history
              </button>
            </div>
            <ul className="space-y-1">
              {checkHistory.map((entry) => (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => handleReuseCheck(entry.url)}
                    className="flex w-full flex-wrap items-center gap-2 rounded-md border border-transparent px-2 py-1 text-left text-xs hover:border-border hover:bg-muted"
                  >
                    <Badge variant={entry.alreadyCut ? "default" : "secondary"}>
                      {entry.alreadyCut ? `Already cut (${entry.matchCount})` : "New"}
                    </Badge>
                    <span className="truncate text-foreground">{entry.url}</span>
                    <span className="ml-auto shrink-0 text-muted-foreground">
                      {new Date(entry.checkedAt).toLocaleString()}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={filterTopic}
          onChange={(event) => setFilterTopic(event.target.value)}
          placeholder="Filter by topic…"
          aria-label="Filter by topic"
          className="sm:max-w-xs"
        />
        <Input
          value={filterCaseArea}
          onChange={(event) => setFilterCaseArea(event.target.value)}
          placeholder="Filter by case area…"
          aria-label="Filter by case area"
          className="sm:max-w-xs"
        />
        <Input
          value={filterTags}
          onChange={(event) => setFilterTags(event.target.value)}
          placeholder="Filter by tags (comma-separated)…"
          aria-label="Filter by tags"
          className="sm:max-w-xs"
        />
      </div>
      {pendingEntries.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-foreground">
            Pending review ({pendingEntries.length})
          </h2>
          <p className="text-xs text-muted-foreground">
            These entries have an in-progress <code>CardReview</code> and won&apos;t appear in
            search results until the review reaches &quot;Published&quot; in the Review Queue.
          </p>
          <div className="space-y-2">
            {pendingEntries.map((entry) => (
              <div key={entry.id} className="rounded-lg border border-dashed border-border p-3">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-foreground">{entry.argBlock}</span>
                  <Badge variant={KIND_VARIANT[entry.kind]} className="capitalize">
                    {entry.kind}
                  </Badge>
                  <Badge variant="outline">{getPeerReview(entry.id)?.status ?? "unknown"}</Badge>
                  <div className="ml-auto flex gap-1">
                    <Button size="sm" variant="ghost" onClick={() => handleEdit(entry)}>
                      Edit
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(entry.id)}>
                      Delete
                    </Button>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">{entry.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
      <p className="text-sm text-muted-foreground">{buildEvidenceSearchSummaryText(results, summaryQuery)}</p>
      {results.length === 0 ? (
        <EmptyState title="No entries match this search." />
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
                {entry.kind === "card" && getEvidenceStaleness(entry, currentYear).isStale && (
                  <Badge variant="destructive">Stale evidence</Badge>
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
