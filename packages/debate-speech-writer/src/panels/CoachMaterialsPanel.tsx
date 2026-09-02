/**
 * @fileoverview Coach Materials panel — the "(c) a materials-upload/coach
 * chat panel UI" follow-up named under idea #8 ("Video-Lecture-Training
 * Coach AI") in TODO.md's Product Feature Ideas list, plus follow-up (b)'s
 * real AI Q&A call.
 *
 * Lets a coach upload grounding materials (lecture transcripts, camp
 * materials, instructional documents, practice-round recordings) through
 * the already-persisted `state/coachMaterials.ts` (`saveCoachMaterial`,
 * `deleteCoachMaterial`), lists every persisted material grouped by kind via
 * the new `buildCoachMaterialLibraryFromStore`, and lets a coach ask the
 * team coach AI a question — previewing which materials it would draw on
 * via `findRelevantMaterialsFromStore` plus the already-existing
 * `buildGroundedCoachPrompt`, then calling `requestTeamCoachAnswer` for a
 * real, grounded answer. No new material-scoring or grouping logic is
 * introduced here.
 *
 * A "Upload a document" file input calls the new
 * `document-material-extraction.ts`'s `extractMaterialTextFromDocument` to
 * fill the Material text field from an uploaded .docx/.txt/.md file instead
 * of requiring it to be pasted in by hand, closing the "document" half of
 * follow-up (a) named under idea #8 in TODO.md. A "🎤 Record" button next to
 * the same field, wired to `hooks/useMicrophoneTranscription.ts`, dictates
 * directly into it via the browser's own Web Speech API, closing the
 * remaining "recording" half (no server-side/paid transcription service
 * exists in this repo) — mirroring idea #6's identical fix in
 * `debate-round`'s `FlowSummariesPanel`.
 *
 * The "Ask the coach" section also renders and persists a conversation
 * history (`state/coachConversation.ts`), feeding prior turns back into
 * `requestTeamCoachAnswer` so a follow-up question can build on an earlier
 * answer, closing the "No conversation history" Known gap recorded in
 * `docs/features/coach-materials.md`.
 *
 * A search/filter bar (keyword search plus a tag dropdown, both backed by
 * the new `filterCoachMaterials`/`listCoachMaterialTags` in
 * `team-coach-materials.ts`) sits above the material list once at least one
 * material exists, closing the "material tagging and a search/filter bar
 * once a library grows past a handful of uploads" follow-up named under
 * idea #8 in TODO.md.
 *
 * Each material also has an "Edit" action (loads it back into the form,
 * saving in place instead of always creating a new record) and a "History"
 * toggle listing every version `state/coachMaterialVersions.ts` snapshotted
 * before an overwrite, each restorable — closing the "No version history
 * for a material that gets re-uploaded/edited" Known gap recorded in
 * `docs/features/coach-materials.md`.
 *
 * @module panels/CoachMaterialsPanel
 */

"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select"
import {
  buildGroundedCoachPrompt,
  COACH_MATERIAL_KIND_LABELS,
  COACH_MATERIAL_KIND_ORDER,
  type CoachMaterialKind,
  type CoachMaterialMatch,
} from "../coach/team-coach-materials"
import { requestTeamCoachAnswer } from "../coach/team-coach-client"
import { extractMaterialTextFromDocument } from "../coach/document-material-extraction"
import { appendDictatedSegment } from "../coach/microphone-transcription"
import { useMicrophoneTranscription } from "../hooks/useMicrophoneTranscription"
import {
  buildCoachMaterialLibraryFromStore,
  deleteCoachMaterial,
  findRelevantMaterialsFromStore,
  listCoachMaterialTagsFromStore,
  saveCoachMaterial,
} from "../state/coachMaterials"
import {
  listVersionsForMaterial,
  materialFromVersion,
  type CoachMaterialVersion,
} from "../state/coachMaterialVersions"
import {
  appendCoachConversationTurn,
  clearCoachConversationHistory,
  listCoachConversationTurns,
} from "../state/coachConversation"
import type { CoachConversationTurn, CoachMaterial, CoachMaterialLibrary } from "../coach/team-coach-materials"

// The labels and display order live with the material model itself, so the
// form, the badges and `buildCoachMaterialLibrary`'s grouping stay in step.
const KIND_LABELS = COACH_MATERIAL_KIND_LABELS

const KIND_OPTIONS = COACH_MATERIAL_KIND_ORDER

type FormState = {
  kind: CoachMaterialKind
  title: string
  topic: string
  tags: string
  text: string
}

const EMPTY_FORM: FormState = {
  kind: "lecture_transcript",
  title: "",
  topic: "",
  tags: "",
  text: "",
}

function parseTags(raw: string): string[] {
  return raw
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

/**
 * Renders the Coach Materials panel: an upload form, every persisted
 * material grouped by kind with a delete action, and an "ask the coach"
 * preview of the materials + grounded prompt a question would draw on.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function CoachMaterialsPanel() {
  const [library, setLibrary] = useState<CoachMaterialLibrary | null>(null)
  const [totalUnfiltered, setTotalUnfiltered] = useState(0)
  const [allTags, setAllTags] = useState<string[]>([])
  const [filterQuery, setFilterQuery] = useState("")
  const [filterTag, setFilterTag] = useState("")
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [historyOpenId, setHistoryOpenId] = useState<string | null>(null)
  const [versions, setVersions] = useState<CoachMaterialVersion[]>([])
  const [error, setError] = useState<string | null>(null)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [question, setQuestion] = useState("")
  const [matches, setMatches] = useState<CoachMaterialMatch[] | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)
  const [history, setHistory] = useState<CoachConversationTurn[]>([])

  const dictation = useMicrophoneTranscription({
    onSegment: (segment) => setForm((prev) => ({ ...prev, text: appendDictatedSegment(prev.text, segment) })),
  })

  useEffect(() => {
    setAllTags(listCoachMaterialTagsFromStore())
    setTotalUnfiltered(buildCoachMaterialLibraryFromStore().totalMaterials)
    setHistory(listCoachConversationTurns())
  }, [])

  useEffect(() => {
    setLibrary(
      buildCoachMaterialLibraryFromStore({
        query: filterQuery.trim() || undefined,
        tag: filterTag || undefined,
      }),
    )
  }, [filterQuery, filterTag])

  const refresh = () => {
    setLibrary(
      buildCoachMaterialLibraryFromStore({
        query: filterQuery.trim() || undefined,
        tag: filterTag || undefined,
      }),
    )
    setAllTags(listCoachMaterialTagsFromStore())
    setTotalUnfiltered(buildCoachMaterialLibraryFromStore().totalMaterials)
  }

  const handleSave = () => {
    const title = form.title.trim()
    const text = form.text.trim()
    if (!title || !text) {
      setError("Title and material text are required.")
      return
    }

    saveCoachMaterial({
      id: editingId ?? `${form.kind}-${Date.now()}`,
      kind: form.kind,
      title,
      topic: form.topic.trim() || undefined,
      tags: parseTags(form.tags),
      text,
    })
    setError(null)
    setForm(EMPTY_FORM)
    setEditingId(null)
    if (historyOpenId === editingId) setVersions(listVersionsForMaterial(editingId as string))
    refresh()
  }

  const handleEdit = (material: CoachMaterial) => {
    setForm({
      kind: material.kind,
      title: material.title,
      topic: material.topic ?? "",
      tags: material.tags.join(", "),
      text: material.text,
    })
    setEditingId(material.id)
    setError(null)
  }

  const handleCancelEdit = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setError(null)
  }

  const handleToggleHistory = (materialId: string) => {
    if (historyOpenId === materialId) {
      setHistoryOpenId(null)
      return
    }
    setVersions(listVersionsForMaterial(materialId))
    setHistoryOpenId(materialId)
  }

  const handleRestore = (version: CoachMaterialVersion) => {
    saveCoachMaterial(materialFromVersion(version))
    setVersions(listVersionsForMaterial(version.materialId))
    if (editingId === version.materialId) handleCancelEdit()
    refresh()
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ""
    if (!file) return

    setUploading(true)
    setUploadError(null)
    try {
      const text = await extractMaterialTextFromDocument({ fileName: file.name, content: file })
      const titleFromFile = file.name.replace(/\.[^./]+$/, "")
      setForm((prev) => ({ ...prev, text, title: prev.title.trim() || titleFromFile }))
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Failed to read the uploaded file.")
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = (id: string) => {
    deleteCoachMaterial(id)
    if (editingId === id) handleCancelEdit()
    if (historyOpenId === id) {
      setHistoryOpenId(null)
      setVersions([])
    }
    refresh()
  }

  const handleAsk = () => {
    setMatches(findRelevantMaterialsFromStore(question, { limit: 5 }))
    setAnswer(null)
    setAskError(null)
  }

  const handleGetAnswer = async () => {
    const currentMatches = matches ?? findRelevantMaterialsFromStore(question, { limit: 5 })
    setMatches(currentMatches)
    setAsking(true)
    setAskError(null)
    setAnswer(null)
    try {
      const result = await requestTeamCoachAnswer(question, currentMatches, { history })
      setAnswer(result)
      const turn = appendCoachConversationTurn({ question, answer: result })
      setHistory((prev) => [...prev, turn])
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Failed to get an answer from the coach.")
    } finally {
      setAsking(false)
    }
  }

  const handleClearHistory = () => {
    clearCoachConversationHistory()
    setHistory([])
  }

  if (library === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading coach materials…</div>
  }

  const groundedPrompt = matches === null ? null : buildGroundedCoachPrompt(question, matches)

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Coach Materials</h1>
        <p className="text-sm text-muted-foreground">
          Upload lecture transcripts, camp materials, instructional documents, and practice-round
          recordings to ground the team coach AI in your own teaching materials.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-kind">Kind</Label>
            <Select
              value={form.kind}
              onValueChange={(value) => setForm((prev) => ({ ...prev, kind: value as CoachMaterialKind }))}
            >
              <SelectTrigger id="coach-material-kind" className="w-56">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {KIND_OPTIONS.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-title">Title</Label>
            <Input
              id="coach-material-title"
              value={form.title}
              onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Topicality Basics"
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-topic">Topic (optional)</Label>
            <Input
              id="coach-material-topic"
              value={form.topic}
              onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="T"
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-tags">Tags (comma-separated)</Label>
            <Input
              id="coach-material-tags"
              value={form.tags}
              onChange={(e) => setForm((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="theory, case"
              className="max-w-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <Label htmlFor="coach-material-text">Material text</Label>
            <div className="flex items-center gap-2">
              {dictation.isSupported ? (
                <Button
                  type="button"
                  size="sm"
                  variant={dictation.isListening ? "destructive" : "outline"}
                  onClick={dictation.isListening ? dictation.stop : dictation.start}
                >
                  {dictation.isListening ? "Stop recording" : "🎤 Record"}
                </Button>
              ) : (
                <span className="text-xs text-muted-foreground">
                  Microphone dictation isn't supported in this browser.
                </span>
              )}
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {uploading ? "Reading file…" : "Upload a document"}
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,.txt,.md,.markdown"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>
          </div>
          <Textarea
            id="coach-material-text"
            value={form.text}
            onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Paste the lecture transcript, handout, or notes here, upload a .docx/.txt/.md file, or click Record to dictate it…"
            className="min-h-32"
          />
          {dictation.isListening && (
            <p className="text-xs text-muted-foreground">Listening… speak now.</p>
          )}
          {dictation.error && <p className="text-sm text-destructive">{dictation.error}</p>}
          {uploadError && <p className="text-sm text-destructive">{uploadError}</p>}
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <Button onClick={handleSave}>{editingId ? "Save changes" : "Add material"}</Button>
          {editingId && (
            <Button type="button" variant="ghost" onClick={handleCancelEdit}>
              Cancel edit
            </Button>
          )}
        </div>
      </div>

      {totalUnfiltered > 0 && (
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5 flex-1 min-w-[16rem]">
            <Label htmlFor="coach-material-search">Search materials</Label>
            <Input
              id="coach-material-search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Search by title, topic, tag, or text…"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-tag-filter">Tag</Label>
            <Select value={filterTag || "__all__"} onValueChange={(value) => setFilterTag(value === "__all__" ? "" : value)}>
              <SelectTrigger id="coach-material-tag-filter" className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All tags</SelectItem>
                {allTags.map((tag) => (
                  <SelectItem key={tag} value={tag}>
                    {tag}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {(filterQuery || filterTag) && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setFilterQuery("")
                setFilterTag("")
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {library.totalMaterials === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          {totalUnfiltered === 0
            ? "No coach materials uploaded yet. Add one above to see it here."
            : "No materials match this search/tag filter."}
        </div>
      ) : (
        <div className="space-y-4">
          {library.groups.map((group) => (
            <div key={group.kind} className="space-y-2">
              <h2 className="text-sm font-medium text-foreground">{KIND_LABELS[group.kind]}</h2>
              <div className="space-y-2">
                {group.materials.map((material) => (
                  <div key={material.id} className="rounded-md border border-border px-3 py-2">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-foreground">{material.title}</span>
                          {material.topic && <Badge variant="outline">{material.topic}</Badge>}
                          {material.tags.map((tag) => (
                            <Badge key={tag} variant="secondary">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                        <p className="text-xs text-muted-foreground">{material.text.slice(0, 160)}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="ghost" onClick={() => handleToggleHistory(material.id)}>
                          {historyOpenId === material.id ? "Hide history" : "History"}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleEdit(material)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => handleDelete(material.id)}>
                          Delete
                        </Button>
                      </div>
                    </div>

                    {historyOpenId === material.id && (
                      <div className="mt-2 space-y-2 border-t border-border pt-2">
                        {versions.length === 0 ? (
                          <p className="text-xs text-muted-foreground">
                            No prior versions — this material hasn't been edited yet.
                          </p>
                        ) : (
                          versions.map((version) => (
                            <div
                              key={version.id}
                              className="flex flex-wrap items-start justify-between gap-2 rounded-md bg-muted/30 px-2 py-1.5"
                            >
                              <div className="space-y-0.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className="text-xs font-medium text-foreground">{version.title}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Replaced {new Date(version.replacedAt).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground">{version.text.slice(0, 120)}</p>
                              </div>
                              <Button size="sm" variant="outline" onClick={() => handleRestore(version)}>
                                Restore this version
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-sm font-medium text-foreground">Ask the coach</h2>
            <p className="text-xs text-muted-foreground">
              Ask a question and the team coach AI answers strictly from your grounding materials —
              or say so if they don't cover it. Follow-up questions build on the conversation below.
            </p>
          </div>
          {history.length > 0 && (
            <Button type="button" size="sm" variant="ghost" onClick={handleClearHistory}>
              Clear conversation
            </Button>
          )}
        </div>

        {history.length > 0 && (
          <div className="space-y-2">
            <Label>Conversation</Label>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {history.map((turn) => (
                <div key={turn.id} className="rounded-md border border-border px-3 py-2 text-sm">
                  <p className="font-medium text-foreground">{turn.question}</p>
                  <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{turn.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1.5 flex-1 min-w-[16rem]">
            <Label htmlFor="coach-question">Question</Label>
            <Input
              id="coach-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How do I answer a topicality violation?"
            />
          </div>
          <Button variant="outline" onClick={handleAsk}>
            Preview grounded prompt
          </Button>
          <Button onClick={handleGetAnswer} disabled={asking || question.trim().length === 0}>
            {asking ? "Asking…" : "Ask the coach"}
          </Button>
        </div>

        {groundedPrompt && (
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
            {groundedPrompt}
          </pre>
        )}

        {askError && <p className="text-sm text-destructive">{askError}</p>}

        {answer && (
          <div className="space-y-1.5">
            <Label>Coach's answer</Label>
            <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
              {answer}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
