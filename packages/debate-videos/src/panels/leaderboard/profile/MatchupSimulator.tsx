/**
 * @fileoverview Head-to-head matchup simulator: pick any two ranked entries in
 * a division and see Glicko-2's win probability for one round, for 3- and
 * 5-judge elim panels, and a Monte Carlo run of simulated rounds.
 *
 * Reads every division's full-season rankings (`<division>_full_rankings.csv`)
 * through {@link useAllRankingDatasets}, so every ranked team is pairable. The
 * math is `@debate/rankings-adapter`'s port of upstream `simulate_round.py`.
 * Mounted on the practice-round page (both sides free) and on each team
 * profile (one side locked to that team).
 * @module panels/leaderboard/profile/MatchupSimulator
 */

"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  simulateMatchup,
  simulateRounds,
  type RankingDataset,
  type RankingDatasetId,
  type RankingEntry,
  type SimulatedRounds,
} from "@debate/rankings-adapter"
import { useAllRankingDatasets } from "../../../hooks/useAllRankingDatasets"
import { Button } from "../../../ui/primitives/button"
import { Input } from "../../../ui/primitives/input"
import { teamHref, teamSlug } from "./rankingProfileHelpers"

const pct = (p: number) => `${(p * 100).toFixed(1)}%`
const SIM_ROUNDS = 1000
const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs dark:bg-input/30"

/** Label a rankings row is listed under in the pickers. */
function entryLabel(entry: RankingEntry): string {
  return `#${entry.rank} ${entry.name} — ${entry.school}`
}

/** A filter box plus a dropdown of every entry in the division that matches it. */
function TeamPicker({
  label,
  entries,
  value,
  onChange,
}: {
  label: string
  entries: RankingEntry[]
  value: string
  onChange: (slug: string) => void
}) {
  const [filter, setFilter] = useState("")
  const options = useMemo(() => {
    const q = filter.trim().toLowerCase()
    const matches = q
      ? entries.filter((e) => e.name.toLowerCase().includes(q) || e.school.toLowerCase().includes(q))
      : entries
    // Keep the current pick listed even when the filter hides it.
    const selected = entries.find((e) => teamSlug(e) === value)
    return selected && !matches.includes(selected) ? [selected, ...matches] : matches
  }, [entries, filter, value])

  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <Input
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        placeholder={`Filter ${entries.length} teams by name or school`}
        aria-label={`${label}: filter teams`}
      />
      <select
        className={selectClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      >
        <option value="">Choose a team…</option>
        {options.map((e) => (
          <option key={e.hash || teamSlug(e)} value={teamSlug(e)}>
            {entryLabel(e)}
          </option>
        ))}
      </select>
    </div>
  )
}

/** One side's name, rating line and win chance. */
function SideSummary({ entry, win, align }: { entry: RankingEntry; win: number; align: "left" | "right" }) {
  return (
    <div className={align === "right" ? "text-right" : ""}>
      <Link href={teamHref(entry)} className="font-semibold text-foreground underline-offset-4 hover:underline">
        {entry.name}
      </Link>
      <div className="text-xs text-muted-foreground">
        {entry.school} · #{entry.rank} · rating {entry.rating.toFixed(1)} ± {(entry.deviation / 15).toFixed(1)}
      </div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{pct(win)}</div>
    </div>
  )
}

/** Props for {@link MatchupSimulator}. */
export interface MatchupSimulatorProps {
  /**
   * Lock side A to this team (its `teamSlug`) and only offer divisions it is
   * ranked in — used on a team profile. Omit to let both sides be picked.
   */
  lockedTeamSlug?: string
  /** Division to open on; defaults to the first one available. */
  initialDatasetId?: RankingDatasetId
  /** Heading shown above the simulator. */
  title?: string
}

/** Pairs any two ranked teams in a division and simulates their round. */
export function MatchupSimulator({ lockedTeamSlug, initialDatasetId, title = "Matchup simulator" }: MatchupSimulatorProps) {
  const { datasets, loading, error } = useAllRankingDatasets()

  const available: RankingDataset[] = useMemo(
    () =>
      lockedTeamSlug
        ? datasets.filter((d) => d.entries.some((e) => teamSlug(e) === lockedTeamSlug))
        : datasets.filter((d) => d.entries.length > 1),
    [datasets, lockedTeamSlug],
  )

  const [pickedDatasetId, setDatasetId] = useState<RankingDatasetId | undefined>(initialDatasetId)
  const dataset = available.find((d) => d.id === pickedDatasetId) ?? available[0]
  const [picked, setPicked] = useState<Record<string, { a: string; b: string }>>({})
  const [run, setRun] = useState<{ key: string; result: SimulatedRounds } | null>(null)

  if (loading) return <p className="py-6 text-sm text-muted-foreground">Loading rankings…</p>
  if (error) return <p className="py-6 text-sm text-muted-foreground">{error}</p>
  if (!dataset) return null

  const sides = picked[dataset.id] ?? { a: "", b: "" }
  const aSlug = lockedTeamSlug ?? sides.a
  const a = dataset.entries.find((e) => teamSlug(e) === aSlug)
  const b = dataset.entries.find((e) => teamSlug(e) === sides.b)
  const opponents = lockedTeamSlug ? dataset.entries.filter((e) => teamSlug(e) !== lockedTeamSlug) : dataset.entries
  const setSide = (side: "a" | "b", slug: string) =>
    setPicked((prev) => ({ ...prev, [dataset.id]: { ...sides, [side]: slug } }))

  const sim = a && b && a !== b ? simulateMatchup(a, b) : null
  const pairKey = `${dataset.id}:${aSlug}:${sides.b}`
  const rounds = run?.key === pairKey ? run.result : null

  const randomOpponent = () => {
    const pool = opponents.filter((e) => teamSlug(e) !== aSlug)
    if (pool.length) setSide("b", teamSlug(pool[Math.floor(Math.random() * pool.length)]))
  }

  return (
    <section className="mt-6 rounded-lg border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        {available.length > 1 && (
          <select
            className={`${selectClass} w-auto`}
            value={dataset.id}
            onChange={(e) => setDatasetId(e.target.value as RankingDatasetId)}
            aria-label="Division"
          >
            {available.map((d) => (
              <option key={d.id} value={d.id}>
                {d.label} ({d.entries.length})
              </option>
            ))}
          </select>
        )}
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Glicko-2 win probability from the full-season {dataset.label} ratings — every ranked team can be paired.
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {lockedTeamSlug && a ? (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Team A</div>
            <div className="text-sm font-medium">{entryLabel(a)}</div>
          </div>
        ) : (
          <TeamPicker label="Team A" entries={dataset.entries} value={sides.a} onChange={(s) => setSide("a", s)} />
        )}
        <TeamPicker
          label={lockedTeamSlug ? "Opponent" : "Team B"}
          entries={opponents}
          value={sides.b}
          onChange={(s) => setSide("b", s)}
        />
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={randomOpponent}>
          Random opponent
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!sim}
          onClick={() => sim && setRun({ key: pairKey, result: simulateRounds(sim.aWin, SIM_ROUNDS) })}
        >
          Simulate {SIM_ROUNDS.toLocaleString()} rounds
        </Button>
      </div>

      {a && b && a === b && <p className="mt-3 text-sm text-muted-foreground">Pick two different teams.</p>}

      {sim && a && b && (
        <div className="mt-4 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <SideSummary entry={a} win={sim.aWin} align="left" />
            <div className="pt-6 text-xs text-muted-foreground">vs</div>
            <SideSummary entry={b} win={sim.bWin} align="right" />
          </div>
          <div
            className="flex h-3 overflow-hidden rounded-full bg-muted"
            role="img"
            aria-label={`${a.name} ${pct(sim.aWin)}, ${b.name} ${pct(sim.bWin)}`}
          >
            <div className="bg-primary" style={{ width: `${sim.aWin * 100}%` }} />
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">Prelim (1 judge)</div>
              <div className="tabular-nums">
                {pct(sim.aWin)} / {pct(sim.bWin)}
              </div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">Elim, 3-judge panel</div>
              <div className="tabular-nums">
                {pct(sim.aPanel3)} / {pct(1 - sim.aPanel3)}
              </div>
            </div>
            <div className="rounded-md border px-3 py-2">
              <div className="text-xs text-muted-foreground">Elim, 5-judge panel</div>
              <div className="tabular-nums">
                {pct(sim.aPanel5)} / {pct(1 - sim.aPanel5)}
              </div>
            </div>
          </div>
          {rounds && (
            <p className="text-sm">
              Over {rounds.rounds.toLocaleString()} simulated rounds: <strong>{a.name}</strong> {rounds.aWins} –{" "}
              {rounds.bWins} <strong>{b.name}</strong>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Panels assume independent ballots at the single-round probability. Ratings only reflect the tournaments
            in the rankings, so treat these as estimates, not predictions.
          </p>
        </div>
      )}
    </section>
  )
}
