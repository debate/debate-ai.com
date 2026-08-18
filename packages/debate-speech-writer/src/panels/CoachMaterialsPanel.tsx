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
 * @module panels/CoachMaterialsPanel
 */

"use client"

import { useEffect, useState } from "react"
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
import {
  buildCoachMaterialLibraryFromStore,
  deleteCoachMaterial,
  findRelevantMaterialsFromStore,
  saveCoachMaterial,
} from "../state/coachMaterials"
import type { CoachMaterialLibrary } from "../coach/team-coach-materials"

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
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [matches, setMatches] = useState<CoachMaterialMatch[] | null>(null)
  const [answer, setAnswer] = useState<string | null>(null)
  const [asking, setAsking] = useState(false)
  const [askError, setAskError] = useState<string | null>(null)

  useEffect(() => {
    setLibrary(buildCoachMaterialLibraryFromStore())
  }, [])

  const refresh = () => setLibrary(buildCoachMaterialLibraryFromStore())

  const handleSave = () => {
    const title = form.title.trim()
    const text = form.text.trim()
    if (!title || !text) {
      setError("Title and material text are required.")
      return
    }

    saveCoachMaterial({
      id: `${form.kind}-${Date.now()}`,
      kind: form.kind,
      title,
      topic: form.topic.trim() || undefined,
      tags: parseTags(form.tags),
      text,
    })
    setError(null)
    setForm(EMPTY_FORM)
    refresh()
  }

  const handleDelete = (id: string) => {
    deleteCoachMaterial(id)
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
      const result = await requestTeamCoachAnswer(question, currentMatches)
      setAnswer(result)
    } catch (e) {
      setAskError(e instanceof Error ? e.message : "Failed to get an answer from the coach.")
    } finally {
      setAsking(false)
    }
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
          <Label htmlFor="coach-material-text">Material text</Label>
          <Textarea
            id="coach-material-text"
            value={form.text}
            onChange={(e) => setForm((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Paste the lecture transcript, handout, or notes here…"
            className="min-h-32"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave}>Add material</Button>
      </div>

      {library.totalMaterials === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No coach materials uploaded yet. Add one above to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          {library.groups.map((group) => (
            <div key={group.kind} className="space-y-2">
              <h2 className="text-sm font-medium text-foreground">{KIND_LABELS[group.kind]}</h2>
              <div className="space-y-2">
                {group.materials.map((material) => (
                  <div
                    key={material.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-md border border-border px-3 py-2"
                  >
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
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(material.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-foreground">Ask the coach</h2>
          <p className="text-xs text-muted-foreground">
            Ask a question and the team coach AI answers strictly from your grounding materials —
            or say so if they don't cover it.
          </p>
        </div>
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
