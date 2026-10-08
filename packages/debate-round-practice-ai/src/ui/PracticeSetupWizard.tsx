/**
 * @fileoverview Round setup for the merged Practice vs AI page — the page
 * that folded the Practice Round Simulator and Practice vs AI into one.
 *
 * Setup is three choices, one step each: **difficulty**, **topic** (and
 * side), and **opponent** — the bots of the chosen difficulty. Then the
 * opponent preps: it searches the card corpus and the caselist outlines for
 * the topic (`findPrepEvidence`) and turns what it found into a case brief
 * for both sides (`prepareCase`, `POST /api/vsbot/prep`). The brief is shown
 * before the round starts and handed to `onStart`, so it stays next to the
 * round.
 *
 * Replaces `BotSelection` as the page's setup screen; `BotSelection` is
 * still exported for hosts that want the original one-screen picker.
 *
 * @module ui/PracticeSetupWizard
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@debate/speech-writer/src/ui/primitives/button"
import { Input } from "@debate/speech-writer/src/ui/primitives/input"
import type { CaseBrief, PrepCard, PrepCaseDocument } from "../backend/case-prep"
import { createDebate, findPrepEvidence, prepareCase } from "../client"
import type { StartedDebate } from "./BotSelection"
import {
  ALL_BOTS,
  BOT_LEVELS,
  DEFAULT_PHASE_TIMINGS,
  MAX_PHASE_SECONDS,
  MAX_TOPIC_LENGTH,
  MIN_PHASE_SECONDS,
  PREDEFINED_TOPICS,
} from "./bots"

export interface PracticeSetupWizardProps {
  /** Called once the backend has created the debate. */
  onStart: (debate: StartedDebate) => void
  /** Where the vs-bot client posts. Defaults to the app's `/api/vsbot`. */
  apiBaseUrl?: string
  /** The host's card search. Defaults to `/api/search`. */
  searchUrl?: string
  /** Called when the user asks to view their past debates. Omit to hide the button. */
  onViewHistory?: () => void
}

/** One line per difficulty tier, shown on the first step. */
export const DIFFICULTY_BLURBS: Record<string, string> = {
  Easy: "Beginner opponents who miss links and drop arguments. Good for a first round.",
  Medium: "Balanced opponents with reasonable arguments and some evidence.",
  Hard: "Logical, evidence-heavy opponents who press every weak link.",
  Expert: "Tournament-level opponents who rarely concede a point.",
  Legends: "Famous characters with distinctive styles and very high ratings.",
}

export const SETUP_STEPS = ["Difficulty", "Topic", "Opponent", "Prep"] as const
type Step = 0 | 1 | 2 | 3

type PrepState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; cards: PrepCard[]; cases: PrepCaseDocument[]; brief: CaseBrief }
  | { status: "error"; message: string }

const DRAFT_KEY = "practiceSetupWizard"

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`w-full rounded-md border p-3 text-left transition-colors ${
        selected ? "border-2 border-primary bg-primary/10" : "border-border bg-card hover:bg-muted"
      }`}
    >
      {children}
    </button>
  )
}

function ArgumentList({ title, args, cards }: { title: string; args: CaseBrief["yourArguments"]; cards: PrepCard[] }) {
  return (
    <div className="rounded-md border border-border bg-card p-3">
      <h4 className="mb-2 font-semibold text-foreground">{title}</h4>
      {args.length === 0 ? (
        <p className="text-sm text-muted-foreground">No arguments found for this side yet.</p>
      ) : (
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          {args.map((arg, i) => (
            <li key={i}>
              <span className="font-medium text-foreground">{arg.claim}</span>
              {arg.warrant && <p className="text-muted-foreground">{arg.warrant}</p>}
              {arg.cardIndexes.map((index) => {
                const card = cards[index]
                if (!card) return null
                return (
                  <p key={index} className="mt-1 text-xs text-muted-foreground">
                    📄 {card.tag}
                    {card.cite ? ` — ${card.cite}` : ""}
                  </p>
                )
              })}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

/** The brief as the prep step and the round both show it. */
export function CaseBriefView({
  brief,
  stance,
  botName,
  cases = [],
  cards = [],
}: {
  brief: CaseBrief
  stance: string
  botName: string
  cases?: PrepCaseDocument[]
  cards?: PrepCard[]
}) {
  const yours = stance.toLowerCase() === "against" ? "Against" : "For"
  const theirs = yours === "For" ? "Against" : "For"
  return (
    <div className="flex flex-col gap-3">
      {brief.summary && <p className="text-sm text-foreground">{brief.summary}</p>}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ArgumentList title={`Your case (${yours})`} args={brief.yourArguments} cards={cards} />
        <ArgumentList title={`${botName}'s case (${theirs})`} args={brief.opponentArguments} cards={cards} />
      </div>
      {cases.length > 0 && (
        <div className="rounded-md border border-border bg-card p-3 text-sm">
          <h4 className="mb-1 font-semibold text-foreground">Caselist outlines on this topic</h4>
          <ul className="list-disc pl-5 text-muted-foreground">
            {cases.map((c, i) => (
              <li key={c.id ?? i}>
                {c.title}
                {c.owner ? ` — ${c.owner}` : ""}
                {c.side ? ` (${c.side})` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      {!brief.generated && (
        <p className="text-xs text-muted-foreground">
          This brief was sorted straight from the cards found; no AI summary was available.
        </p>
      )}
    </div>
  )
}

export function PracticeSetupWizard({ onStart, apiBaseUrl, searchUrl, onViewHistory }: PracticeSetupWizardProps) {
  const [step, setStep] = useState<Step>(0)
  const [level, setLevel] = useState<string | null>(null)
  const [topic, setTopic] = useState("")
  const [stance, setStance] = useState<"for" | "against" | "random">("random")
  const [botName, setBotName] = useState<string | null>(null)
  const [phaseTimings, setPhaseTimings] = useState(() => DEFAULT_PHASE_TIMINGS.map((p) => ({ ...p })))
  const [resolvedStance, setResolvedStance] = useState<"for" | "against">("for")
  const [prep, setPrep] = useState<PrepState>({ status: "idle" })
  const [creating, setCreating] = useState(false)
  const [startError, setStartError] = useState<string | null>(null)
  const prepAbortRef = useRef<AbortController | null>(null)
  const restoredRef = useRef(false)

  // Restore the choices the user left behind (not the prep, which is re-run).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, unknown>
        if (typeof saved.level === "string" && (BOT_LEVELS as readonly string[]).includes(saved.level)) setLevel(saved.level)
        if (typeof saved.topic === "string") setTopic(saved.topic.slice(0, MAX_TOPIC_LENGTH))
        if (saved.stance === "for" || saved.stance === "against" || saved.stance === "random") setStance(saved.stance)
        if (typeof saved.botName === "string" && ALL_BOTS.some((b) => b.name === saved.botName)) setBotName(saved.botName)
      }
    } catch {
      // A broken or blocked draft just starts the wizard fresh.
    }
    restoredRef.current = true
  }, [])

  useEffect(() => {
    if (!restoredRef.current) return
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ level, topic, stance, botName }))
    } catch {
      // Storage full or blocked: the draft is a convenience only.
    }
  }, [level, topic, stance, botName])

  useEffect(() => () => prepAbortRef.current?.abort(), [])

  const bot = botName ? (ALL_BOTS.find((b) => b.name === botName) ?? null) : null
  const levelBots = level ? ALL_BOTS.filter((b) => b.level === level) : []
  const trimmedTopic = topic.trim()
  const topicValid = trimmedTopic.length > 0 && trimmedTopic.length <= MAX_TOPIC_LENGTH
  const timingsValid = phaseTimings.every((p) => p.time >= MIN_PHASE_SECONDS && p.time <= MAX_PHASE_SECONDS)

  const canAdvance = [Boolean(level), topicValid, Boolean(bot && bot.level === level), false][step]

  const runPrep = async () => {
    if (!bot) return
    prepAbortRef.current?.abort()
    const controller = new AbortController()
    prepAbortRef.current = controller
    const side = stance === "random" ? (Math.random() < 0.5 ? "for" : "against") : stance
    setResolvedStance(side)
    setPrep({ status: "loading" })
    try {
      const { cards, cases } = await findPrepEvidence(trimmedTopic, { searchUrl, signal: controller.signal })
      const brief = await prepareCase(
        { botName: bot.name, botLevel: bot.level, topic: trimmedTopic, stance: side, cards, cases },
        { baseUrl: apiBaseUrl, signal: controller.signal },
      )
      if (!controller.signal.aborted) setPrep({ status: "ready", cards, cases, brief })
    } catch (error) {
      if (controller.signal.aborted) return
      setPrep({ status: "error", message: error instanceof Error ? error.message : "Prep failed." })
    }
  }

  const goTo = (next: Step) => {
    setStep(next)
    if (next === 3) void runPrep()
  }

  const startRound = async () => {
    if (!bot || creating || !timingsValid) return
    setCreating(true)
    setStartError(null)
    try {
      const data = await createDebate(
        { botName: bot.name, botLevel: bot.level, topic: trimmedTopic, stance: resolvedStance, history: [], phaseTimings },
        { baseUrl: apiBaseUrl },
      )
      try {
        localStorage.removeItem(DRAFT_KEY)
      } catch {
        // Nothing to clean up when storage is blocked.
      }
      onStart({
        debateId: data.debateId,
        botName: bot.name,
        botLevel: bot.level,
        topic: trimmedTopic,
        stance: resolvedStance,
        phaseTimings,
        ...(prep.status === "ready" ? { brief: prep.brief, cards: prep.cards, cases: prep.cases } : {}),
      })
    } catch (error) {
      console.error("Failed to create debate:", error)
      setStartError("Failed to start the round. Please try again.")
      setCreating(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 p-2">
      <div className="text-center">
        <h2 className="text-2xl font-extrabold text-foreground sm:text-3xl">
          Set up your <span className="text-primary">practice round</span>
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Choose a difficulty, a topic and an opponent. Your opponent then finds cards and cases and summarizes the
          arguments for both sides.
        </p>
        {onViewHistory && (
          <Button variant="outline" className="mt-3" onClick={onViewHistory}>
            View Debate History
          </Button>
        )}
      </div>

      <ol className="flex flex-wrap justify-center gap-2 text-sm" aria-label="Setup steps">
        {SETUP_STEPS.map((name, i) => (
          <li
            key={name}
            aria-current={i === step ? "step" : undefined}
            className={`rounded-full border px-3 py-1 ${
              i === step
                ? "border-primary bg-primary/10 font-semibold text-primary"
                : i < step
                  ? "border-border text-foreground"
                  : "border-border text-muted-foreground"
            }`}
          >
            {i + 1}. {name}
          </li>
        ))}
      </ol>

      <section className="rounded-md border border-border bg-card p-4 shadow-sm">
        {step === 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-lg font-semibold text-foreground">Choose your difficulty</h3>
            {BOT_LEVELS.map((name) => (
              <ChoiceButton
                key={name}
                selected={level === name}
                onClick={() => {
                  setLevel(name)
                  if (bot && bot.level !== name) setBotName(null)
                }}
              >
                <span className="font-medium text-foreground">{name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {ALL_BOTS.filter((b) => b.level === name).length} opponents
                </span>
                <p className="text-sm text-muted-foreground">{DIFFICULTY_BLURBS[name]}</p>
              </ChoiceButton>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">Choose your topic</h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {PREDEFINED_TOPICS.map((t) => (
                <ChoiceButton key={t} selected={trimmedTopic === t} onClick={() => setTopic(t)}>
                  <span className="text-sm text-foreground">{t}</span>
                </ChoiceButton>
              ))}
            </div>
            <label className="text-sm text-muted-foreground" htmlFor="practice-topic">
              Or write your own resolution
            </label>
            <Input
              id="practice-topic"
              value={topic}
              maxLength={MAX_TOPIC_LENGTH}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Resolved: …"
              className="border-border bg-background text-foreground"
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Your side</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["for", "For"],
                    ["against", "Against"],
                    ["random", "Let the system decide"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={stance === value ? "default" : "outline"}
                    aria-pressed={stance === value}
                    onClick={() => setStance(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">Choose your opponent</h3>
            <p className="text-sm text-muted-foreground">{level} opponents</p>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {levelBots.map((b) => (
                <ChoiceButton key={b.name} selected={botName === b.name} onClick={() => setBotName(b.name)}>
                  <div className="flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.avatar} alt="" className="h-12 w-12 rounded-full border-2 border-primary object-cover" />
                    <div>
                      <span className="font-medium text-foreground">{b.name}</span>
                      <span className="ml-2 text-xs text-primary">{b.rating} rating</span>
                      <p className="text-sm text-muted-foreground">{b.desc}</p>
                    </div>
                  </div>
                </ChoiceButton>
              ))}
            </div>
          </div>
        )}

        {step === 3 && bot && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">
              {bot.name} is prepping: &ldquo;{trimmedTopic}&rdquo;
            </h3>
            {prep.status === "loading" && (
              <p role="status" className="text-sm text-muted-foreground">
                Finding cards and cases and summarizing the arguments…
              </p>
            )}
            {prep.status === "error" && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-red-500">{prep.message}</p>
                <Button variant="outline" onClick={() => void runPrep()}>
                  Try prep again
                </Button>
              </div>
            )}
            {prep.status === "ready" && (
              <CaseBriefView
                brief={prep.brief}
                stance={resolvedStance}
                botName={bot.name}
                cases={prep.cases}
                cards={prep.cards}
              />
            )}

            <details className="rounded-md border border-border p-3 text-sm">
              <summary className="cursor-pointer text-muted-foreground">Phase timings (seconds)</summary>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                {phaseTimings.map((phase, index) => (
                  <label key={phase.name} className="flex flex-col text-xs text-muted-foreground">
                    {phase.name}
                    <Input
                      type="number"
                      value={String(phase.time)}
                      onChange={(e) => {
                        const value = Number.parseInt(e.target.value, 10)
                        setPhaseTimings((prev) =>
                          prev.map((p, i) => (i === index ? { ...p, time: Number.isNaN(value) ? 0 : value } : p)),
                        )
                      }}
                      className="mt-1 border-border bg-background text-foreground"
                    />
                  </label>
                ))}
              </div>
              {!timingsValid && (
                <p className="mt-1 text-xs text-red-500">
                  Phases must be between {MIN_PHASE_SECONDS}s and {MAX_PHASE_SECONDS}s
                </p>
              )}
            </details>
            {startError && <p className="text-sm text-red-500">{startError}</p>}
          </div>
        )}
      </section>

      <div className="flex justify-between gap-2">
        <Button variant="outline" disabled={step === 0 || creating} onClick={() => goTo((step - 1) as Step)}>
          Back
        </Button>
        {step < 3 ? (
          <Button disabled={!canAdvance} onClick={() => goTo((step + 1) as Step)}>
            {step === 2 ? "Prep my case" : "Next"}
          </Button>
        ) : (
          <Button disabled={creating || prep.status === "loading" || !timingsValid} onClick={() => void startRound()}>
            {creating ? "Starting…" : "Start round"}
          </Button>
        )}
      </div>
    </div>
  )
}

export default PracticeSetupWizard
