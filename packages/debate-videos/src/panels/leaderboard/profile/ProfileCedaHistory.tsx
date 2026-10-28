/**
 * @fileoverview CEDA nationals section of a school profile: every Cross
 * Examination Debate Association national championship the school won, with
 * the winning team. Renders nothing for a school that never won.
 * @module panels/leaderboard/profile/ProfileCedaHistory
 */

"use client"

import { useMemo } from "react"
import { Medal } from "lucide-react"
import { findCedaSchoolTitles } from "@debate-ai/data-sync/src/rankings/ceda-champions"
import { Badge } from "../../../ui/primitives/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/primitives/card"
import { SCROLL_AREA } from "./ProfileNdtHistory"

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileCedaHistory({ school }: { school: string }) {
  const record = useMemo(() => findCedaSchoolTitles(school), [school])
  if (!record) return null

  const titles = [...record.titles].sort((a, b) => b.year - a.year)

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Medal className="h-4 w-4" aria-hidden />
          CEDA national championships ({titles.length})
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {record.school} · from the{" "}
          <a href="https://www.cedadebate.org/" target="_blank" rel="noreferrer" className="hover:underline">
            Cross Examination Debate Association
          </a>{" "}
          history of winners
        </p>
      </CardHeader>
      <CardContent>
        <ul className={`space-y-0.5 text-sm ${SCROLL_AREA}`}>
          {titles.map((title) => (
            <li key={title.year} className="flex flex-wrap items-baseline gap-x-2">
              <span className="tabular-nums text-foreground">{title.year}</span>
              <Badge className="text-xs">Champion</Badge>
              <span className="text-foreground">{title.team}</span>
              {title.formerName && <span className="text-xs text-muted-foreground">as {title.formerName}</span>}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
