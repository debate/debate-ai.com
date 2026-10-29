/**
 * @fileoverview Round setup for the merged Practice vs AI page — the page
 * that folded the Practice Round Simulator and Practice vs AI into one.
 *
 * Setup is three choices, one step each: **difficulty**, **topic** (with
 * side and evidence mode), and **opponent** — the bots of the chosen
 * difficulty. Then the opponent preps: in an evidence round it searches the
 * card corpus and the caselist outlines for the topic (`findPrepEvidence`);
 * either way it turns what it has into a case brief for both sides
 * (`prepareCase`, `POST /api/vsbot/prep`). On the last step the debater
 * picks exactly which arguments they run and which the opponent runs; those
 * choices become the round's `RoundPlan`, which steers the bot for the whole
 * round.
 *
 * The page opens on the current national health insurance topic with a
 * single-payer affirmative, so the default round is the debater reading
 * single payer while the opponent runs the standard disads against it. A
 * custom topic works too, and defaults to a round without evidence.
 *
 * Replaces `BotSelection` as the page's setup screen; `BotSelection` is
 * still exported for hosts that want the original one-screen picker.
 *
 * @module ui/PracticeSetupWizard
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@debate-ai/speech-writer/src/ui/primitives/button"
import { Input } from "@debate-ai/speech-writer/src/ui/primitives/input"
import type { CaseBrief, PrepCard, PrepCaseDocument } from "../backend/case-prep"
import {
  DEFAULT_PRACTICE_TOPIC,
  TOPIC_PRESETS,
  defaultPresetSelection,
  findTopicPreset,
  presetArgumentsFor,
  type TopicPreset,
} from "../backend/round-plan"
import type { EvidenceMode, RoundArgument, RoundPlan } from "../backend/types"
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

export const SETUP_STEPS = ["Difficulty", "Topic", "Opponent", "Prep", "Arguments"] as const
type Step = 0 | 1 | 2 | 3 | 4

/** One argument a side can be given on the last step. */
export interface ArgumentOption extends RoundArgument {
  /** Stable key for the checkbox. */
  key: string
  /** Indexes into the prep cards that back it, when the brief cited any. */
  cardIndexes?: number[]
}

/**
 * The arguments a side can pick: the topic preset's positions for that side
 * first, then the brief's arguments that aren't already among them, then any
 * the debater wrote. Deduplicated by title.
 */
export function buildArgumentOptions(
  preset: TopicPreset | null,
  stance: string,
  briefArgs: CaseBrief["yourArguments"],
  custom: ArgumentOption[] = [],
): ArgumentOption[] {
  const options: ArgumentOption[] = []
  const seen = new Set<string>()
  const add = (option: ArgumentOption) => {
    const key = option.title.trim().toLowerCase()
    if (!key || seen.has(key)) return
    seen.add(key)
    options.push(option)
  }
  if (preset) {
    for (const a of presetArgumentsFor(preset, stance)) {
      add({ key: `preset:${a.id}`, title: a.title, summary: a.summary, kind: a.kind })
    }
  }
  briefArgs.forEach((a, i) =>
    add({ key: `brief:${i}:${a.claim}`, title: a.claim, summary: a.warrant || undefined, cardIndexes: a.cardIndexes }),
  )
  custom.forEach(add)
  return options
}

/** Which options start ticked: the preset's defaults, or every brief argument for a custom topic. */
export function defaultArgumentSelection(preset: TopicPreset | null, stance: string, options: ArgumentOption[]): string[] {
  if (preset) {
    const ids = new Set(defaultPresetSelection(preset, stance).map((id) => `preset:${id}`))
    return options.filter((o) => ids.has(o.key)).map((o) => o.key)
  }
  return options.map((o) => o.key)
}

/** Turn the picks into the plan the round sends with every bot turn. */
export function buildRoundPlan(input: {
  evidence: EvidenceMode
  preset: TopicPreset | null
  userStance: string
  userOptions: ArgumentOption[]
  userSelected: string[]
  botOptions: ArgumentOption[]
  botSelected: string[]
  cards: PrepCard[]
}): RoundPlan {
  const picked = (options: ArgumentOption[], selected: string[]) =>
    options.filter((o) => selected.includes(o.key))
  const userArgs = picked(input.userOptions, input.userSelected)
  const botArgs = picked(input.botOptions, input.botSelected)
  const strip = ({ title, summary, kind }: ArgumentOption): RoundArgument => ({
    title,
    ...(summary ? { summary } : {}),
    ...(kind ? { kind } : {}),
  })
  // The bot's own cards first, so the ones its arguments rely on survive the server's cap.
  const cardOrder = [...new Set([...botArgs.flatMap((a) => a.cardIndexes ?? []), ...input.cards.map((_, i) => i)])]
  return {
    evidence: input.evidence,
    ...(input.preset?.affPlan ? { affPlan: input.preset.affPlan } : {}),
    userArguments: userArgs.map(strip),
    botArguments: botArgs.map(strip),
    cards:
      input.evidence === "with"
        ? cardOrder
            .map((i) => input.cards[i])
            .filter((c): c is PrepCard => Boolean(c))
            .map((c) => ({ tag: c.tag, ...(c.cite ? { cite: c.cite } : {}), ...(c.excerpt ? { excerpt: c.excerpt } : {}) }))
        : [],
  }
}

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

function ArgumentPicker({
  title,
  options,
  selected,
  onToggle,
  cards,
}: {
  title: string
  options: ArgumentOption[]
  selected: string[]
  onToggle: (key: string) => void
  cards: PrepCard[]
}) {
  return (
    <fieldset className="rounded-md border border-border bg-card p-3">
      <legend className="px-1 font-semibold text-foreground">{title}</legend>
      {options.length === 0 ? (
        <p className="text-sm text-muted-foreground">No arguments yet. Add one below.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {options.map((option) => (
            <li key={option.key}>
              <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(option.key)}
                  onChange={() => onToggle(option.key)}
                />
                <span>
                  <span className="font-medium text-foreground">{option.title}</span>
                  {option.kind && <span className="ml-2 text-xs uppercase text-primary">{option.kind}</span>}
                  {option.summary && <span className="block text-muted-foreground">{option.summary}</span>}
                  {(option.cardIndexes ?? []).map((index) => {
                    const card = cards[index]
                    if (!card) return null
                    return (
                      <span key={index} className="mt-1 block text-xs text-muted-foreground">
                        📄 {card.tag}
                        {card.cite ? ` — ${card.cite}` : ""}
                      </span>
                    )
                  })}
                </span>
              </label>
            </li>
          ))}
        </ul>
      )}
    </fieldset>
  )
}

const otherStance = (stance: "for" | "against"): "for" | "against" => (stance === "for" ? "against" : "for")

export function PracticeSetupWizard({ onStart, apiBaseUrl, searchUrl, onViewHistory }: PracticeSetupWizardProps) {
  const [step, setStep] = useState<Step>(0)
  const [level, setLevel] = useState<string | null>(null)
  const [topic, setTopic] = useState(DEFAULT_PRACTICE_TOPIC)
  const [stance, setStance] = useState<"for" | "against" | "random">("for")
  // `null` follows the topic: evidence for a preset topic, none for a custom one.
  const [evidenceChoice, setEvidenceChoice] = useState<EvidenceMode | null>(null)
  const [botName, setBotName] = useState<string | null>(null)
  const [phaseTimings, setPhaseTimings] = useState(() => DEFAULT_PHASE_TIMINGS.map((p) => ({ ...p })))
  const [resolvedStance, setResolvedStance] = useState<"for" | "against">("for")
  const [prep, setPrep] = useState<PrepState>({ status: "idle" })
  const [userCustom, setUserCustom] = useState<ArgumentOption[]>([])
  const [userSelected, setUserSelected] = useState<string[]>([])
  const [botSelected, setBotSelected] = useState<string[]>([])
  const [customDraft, setCustomDraft] = useState("")
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
        if (typeof saved.topic === "string" && saved.topic.trim()) setTopic(saved.topic.slice(0, MAX_TOPIC_LENGTH))
        if (saved.stance === "for" || saved.stance === "against" || saved.stance === "random") setStance(saved.stance)
        if (saved.evidence === "with" || saved.evidence === "without") setEvidenceChoice(saved.evidence)
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
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ level, topic, stance, evidence: evidenceChoice, botName }))
    } catch {
      // Storage full or blocked: the draft is a convenience only.
    }
  }, [level, topic, stance, evidenceChoice, botName])

  useEffect(() => () => prepAbortRef.current?.abort(), [])

  const bot = botName ? (ALL_BOTS.find((b) => b.name === botName) ?? null) : null
  const levelBots = level ? ALL_BOTS.filter((b) => b.level === level) : []
  const trimmedTopic = topic.trim()
  const topicValid = trimmedTopic.length > 0 && trimmedTopic.length <= MAX_TOPIC_LENGTH
  const timingsValid = phaseTimings.every((p) => p.time >= MIN_PHASE_SECONDS && p.time <= MAX_PHASE_SECONDS)
  const preset = findTopicPreset(trimmedTopic)
  const evidence: EvidenceMode = evidenceChoice ?? (preset ? "with" : "without")
  const prepCards = prep.status === "ready" ? prep.cards : []

  const userOptions =
    prep.status === "ready" ? buildArgumentOptions(preset, resolvedStance, prep.brief.yourArguments, userCustom) : []
  const botOptions =
    prep.status === "ready" ? buildArgumentOptions(preset, otherStance(resolvedStance), prep.brief.opponentArguments) : []

  const canAdvance = [Boolean(level), topicValid, Boolean(bot && bot.level === level), prep.status === "ready", false][step]

  const runPrep = async () => {
    if (!bot) return
    prepAbortRef.current?.abort()
    const controller = new AbortController()
    prepAbortRef.current = controller
    const side = stance === "random" ? (Math.random() < 0.5 ? "for" : "against") : stance
    setResolvedStance(side)
    setPrep({ status: "loading" })
    try {
      const { cards, cases } =
        evidence === "with"
          ? await findPrepEvidence(trimmedTopic, { searchUrl, signal: controller.signal })
          : { cards: [] as PrepCard[], cases: [] as PrepCaseDocument[] }
      const brief = await prepareCase(
        { botName: bot.name, botLevel: bot.level, topic: trimmedTopic, stance: side, cards, cases, evidence },
        { baseUrl: apiBaseUrl, signal: controller.signal },
      )
      if (controller.signal.aborted) return
      setPrep({ status: "ready", cards, cases, brief })
      setUserCustom([])
      setUserSelected(
        defaultArgumentSelection(preset, side, buildArgumentOptions(preset, side, brief.yourArguments)),
      )
      setBotSelected(
        defaultArgumentSelection(
          preset,
          otherStance(side),
          buildArgumentOptions(preset, otherStance(side), brief.opponentArguments),
        ),
      )
    } catch (error) {
      if (controller.signal.aborted) return
      setPrep({ status: "error", message: error instanceof Error ? error.message : "Prep failed." })
    }
  }

  const goTo = (next: Step) => {
    // Prep runs when coming forward from the opponent step, not when backing up from the arguments.
    if (next === 3 && step === 2) void runPrep()
    setStep(next)
  }

  const toggle = (setter: typeof setUserSelected) => (key: string) =>
    setter((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]))

  const addCustomArgument = () => {
    const title = customDraft.trim().slice(0, 200)
    if (!title) return
    const key = `custom:${Date.now()}:${title}`
    setUserCustom((prev) => [...prev, { key, title, kind: "custom" }])
    setUserSelected((prev) => [...prev, key])
    setCustomDraft("")
  }

  const startRound = async () => {
    if (!bot || creating || !timingsValid || prep.status !== "ready") return
    setCreating(true)
    setStartError(null)
    const plan = buildRoundPlan({
      evidence,
      preset,
      userStance: resolvedStance,
      userOptions,
      userSelected,
      botOptions,
      botSelected,
      cards: prep.cards,
    })
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
        brief: prep.brief,
        cards: prep.cards,
        cases: prep.cases,
        plan,
      })
    } catch (error) {
      console.error("Failed to create debate:", error)
      setStartError(
        error instanceof Error && /sign in/i.test(error.message)
          ? error.message.replace(/^Failed to create debate:\s*/, "")
          : "Failed to start the round. Please try again.",
      )
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
          Choose a difficulty, a topic and an opponent. Your opponent finds cards and cases, summarizes both sides,
          and you pick the arguments each side runs before the timed round.
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
            <div className="grid grid-cols-1 gap-2">
              {TOPIC_PRESETS.map((p) => (
                <ChoiceButton key={p.id} selected={preset?.id === p.id} onClick={() => setTopic(p.topic)}>
                  <span className="text-xs font-semibold uppercase text-primary">{p.label}</span>
                  <span className="block text-sm text-foreground">{p.topic}</span>
                  {p.affPlan && (
                    <span className="block text-xs text-muted-foreground">
                      Default aff: single payer. Neg runs the disads, counterplans and T against it.
                    </span>
                  )}
                </ChoiceButton>
              ))}
            </div>
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
                    ["for", preset ? "Aff (For)" : "For"],
                    ["against", preset ? "Neg (Against)" : "Against"],
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
            <div className="flex flex-col gap-1">
              <span className="text-sm text-muted-foreground">Evidence</span>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["with", "With evidence"],
                    ["without", "Without evidence"],
                  ] as const
                ).map(([value, label]) => (
                  <Button
                    key={value}
                    type="button"
                    variant={evidence === value ? "default" : "outline"}
                    aria-pressed={evidence === value}
                    onClick={() => setEvidenceChoice(value)}
                  >
                    {label}
                  </Button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {evidence === "with"
                  ? "Your opponent searches the card library and caselist and cites real cards."
                  : "No card search: both sides argue analytically, and nobody may cite or invent sources."}
              </p>
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
                {evidence === "with"
                  ? "Finding cards and cases and summarizing the arguments…"
                  : "Summarizing the arguments for both sides…"}
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
          </div>
        )}

        {step === 4 && bot && prep.status === "ready" && (
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-semibold text-foreground">Choose your arguments</h3>
            <p className="text-sm text-muted-foreground">
              You debate the {resolvedStance === "for" ? "affirmative (For)" : "negative (Against)"} side
              {evidence === "with" ? " with evidence" : " without evidence"}. Tick the arguments you will run, and the
              ones {bot.name} will run against you.
            </p>
            {preset?.affPlan && (
              <p className="rounded-md border border-border p-2 text-sm text-foreground">
                <span className="font-semibold">Aff plan: </span>
                {preset.affPlan}
              </p>
            )}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="flex flex-col gap-2">
                <ArgumentPicker
                  title="Your arguments"
                  options={userOptions}
                  selected={userSelected}
                  onToggle={toggle(setUserSelected)}
                  cards={prepCards}
                />
                <div className="flex gap-2">
                  <Input
                    id="practice-custom-argument"
                    value={customDraft}
                    maxLength={200}
                    onChange={(e) => setCustomDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addCustomArgument()
                      }
                    }}
                    placeholder="Add your own argument…"
                    className="border-border bg-background text-foreground"
                  />
                  <Button type="button" variant="outline" disabled={!customDraft.trim()} onClick={addCustomArgument}>
                    Add
                  </Button>
                </div>
              </div>
              <ArgumentPicker
                title={`${bot.name}'s arguments`}
                options={botOptions}
                selected={botSelected}
                onToggle={toggle(setBotSelected)}
                cards={prepCards}
              />
            </div>
            {botSelected.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Nothing ticked for {bot.name}: it will pick its own arguments.
              </p>
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
        {step < 4 ? (
          <Button disabled={!canAdvance} onClick={() => goTo((step + 1) as Step)}>
            {step === 2 ? "Prep my case" : step === 3 ? "Choose arguments" : "Next"}
          </Button>
        ) : (
          <Button disabled={creating || prep.status !== "ready" || !timingsValid} onClick={() => void startRound()}>
            {creating ? "Starting…" : "Start round"}
          </Button>
        )}
      </div>
    </div>
  )
}

export default PracticeSetupWizard
