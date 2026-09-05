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
 * AI" `aiVersusRounds.ts` store — speeches are actually submitted in
 * `AiVersusRoundPanel` on the Coach hub), and post-round feedback once one
 * has been generated.
 *
 * Once a round has been started in `AiVersusRoundPanel` on `/coach` (so an
 * `aiVersusRounds.ts` record exists for the same `roundId`) and it's the AI's
 * turn, a "Generate AI opponent speech" action builds the request via the
 * existing `buildAiResponseRequest` and calls `requestAiVersusSpeech` — or, when the
 * round's own saved `setup.opponentPersona` is set, the persona- and
 * difficulty-conditioned `requestAiVersusSpeechWithPersona` (passing the
 * round's own saved `setup.opponentDifficulty`) — saving the result back
 * through
 * `aiVersusRounds.ts`, closing the AI-opponent-speech half of follow-up (a).
 * A "Get AI judge decision" action resolves the round's own saved
 * `setup.judgeParadigm` against a saved flow summary (Speech Transcript
 * Summaries, same `roundId`) via the new
 * `round/practice-round-judge-decision-wiring.ts`, calls the existing
 * `requestJudgeDecision`, and saves the verdict onto the round's own record,
 * closing the AI-judge-decision half of follow-up (a). No new setup
 * composition, speech-order, or judge-paradigm logic is introduced here.
 *
 * A second "Difficulty" radio group next to AI opponent persona closes the
 * "🤖 AI Practice Opponent" idea's "extend the Practice Round Simulator's
 * own separate persona setup to carry a difficulty too" Next item (TODO.md's
 * Research Crowdsourcing Organizer Features list) — the same
 * `opponentDifficulties` axis `OpponentPersonaPickerPanel`/`AiVersusRoundPanel`
 * already carry, saved on the same `PracticeRoundSetup` and shown as a
 * second badge per round and on the "Generate AI opponent speech" prompt.
 *
 * A "Generate post-round feedback for current round" form per round reads
 * the round workspace's currently selected flow (`state/store.ts`'s
 * `useFlowStore`, the same mechanism `CoachingSessionsPanel`'s "Generate
 * coaching session for current round" action uses) and, given a side, calls
 * the new `state/practiceRounds.ts`'s `buildAndSavePracticeRoundFeedback` to
 * derive and save that round's `PracticeRoundFeedback` — closing
 * `docs/features/practice-round-simulator.md`'s "feedback generation isn't
 * wired to a live round flow" Known gap. The button is only enabled while
 * the workspace's selected flow's id matches this card's `roundId`, since
 * feedback is judged under that round's own already-saved judge paradigm.
 *
 * A "Compare your past attempts" section closes the "comparison across a
 * debater's past attempts" follow-up named under this bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list: a chronological win/loss
 * trend across every persisted round via the new `state/practiceRounds.ts`'s
 * `buildPracticeRoundAttemptsComparison`, with a "Download comparison"
 * action mirroring `CoachingSessionsPanel`'s anchor+Blob download pattern.
 *
 * A "Scoring rubric" card next to each round's AI judge decision closes this
 * bullet's "a scoring rubric shown alongside the AI judge decision" Next
 * item: `debate-round`'s new `round/judge-decision-ai.ts#buildJudgeDecisionRubric`
 * checks the round's own judge paradigm's `votingPriorities` against the
 * rendered decision, and each criterion shows ✅/⬜ for whether the decision
 * actually engaged with it.
 *
 * @module panels/PracticeRoundSimulatorPanel
 */

"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Badge } from "debate-round/src/ui/primitives/badge"
import { Button } from "debate-round/src/ui/primitives/button"
import { Input } from "debate-round/src/ui/primitives/input"
import { Label } from "debate-round/src/ui/primitives/label"
import { RadioGroup, RadioGroupItem } from "../ui/primitives/radio-group"
import { Textarea } from "debate-round/src/ui/primitives/textarea"
import { EmptyState } from "debate-round/src/ui/panels/panel-shell"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-round/src/ui/primitives/select"
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
  DEFAULT_OPPONENT_DIFFICULTY,
  listOpponentDifficulties,
  listOpponentPersonas,
  opponentDifficulties,
  type BuiltinOpponentPersonaId,
  type OpponentDifficulty,
} from "debate-speech-writer/src/opponent/opponent-personas"
import { buildAiResponseRequest, type AiVersusSide } from "debate-round/src/round/ai-versus-speech-order"
import { requestAiVersusSpeech } from "../round/ai-versus-speech-client"
import { requestAiVersusSpeechWithPersona } from "../round/opponent-persona-speech-client"
import { requestJudgeDecision } from "../round/judge-decision-client"
import { buildJudgeDecisionRubric } from "debate-round/src/round/judge-decision-ai"
import { buildPracticeRoundJudgeDecisionInput } from "../round/practice-round-judge-decision-wiring"
import { buildPracticeRoundSetup } from "debate-round/src/round/practice-round-simulator"
import { getAiVersusRound, saveAiVersusRound } from "debate-round/src/state/aiVersusRounds"
import {
  buildAndSavePracticeRoundFeedback,
  buildPracticeRoundAttemptsComparison,
  buildPracticeRoundAttemptsComparisonText,
  buildPracticeRoundsPanelView,
  deletePracticeRound,
  getPracticeRound,
  getPracticeRoundSubmittedSpeeches,
  practiceRoundAttemptsComparisonFilename,
  savePracticeRound,
  type PracticeRoundRecord,
} from "debate-round/src/state/practiceRounds"
import { useFlowStore } from "debate-round/src/state/store"

const JUDGE_DECISION_SIDE_NAMES = { primary: "Primary", secondary: "Secondary" }

const STYLE_LABELS: Record<DebateStyleKey, string> = debateStyleMap.reduce(
  (labels, key, index) => ({ ...labels, [key]: debateStyleNames[index] }),
  {} as Record<DebateStyleKey, string>,
)

const BUILTIN_PARADIGMS = listJudgeParadigms()
const BUILTIN_PERSONAS = listOpponentPersonas()
const DIFFICULTIES = listOpponentDifficulties()

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
  opponentDifficultyId: OpponentDifficulty
}

const EMPTY_FORM: FormState = {
  roundId: "",
  styleKey: debateStyleMap[0],
  userSide: "primary",
  judgeParadigmId: BUILTIN_PARADIGMS[0].id,
  customJudgeName: "",
  customJudgeNotes: "",
  opponentPersonaId: "none",
  opponentDifficultyId: DEFAULT_OPPONENT_DIFFICULTY,
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
  const [aiGeneratingId, setAiGeneratingId] = useState<string | null>(null)
  const [judgeLoadingId, setJudgeLoadingId] = useState<string | null>(null)
  const [actionErrors, setActionErrors] = useState<Record<string, string>>({})
  const [feedbackSideKeyByRound, setFeedbackSideKeyByRound] = useState<Record<string, string>>({})
  const [mounted, setMounted] = useState(false)

  const flows = useFlowStore((state) => state.flows)
  const selected = useFlowStore((state) => state.selected)
  const currentFlow = mounted ? flows[selected] : undefined

  useEffect(() => {
    setMounted(true)
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
      opponentDifficulty: form.opponentDifficultyId,
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

  const setActionError = (roundId: string, message: string) =>
    setActionErrors((prev) => ({ ...prev, [roundId]: message }))

  const handleGenerateAiSpeech = async (record: PracticeRoundRecord) => {
    const aiRound = getAiVersusRound(record.roundId)
    if (!aiRound) return

    const request = buildAiResponseRequest(
      record.setup.speechOrder,
      aiRound.submittedSpeeches.length,
      aiRound.submittedSpeeches,
    )
    if (!request) return

    setAiGeneratingId(record.roundId)
    setActionError(record.roundId, "")
    try {
      const persona = record.setup.opponentPersona
      const text = persona
        ? await requestAiVersusSpeechWithPersona(
            request,
            persona,
            record.setup.opponentDifficulty ?? DEFAULT_OPPONENT_DIFFICULTY,
          )
        : await requestAiVersusSpeech(request)
      saveAiVersusRound({
        ...aiRound,
        submittedSpeeches: [
          ...aiRound.submittedSpeeches,
          { name: request.slot.name, speaker: "ai", text },
        ],
      })
      refresh()
    } catch (e) {
      setActionError(record.roundId, e instanceof Error ? e.message : "AI speech generation failed.")
    } finally {
      setAiGeneratingId(null)
    }
  }

  const handleGetJudgeDecision = async (record: PracticeRoundRecord) => {
    const sources = buildPracticeRoundJudgeDecisionInput(
      record.roundId,
      record.setup.judgeParadigm,
      JUDGE_DECISION_SIDE_NAMES,
    )
    if (!sources.ok) {
      setActionError(
        record.roundId,
        "Save a flow summary for this round first (Speech Transcript Summaries).",
      )
      return
    }

    setJudgeLoadingId(record.roundId)
    setActionError(record.roundId, "")
    try {
      const judgeDecision = await requestJudgeDecision(sources.input)
      savePracticeRound({ ...record, judgeDecision })
      refresh()
    } catch (e) {
      setActionError(record.roundId, e instanceof Error ? e.message : "AI judge decision failed.")
    } finally {
      setJudgeLoadingId(null)
    }
  }

  const handleGenerateFeedback = (record: PracticeRoundRecord) => {
    if (!currentFlow || String(currentFlow.id) !== record.roundId) return
    const sideKey = (feedbackSideKeyByRound[record.roundId] ?? "").trim()
    if (!sideKey) {
      setActionError(record.roundId, "A side (e.g. aff or neg) is required to generate post-round feedback.")
      return
    }

    buildAndSavePracticeRoundFeedback(currentFlow, record.roundId, sideKey)
    setActionError(record.roundId, "")
    refresh()
  }

  if (rounds === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading practice rounds…</div>
  }

  const comparison = buildPracticeRoundAttemptsComparison()

  /** Mirrors `CoachingSessionsPanel`'s anchor+Blob download pattern. */
  const handleDownloadAttemptsComparison = () => {
    const text = buildPracticeRoundAttemptsComparisonText(comparison)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = practiceRoundAttemptsComparisonFilename()
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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

        <div className="space-y-1.5">
          <Label>Difficulty</Label>
          <RadioGroup
            value={form.opponentDifficultyId}
            onValueChange={(value) =>
              setForm((prev) => ({ ...prev, opponentDifficultyId: value as OpponentDifficulty }))
            }
          >
            {DIFFICULTIES.map((level) => (
              <div key={level.id} className="flex items-start gap-2">
                <RadioGroupItem
                  value={level.id}
                  id={`practice-round-difficulty-${level.id}`}
                  className="mt-0.5"
                />
                <Label htmlFor={`practice-round-difficulty-${level.id}`} className="font-normal">
                  <span className="text-foreground">{level.name}</span>{" "}
                  <span className="text-muted-foreground">— {level.description}</span>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button onClick={handleSave}>Save round setup</Button>
      </div>

      {comparison.attempts.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Compare your past attempts</h2>
            <Button size="sm" variant="outline" onClick={handleDownloadAttemptsComparison}>
              Download comparison
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            {comparison.attempts.length} attempt{comparison.attempts.length === 1 ? "" : "s"} logged —{" "}
            {comparison.wins} won, {comparison.losses} lost, {comparison.pending} pending
            {comparison.winRate !== null && ` (win rate: ${Math.round(comparison.winRate * 100)}%)`}.
          </p>
          <div className="space-y-1.5">
            {comparison.attempts.map((attempt) => (
              <div
                key={attempt.roundId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
              >
                <div>
                  <span className="font-medium text-foreground">Round {attempt.roundId}</span>{" "}
                  <span className="text-muted-foreground">
                    — {new Date(attempt.createdAt).toLocaleDateString()} vs. {attempt.opponentPersonaName},
                    judged under {attempt.judgeParadigmName}
                    {attempt.feedbackIssueCount !== undefined &&
                      ` — ${attempt.feedbackIssueCount} feedback issue${attempt.feedbackIssueCount === 1 ? "" : "s"}`}
                  </span>
                </div>
                <Badge
                  variant={
                    attempt.outcome === "won" ? "default" : attempt.outcome === "lost" ? "destructive" : "outline"
                  }
                >
                  {attempt.outcome === "won" ? "Won" : attempt.outcome === "lost" ? "Lost" : "Pending"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {rounds.length === 0 ? (
        <EmptyState title="No practice rounds yet." message="Configure one above to see it here." />
      ) : (
        <div className="space-y-4">
          {rounds.map((record) => {
            const submitted = getPracticeRoundSubmittedSpeeches(record.roundId)
            const aiRound = getAiVersusRound(record.roundId)
            const aiSpeechRequest = aiRound
              ? buildAiResponseRequest(
                  record.setup.speechOrder,
                  aiRound.submittedSpeeches.length,
                  aiRound.submittedSpeeches,
                )
              : null
            const judgeDecisionRubric = record.judgeDecision
              ? buildJudgeDecisionRubric(record.setup.judgeParadigm, record.judgeDecision)
              : null
            const actionError = actionErrors[record.roundId]
            return (
              <div key={record.roundId} className="rounded-lg border border-border p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-sm font-semibold text-foreground">Round {record.roundId}</h2>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{record.setup.judgeParadigm.name}</Badge>
                    <Badge variant="outline">
                      {record.setup.opponentPersona ? record.setup.opponentPersona.name : "No AI opponent"}
                    </Badge>
                    {record.setup.opponentPersona && (
                      <Badge variant="outline">
                        {
                          opponentDifficulties[record.setup.opponentDifficulty ?? DEFAULT_OPPONENT_DIFFICULTY]
                            .name
                        }
                      </Badge>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => handleClear(record.roundId)}>
                      Clear
                    </Button>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {submitted.length} / {record.setup.speechOrder.length} speeches submitted — submit
                  speeches at{" "}
                  <Link href="/coach" className="underline">
                    Online Debate Versus AI
                  </Link>
                  .
                </p>

                {aiSpeechRequest && (
                  <div className="space-y-2">
                    {record.setup.opponentPersona && (
                      <p className="text-xs text-muted-foreground">
                        Arguing as <Badge variant="outline">{record.setup.opponentPersona.name}</Badge>{" "}
                        <Badge variant="outline">
                          {
                            opponentDifficulties[
                              record.setup.opponentDifficulty ?? DEFAULT_OPPONENT_DIFFICULTY
                            ].name
                          }
                        </Badge>
                      </p>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleGenerateAiSpeech(record)}
                      disabled={aiGeneratingId === record.roundId}
                    >
                      {aiGeneratingId === record.roundId ? "Generating…" : "Generate AI opponent speech"}
                    </Button>
                  </div>
                )}

                <div className="space-y-2">
                  {record.setup.sections.map((section) => (
                    <div key={section.title} className="rounded-md border border-border px-3 py-2 text-sm">
                      <p className="mb-1 font-medium text-foreground">{section.title}</p>
                      <p className="whitespace-pre-line text-muted-foreground">{section.body}</p>
                    </div>
                  ))}
                </div>

                <div className="space-y-2">
                  <Label htmlFor={`practice-feedback-side-${record.roundId}`}>
                    Generate post-round feedback for current round
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Uses the round workspace's currently selected flow.
                  </p>
                  <div className="flex flex-wrap items-end gap-2">
                    <Input
                      id={`practice-feedback-side-${record.roundId}`}
                      value={feedbackSideKeyByRound[record.roundId] ?? ""}
                      onChange={(e) =>
                        setFeedbackSideKeyByRound((prev) => ({ ...prev, [record.roundId]: e.target.value }))
                      }
                      placeholder="Side (e.g. aff)"
                      className="w-40"
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={!currentFlow || String(currentFlow.id) !== record.roundId}
                      onClick={() => handleGenerateFeedback(record)}
                    >
                      {record.feedback ? "Regenerate post-round feedback" : "Generate post-round feedback"}
                    </Button>
                  </div>
                  {(!currentFlow || String(currentFlow.id) !== record.roundId) && (
                    <p className="text-xs text-muted-foreground">
                      Select this round's flow (round ID {record.roundId}) in the round workspace to
                      generate feedback for it.
                    </p>
                  )}
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
                  <p className="text-sm text-muted-foreground">No post-round feedback yet.</p>
                )}

                <div className="space-y-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleGetJudgeDecision(record)}
                    disabled={judgeLoadingId === record.roundId}
                  >
                    {judgeLoadingId === record.roundId
                      ? "Asking the AI judge…"
                      : record.judgeDecision
                        ? "Re-request AI judge decision"
                        : "Get AI judge decision"}
                  </Button>
                  {record.judgeDecision && (
                    <div className="rounded-md border border-border px-3 py-2 text-sm">
                      <p className="mb-1 font-medium text-foreground">
                        AI judge decision:{" "}
                        {record.judgeDecision.winner === "primary"
                          ? JUDGE_DECISION_SIDE_NAMES.primary
                          : JUDGE_DECISION_SIDE_NAMES.secondary}{" "}
                        wins
                      </p>
                      <ul className="list-disc space-y-0.5 pl-5 text-muted-foreground">
                        {record.judgeDecision.keyVotingIssues.map((issue, index) => (
                          <li key={index}>{issue}</li>
                        ))}
                      </ul>
                      <p className="mt-1 text-muted-foreground">{record.judgeDecision.rationale}</p>
                    </div>
                  )}
                  {judgeDecisionRubric && (
                    <div className="rounded-md border border-border px-3 py-2 text-sm">
                      <p className="mb-1 font-medium text-foreground">
                        Scoring rubric — {record.setup.judgeParadigm.name}
                      </p>
                      {judgeDecisionRubric.length === 0 ? (
                        <p className="text-muted-foreground">
                          This paradigm has no fixed voting priorities to check against.
                        </p>
                      ) : (
                        <ul className="space-y-0.5">
                          {judgeDecisionRubric.map((row) => (
                            <li key={row.criterion} className="flex items-start gap-1.5">
                              <span aria-hidden="true">{row.addressed ? "✅" : "⬜"}</span>
                              <span className={row.addressed ? "text-foreground" : "text-muted-foreground"}>
                                {row.criterion}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>

                {actionError && <p className="text-sm text-destructive">{actionError}</p>}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
