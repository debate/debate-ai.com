/**
 * @fileoverview Judge Profiles panel — the "(b) a judge-profile card/panel
 * UI" follow-up named under the "⚖️ Judge Profiles" bullet in TODO.md's
 * Research Crowdsourcing Organizer Features list.
 *
 * Reads every persisted judge profile via `state/judgeProfiles.ts`'s
 * `buildJudgeProfilesRoster` (a thin ordering helper over the existing
 * persisted store) and renders it as a roster table — side-vote bias,
 * average speaker points, delivery-speed tolerance, theory receptiveness,
 * and most-tagged paradigm — reusing `judge/judge-profile.ts`'s existing
 * aggregation fields directly rather than introducing new scoring logic
 * here.
 *
 * @module panels/JudgeProfilesPanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "debate-ui/src/primitives/table"
import { buildJudgeProfilesRoster } from "../state/judgeProfiles"
import type { JudgeProfile } from "../judge/judge-profile"

/**
 * Renders the Judge Profiles roster: every persisted judge profile ordered
 * by rounds judged descending, with side-vote bias, average speaker points,
 * delivery-speed tolerance, theory receptiveness, and most-tagged paradigm.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function JudgeProfilesPanel() {
  const [roster, setRoster] = useState<JudgeProfile[] | null>(null)

  useEffect(() => {
    setRoster(buildJudgeProfilesRoster())
  }, [])

  if (roster === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading judge profiles…</div>
  }

  if (roster.length === 0) {
    return (
      <div className="p-6 text-center text-sm text-muted-foreground">
        No judge profiles yet. A profile appears here once a judge's ballot
        history has been aggregated and saved.
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6">
      <h1 className="mb-1 text-xl font-semibold text-foreground">Judge Profiles</h1>
      <p className="mb-4 text-sm text-muted-foreground">
        Side-vote bias, average speaker points, delivery-speed tolerance, and
        theory receptiveness for every judge with a saved profile.
      </p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Judge</TableHead>
            <TableHead className="text-right">Rounds</TableHead>
            <TableHead>Side record</TableHead>
            <TableHead className="text-right">Avg speaker pts</TableHead>
            <TableHead>Speed tolerance</TableHead>
            <TableHead>Theory receptiveness</TableHead>
            <TableHead>Paradigm</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {roster.map((profile) => (
            <TableRow key={profile.judgeId}>
              <TableCell className="font-medium">{profile.judgeId}</TableCell>
              <TableCell className="text-right">{profile.roundsJudged}</TableCell>
              <TableCell>
                Aff {profile.sideBias.affWins}-{profile.sideBias.negWins} Neg
                {profile.sideBias.hasNotableSideBias && (
                  <Badge variant="outline" className="ml-2">
                    notable bias
                  </Badge>
                )}
              </TableCell>
              <TableCell className="text-right">
                {profile.roundsJudged > 0 ? profile.avgSpeakerPoints.overall : "—"}
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {profile.speedTolerance ?? "unknown"}
              </TableCell>
              <TableCell className="capitalize text-muted-foreground">
                {profile.theoryReceptiveness ?? "unknown"}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {profile.mostCommonParadigm ?? "—"}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
