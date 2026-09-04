/**
 * @fileoverview The Practice vs AI feature, whole — the screen the
 * `/versus-ai` route renders.
 *
 * Upstream split this across three react-router routes (`/game` for the
 * picker, `/debate/:id` for the round, and the scorecard inside it), passing
 * round setup through `location.state`. Under Next.js that state would be
 * lost on reload, so the two screens live behind one route here and hand
 * the round off in local state instead.
 *
 * @module ui/DebatePracticeVsAi
 */

"use client"

import { useState } from "react"
import { BotSelection, type StartedDebate } from "./BotSelection"
import { DebateRoom } from "./DebateRoom"
import type { CoachSkill } from "./JudgmentPopup"

export interface DebatePracticeVsAiProps {
  /** Namespaces the round's resume key. Pass the signed-in user's id. */
  userId?: string
  userDisplayName?: string
  userBio?: string
  userRating?: number
  userAvatar?: string
  /** Where the client posts. Defaults to the app's `/api/vsbot`. */
  apiBaseUrl?: string
  /** Recommendation cards shown on the scorecard. */
  coachSkills?: CoachSkill[]
}

export function DebatePracticeVsAi({
  userId,
  userDisplayName,
  userBio,
  userRating,
  userAvatar,
  apiBaseUrl,
  coachSkills,
}: DebatePracticeVsAiProps = {}) {
  const [debate, setDebate] = useState<StartedDebate | null>(null)

  if (!debate) {
    return <BotSelection onStart={setDebate} apiBaseUrl={apiBaseUrl} />
  }

  return (
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
      onExit={() => setDebate(null)}
    />
  )
}

export default DebatePracticeVsAi
