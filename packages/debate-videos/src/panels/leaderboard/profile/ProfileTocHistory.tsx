/**
 * @fileoverview Tournament of Champions section of a high school's profile:
 * title, runner-up and top-speaker counts, then every TOC finish by event with
 * the competitors. Renders nothing for a school with no TOC finish.
 * @module panels/leaderboard/profile/ProfileTocHistory
 */

"use client"

import { useMemo } from "react"
import { Trophy } from "lucide-react"
import { findTocSchoolRecord, TOC_SOURCE_URL, type TocPlace } from "@debate-ai/data-sync/src/rankings/toc-champions"
import { Badge } from "../../../ui/primitives/badge"
import { Card, CardContent, CardHeader, CardTitle } from "../../../ui/primitives/card"

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-md border bg-muted/30 px-3 py-2">
      <div className="text-lg font-semibold tabular-nums text-foreground">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

const PLACE_VARIANT: Record<TocPlace, "default" | "secondary" | "outline"> = {
  Champion: "default",
  "Co-champion": "default",
  "Runner-up": "secondary",
  "Top speaker": "outline",
}

/**
 * @param props.school - School name as the rankings spell it.
 */
export function ProfileTocHistory({ school }: { school: string }) {
  const record = useMemo(() => findTocSchoolRecord(school), [school])
  if (!record) return null

  const years = record.results.map((r) => r.year)

  return (
    <Card className="mt-4">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Trophy className="h-4 w-4" aria-hidden />
          Tournament of Champions record
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          {record.school} · from{" "}
          <a href={TOC_SOURCE_URL} target="_blank" rel="noreferrer" className="hover:underline">
            the University of Kentucky&apos;s official TOC results
          </a>
        </p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="TOC titles" value={record.titles} />
          <Stat label="Runner-ups" value={record.runnerUps} />
          {record.topSpeakers > 0 && <Stat label="Top speakers" value={record.topSpeakers} />}
          <Stat
            label="Years"
            value={Math.min(...years) === Math.max(...years) ? Math.min(...years) : `${Math.min(...years)}–${Math.max(...years)}`}
          />
        </div>
        {record.events.map((event) => {
          const results = record.results.filter((r) => r.event === event).reverse()
          return (
            <section key={event} className="mt-4">
              <h3 className="mb-1 text-sm font-medium text-muted-foreground">
                {event} ({results.length})
              </h3>
              <ul className="space-y-0.5 text-sm">
                {results.map((result) => (
                  <li
                    key={`${result.year}-${result.place}-${result.competitors}`}
                    className="flex flex-wrap items-baseline gap-x-2"
                  >
                    <span className="tabular-nums text-foreground">{result.year}</span>
                    <Badge variant={PLACE_VARIANT[result.place]} className="text-xs">
                      {result.place}
                    </Badge>
                    <span className="text-foreground">{result.competitors}</span>
                    {result.formerName && <span className="text-xs text-muted-foreground">as {result.formerName}</span>}
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
