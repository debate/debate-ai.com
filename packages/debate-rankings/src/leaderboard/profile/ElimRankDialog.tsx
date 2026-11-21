/**
 * @fileoverview Full "Elim finish rank" list behind the list icon on a
 * college's NDT headline cards: every school with enough NDT elims ranked by
 * average elim finish, with a tab per span (last decade, all years) and a
 * school filter. The page's own school is highlighted. Mirrors the program
 * strength ranking modal.
 * @module leaderboard/profile/ElimRankDialog
 */

"use client"

import Link from "next/link"
import { useEffect, useMemo, useRef, useState } from "react"
import { X } from "lucide-react"
import type { NdtSchoolHistory } from "../../sync/ndt-school-history"
import { Button } from "../ui/primitives/button"
import { MIN_RANKED_ELIMS, rankAllNdtElimAverages } from "./ndtHistory"
import { schoolHref } from "./rankingProfileHelpers"

/** One span the elim finish rank is shown for. */
export interface ElimRankSpan {
  id: "decade" | "allYears"
  /** Card label, e.g. `Elim finish rank, 2016–2025`. */
  label: string
  /** Tab label. */
  short: string
  sinceYear: number
}

/** Rows shown before "Show more". */
const PAGE = 50

export function ElimRankDialog({
  schools,
  spans,
  spanId,
  ownSchool,
  onSpan,
  onClose,
}: {
  schools: NdtSchoolHistory[]
  spans: ElimRankSpan[]
  spanId: ElimRankSpan["id"] | null
  ownSchool: string
  onSpan: (id: ElimRankSpan["id"]) => void
  onClose: () => void
}) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [query, setQuery] = useState("")
  const [shown, setShown] = useState(PAGE)
  const open = spanId !== null
  const span = spans.find((candidate) => candidate.id === spanId) ?? null

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal()
      else dialog.setAttribute("open", "")
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close()
      else dialog.removeAttribute("open")
    }
  }, [open])

  useEffect(() => setShown(PAGE), [spanId, query])

  const rows = useMemo(() => (span ? rankAllNdtElimAverages(schools, span.sinceYear) : []), [schools, span])
  const own = rows.find((row) => row.school === ownSchool)
  const needle = query.trim().toLowerCase()
  const matches = needle ? rows.filter((row) => row.school.toLowerCase().includes(needle)) : rows

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="elim-rank-title"
      onClose={onClose}
      onClick={(event) => event.target === event.currentTarget && onClose()}
      className="m-auto w-[min(40rem,calc(100vw-2rem))] max-h-[85vh] overflow-hidden rounded-lg border bg-background p-0 text-foreground shadow-xl backdrop:bg-black/50"
    >
      {span && (
        <div className="flex max-h-[85vh] flex-col">
          <header className="border-b px-4 pb-3 pt-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 id="elim-rank-title" className="text-lg font-semibold">
                  {span.label}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Every school with {MIN_RANKED_ELIMS}+ NDT elims in the span, by how deep its elim teams went on average.
                </p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={onClose} aria-label="Close">
                <X aria-hidden />
              </Button>
            </div>
            <p className="mt-2 text-sm">
              {ownSchool}:{" "}
              {own ? (
                <>
                  <span className="font-semibold tabular-nums">#{own.rank}</span> of {rows.length} ·{" "}
                  <span className="tabular-nums">
                    {own.elims} elim{own.elims === 1 ? "" : "s"}
                  </span>
                </>
              ) : (
                `unranked in this span (under ${MIN_RANKED_ELIMS} elims)`
              )}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <div role="tablist" aria-label="Span" className="inline-flex rounded-md border p-0.5">
                {spans.map((candidate) => (
                  <button
                    key={candidate.id}
                    type="button"
                    role="tab"
                    aria-selected={candidate.id === span.id}
                    onClick={() => onSpan(candidate.id)}
                    className={`rounded px-3 py-1 text-sm ${candidate.id === span.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {candidate.short}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Filter by school"
                aria-label="Filter by school"
                className="h-8 min-w-0 flex-1 rounded-md border bg-transparent px-2 text-sm"
              />
            </div>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2">
            {matches.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No matches.</p>
            ) : (
              <ol className="divide-y">
                {matches.slice(0, shown).map((row) => {
                  const isOwn = row.school === ownSchool
                  return (
                    <li
                      key={row.school}
                      className={`flex items-baseline gap-3 px-2 py-1.5 ${isOwn ? "rounded-md bg-primary/10" : ""}`}
                      data-own-school={isOwn || undefined}
                    >
                      <span className="w-10 shrink-0 text-right text-sm font-semibold tabular-nums text-muted-foreground">
                        #{row.rank}
                      </span>
                      <Link
                        href={schoolHref(row.school)}
                        className="min-w-0 flex-1 truncate text-sm font-medium text-foreground underline-offset-4 hover:underline"
                      >
                        {row.school}
                      </Link>
                      <span className="shrink-0 text-sm tabular-nums text-foreground">
                        {row.elims} elim{row.elims === 1 ? "" : "s"}
                      </span>
                    </li>
                  )
                })}
              </ol>
            )}
            {matches.length > shown && (
              <div className="py-2 text-center">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShown((count) => count + PAGE)}>
                  Show more ({matches.length - shown} left)
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </dialog>
  )
}
