/**
 * @fileoverview Win-probability calculator for a past-season college policy
 * table: pick an aff and a neg team (or type any Mu and Sigma) and see the
 * aff's chance of winning one round under debatedata's model
 * (`collegeWinProbability`).
 * @module leaderboard/CollegeWinCalculator
 */

"use client"

import { useState } from "react"
import { collegeWinProbability, type CollegeHistoryEntry } from "../index"
import { Input } from "./ui/primitives/input"
import { SIDE_BAR_DOT } from "./side-styles"

/** Props for {@link CollegeWinCalculator}. */
interface CollegeWinCalculatorProps {
  /** The season's teams, in rank order; the first two start as aff and neg. */
  entries: CollegeHistoryEntry[]
}

/** One side's inputs: the team picked (its rank, or "" for custom) and its numbers as typed. */
interface SideState {
  rank: string
  mu: string
  sigma: string
}

function sideFrom(entry: CollegeHistoryEntry | undefined): SideState {
  return entry
    ? { rank: String(entry.rank), mu: entry.mu.toFixed(2), sigma: entry.sigma.toFixed(2) }
    : { rank: "", mu: "", sigma: "" }
}

/** Parses a side's inputs, or `null` unless Mu is a number and Sigma a non-negative one. */
function parseSide(side: SideState): { mu: number; sigma: number } | null {
  if (side.mu.trim() === "" || side.sigma.trim() === "") return null
  const mu = Number(side.mu)
  const sigma = Number(side.sigma)
  return Number.isFinite(mu) && Number.isFinite(sigma) && sigma >= 0 ? { mu, sigma } : null
}

function SideInputs({
  label,
  side,
  entries,
  onChange,
}: {
  label: "Aff" | "Neg"
  side: SideState
  entries: CollegeHistoryEntry[]
  onChange: (next: SideState) => void
}) {
  const pickTeam = (rank: string) =>
    onChange(rank ? sideFrom(entries.find((e) => String(e.rank) === rank)) : { ...side, rank: "" })
  // Typing a number makes the side custom: it no longer matches the picked team.
  const edit = (field: "mu" | "sigma", value: string) => onChange({ ...side, rank: "", [field]: value })

  return (
    <fieldset className="min-w-0 rounded-md border p-3">
      <legend className="px-1 text-xs font-medium text-muted-foreground">{label}</legend>
      <select
        value={side.rank}
        onChange={(e) => pickTeam(e.target.value)}
        aria-label={`${label} team`}
        className="mb-2 h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm dark:bg-input/30"
      >
        <option value="">Custom</option>
        {entries.map((e) => (
          <option key={e.rank} value={String(e.rank)}>
            {e.rank}. {e.school}: {e.name}
          </option>
        ))}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid gap-1 text-xs text-muted-foreground">
          Mu
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            value={side.mu}
            onChange={(e) => edit("mu", e.target.value)}
            aria-label={`${label} mu`}
          />
        </label>
        <label className="grid gap-1 text-xs text-muted-foreground">
          Sigma
          <Input
            type="number"
            step="0.1"
            min="0"
            inputMode="decimal"
            value={side.sigma}
            onChange={(e) => edit("sigma", e.target.value)}
            aria-label={`${label} sigma`}
          />
        </label>
      </div>
    </fieldset>
  )
}

/** Aff-vs-neg win probability from two teams' Mu and Sigma. */
export function CollegeWinCalculator({ entries }: CollegeWinCalculatorProps) {
  const [aff, setAff] = useState<SideState>(() => sideFrom(entries[0]))
  const [neg, setNeg] = useState<SideState>(() => sideFrom(entries[1]))

  const affNums = parseSide(aff)
  const negNums = parseSide(neg)
  const pct = affNums && negNums ? Math.round(collegeWinProbability(affNums, negNums) * 100) : null

  return (
    <section aria-labelledby="college-win-calc" className="rounded-lg border p-4">
      <h3 id="college-win-calc" className="mb-1 text-sm font-semibold">
        Win probability
      </h3>
      <p className="mb-3 text-xs text-muted-foreground">
        Pick two teams or enter any Mu and Sigma. Each side's round performance varies around its Mu
        by its Sigma plus a fixed 4.17 of round-to-round noise.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <SideInputs label="Aff" side={aff} entries={entries} onChange={setAff} />
        <SideInputs label="Neg" side={neg} entries={entries} onChange={setNeg} />
      </div>
      <div className="mt-3" aria-live="polite">
        {pct === null ? (
          <p className="text-sm text-muted-foreground">Enter a Mu and a non-negative Sigma for both sides.</p>
        ) : (
          <>
            <div
              className="relative mb-1.5 flex h-3 overflow-hidden rounded-sm bg-muted"
              role="img"
              aria-label={`Aff ${pct} percent, neg ${100 - pct} percent.`}
            >
              <span className={`${SIDE_BAR_DOT.aff} transition-[width] duration-300`} style={{ width: `${pct}%` }} />
              <span className={`${SIDE_BAR_DOT.neg} flex-1 opacity-80`} />
              <span className="absolute inset-y-0 left-1/2 w-px bg-background" />
            </div>
            <div className="flex justify-between text-sm tabular-nums">
              <span>
                Aff <strong>{pct}%</strong>
              </span>
              <span>
                Neg <strong>{100 - pct}%</strong>
              </span>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
