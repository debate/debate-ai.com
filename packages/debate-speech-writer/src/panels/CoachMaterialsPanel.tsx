/**
 * @fileoverview Team Coach Materials panel — the "(c) a materials-upload/
 * coach chat panel UI" follow-up named in the `team-coach-materials.ts`
 * slice for idea #8 ("Video-Lecture-Training Coach AI") in TODO.md.
 *
 * Lets a coach upload a `CoachMaterial` (lecture transcript, camp material,
 * instructional document, or practice-round recording) through the
 * already-persisted `state/coachMaterials.ts` (`saveCoachMaterial`,
 * `deleteCoachMaterial`), and renders every persisted material grouped by
 * kind via `buildPersistedCoachMaterialLibrary`. A "coach chat" section lets
 * a user type a question and preview the grounded prompt a future AI Q&A
 * call would receive, composed from `findRelevantPersistedMaterials` and
 * `buildGroundedCoachPrompt` — no AI model is called here (follow-up (b)
 * remains open), only the request that call would consume.
 *
 * @module panels/CoachMaterialsPanel
 */

"use client"

import { useEffect, useMemo, useState } from "react"
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
  COACH_MATERIAL_KIND_LABELS,
  COACH_MATERIAL_KIND_ORDER,
  excerptMaterialText,
  buildGroundedCoachPrompt,
  type CoachMaterial,
  type CoachMaterialKind,
  type CoachMaterialLibrary,
} from "../coach/team-coach-materials"
import {
  buildPersistedCoachMaterialLibrary,
  deleteCoachMaterial,
  findRelevantPersistedMaterials,
  saveCoachMaterial,
} from "../state/coachMaterials"

type MaterialDraft = {
  id: string
  kind: CoachMaterialKind
  title: string
  topic: string
  tags: string
  text: string
}

const EMPTY_DRAFT: MaterialDraft = {
  id: "",
  kind: COACH_MATERIAL_KIND_ORDER[0],
  title: "",
  topic: "",
  tags: "",
  text: "",
}

function parseTags(tags: string): string[] {
  return tags
    .split(",")
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0)
}

/**
 * Renders the Team Coach Materials panel: a form to upload a grounding
 * material, every persisted material grouped by kind with a "Remove"
 * action, and a coach Q&A preview that shows the grounded prompt a future
 * AI call would receive for a typed question.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function CoachMaterialsPanel() {
  const [library, setLibrary] = useState<CoachMaterialLibrary | null>(null)
  const [draft, setDraft] = useState<MaterialDraft>(EMPTY_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const [question, setQuestion] = useState("")
  const [topicFilter, setTopicFilter] = useState<string>("all")

  useEffect(() => {
    setLibrary(buildPersistedCoachMaterialLibrary())
  }, [])

  const refresh = () => setLibrary(buildPersistedCoachMaterialLibrary())

  const topics = useMemo(() => {
    if (!library) return []
    const all = library.groups.flatMap((group) => group.materials.map((material) => material.topic))
    return Array.from(new Set(all.filter((topic): topic is string => Boolean(topic)))).sort()
  }, [library])

  const matches = useMemo(() => {
    if (question.trim().length === 0) return []
    return findRelevantPersistedMaterials(question, {
      limit: 3,
      ...(topicFilter !== "all" ? { topic: topicFilter } : {}),
    })
  }, [question, topicFilter, library])

  const groundedPrompt = useMemo(() => {
    if (question.trim().length === 0) return null
    return buildGroundedCoachPrompt(question, matches)
  }, [question, matches])

  const handleSave = () => {
    const id = draft.id.trim()
    const title = draft.title.trim()
    if (!id) {
      setError("Material ID is required.")
      return
    }
    if (!title) {
      setError("Title is required.")
      return
    }
    if (!draft.text.trim()) {
      setError("Text is required.")
      return
    }

    const material: CoachMaterial = {
      id,
      kind: draft.kind,
      title,
      tags: parseTags(draft.tags),
      text: draft.text,
      ...(draft.topic.trim() ? { topic: draft.topic.trim() } : {}),
    }

    saveCoachMaterial(material)
    setError(null)
    setDraft(EMPTY_DRAFT)
    refresh()
  }

  const handleRemove = (id: string) => {
    deleteCoachMaterial(id)
    refresh()
  }

  if (library === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading coach materials…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Team Coach Materials</h1>
        <p className="text-sm text-muted-foreground">
          Upload lecture transcripts, camp materials, instructional documents, and practice-round
          recordings to ground the team coach AI.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-id">Material ID</Label>
            <Input
              id="coach-material-id"
              value={draft.id}
              onChange={(e) => setDraft((prev) => ({ ...prev, id: e.target.value }))}
              placeholder="lecture-1"
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-kind">Kind</Label>
            <Select
              value={draft.kind}
              onValueChange={(value) => setDraft((prev) => ({ ...prev, kind: value as CoachMaterialKind }))}
            >
              <SelectTrigger id="coach-material-kind" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COACH_MATERIAL_KIND_ORDER.map((kind) => (
                  <SelectItem key={kind} value={kind}>
                    {COACH_MATERIAL_KIND_LABELS[kind]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-title">Title</Label>
            <Input
              id="coach-material-title"
              value={draft.title}
              onChange={(e) => setDraft((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Topicality Basics"
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-topic">Topic (optional)</Label>
            <Input
              id="coach-material-topic"
              value={draft.topic}
              onChange={(e) => setDraft((prev) => ({ ...prev, topic: e.target.value }))}
              placeholder="Resolution or argument block"
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coach-material-tags">Tags (comma-separated)</Label>
            <Input
              id="coach-material-tags"
              value={draft.tags}
              onChange={(e) => setDraft((prev) => ({ ...prev, tags: e.target.value }))}
              placeholder="theory, case"
              className="max-w-xs"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="coach-material-text">Text</Label>
          <Textarea
            id="coach-material-text"
            value={draft.text}
            onChange={(e) => setDraft((prev) => ({ ...prev, text: e.target.value }))}
            placeholder="Paste the transcript or document text…"
            className="min-h-32"
          />
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave}>Save material</Button>
      </div>

      {library.totalMaterials === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No coach materials yet. Upload one above to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          {library.groups.map((group) => (
            <div key={group.kind} className="rounded-lg border border-border p-4">
              <h2 className="mb-3 text-sm font-semibold text-foreground">
                {COACH_MATERIAL_KIND_LABELS[group.kind]}{" "}
                <span className="font-normal text-muted-foreground">({group.materials.length})</span>
              </h2>
              <div className="space-y-2">
                {group.materials.map((material) => (
                  <div key={material.id} className="rounded-md border border-border p-3">
                    <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">{material.title}</span>
                        {material.topic && <Badge variant="outline">{material.topic}</Badge>}
                        {material.tags.map((tag) => (
                          <Badge key={tag} variant="outline" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                      <Button size="sm" variant="ghost" onClick={() => handleRemove(material.id)}>
                        Remove
                      </Button>
                    </div>
                    <p className="text-sm text-muted-foreground">{excerptMaterialText(material.text)}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Coach Q&amp;A preview</h2>
          <p className="text-sm text-muted-foreground">
            Type a question to preview the grounded prompt a future team coach AI call would
            receive. No AI model is called here.
          </p>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-48 space-y-1.5">
            <Label htmlFor="coach-question">Question</Label>
            <Input
              id="coach-question"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="How should we answer a topicality shell?"
            />
          </div>
          {topics.length > 0 && (
            <div className="space-y-1.5">
              <Label htmlFor="coach-question-topic">Topic</Label>
              <Select value={topicFilter} onValueChange={setTopicFilter}>
                <SelectTrigger id="coach-question-topic" className="w-48">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All topics</SelectItem>
                  {topics.map((topic) => (
                    <SelectItem key={topic} value={topic}>
                      {topic}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        {groundedPrompt && (
          <pre className="whitespace-pre-wrap rounded-md border border-border bg-muted/30 p-3 text-xs text-foreground">
            {groundedPrompt}
          </pre>
        )}
      </div>
    </div>
  )
}
