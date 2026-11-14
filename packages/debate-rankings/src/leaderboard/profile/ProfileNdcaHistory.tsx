/**
 * @fileoverview NDCA national championship section of a high school's
 * profile: policy titles, elimination finishes and top speakers, then every
 * result by year with the competitors. Renders nothing for a school with no
 * NDCA result. Finishes cover the 2006 bracket and the 2009, 2011 and 2012
 * finalists; titles and top speakers every year. Speaker places below first
 * aren't listed here: they only score in the all-seasons NDT points.
 * @module leaderboard/profile/ProfileNdcaHistory
 */

"use client"

import { useMemo } from "react"
import { Award } from "lucide-react"
import {
  findNdcaSchoolRecord,
  NDCA_SOURCE_URL,
  ndcaPlaceLabel,
  type NdcaPlace,
  type NdcaResult,
} from "../../sync/ndca-champions"
import { Badge } from "../ui/primitives/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../ui/primitives/card"

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

const PLACE_VARIANT: Record<NdcaPlace, "default" | "secondary" | "outline"> = {
  Champion: "default",
  "Co-champion": "default",
  "Top speaker": "outline",
  Finalist: "secondary",
  Semifinalist: "secondary",
  Quarterfinalist: "secondary",
  Octafinalist: "secondary",
  Speaker: "outline",
}

/** The school's NDCA results the page lists: everything but speaker places below first. */
const listed = (results: readonly NdcaResult[]) => results.filter((r) => r.place !== "Speaker")

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileNdcaHistory({ school }: { school: string }) {
  const found = useMemo(() => findNdcaSchoolRecord(school), [school])
  const results = found ? listed(found.results) : []
  if (!found || results.length === 0) return null
  const record = { ...found, results }

  const years = [...new Set(record.results.map((r) => r.year))].sort((a, b) => b - a)

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Award className="h-4 w-4" aria-hidden />
          NDCA national championship (policy)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {record.school} · titles and top speakers from{" "}
          <a href={NDCA_SOURCE_URL} target="_blank" rel="noreferrer" className="hover:underline">
            the NDCA&apos;s tournament history
          </a>
          ; elimination finishes for 2006 (full bracket) and the 2009, 2011 and 2012 finals
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-2">
          <Stat label="NDCA titles" value={record.titles} />
          <Stat label="Elim finishes" value={record.elimFinishes} />
          <Stat label="Top speakers" value={record.topSpeakers} />
        </div>
        {years.map((year) => {
          const results = record.results.filter((r) => r.year === year)
          return (
            <section key={year} className="mt-4">
              <h3 className="mb-1 text-sm font-medium tabular-nums text-muted-foreground">{year}</h3>
              <ul className="space-y-0.5 text-sm">
                {results.map((result) => (
                  <li
                    key={`${result.place}-${result.rank ?? ""}-${result.competitors}`}
                    className="flex flex-wrap items-baseline gap-x-2"
                  >
                    <Badge variant={PLACE_VARIANT[result.place]} className="text-xs">
                      {ndcaPlaceLabel(result)}
                    </Badge>
                    <span className="text-foreground">{result.competitors}</span>
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </CardContent>
    </Card>
  )
}
