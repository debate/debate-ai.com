/**
 * @fileoverview The body of the merged practice page: Practice vs AI and the
 * Practice Round Simulator on one page, at `/practice/versus-ai` (`/practice`
 * redirects here).
 *
 * The round itself comes first — `DebatePracticeVsAi`'s setup wizard asks
 * for a difficulty, a topic and an opponent, then the opponent finds cards
 * and cases and summarizes both sides before the timed round. The Practice
 * Round Simulator's own tools (saved simulator rounds with judge paradigms,
 * replays and feedback, plus the team matchup simulator) follow in a
 * collapsed section, so nothing the old `/practice` page offered is lost.
 *
 * Each route renders its own `ToolPage` and `ToolPageHeader` around this:
 * the Next app page reads the session on the server, `_client/VersusAiRoute`
 * on the client.
 *
 * @module components/practice/PracticeVsAiSections
 */

import { Suspense } from "react"
import { DebatePracticeVsAi } from "@debate/practice-vs-ai"
import { PracticeRoundSimulatorPanel, TeamMatchupSimulatorPanel } from "@debate/practice-rounds"

export interface PracticeVsAiSectionsProps {
  userId?: string
  userDisplayName?: string
  userAvatar?: string
}

export function PracticeVsAiSections({ userId, userDisplayName, userAvatar }: PracticeVsAiSectionsProps) {
  return (
    <>
      <Suspense>
        <DebatePracticeVsAi userId={userId} userDisplayName={userDisplayName} userAvatar={userAvatar} />
      </Suspense>
      <details id="round-simulator" className="rounded-lg border border-border bg-card p-4">
        <summary className="cursor-pointer font-semibold text-foreground">
          Round simulator: saved rounds, judge paradigms, replays and team matchups
        </summary>
        <div className="mt-4 flex flex-col gap-6">
          <Suspense>
            <PracticeRoundSimulatorPanel />
            <TeamMatchupSimulatorPanel />
          </Suspense>
        </div>
      </details>
    </>
  )
}

export default PracticeVsAiSections
