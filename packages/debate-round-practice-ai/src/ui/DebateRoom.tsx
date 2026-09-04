/**
 * @fileoverview The live round — the port of the upstream
 * `frontend/src/Pages/DebateRoom.tsx`.
 *
 * The round's rules are carried over unchanged: three phases, the
 * `phaseSequences`/`turnTypes` tables that decide who speaks and whether the
 * turn is a statement, a question or an answer, per-phase countdowns, the
 * localStorage resume key, dictation through the Web Speech API, and the
 * concede button.
 *
 * The plumbing changed in three ways. Round data arrives as props rather
 * than through react-router's `location.state`. The user's name and avatar
 * come from props rather than a jotai atom. And the round state is mirrored
 * in a ref, because upstream called `advanceTurn` from inside `setState`
 * updaters — a side effect during render that misfires under React 18+
 * StrictMode; here the updaters stay pure and turn changes are applied
 * against the ref.
 *
 * @module ui/DebateRoom
 */

"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Mic, MicOff } from "lucide-react"
import { Button } from "debate-speech-writer/src/ui/primitives/button"
import { Textarea } from "debate-speech-writer/src/ui/primitives/textarea"
import { concedeDebate, judgeDebate, sendDebateMessage } from "../client"
import type { DebateMessage } from "../backend/types"
import { findBot } from "./bots"
import type { JudgmentDataUserBot } from "./JudgmentPopup"
import { JudgmentPopup, type CoachSkill } from "./JudgmentPopup"
import { getSpeechRecognition, type SpeechRecognitionLike } from "./speech-recognition"

/** Which side speaks at each step of each phase. Ported verbatim. */
const PHASE_SEQUENCES: string[][] = [
  ["For", "Against"],
  ["For", "Against", "Against", "For"],
  ["For", "Against"],
]

/** What kind of turn each step is. Ported verbatim. */
const TURN_TYPES: ("statement" | "question" | "answer")[][] = [
  ["statement", "statement"],
  ["question", "answer", "question", "answer"],
  ["statement", "statement"],
]

/** A transcript line as the room stores it — phase is always set here. */
type RoomMessage = DebateMessage & { phase: string }

interface RoomState {
  messages: RoomMessage[]
  currentPhase: number
  phaseStep: number
  isBotTurn: boolean
  userStance: string
  botStance: string
  timer: number
  isDebateEnded: boolean
}

export interface DebateRoomProps {
  debateId: string
  botName: string
  botLevel: string
  topic: string
  /** The user's side, "for"/"against" in any casing. */
  stance: string
  phaseTimings: { name: string; time: number }[]
  /** Namespaces the localStorage resume key. Upstream used the user's email. */
  userId?: string
  userDisplayName?: string
  userBio?: string
  userRating?: number
  userAvatar?: string
  /** Where the client posts. Defaults to the app's `/api/vsbot`. */
  apiBaseUrl?: string
  /** Recommendation cards on the scorecard. */
  coachSkills?: CoachSkill[]
  /** Called when the user leaves the finished round. */
  onExit?: () => void
}

const DEFAULT_AVATAR = "https://api.dicebear.com/9.x/big-ears/svg?seed=Felix"

/** Pull the JSON object out of a judge reply. Ported from upstream `extractJSON`. */
function extractJson(response: string): string {
  if (!response) return "{}"
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(response)
  if (fenced?.[1]) return fenced[1].trim()
  const bare = response.match(/\{[\s\S]*\}/)
  if (bare) return bare[0]
  console.warn("No JSON found in judge response:", response)
  return "{}"
}

/** What the scorecard shows when judging itself failed. Ported from upstream. */
function errorJudgment(message: string): JudgmentDataUserBot {
  const cell = { score: 0, reason: "Error occurred during judgment" }
  return {
    opening_statement: { user: { ...cell }, bot: { ...cell } },
    cross_examination: { user: { ...cell }, bot: { ...cell } },
    answers: { user: { ...cell }, bot: { ...cell } },
    closing: { user: { ...cell }, bot: { ...cell } },
    total: { user: 0, bot: 0 },
    verdict: { winner: "None", reason: message, congratulations: "", opponent_analysis: "" },
  }
}

/** The instructions shown when a phase begins. Ported verbatim. */
function phaseInstructions(phaseIndex: number): string {
  switch (phaseIndex) {
    case 0:
      return "Each side presents an opening statement."
    case 1:
      return "Cross Examination: one side questions and the other answers, then vice versa."
    case 2:
      return "Both sides deliver their closing statements."
    default:
      return ""
  }
}

export function DebateRoom(props: DebateRoomProps) {
  const {
    debateId,
    botName,
    botLevel,
    topic,
    stance,
    phaseTimings: phases,
    userId = "guest",
    userDisplayName,
    userBio,
    userRating,
    userAvatar,
    apiBaseUrl,
    coachSkills,
    onExit,
  } = props

  const debateKey = `debate_${userId}_${topic}_${debateId}`
  const bot = findBot(botName)

  const initialStance = stance.toLowerCase() === "against" ? "Against" : "For"

  const [state, setState] = useState<RoomState>(() => {
    const saved = typeof window === "undefined" ? null : localStorage.getItem(debateKey)
    if (saved) {
      try {
        return JSON.parse(saved) as RoomState
      } catch {
        // A corrupt draft is no reason to refuse the round.
      }
    }
    return {
      messages: [],
      currentPhase: 0,
      phaseStep: 0,
      isBotTurn: initialStance === "Against",
      userStance: initialStance,
      botStance: initialStance === "For" ? "Against" : "For",
      timer: phases[0]?.time ?? 0,
      isDebateEnded: false,
    }
  })

  // Upstream drove turn changes from inside `setState` updaters, which React
  // may run twice. The ref keeps the updaters pure while still giving the
  // turn logic a current snapshot to work from.
  const stateRef = useRef(state)
  stateRef.current = state

  const [finalInput, setFinalInput] = useState("")
  const [interimInput, setInterimInput] = useState("")
  const [popup, setPopup] = useState<{ show: boolean; message: string; isJudging?: boolean }>({
    show: false,
    message: "",
  })
  const [judgmentData, setJudgmentData] = useState<JudgmentDataUserBot | null>(null)
  const [isRecognizing, setIsRecognizing] = useState(false)
  const [nextTurnPending, setNextTurnPending] = useState(false)

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const phaseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const botTurnRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const resolvedUserAvatar = userAvatar || DEFAULT_AVATAR

  useEffect(() => {
    if (typeof window === "undefined") return
    localStorage.setItem(debateKey, JSON.stringify(state))
  }, [state, debateKey])

  useEffect(
    () => () => {
      if (typeof window !== "undefined") localStorage.removeItem(debateKey)
    },
    [debateKey],
  )

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [state.messages])

  // --- Dictation ---------------------------------------------------------

  useEffect(() => {
    const SpeechRecognitionCtor = getSpeechRecognition()
    if (!SpeechRecognitionCtor) return

    const recognition = new SpeechRecognitionCtor()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = "en-US"

    recognition.onresult = (event) => {
      let newFinal = ""
      let newInterim = ""
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]
        if (result.isFinal) newFinal += `${result[0].transcript} `
        else newInterim = result[0].transcript
      }
      if (newFinal) {
        setFinalInput((prev) => (prev ? `${prev} ${newFinal.trim()}` : newFinal.trim()))
        setInterimInput("")
      } else {
        setInterimInput(newInterim)
      }
    }
    recognition.onend = () => setIsRecognizing(false)
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error ?? event)
      setIsRecognizing(false)
    }

    recognitionRef.current = recognition
    return () => {
      recognition.stop()
      recognitionRef.current = null
    }
  }, [])

  const startRecognition = () => {
    if (recognitionRef.current && !isRecognizing) {
      recognitionRef.current.start()
      setIsRecognizing(true)
    }
  }

  const stopRecognition = useCallback(() => {
    if (recognitionRef.current && isRecognizing) {
      recognitionRef.current.stop()
      setIsRecognizing(false)
    }
  }, [isRecognizing])

  // --- Judging -----------------------------------------------------------

  const judgeRound = useCallback(
    async (messages: RoomMessage[]) => {
      try {
        const { result } = await judgeDebate({ history: messages, debateId }, { baseUrl: apiBaseUrl })
        const judgment = JSON.parse(extractJson(result)) as JudgmentDataUserBot
        if (!judgment?.opening_statement || !judgment?.verdict) {
          throw new Error("Judge returned an unrecognised scorecard")
        }
        setJudgmentData(judgment)
        setPopup({ show: false, message: "" })
      } catch (error) {
        console.error("Judging error:", error)
        const message = error instanceof Error ? error.message : "Unknown error"
        setPopup({
          show: true,
          message: `Judgment error: ${message}. Showing default results.`,
          isJudging: false,
        })
        setJudgmentData(errorJudgment(message))
        setTimeout(() => setPopup({ show: false, message: "" }), 3000)
      }
    },
    [apiBaseUrl, debateId],
  )

  // --- Turn advancement --------------------------------------------------

  /**
   * Move to the next speaker, the next phase, or the verdict. Ported from
   * upstream `advanceTurn`, but applied against an explicit snapshot rather
   * than from inside a state updater.
   */
  const advanceTurn = useCallback(
    (snapshot: RoomState) => {
      if (timerRef.current) clearInterval(timerRef.current)

      const sequence = PHASE_SEQUENCES[snapshot.currentPhase]
      if (snapshot.phaseStep + 1 < sequence.length) {
        const nextStep = snapshot.phaseStep + 1
        const nextStance = sequence[nextStep]
        setState({
          ...snapshot,
          phaseStep: nextStep,
          isBotTurn: snapshot.userStance !== nextStance,
          timer: phases[snapshot.currentPhase].time,
        })
        setNextTurnPending(false)
        return
      }

      if (snapshot.currentPhase < phases.length - 1) {
        const newPhase = snapshot.currentPhase + 1
        setPopup({
          show: true,
          message: `${phases[snapshot.currentPhase].name} completed. Next: ${
            phases[newPhase].name
          } - ${phaseInstructions(newPhase)}`,
        })
        if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current)
        phaseTimeoutRef.current = setTimeout(() => {
          setPopup({ show: false, message: "" })
          setState((prev) => ({
            ...prev,
            currentPhase: newPhase,
            phaseStep: 0,
            isBotTurn: prev.userStance !== PHASE_SEQUENCES[newPhase][0],
            timer: phases[newPhase].time,
          }))
          setNextTurnPending(false)
        }, 4000)
        return
      }

      setPopup({ show: true, message: "Calculating scores and judging results...", isJudging: true })
      setState({ ...snapshot, isDebateEnded: true })
      setNextTurnPending(false)
      void judgeRound(snapshot.messages)
    },
    [judgeRound, phases],
  )

  // --- Countdown ---------------------------------------------------------

  useEffect(() => {
    if (state.timer <= 0 || state.isDebateEnded) return

    timerRef.current = setInterval(() => {
      const current = stateRef.current
      if (current.timer <= 1) {
        if (timerRef.current) clearInterval(timerRef.current)
        if (!current.isBotTurn) {
          if (isRecognizing) stopRecognition()
          setPopup({ show: true, message: "Time's up! Moving to the next turn." })
          setTimeout(() => setPopup({ show: false, message: "" }), 2000)
          advanceTurn({ ...current, timer: 0 })
        } else {
          // The bot is still generating; offer a manual nudge instead of
          // skipping its turn, exactly as upstream did.
          setNextTurnPending(true)
          setState((prev) => ({ ...prev, timer: 0 }))
        }
        return
      }
      setState((prev) => ({ ...prev, timer: prev.timer - 1 }))
    }, 1000)

    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [state.timer, state.isDebateEnded, state.isBotTurn, isRecognizing, advanceTurn, stopRecognition])

  useEffect(
    () => () => {
      if (phaseTimeoutRef.current) clearTimeout(phaseTimeoutRef.current)
    },
    [],
  )

  // --- The bot's turn ----------------------------------------------------

  const handleBotTurn = useCallback(async () => {
    const snapshot = stateRef.current
    const turnType = TURN_TYPES[snapshot.currentPhase][snapshot.phaseStep]
    let context = ""
    if (turnType === "statement") {
      context = "Make your statement"
    } else if (turnType === "question") {
      context = "Ask a clear and concise question challenging your opponent."
    } else {
      const lastMessage = snapshot.messages[snapshot.messages.length - 1]
      context = lastMessage ? `Answer this question: ${lastMessage.text}` : "Provide your answer"
    }

    let text: string
    try {
      const { response } = await sendDebateMessage(
        {
          debateId,
          botLevel,
          topic,
          history: snapshot.messages,
          botName,
          stance: snapshot.botStance,
          context,
        },
        { baseUrl: apiBaseUrl },
      )
      text = response || "I need to think about that..."
    } catch (error) {
      console.error("Bot error:", error)
      text = "I encountered an error. Please continue."
    } finally {
      botTurnRef.current = false
    }

    const botMessage: RoomMessage = {
      sender: "Bot",
      text,
      phase: phases[snapshot.currentPhase]?.name ?? "",
    }
    const updated: RoomState = {
      ...stateRef.current,
      messages: [...stateRef.current.messages, botMessage],
    }
    setState(updated)
    advanceTurn(updated)
  }, [advanceTurn, apiBaseUrl, botLevel, botName, debateId, phases, topic])

  useEffect(() => {
    if (state.isBotTurn && !state.isDebateEnded && !botTurnRef.current) {
      botTurnRef.current = true
      void handleBotTurn()
    }
  }, [state.isBotTurn, state.currentPhase, state.phaseStep, state.isDebateEnded, handleBotTurn])

  // --- The user's turn ---------------------------------------------------

  const sendMessage = () => {
    if (!finalInput.trim() || state.isBotTurn || state.timer === 0) return

    const updated: RoomState = {
      ...state,
      messages: [
        ...state.messages,
        { sender: "User", text: finalInput, phase: phases[state.currentPhase].name },
      ],
      timer: phases[state.currentPhase].time,
    }
    setState(updated)
    advanceTurn(updated)

    setFinalInput("")
    setInterimInput("")
    if (isRecognizing) stopRecognition()
  }

  const handleNextTurn = () => advanceTurn(stateRef.current)

  const handleConcede = async () => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(
        "Are you sure you want to concede? This will count as a loss.",
      )
      if (!confirmed) return
    }
    try {
      if (debateId) await concedeDebate(debateId, state.messages, { baseUrl: apiBaseUrl })
      setState((prev) => ({ ...prev, isDebateEnded: true }))
      setPopup({ show: true, message: "You have conceded the debate.", isJudging: false })
      setTimeout(() => onExit?.(), 2000)
    } catch (error) {
      console.error("Error conceding:", error)
    }
  }

  // --- Render ------------------------------------------------------------

  const formatTime = (seconds: number) => (
    <span
      className={`font-mono ${seconds <= 5 ? "animate-pulse text-destructive" : "text-muted-foreground"}`}
    >
      {`${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, "0")}`}
    </span>
  )

  const renderPhaseMessages = (sender: "User" | "Bot") => (
    <div className="space-y-4">
      {state.messages
        .filter((msg) => msg.sender === sender)
        .map((msg, idx) => (
          <div
            key={`${sender}-${idx}`}
            className="break-words rounded-lg bg-muted p-3 text-foreground shadow-sm"
          >
            <span className="mb-1 block text-xs text-muted-foreground">{msg.phase}</span>
            {msg.text}
          </div>
        ))}
      <div ref={messagesEndRef} />
    </div>
  )

  const currentStance = PHASE_SEQUENCES[state.currentPhase]?.[state.phaseStep]
  const currentEntity = state.userStance === currentStance ? "User" : "Bot"
  const currentTurnType = TURN_TYPES[state.currentPhase]?.[state.phaseStep] ?? "statement"
  const inputDisabled = state.isBotTurn || state.timer === 0 || nextTurnPending

  if (judgmentData) {
    return (
      <div className="fixed inset-0 z-[9999] bg-background">
        <JudgmentPopup
          judgment={judgmentData}
          userAvatar={resolvedUserAvatar}
          botAvatar={bot.avatar}
          botName={botName}
          userStance={state.userStance}
          botStance={state.botStance}
          botDesc={bot.desc}
          coachSkills={coachSkills}
          onClose={() => {
            setJudgmentData(null)
            onExit?.()
          }}
        />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background p-4 transition-colors duration-300">
      <div className="mx-auto w-full max-w-5xl py-2">
        <div className="rounded-xl border border-border bg-card p-4 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Debate: {topic}</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Phase:{" "}
            <span className="font-medium text-foreground">
              {phases[state.currentPhase]?.name || "Finished"}
            </span>{" "}
            | Current Turn:{" "}
            <span className="font-semibold text-primary">
              {currentEntity === "User" ? "You" : botName} to{" "}
              {currentTurnType === "statement"
                ? "make a statement"
                : currentTurnType === "question"
                  ? "ask a question"
                  : "answer"}
            </span>
          </p>
        </div>
      </div>

      {popup.show && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-2xl">
            {popup.isJudging ? (
              <div className="flex flex-col items-center">
                <div className="mb-4 h-16 w-16 animate-spin rounded-full border-t-4 border-primary" />
                <h2 className="text-xl font-semibold text-foreground">{popup.message}</h2>
              </div>
            ) : (
              <>
                <h3 className="mb-2 text-xl font-bold text-primary">Phase Transition</h3>
                <p className="text-center text-sm text-muted-foreground">{popup.message}</p>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 md:flex-row">
        {/* Bot side */}
        <div
          className={`relative flex h-[540px] w-full flex-col border border-border bg-card shadow-md transition-colors md:w-1/2 ${
            state.isBotTurn ? "practice-vs-ai-glow" : ""
          }`}
        >
          <div className="flex items-center gap-2 bg-muted p-2">
            <div className="h-12 w-12 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={bot.avatar}
                alt={botName}
                className="h-full w-full rounded-full border border-border object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-foreground">{botName}</div>
              <div className="text-xs text-muted-foreground">{bot.desc}</div>
              <div className="text-xs text-muted-foreground">Rating: {bot.rating}</div>
            </div>
            {nextTurnPending && (
              <Button onClick={handleNextTurn} className="ml-auto rounded-md px-3 text-sm">
                Next Turn
              </Button>
            )}
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <p className="mb-1 text-sm font-semibold text-primary">Stance: {state.botStance}</p>
            <p className="mb-1 text-xs">
              Time:{" "}
              {formatTime(state.isBotTurn ? state.timer : (phases[state.currentPhase]?.time ?? 0))}
            </p>
            {renderPhaseMessages("Bot")}
          </div>
        </div>

        {/* User side */}
        <div
          className={`relative flex h-[540px] w-full flex-col border border-border bg-card shadow-md transition-colors md:w-1/2 ${
            !state.isBotTurn && !state.isDebateEnded ? "practice-vs-ai-glow" : ""
          }`}
        >
          <div className="flex items-center gap-2 bg-muted p-2">
            <div className="h-12 w-12 shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedUserAvatar}
                alt="You"
                className="h-full w-full rounded-full border border-border object-cover"
              />
            </div>
            <div className="flex flex-col">
              <div className="text-sm font-medium text-foreground">{userDisplayName || "You"}</div>
              <div className="text-xs text-muted-foreground">{userBio || "Debater"}</div>
              <div className="text-xs text-muted-foreground">
                {userRating ? `Rating: ${userRating}` : "Ready to argue!"}
              </div>
            </div>
            {!state.isDebateEnded && (
              <Button
                onClick={handleConcede}
                variant="destructive"
                className="ml-auto rounded-md px-3 text-sm"
              >
                Concede
              </Button>
            )}
          </div>
          <div className="flex flex-1 flex-col overflow-y-auto p-3">
            <p className="mb-1 text-sm font-semibold text-primary">Stance: {state.userStance}</p>
            <p className="mb-1 text-xs">
              Time:{" "}
              {formatTime(!state.isBotTurn ? state.timer : (phases[state.currentPhase]?.time ?? 0))}
            </p>
            <div className="flex-1 overflow-y-auto">{renderPhaseMessages("User")}</div>
            {!state.isDebateEnded && (
              <div className="mt-3 flex items-center gap-2">
                <Textarea
                  value={isRecognizing ? finalInput + (interimInput ? ` ${interimInput}` : "") : finalInput}
                  onChange={(e) => !isRecognizing && setFinalInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault()
                      sendMessage()
                    }
                  }}
                  readOnly={isRecognizing}
                  disabled={inputDisabled}
                  placeholder={
                    currentTurnType === "statement"
                      ? "Make your statement"
                      : currentTurnType === "question"
                        ? "Ask your question"
                        : "Provide your answer"
                  }
                  className="flex-1 rounded-md border border-border bg-input text-sm text-foreground"
                />
                <Button
                  onClick={isRecognizing ? stopRecognition : startRecognition}
                  disabled={inputDisabled}
                  variant="secondary"
                  aria-label={isRecognizing ? "Stop dictation" : "Start dictation"}
                  className="rounded-md p-2"
                >
                  {isRecognizing ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                </Button>
                <Button onClick={sendMessage} disabled={inputDisabled} className="rounded-md px-3 text-sm">
                  Send
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes practice-vs-ai-glow {
          0% { box-shadow: 0 0 5px rgba(255, 149, 0, 0.5); }
          50% { box-shadow: 0 0 20px rgba(255, 149, 0, 0.8); }
          100% { box-shadow: 0 0 5px rgba(255, 149, 0, 0.5); }
        }
        .practice-vs-ai-glow { animation: practice-vs-ai-glow 2s infinite; }
      `}</style>
    </div>
  )
}

export default DebateRoom
