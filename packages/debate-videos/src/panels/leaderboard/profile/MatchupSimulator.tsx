/**
 * @fileoverview Head-to-head matchup simulator: pick any two ranked entries in
 * a division and see each team's chances with A locked aff and then locked
 * neg, in prelims (one judge) and elims (3- and 5-judge panels), plus a Monte
 * Carlo run per side so the variance a percentage hides is visible.
 *
 * The math is `@debate/rankings-adapter`'s `modelMatchup`: Glicko-2's win
 * probability from a rating blended from the team's own rating, the debaters'
 * individual ratings from their other entries, and their school's mean —
 * mixed by the two sliders here — then shifted for the field's side bias and
 * each team's own aff/neg tilt. Each team gets a recommended mix
 * (`recommendWeights`): few rounds of its own → lean on the school.
 *
 * Side A pre-fills with the viewer's own team for the division ("My team" in
 * Settings, `lib/my-ranked-teams`). On another team's profile that team is the
 * opponent; on the viewer's own profile, or with no team set, the profile's
 * team is side A and locked, as before.
 *
 * Reads every division's full-season rankings through
 * {@link useAllRankingDatasets}, so every ranked team is pairable. Mounted on
 * the practice-round page (both sides free) and on each team profile.
 * @module panels/leaderboard/profile/MatchupSimulator
 */

"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import {
  modelMatchup,
  recommendSide,
  recommendWeights,
  simulateRounds,
  type DebateSide,
  type MatchupWeights,
  type RankingDataset,
  type RankingDatasetId,
  type RankingEntry,
  type RatingBreakdown,
  type SimulatedRounds,
} from "@debate/rankings-adapter"
import { useAllRankingDatasets } from "../../../hooks/useAllRankingDatasets"
import { useMyRankedTeams } from "../../../lib/my-ranked-teams/useMyRankedTeams"
import { Button } from "../../../ui/primitives/button"
import { Input } from "../../../ui/primitives/input"
import { teamHref, teamSlug } from "./rankingProfileHelpers"

const pct = (p: number) => `${(p * 100).toFixed(1)}%`
const SIM_ROUNDS = 1000
const selectClass =
  "border-input h-9 w-full rounded-md border bg-transparent px-2 text-sm shadow-xs dark:bg-input/30"
/** Starting slider positions before the user (or a recommendation) moves them. */
const DEFAULT_WEIGHTS: MatchupWeights = { school: 0.2, individual: 0.2 }

type SideChoice = DebateSide | "both"
type StageChoice = "prelim" | "elim" | "both"

/** Label a rankings row is listed under in the pickers. */
function entryLabel(entry: RankingEntry): string {
  return `#${entry.rank} ${entry.name} — ${entry.school}`
}

/** A filter box plus a dropdown of every entry in the division that matches it. */
export function TeamPicker({
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

/** A row of mutually exclusive buttons. */
function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: readonly { id: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <div role="radiogroup" aria-label={label} className="inline-flex rounded-md border bg-muted/40 p-0.5">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={value === o.id}
            onClick={() => onChange(o.id)}
            className={`h-7 rounded px-3 text-xs font-medium transition-colors ${
              value === o.id ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A 0–100% slider for one weight. */
function WeightSlider({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <label className="block space-y-1">
      <span className="flex items-baseline justify-between text-xs font-medium text-muted-foreground">
        {label}
        <span className="tabular-nums text-foreground">{Math.round(value * 100)}%</span>
      </span>
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        className="w-full accent-primary"
        aria-label={label}
      />
      <span className="block text-[11px] text-muted-foreground">{hint}</span>
    </label>
  )
}

/** One team's name, the signals behind its blended rating, and its suggested mix. */
function TeamBreakdown({
  entry,
  breakdown,
  recommended,
  onUseRecommended,
  align,
}: {
  entry: RankingEntry
  breakdown: RatingBreakdown
  recommended: MatchupWeights
  onUseRecommended: () => void
  align: "left" | "right"
}) {
  return (
    <div className={align === "right" ? "sm:text-right" : ""}>
      <Link href={teamHref(entry)} className="font-semibold text-foreground underline-offset-4 hover:underline">
        {entry.name}
      </Link>
      <div className="text-xs text-muted-foreground">
        {entry.school} · #{entry.rank} · {entry.matches} rounds
      </div>
      <dl className="mt-1 text-xs tabular-nums text-muted-foreground">
        <div>
          Team {breakdown.team.toFixed(1)} · School {breakdown.school.toFixed(1)}
          {breakdown.schoolEntries > 1 ? ` (${breakdown.schoolEntries} entries)` : " (only entry)"}
        </div>
        <div>
          Individual{" "}
          {breakdown.individual === null
            ? "— no other entries"
            : `${breakdown.individual.toFixed(1)} (${breakdown.individualSources} other entr${breakdown.individualSources === 1 ? "y" : "ies"})`}
        </div>
        <div className="font-medium text-foreground">Blended {breakdown.blended.toFixed(1)}</div>
      </dl>
      <button
        type="button"
        onClick={onUseRecommended}
        className="mt-1 text-[11px] text-primary underline-offset-4 hover:underline"
      >
        Recommended: school {Math.round(recommended.school * 100)}%, individual{" "}
        {Math.round(recommended.individual * 100)}% — use
      </button>
    </div>
  )
}

/** Props for {@link MatchupSimulator}. */
export interface MatchupSimulatorProps {
  /**
   * The profile's team (its `teamSlug`); only divisions it is ranked in are
   * offered. When the viewer has their own team set for the division it
   * becomes side A and this team the opponent; otherwise this team is side A,
   * locked. Omit to let both sides be picked freely.
   */
  lockedTeamSlug?: string
  /** Division to open on; defaults to the first one available. */
  initialDatasetId?: RankingDatasetId
  /** Heading shown above the simulator. */
  title?: string
}

/** Pairs any two ranked teams in a division and simulates their round on each side. */
export function MatchupSimulator({ lockedTeamSlug, initialDatasetId, title = "Matchup simulator" }: MatchupSimulatorProps) {
  const { datasets, loading, error } = useAllRankingDatasets()
  const { value: myTeams } = useMyRankedTeams()

  const available: RankingDataset[] = useMemo(
    () =>
      lockedTeamSlug
        ? datasets.filter((d) => d.entries.some((e) => teamSlug(e) === lockedTeamSlug))
        : datasets.filter((d) => d.entries.length > 1),
    [datasets, lockedTeamSlug],
  )

  const [pickedDatasetId, setDatasetId] = useState<RankingDatasetId | undefined>(initialDatasetId)
  const dataset = available.find((d) => d.id === pickedDatasetId) ?? available[0]
  const [picked, setPicked] = useState<Record<string, { a?: string; b?: string }>>({})
  const [sides, setSides] = useState<SideChoice>("both")
  const [stage, setStage] = useState<StageChoice>("both")
  const [weights, setWeights] = useState<MatchupWeights>(DEFAULT_WEIGHTS)
  const [runs, setRuns] = useState<{ key: string; results: Partial<Record<DebateSide, SimulatedRounds>> } | null>(null)

  if (loading) return <p className="py-6 text-sm text-muted-foreground">Loading rankings…</p>
  if (error) return <p className="py-6 text-sm text-muted-foreground">{error}</p>
  if (!dataset) return null

  const findSlug = (slug: string | undefined) =>
    slug ? dataset.entries.find((e) => teamSlug(e) === slug) : undefined
  // The viewer's team, when it is ranked in this division.
  const mySlug = findSlug(myTeams.teams[dataset.id]) ? myTeams.teams[dataset.id] : undefined
  // On someone else's profile with a team of their own, the viewer is side A.
  const viewerVsProfile = Boolean(lockedTeamSlug && mySlug && mySlug !== lockedTeamSlug)
  const aLocked = Boolean(lockedTeamSlug && !viewerVsProfile)

  const pick = picked[dataset.id] ?? {}
  const aSlug = aLocked ? lockedTeamSlug! : (pick.a ?? mySlug ?? "")
  const bSlug = pick.b ?? (viewerVsProfile ? lockedTeamSlug! : "")
  const a = findSlug(aSlug)
  const b = findSlug(bSlug)
  const opponents = dataset.entries.filter((e) => teamSlug(e) !== aSlug)
  const setSide = (side: "a" | "b", slug: string) =>
    setPicked((prev) => ({ ...prev, [dataset.id]: { ...pick, [side]: slug } }))

  const result = a && b && a !== b ? modelMatchup(a, b, dataset, datasets, weights) : null
  const shownSides = result ? result.sides.filter((o) => sides === "both" || o.side === sides) : []
  const showPrelim = stage !== "elim"
  const showElim = stage !== "prelim"
  const runKey = `${dataset.id}:${aSlug}:${bSlug}:${weights.school}:${weights.individual}`
  const rounds = runs?.key === runKey ? runs.results : null

  const randomOpponent = () => {
    if (opponents.length) setSide("b", teamSlug(opponents[Math.floor(Math.random() * opponents.length)]))
  }
  const runSimulation = () => {
    if (!result) return
    const results: Partial<Record<DebateSide, SimulatedRounds>> = {}
    for (const o of result.sides) results[o.side] = simulateRounds(o.prelim, SIM_ROUNDS)
    setRuns({ key: runKey, results })
  }

  const sideName = (side: DebateSide) => (side === "aff" ? "Aff" : "Neg")
  const other = (side: DebateSide): DebateSide => (side === "aff" ? "neg" : "aff")
  // Which side A should take on a coin flip, per stage shown.
  const recommendations = result
    ? [
        ...(showPrelim ? [{ label: "Prelims", rec: recommendSide(result, "prelim") }] : []),
        ...(showElim ? [{ label: "Elims", rec: recommendSide(result, "elim") }] : []),
      ]
    : []

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
        Each side is simulated separately — A locked aff, then A locked neg — from the full-season {dataset.label}{" "}
        ratings, blended with school and individual performance by the sliders below.{" "}
        {mySlug ? (
          "Your team is pre-filled from Settings."
        ) : (
          <>
            <Link href="/settings?category=my-team" className="text-primary underline-offset-4 hover:underline">
              Set your team
            </Link>{" "}
            to have it pre-filled here.
          </>
        )}
      </p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {aLocked && a ? (
          <div className="space-y-1.5">
            <div className="text-xs font-medium text-muted-foreground">Team A</div>
            <div className="text-sm font-medium">{entryLabel(a)}</div>
          </div>
        ) : (
          <TeamPicker
            label={mySlug && aSlug === mySlug ? "Team A (your team)" : "Team A"}
            entries={dataset.entries}
            value={aSlug}
            onChange={(s) => setSide("a", s)}
          />
        )}
        <TeamPicker
          label={lockedTeamSlug ? "Opponent" : "Team B"}
          entries={opponents}
          value={bSlug}
          onChange={(s) => setSide("b", s)}
        />
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-wrap gap-4">
          <Segmented
            label="Team A's side"
            value={sides}
            onChange={setSides}
            options={[
              { id: "aff", label: "Aff" },
              { id: "neg", label: "Neg" },
              { id: "both", label: "Both" },
            ]}
          />
          <Segmented
            label="Round"
            value={stage}
            onChange={setStage}
            options={[
              { id: "prelim", label: "Prelim" },
              { id: "elim", label: "Elim" },
              { id: "both", label: "Both" },
            ]}
          />
        </div>
        <div className="space-y-2">
          <WeightSlider
            label="School performance"
            hint="How much of each rating comes from the school's average entry — program strength and shared files."
            value={weights.school}
            onChange={(school) => setWeights((w) => ({ ...w, school }))}
          />
          <WeightSlider
            label="Individual performance"
            hint="How much of the team rating comes from each debater's other entries — other partners and divisions."
            value={weights.individual}
            onChange={(individual) => setWeights((w) => ({ ...w, individual }))}
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" variant="outline" size="sm" onClick={randomOpponent}>
          Random opponent
        </Button>
        <Button type="button" size="sm" disabled={!result} onClick={runSimulation}>
          Simulate {SIM_ROUNDS.toLocaleString()} rounds per side
        </Button>
      </div>

      {a && b && a === b && <p className="mt-3 text-sm text-muted-foreground">Pick two different teams.</p>}

      {result && a && b && (
        <div className="mt-4 space-y-3">
          <div className="grid gap-4 sm:grid-cols-2">
            <TeamBreakdown
              entry={a}
              breakdown={result.a}
              recommended={recommendWeights(a, result.a)}
              onUseRecommended={() => setWeights(recommendWeights(a, result.a))}
              align="left"
            />
            <TeamBreakdown
              entry={b}
              breakdown={result.b}
              recommended={recommendWeights(b, result.b)}
              onUseRecommended={() => setWeights(recommendWeights(b, result.b))}
              align="right"
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="py-1 pr-3 font-medium">{a.name} on…</th>
                  {showPrelim && <th className="py-1 pr-3 font-medium">Prelim (1 judge)</th>}
                  {showElim && <th className="py-1 pr-3 font-medium">Elim, 3 judges</th>}
                  {showElim && <th className="py-1 pr-3 font-medium">Elim, 5 judges</th>}
                </tr>
              </thead>
              <tbody>
                {shownSides.map((o) => (
                  <tr key={o.side} className="border-t">
                    <td className="py-1.5 pr-3">
                      <span className="font-medium">{sideName(o.side)}</span>{" "}
                      <span className="text-xs text-muted-foreground">
                        vs {b.name} {sideName(other(o.side)).toLowerCase()}
                      </span>
                    </td>
                    {showPrelim && <td className="py-1.5 pr-3 tabular-nums">{pct(o.prelim)}</td>}
                    {showElim && <td className="py-1.5 pr-3 tabular-nums">{pct(o.elim3)}</td>}
                    {showElim && <td className="py-1.5 pr-3 tabular-nums">{pct(o.elim5)}</td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {sides === "both" && (
            <p className="text-sm">
              {recommendations.map(({ label, rec }) => (
                <span key={label} className="mr-3 inline-block">
                  <strong>{label}:</strong>{" "}
                  {rec
                    ? `${a.name} should take ${sideName(rec.side)} (+${rec.margin.toFixed(1)} pts)`
                    : "no real side preference"}
                </span>
              ))}
            </p>
          )}

          {rounds && (
            <ul className="text-sm">
              {shownSides.map((o) =>
                rounds[o.side] ? (
                  <li key={o.side}>
                    {a.name} on {sideName(o.side)}, {rounds[o.side]!.rounds.toLocaleString()} prelims:{" "}
                    <strong>{rounds[o.side]!.aWins}</strong> – {rounds[o.side]!.bWins} {b.name}
                  </li>
                ) : null,
              )}
            </ul>
          )}
          <p className="text-xs text-muted-foreground">
            Side effects come from the field&apos;s aff/neg split and each team&apos;s own aff vs. neg record, shrunk
            toward zero for teams with few rounds. Panels assume independent ballots. Ratings only reflect the
            tournaments in the rankings, so treat these as estimates, not predictions.
          </p>
        </div>
      )}
    </section>
  )
}
