/**
 * @fileoverview Practice Round Simulator panel — the "(b) a round-simulator
 * UI that reads/writes through the persistence store" follow-up named under
 * the "🧪 Practice Round Simulator" bullet in TODO.md's Research
 * Crowdsourcing Organizer Features list.
 *
 * Lets a user configure a practice round — round ID, `debate-timer` format,
 * side, AI judge paradigm (built-in or custom, reusing idea #5's
 * `judge-paradigms.ts`), and AI opponent persona (built-in, reusing the "AI
 * Practice Opponent" idea's `opponent-personas.ts`) — composed via the
 * already-existing `buildPracticeRoundSetup` and saved through the
 * already-persisted `state/practiceRounds.ts` (`savePracticeRound`,
 * `deletePracticeRound`). Every persisted round below renders its setup
 * sections, submitted-speech progress (looked up through the existing
 * `getPracticeRoundSubmittedSpeeches`, which reads the "Online Debate Versus
 * AI" `aiVersusRounds.ts` store — speeches are actually submitted at
 * `/versus-ai`), and post-round feedback once one has been generated. No new
 * setup-composition, judge-paradigm, or opponent-persona logic is introduced
 * here.
 *
 * @module panels/PracticeRoundSimulatorPanel
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Label } from "debate-ui/src/primitives/label"
import { RadioGroup, RadioGroupItem } from "debate-ui/src/primitives/radio-group"
import { Textarea } from "debate-ui/src/primitives/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select"
import {
  debateStyleMap,
  debateStyleNames,
  debateStyles,
  type DebateStyleKey,
} from "debate-timer/src/formats/debate-format-times"
import {
  buildCustomJudgeParadigm,
  listJudgeParadigms,
  type BuiltinJudgeParadigmId,
  type JudgeParadigm,
} from "debate-speech-writer/src/judge/judge-paradigms"
import {
  listOpponentPersonas,
  type BuiltinOpponentPersonaId,
} from "debate-speech-writer/src/opponent/opponent-personas"
import type { AiVersusSide } from "../round/ai-versus-speech-order"
import { buildPracticeRoundSetup } from "../round/practice-round-simulator"
import {
  buildPracticeRoundsPanelView,
  deletePracticeRound,
  getPracticeRound,
  getPracticeRoundSubmittedSpeeches,
  savePracticeRound,
  type PracticeRoundRecord,
} from "../state/practiceRounds"

const STYLE_LABELS: Record<DebateStyleKey, string> = debateStyleMap.reduce(
  (labels, key, index) => ({ ...labels, [key]: debateStyleNames[index] }),
  {} as Record<DebateStyleKey, string>,
)

const BUILTIN_PARADIGMS = listJudgeParadigms()
const BUILTIN_PERSONAS = listOpponentPersonas()

function sideLabel(styleKey: DebateStyleKey, side: AiVersusSide): string {
  const style = debateStyles[styleKey]
  return side === "primary" ? style.primary.name : (style.secondary?.name ?? side)
}

type FormState = {
  roundId: string
  styleKey: DebateStyleKey
  userSide: AiVersusSide
  judgeParadigmId: BuiltinJudgeParadigmId | "custom"
  customJudgeName: string
  customJudgeNotes: string
  opponentPersonaId: BuiltinOpponentPersonaId | "none"
}

const EMPTY_FORM: FormState = {
  roundId: "",
  styleKey: debateStyleMap[0],
  userSide: "primary",
  judgeParadigmId: BUILTIN_PARADIGMS[0].id,
  customJudgeName: "",
  customJudgeNotes: "",
  opponentPersonaId: "none",
}

/**
 * Renders the Practice Round Simulator panel: a form to configure and save
 * a round's setup (format, side, judge paradigm, AI opponent persona), plus
 * every persisted round below with its rendered setup, submitted-speech
 * progress, and post-round feedback (once generated), each with a "Clear"
 * action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function PracticeRoundSimulatorPanel() {
  const [rounds, setRounds] = useState<PracticeRoundRecord[] | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setRounds(buildPracticeRoundsPanelView())
  }, [])

  const refresh = () => setRounds(buildPracticeRoundsPanelView())

  const style = debateStyles[form.styleKey]
  const hasSecondarySide = Boolean(style.secondary)

  const handleStyleChange = (value: string) => {
    const key = value as DebateStyleKey
    setForm((prev) => ({
      ...prev,
      styleKey: key,
      userSide: debateStyles[key].secondary ? prev.userSide : "primary",
    }))
  }

  const handleSave = () => {
    const roundId = form.roundId.trim()
    if (!roundId) {
      setError("Round ID is required.")
      return
    }

    let judgeParadigm: JudgeParadigm | BuiltinJudgeParadigmId
    if (form.judgeParadigmId === "custom") {
      try {
        judgeParadigm = buildCustomJudgeParadigm({
          name: form.customJudgeName,
          notes: form.customJudgeNotes,
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not build custom judge paradigm.")
        return
      }
    } else {
      judgeParadigm = form.judgeParadigmId
    }

    const opponentPersona = form.opponentPersonaId === "none" ? undefined : form.opponentPersonaId

    const setup = buildPracticeRoundSetup({
      styleKey: form.styleKey,
      userSide: form.userSide,
      judgeParadigm,
      opponentPersona,
    })

    const existing = getPracticeRound(roundId)
    savePracticeRound({ roundId, setup, feedback: existing?.feedback })

    setError(null)
    setForm((prev) => ({ ...EMPTY_FORM, styleKey: prev.styleKey, userSide: prev.userSide }))
    refresh()
  }

  const handleClear = (roundId: string) => {
    deletePracticeRound(roundId)
    refresh()
  }

  if (rounds === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading practice rounds…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Practice Round Simulator</h1>
        <p className="text-sm text-muted-foreground">
          Recreate a tournament round — pick a format, side, AI judge paradigm, and AI opponent
          style, then track speeches and feedback for it.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-4">
        <div className="flex flex-wrap gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="practice-round-id">Round ID</Label>
            <Input
              id="practice-round-id"
              value={form.roundId}
              onChange={(e) => setForm((prev) => ({ ...prev, roundId: e.target.value }))}
              placeholder="round-1"
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="practice-round-style">Format</Label>
            <Select value={form.styleKey} onValueChange={handleStyleChange}>
              <SelectTrigger id="practice-round-style" className="w-64">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {debateStyleMap.map((key) => (
                  <SelectItem key={key} value={key}>
                    {STYLE_LABELS[key]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="practice-round-side">Your side</Label>
            <Select
              value={form.userSide}
              onValueChange={(value) => setForm((prev) => ({ ...prev, userSide: value as AiVersusSide }))}
            >
              <SelectTrigger id="practice-round-side" className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="primary">{style.primary.name}</SelectItem>
                {hasSecondarySide && <SelectItem value="secondary">{style.secondary!.name}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Judge paradigm</Label>
          <RadioGroup
            value={form.judgeParadigmId}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, judgeParadigmId: value as FormState["judgeParadigmId"] }))
            }
          >
            {BUILTIN_PARADIGMS.map((paradigm) => (
              <div key={paradigm.id} className="flex items-start gap-2">
                <RadioGroupItem
                  value={paradigm.id}
                  id={`practice-round-paradigm-${paradigm.id}`}
                  className="mt-0.5"
                />
                <Label htmlFor={`practice-round-paradigm-${paradigm.id}`} className="font-normal">
                  <span className="text-foreground">{paradigm.name}</span>{" "}
                  <span className="text-muted-foreground">— {paradigm.description}</span>
                </Label>
              </div>
            ))}
            <div className="flex items-start gap-2">
              <RadioGroupItem value="custom" id="practice-round-paradigm-custom" className="mt-0.5" />
              <Label htmlFor="practice-round-paradigm-custom" className="font-normal text-foreground">
                Custom judge paradigm
              </Label>
            </div>
          </RadioGroup>
        </div>

        {form.judgeParadigmId === "custom" && (
          <div className="space-y-3 rounded-md border border-border p-3">
            <div className="space-y-1.5">
              <Label htmlFor="practice-round-custom-judge-name">Judge name</Label>
              <Input
                id="practice-round-custom-judge-name"
                value={form.customJudgeName}
                onChange={(e) => setForm((prev) => ({ ...prev, customJudgeName: e.target.value }))}
                placeholder="Judge Smith"
                className="max-w-xs"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="practice-round-custom-judge-notes">Publicly stated preferences</Label>
              <Textarea
                id="practice-round-custom-judge-notes"
                value={form.customJudgeNotes}
                onChange={(e) => setForm((prev) => ({ ...prev, customJudgeNotes: e.target.value }))}
                placeholder="Votes on framework first, dislikes speed…"
              />
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label>AI opponent persona</Label>
          <RadioGroup
            value={form.opponentPersonaId}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, opponentPersonaId: value as FormState["opponentPersonaId"] }))
            }
          >
            <div className="flex items-start gap-2">
              <RadioGroupItem value="none" id="practice-round-persona-none" className="mt-0.5" />
              <Label htmlFor="practice-round-persona-none" className="font-normal text-foreground">
                No persona (no style-specific guidance)
              </Label>
            </div>
            {BUILTIN_PERSONAS.map((persona) => (
              <div key={persona.id} className="flex items-start gap-2">
                <RadioGroupItem
                  value={persona.id}
                  id={`practice-round-persona-${persona.id}`}
                  className="mt-0.5"
                />
                <Label htmlFor={`practice-round-persona-${persona.id}`} className="font-normal">
                  <span className="text-foreground">{persona.name}</span>{" "}
                  <span className="text-muted-foreground">— {persona.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave}>Save round setup</Button>
      </div>

      {rounds.length === 0 ? (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No practice rounds yet. Configure one above to see it here.
        </div>
      ) : (
        <div className="space-y-4">
          {rounds.map((record) => {
            const submitted = getPracticeRoundSubmittedSpeeches(record.roundId)
            return (
              <div key={record.roundId} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">Round {record.roundId}</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{record.setup.judgeParadigm.name}</Badge>
                    <Badge variant="outline">
                      {record.setup.opponentPersona ? record.setup.opponentPersona.name : "No AI opponent"}
                    </Badge>
                    <Button size="sm" variant="ghost" onClick={() => handleClear(record.roundId)}>
                      Clear
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {submitted.length} / {record.setup.speechOrder.length} speeches submitted — submit
                  speeches at{" "}
                  <Link href="/versus-ai" className="underline">
                    Online Debate Versus AI
                  </Link>
                  .
                </p>

                <div className="space-y-2">
                  {record.setup.sections.map((section) => (
                    <div key={section.title} className="rounded-md border border-border px-3 py-2 text-sm">
                      <p className="mb-1 font-medium text-foreground">{section.title}</p>
                      <p className="whitespace-pre-line text-muted-foreground">{section.body}</p>
                    </div>
                  ))}
                </div>

                {record.feedback ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-foreground">Post-round feedback</p>
                    {record.feedback.sections.map((section) => (
                      <div
                        key={section.title}
                        className="rounded-md border border-border px-3 py-2 text-sm"
                      >
                        <p className="mb-1 font-medium text-foreground">{section.title}</p>
                        <p className="whitespace-pre-line text-muted-foreground">{section.body}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No post-round feedback yet — feedback generation isn&apos;t wired to a live round
                    flow in this app yet.
                  </p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
