/**
 * @fileoverview Past-season college policy table: the top 100 teams of one
 * season as debatedata.weebly.com rated them. Shown on the NDT tab for the
 * seasons `debate-rankings` does not cover.
 * @module components/debate/DebateVideos/panels/CollegeHistoryTable
 */

"use client"

import { useEffect, useState } from "react"
import {
  COLLEGE_HISTORY_SOURCE_URL,
  loadCollegeHistory,
  type CollegeHistoryEntry,
} from "@debate/rankings-adapter"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/primitives/table"
import { seasonLabel } from "./leaderboardUtils"

/** Props for {@link CollegeHistoryTable}. */
interface CollegeHistoryTableProps {
  /** Season year (the year the season ends in), e.g. `"2025"`. */
  year: string
  /** Free-text school/team filter. */
  query: string
}

/** Loads and renders season `year`'s scraped college policy table. */
export function CollegeHistoryTable({ year, query }: CollegeHistoryTableProps) {
  const [entries, setEntries] = useState<CollegeHistoryEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setEntries(null)
    setError(null)
    loadCollegeHistory(year)
      .then((rows) => {
        if (!cancelled) setEntries(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load rankings")
      })
    return () => {
      cancelled = true
    }
  }, [year])

  if (error) return <p className="py-8 text-center text-sm text-muted-foreground">{error}</p>
  if (!entries) return <p className="py-8 text-center text-sm text-muted-foreground">Loading rankings...</p>

  const q = query.trim().toLowerCase()
  const visible = q
    ? entries.filter((e) => e.school.toLowerCase().includes(q) || e.name.toLowerCase().includes(q))
    : entries

  return (
    <>
      <p className="mb-3 text-sm text-muted-foreground">
        Top {entries.length} college policy teams of {seasonLabel(year)}, from{" "}
        <a
          href={`${COLLEGE_HISTORY_SOURCE_URL}/${seasonLabel(year)}.html`}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-4"
        >
          debatedata
        </a>
        . Rating is a conservative skill estimate (Mu minus a margin for Sigma, the uncertainty) on
        that site's own scale, not comparable with current-season ratings.
      </p>
      {visible.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No teams match "{query}".</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-right">#</TableHead>
              <TableHead>School</TableHead>
              <TableHead>Team</TableHead>
              <TableHead className="text-right">Rating</TableHead>
              <TableHead className="text-right">Mu</TableHead>
              <TableHead className="text-right">Sigma</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visible.map((e) => (
              <TableRow key={`${e.rank}-${e.name}`}>
                <TableCell className="text-right font-semibold tabular-nums">{e.rank}</TableCell>
                <TableCell className="font-medium">{e.school}</TableCell>
                <TableCell>{e.name}</TableCell>
                <TableCell className="text-right tabular-nums">{e.rating.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{e.mu.toFixed(2)}</TableCell>
                <TableCell className="text-right tabular-nums text-muted-foreground">{e.sigma.toFixed(2)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </>
  )
}
