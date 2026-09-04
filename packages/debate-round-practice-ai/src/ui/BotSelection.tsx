/**
 * @fileoverview Bot picker and round setup — the port of the upstream
 * `frontend/src/Pages/BotSelection.tsx`.
 *
 * The markup, the accordion-by-difficulty layout, the localStorage draft and
 * every validation rule (topic length, 60–600s phase clocks) are carried
 * over. What changed is the plumbing: react-router's `useNavigate` and
 * jotai's `userAtom` are gone, replaced by an `onStart` callback the parent
 * supplies, so this screen works inside a single Next.js route.
 *
 * @module ui/BotSelection
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "debate-speech-writer/src/ui/primitives/button"
import { Input } from "debate-speech-writer/src/ui/primitives/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-speech-writer/src/ui/primitives/select"
import { createDebate } from "../client"
import {
  ALL_BOTS,
  BOT_LEVELS,
  DEFAULT_PHASE_TIMINGS,
  MAX_PHASE_SECONDS,
  MAX_TOPIC_LENGTH,
  MIN_PHASE_SECONDS,
  PREDEFINED_TOPICS,
  type PracticeBot,
} from "./bots"

/** Everything the debate room needs to run the round the user just set up. */
export interface StartedDebate {
  debateId: string
  botName: string
  botLevel: string
  topic: string
  /** The user's side — "For" or "Against". */
  stance: string
  phaseTimings: { name: string; time: number }[]
}

export interface BotSelectionProps {
  /** Called once the backend has created the debate. */
  onStart: (debate: StartedDebate) => void
  /** Where the client posts. Defaults to the app's `/api/vsbot`. */
  apiBaseUrl?: string
}

const DRAFT_KEY = "botSelectionState"

const isValidPhaseTimings = (value: unknown): value is { name: string; time: number }[] =>
  Array.isArray(value) &&
  value.every(
    (p) =>
      p &&
      typeof p === "object" &&
      typeof (p as { name?: unknown }).name === "string" &&
      Number.isFinite((p as { time?: unknown }).time),
  )

/** Full-screen "creating your room" overlay. Ported from upstream `Loader`. */
function Loader() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/50">
      <div className="flex flex-col items-center rounded-lg bg-card p-8 shadow-lg">
        <div className="mb-4 h-16 w-16 animate-spin rounded-full border-t-4 border-primary" />
        <h2 className="text-xl font-semibold text-foreground">Creating your room...</h2>
        <p className="mt-2 text-muted-foreground">Getting your bot ready, please wait.</p>
      </div>
    </div>
  )
}

export function BotSelection({ onStart, apiBaseUrl }: BotSelectionProps) {
  const [selectedBot, setSelectedBot] = useState<string | null>(null)
  const [topic, setTopic] = useState<string>("custom")
  const [customTopic, setCustomTopic] = useState<string>("")
  const [stance, setStance] = useState<string>("random")
  const [phaseTimings, setPhaseTimings] = useState<{ name: string; time: number }[]>(() =>
    DEFAULT_PHASE_TIMINGS.map((p) => ({ ...p })),
  )
  const [isCreating, setIsCreating] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<{
    bot?: string
    topic?: string
    timings?: string
  }>({})

  const skipInitialPersistRef = useRef(true)
  const preventPersistRef = useRef(false)
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Restore the draft the user left behind, as upstream did.
  useEffect(() => {
    const savedState = typeof window === "undefined" ? null : localStorage.getItem(DRAFT_KEY)
    if (!savedState) return
    try {
      const parsed = JSON.parse(savedState)
      setSelectedBot(typeof parsed.selectedBot === "string" ? parsed.selectedBot : null)
      setTopic(typeof parsed.topic === "string" ? parsed.topic : "custom")
      setCustomTopic(typeof parsed.customTopic === "string" ? parsed.customTopic : "")
      setStance(typeof parsed.stance === "string" ? parsed.stance : "random")
      setPhaseTimings(
        isValidPhaseTimings(parsed.phaseTimings)
          ? parsed.phaseTimings.map((p: { name: string; time: number }) => ({ ...p }))
          : DEFAULT_PHASE_TIMINGS.map((p) => ({ ...p })),
      )
    } catch (error) {
      console.error("Failed to load saved state:", error)
    }
  }, [])

  useEffect(() => {
    if (skipInitialPersistRef.current) {
      skipInitialPersistRef.current = false
      return
    }
    if (preventPersistRef.current || typeof window === "undefined") return
    localStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ selectedBot, topic, customTopic, stance, phaseTimings }),
    )
  }, [selectedBot, topic, customTopic, stance, phaseTimings])

  useEffect(
    () => () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current)
    },
    [],
  )

  const effectiveTopic = topic === "custom" ? customTopic : topic
  const selectedBotObj: PracticeBot | null = selectedBot
    ? (ALL_BOTS.find((b) => b.name === selectedBot) ?? null)
    : null

  const levels = BOT_LEVELS.map((name) => ({
    name,
    count: ALL_BOTS.filter((bot) => bot.level === name).length,
  })).filter((level) => level.count > 0)

  const updatePhaseTiming = (phaseIndex: number, value: string) => {
    const parsedValue = value === "" ? 0 : Number.parseInt(value, 10)
    const timeInSeconds = Number.isNaN(parsedValue) ? 0 : parsedValue
    setPhaseTimings((prev) =>
      prev.map((phase, idx) => (idx === phaseIndex ? { ...phase, time: timeInSeconds } : phase)),
    )
    if (fieldErrors.timings) setFieldErrors((prev) => ({ ...prev, timings: undefined }))
  }

  const timingsOutOfRange = phaseTimings.some(
    (p) => p.time < MIN_PHASE_SECONDS || p.time > MAX_PHASE_SECONDS,
  )

  const startDebate = async () => {
    if (isCreating) return

    const newErrors: typeof fieldErrors = {}
    if (!selectedBot) newErrors.bot = "Please select a bot"
    if (!effectiveTopic.trim()) {
      newErrors.topic = "Please select or enter a topic"
    } else if (effectiveTopic.trim().length > MAX_TOPIC_LENGTH) {
      newErrors.topic = `Topic must be ${MAX_TOPIC_LENGTH} characters or fewer`
    }
    if (timingsOutOfRange) {
      newErrors.timings = `Phases must be between ${MIN_PHASE_SECONDS}s and ${MAX_PHASE_SECONDS}s`
    }

    setFieldErrors(newErrors)
    if (Object.keys(newErrors).length > 0) return

    const bot = ALL_BOTS.find((b) => b.name === selectedBot)
    if (!bot) {
      setFieldErrors({ bot: "Selected bot not found" })
      return
    }

    const finalStance = stance === "random" ? (Math.random() < 0.5 ? "for" : "against") : stance

    try {
      setIsCreating(true)
      const data = await createDebate(
        {
          botName: bot.name,
          botLevel: bot.level,
          topic: effectiveTopic.trim(),
          stance: finalStance,
          history: [],
          phaseTimings,
        },
        { baseUrl: apiBaseUrl },
      )
      setShowSuccess(true)
      if (typeof window !== "undefined") localStorage.removeItem(DRAFT_KEY)
      preventPersistRef.current = true

      // Upstream let the success toast sit for a beat before navigating.
      if (startTimerRef.current) clearTimeout(startTimerRef.current)
      startTimerRef.current = setTimeout(() => {
        onStart({
          debateId: data.debateId,
          botName: bot.name,
          botLevel: bot.level,
          topic: effectiveTopic.trim(),
          stance: finalStance,
          phaseTimings,
        })
      }, 1500)
    } catch (error) {
      console.error("Failed to create debate:", error)
      setFieldErrors({ bot: "Failed to start debate. Please try again." })
      setShowSuccess(false)
      setIsCreating(false)
    }
  }

  return (
    <>
      {isCreating && <Loader />}
      {showSuccess && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="fixed right-4 top-4 z-50 animate-pulse rounded-lg bg-green-500 px-6 py-3 text-white shadow-lg"
        >
          Debate created successfully! Topic: &quot;{effectiveTopic}&quot;
        </div>
      )}
      <div className="bg-gradient-to-br from-background via-accent/10 to-background p-4">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-extrabold tracking-wide text-foreground sm:text-4xl">
            Pick Your <span className="text-primary">Debate</span> Rival!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground sm:text-base">
            Select a bot and set up your debate challenge.
          </p>
        </div>

        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 md:grid-cols-2">
          {/* Bot roster */}
          <div className="rounded-md border border-border bg-card p-4 shadow-md">
            <h2 className="mb-4 text-xl font-light text-foreground">
              Pick Your <span className="text-primary">Bot</span>
            </h2>
            {fieldErrors.bot && <p className="mb-2 text-sm text-red-500">{fieldErrors.bot}</p>}

            {selectedBotObj && (
              <div className="mb-4 rounded-md border border-border bg-muted p-3">
                <h3 className="mb-2 text-sm font-medium text-muted-foreground">Selected Bot</h3>
                <div className="flex items-center">
                  <div className="mr-3 h-16 w-16 overflow-hidden rounded-full border-2 border-primary">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={selectedBotObj.avatar}
                      alt={selectedBotObj.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div>
                    <h4 className="font-semibold text-foreground">{selectedBotObj.name}</h4>
                    <p className="text-xs italic text-muted-foreground">
                      &quot;{selectedBotObj.quote}&quot;
                    </p>
                    <div className="mt-1 flex">
                      <span className="mr-2 rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
                        {selectedBotObj.level}
                      </span>
                      <span className="rounded bg-primary/20 px-2 py-1 text-xs text-primary">
                        {selectedBotObj.rating} Rating
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-[250px] space-y-3 overflow-y-auto pr-4">
              {levels.map((level) => (
                <div
                  key={level.name}
                  className={`cursor-pointer rounded-md border transition-all ${
                    expandedLevel === level.name
                      ? "border-primary shadow-sm"
                      : "border-border hover:border-muted-foreground"
                  }`}
                >
                  <div
                    className="flex items-center justify-between rounded-t-md bg-muted p-3"
                    onClick={() => setExpandedLevel(expandedLevel === level.name ? null : level.name)}
                  >
                    <div className="flex items-center">
                      <span className="font-medium text-foreground">{level.name}</span>
                      <span className="ml-2 rounded-full bg-primary/20 px-2 py-1 text-xs text-primary">
                        {level.count} bots
                      </span>
                    </div>
                    <span>{expandedLevel === level.name ? "▲" : "▼"}</span>
                  </div>

                  {expandedLevel === level.name && (
                    <div className="grid grid-cols-2 gap-3 border-t border-border bg-card p-3 sm:grid-cols-3">
                      {ALL_BOTS.filter((bot) => bot.level === level.name).map((bot) => (
                        <div
                          key={bot.name}
                          role="button"
                          tabIndex={0}
                          aria-pressed={selectedBot === bot.name}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault()
                              setSelectedBot(bot.name)
                              setFieldErrors((prev) => ({ ...prev, bot: undefined }))
                            }
                          }}
                          onClick={() => {
                            setSelectedBot(bot.name)
                            setFieldErrors((prev) => ({ ...prev, bot: undefined }))
                          }}
                          className={`group relative flex cursor-pointer flex-col items-center rounded-md border p-2 transition-colors ${
                            selectedBot === bot.name
                              ? "border-2 border-primary bg-primary/10"
                              : "border-border hover:bg-muted"
                          }`}
                        >
                          <div className="h-16 w-16 overflow-hidden rounded-full border-2 border-primary">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={bot.avatar}
                              alt={bot.name}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="absolute inset-0 flex flex-col items-center justify-center rounded-md bg-black/70 opacity-0 transition-opacity duration-200 group-focus:opacity-100 group-hover:opacity-100">
                            <h3 className="text-center text-sm font-medium text-white">{bot.name}</h3>
                            <div className="text-xs font-semibold text-primary">
                              {bot.rating} Rating
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Round setup */}
          <div className="flex flex-col rounded-md border border-border bg-card shadow-md">
            <div className="p-3">
              <h2 className="text-xl font-light text-foreground">Debate Setup</h2>
              <p className="text-sm text-muted-foreground">
                Configure your topic, stance, and phase timings.
              </p>
              {selectedBotObj?.specialMessage && (
                <div className="mt-2 rounded-md border border-border bg-card p-2 text-sm font-medium text-foreground">
                  {selectedBotObj.specialMessage}
                </div>
              )}
            </div>
            <div className="h-px w-full bg-border" />
            <div className="flex flex-col gap-4 p-3">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col">
                  <label className="mb-1 block text-sm text-muted-foreground">Debate Topic</label>
                  <Select
                    value={topic}
                    onValueChange={(val) => {
                      setTopic(val)
                      setFieldErrors((prev) => ({ ...prev, topic: undefined }))
                    }}
                  >
                    <SelectTrigger className="w-full border-border bg-background text-foreground">
                      <SelectValue placeholder="Select a topic" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="custom">Custom Topic</SelectItem>
                      {PREDEFINED_TOPICS.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {topic === "custom" && (
                    <Input
                      value={customTopic}
                      onChange={(e) => {
                        setCustomTopic(e.target.value)
                        setFieldErrors((prev) => ({ ...prev, topic: undefined }))
                      }}
                      maxLength={MAX_TOPIC_LENGTH}
                      placeholder="Enter your custom topic"
                      className="mt-2 border-border bg-background text-foreground"
                    />
                  )}
                  {fieldErrors.topic && (
                    <p className="mt-1 text-xs text-red-500">{fieldErrors.topic}</p>
                  )}
                </div>

                <div className="flex flex-col">
                  <label className="mb-1 block text-sm text-muted-foreground">Your Stance</label>
                  <Select value={stance} onValueChange={setStance}>
                    <SelectTrigger className="w-full border-border bg-background text-foreground">
                      <SelectValue placeholder="Choose your stance" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="for">For</SelectItem>
                      <SelectItem value="against">Against</SelectItem>
                      <SelectItem value="random">Let System Decide</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col">
                <label className="mb-2 block text-sm text-muted-foreground">
                  Phase Timings (seconds)
                </label>
                {fieldErrors.timings && (
                  <p className="mb-2 text-xs text-red-500">{fieldErrors.timings}</p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {phaseTimings.map((phase, index) => (
                    <div
                      key={phase.name}
                      className="flex flex-col rounded-md border border-border p-2"
                    >
                      <span className="mb-1 text-xs font-medium text-muted-foreground">
                        {phase.name}
                      </span>
                      <Input
                        type="number"
                        value={phase.time.toString()}
                        onChange={(e) => updatePhaseTiming(index, e.target.value)}
                        className="border-border bg-background text-xs text-foreground"
                      />
                      {(phase.time < MIN_PHASE_SECONDS || phase.time > MAX_PHASE_SECONDS) && (
                        <span className="mt-1 text-[10px] text-red-500">
                          Min {MIN_PHASE_SECONDS}s, Max {MAX_PHASE_SECONDS}s
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <Button
                onClick={startDebate}
                disabled={
                  isCreating ||
                  !selectedBot ||
                  !effectiveTopic.trim() ||
                  effectiveTopic.trim().length > MAX_TOPIC_LENGTH ||
                  timingsOutOfRange
                }
                className="w-full rounded-md py-2 font-semibold shadow-md"
              >
                {isCreating ? "Creating Debate..." : "Start Debate 🚀"}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default BotSelection
