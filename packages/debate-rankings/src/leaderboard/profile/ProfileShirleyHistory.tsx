/**
 * @fileoverview Shirley Classic section of a college school profile: every
 * Wake Forest Franklin R. Shirley Classic final the school reached, listed as
 * "Shirley champion" or "Shirley second place" with the team. Renders nothing
 * for a school that never reached a final.
 * @module leaderboard/profile/ProfileShirleyHistory
 */

"use client"

import { useMemo } from "react"
import Link from "next/link"
import { Award } from "lucide-react"
import { SHIRLEY_BRACKETS_URL, SHIRLEY_SOURCE_URL, findShirleySchoolResults, type ShirleyResult } from "../../sync/shirley-results"
import { Badge } from "../ui/primitives/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"
import { pastTeamHref } from "./pastTeamHelpers"
import { SCROLL_AREA } from "./ProfileNdtHistory"

/** A two-debater team the past-team pages can resolve; partial or unnamed teams stay plain text. */
function linkable(team: string | undefined): team is string {
  return !!team && team.includes("&") && !/unidentified|,/i.test(team)
}

function ShirleyRow({ result }: { result: ShirleyResult }) {
  const champion = result.place === "Champion"
  return (
    <li className="flex flex-wrap items-baseline gap-x-2">
      <span className="tabular-nums text-foreground">{result.year}</span>
      <Badge variant={champion ? "default" : "secondary"} className="text-xs">
        {champion ? "Shirley champion" : "Shirley second place"}
      </Badge>
      {linkable(result.team) ? (
        <Link href={pastTeamHref({ school: result.school, name: result.team })} className="text-foreground hover:underline underline-offset-4">
          {result.team}
        </Link>
      ) : (
        <span className="text-muted-foreground">{result.team ?? "Names not listed"}</span>
      )}
      {result.formerName && <span className="text-xs text-muted-foreground">as {result.formerName}</span>}
      {result.note && <span className="text-xs text-muted-foreground">({result.note})</span>}
    </li>
  )
}

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileShirleyHistory({ school }: { school: string }) {
  const record = useMemo(() => findShirleySchoolResults(school), [school])
  if (!record) return null
  const results = [...record.results].sort((a, b) => b.year - a.year || (a.place === "Champion" ? -1 : 1))

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-4 w-4" aria-hidden />
          Shirley Classic finals
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {record.championships} Shirley {record.championships === 1 ? "championship" : "championships"} ·{" "}
          {record.secondPlaces} second {record.secondPlaces === 1 ? "place" : "places"} · from{" "}
          <a href={SHIRLEY_SOURCE_URL} target="_blank" rel="noreferrer" className="hover:underline">
            Wake Forest&apos;s historical winners list
          </a>{" "}
          (1956–2022) and{" "}
          <a href={SHIRLEY_BRACKETS_URL} target="_blank" rel="noreferrer" className="hover:underline">
            College Debate Results
          </a>{" "}
          (2007, 2008, 2023 on); no 1994 result. Titles count toward program strength like CEDA titles.
        </p>
      </CardHeader>
      <CardContent>
        <ul className={`space-y-0.5 text-sm ${SCROLL_AREA}`}>
          {results.map((result) => (
            <ShirleyRow key={`${result.year}-${result.place}-${result.team ?? ""}-${result.note ?? ""}`} result={result} />
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
