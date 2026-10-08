/**
 * @fileoverview The Practice vs AI feature, whole — the screen the
 * `/practice/versus-ai` route renders (and `/practice`, which redirects
 * there since the Practice Round Simulator was merged into this page).
 *
 * Setup runs through `PracticeSetupWizard`: difficulty, topic, opponent,
 * then the opponent's prep brief. The brief stays available above the
 * round in a collapsible panel.
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
import { DebateRoom } from "./DebateRoom"
import type { CoachSkill } from "./JudgmentPopup"
import { CaseBriefView, PracticeSetupWizard } from "./PracticeSetupWizard"

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
  onStartDebate,
}: DebatePracticeVsAiProps = {}) {
  const [debate, setDebate] = useState<StartedDebate | null>(() => readActiveRound(userId))
  const [showHistory, setShowHistory] = useState(false)

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
      return <DebateHistory apiBaseUrl={apiBaseUrl} onBack={() => setShowHistory(false)} />
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
          <div className="mt-3">
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
        onExit={handleExit}
      />
    </>
  )
}

export default DebatePracticeVsAi
