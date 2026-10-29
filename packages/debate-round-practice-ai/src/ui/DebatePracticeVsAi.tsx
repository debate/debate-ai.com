/**
 * @fileoverview The Practice vs AI feature, whole — the screen the
 * `/practice/versus-ai` route renders (and `/practice`, which redirects
 * there since the Practice Round Simulator was merged into this page).
 *
 * Setup runs through `PracticeSetupWizard`: difficulty, topic, opponent,
 * the opponent's prep brief, then the arguments each side runs. The brief
 * and those chosen arguments stay available above the round in a
 * collapsible panel, and the chosen arguments go to the bot on every turn.
 *
 * Upstream split this across three react-router routes (`/game` for the
 * picker, `/debate/:id` for the round, and the scorecard inside it), passing
 * round setup through `location.state`. Under Next.js that state would be
 * lost on reload, so the two screens live behind one route here and hand
 * the round off in local state instead — mirrored into `active-round.ts`'s
 * localStorage record so a reload resumes the round instead of dropping
 * back to the picker.
 *
 * @module ui/DebatePracticeVsAi
 */

"use client"

import { useState } from "react"
import { clearActiveRound, readActiveRound, writeActiveRound } from "./active-round"
import type { StartedDebate } from "./BotSelection"
import { DebateHistory } from "./DebateHistory"
import { parseDebateHistoryParam } from "./history-link"
import { DebateRoom } from "./DebateRoom"
import type { CoachSkill } from "./JudgmentPopup"
import { CaseBriefView, PracticeSetupWizard } from "./PracticeSetupWizard"
import type { RoundPlan } from "../backend/types"

/** The arguments each side chose, shown above the round. */
function RoundPlanView({ plan, botName }: { plan: RoundPlan; botName: string }) {
  const list = (title: string, args: RoundPlan["userArguments"]) => (
    <div className="rounded-md border border-border bg-card p-3 text-sm">
      <h4 className="mb-1 font-semibold text-foreground">{title}</h4>
      {args.length === 0 ? (
        <p className="text-muted-foreground">Free choice.</p>
      ) : (
        <ul className="list-disc pl-5 text-foreground">
          {args.map((a, i) => (
            <li key={i}>{a.title}</li>
          ))}
        </ul>
      )}
    </div>
  )
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">
        {plan.evidence === "with" ? "Evidence round" : "Round without evidence"}
        {plan.affPlan ? ` · Aff plan: ${plan.affPlan}` : ""}
      </p>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {list("Your arguments", plan.userArguments)}
        {list(`${botName}'s arguments`, plan.botArguments)}
      </div>
    </div>
  )
}

export interface DebatePracticeVsAiProps {
  /** Namespaces the round's resume key. Pass the signed-in user's id. */
  userId?: string
  userDisplayName?: string
  userBio?: string
  userRating?: number
  userAvatar?: string
  /** Where the client posts. Defaults to the app's `/api/vsbot`. */
  apiBaseUrl?: string
  /** The host's card search, used by the opponent's prep. Defaults to `/api/search`. */
  searchUrl?: string
  /** Recommendation cards shown on the scorecard. */
  coachSkills?: CoachSkill[]
  /** Open the debate history with this saved round expanded (the `?debate=` deep link). */
  historyDebateId?: string
  /** Called when a debate round is initiated. */
  onStartDebate?: (debate: StartedDebate) => void
}

export function DebatePracticeVsAi({
  userId,
  userDisplayName,
  userBio,
  userRating,
  userAvatar,
  apiBaseUrl,
  searchUrl,
  coachSkills,
  historyDebateId,
  onStartDebate,
}: DebatePracticeVsAiProps = {}) {
  const [debate, setDebate] = useState<StartedDebate | null>(() => readActiveRound(userId))
  // A `?debate=<id>` link (Settings → Saved data) opens the history with that round expanded.
  const [linkedDebateId] = useState(() => historyDebateId ?? (typeof window === "undefined" ? null : parseDebateHistoryParam(window.location.search)))
  const [showHistory, setShowHistory] = useState(linkedDebateId !== null)

  const handleStart = (started: StartedDebate) => {
    writeActiveRound(userId, started)
    setDebate(started)
    onStartDebate?.(started)
  }

  const handleExit = () => {
    clearActiveRound(userId)
    setDebate(null)
  }

  if (!debate) {
    if (showHistory) {
      return <DebateHistory apiBaseUrl={apiBaseUrl} initialExpandedId={linkedDebateId} onBack={() => setShowHistory(false)} />
    }
    return (
      <PracticeSetupWizard
        onStart={handleStart}
        apiBaseUrl={apiBaseUrl}
        searchUrl={searchUrl}
        onViewHistory={() => setShowHistory(true)}
      />
    )
  }

  return (
    <>
      {debate.brief && (
        <details className="mx-auto mb-3 w-full max-w-4xl rounded-md border border-border bg-card p-3">
          <summary className="cursor-pointer font-medium text-foreground">Prep brief: cards, cases and arguments</summary>
          <div className="mt-3 flex flex-col gap-3">
            {debate.plan && <RoundPlanView plan={debate.plan} botName={debate.botName} />}
            <CaseBriefView
              brief={debate.brief}
              stance={debate.stance}
              botName={debate.botName}
              cards={debate.cards}
              cases={debate.cases}
            />
          </div>
        </details>
      )}
      <DebateRoom
        key={debate.debateId}
        debateId={debate.debateId}
        botName={debate.botName}
        botLevel={debate.botLevel}
        topic={debate.topic}
        stance={debate.stance}
        phaseTimings={debate.phaseTimings}
        userId={userId}
        userDisplayName={userDisplayName}
        userBio={userBio}
        userRating={userRating}
        userAvatar={userAvatar}
        apiBaseUrl={apiBaseUrl}
        coachSkills={coachSkills}
        plan={debate.plan}
        onExit={handleExit}
      />
    </>
  )
}

export default DebatePracticeVsAi
