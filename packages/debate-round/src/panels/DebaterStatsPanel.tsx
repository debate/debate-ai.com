/**
 * @fileoverview Debater Stats panel — mounts `round/debater-stats.ts`'s
 * `buildDebaterStats` over the rounds this team logged in
 * `state/ownRoundHistory.ts` (account-synced as the `ownRoundHistory`
 * tool-record collection), closing the "mount a Stats panel" follow-up of the
 * "Analytics Dashboard for Debaters" idea in IDEAS.md.
 *
 * Rounds can be logged right here ("Log a round", built by
 * `round/own-round-log.ts`; opponent optional) as well as from the Pre-Round
 * Briefings panel's form, and the "Logged rounds" list removes a mistyped one
 * after a confirm. Both write `state/ownRoundHistory.ts`, so the account sync
 * carries them. Re-reads when another tab changes `ownRoundHistory`.
 *
 * @module panels/DebaterStatsPanel
 */

"use client"

import { useEffect, useMemo, useState, type FormEvent } from "react"
import { buildDebaterStats, type LabeledWinLossRecord, type WinLossRecord, type FormTrend } from "../round/debater-stats"
import {
  buildOwnRoundLogRecord,
  describeOwnRound,
  EMPTY_OWN_ROUND_LOG_DRAFT,
  MAX_OWN_ROUND_TEXT_LENGTH,
  newOwnRoundId,
  sortOwnRoundsNewestFirst,
  type OwnRoundLogDraft,
} from "../round/own-round-log"
import {
  deleteOwnRoundHistoryRecord,
  listOwnRoundHistory,
  saveOwnRoundHistoryRecord,
  type OwnRoundHistoryRecord,
} from "../state/ownRoundHistory"
import { Button } from "../ui/primitives/button"
import { Input } from "../ui/primitives/input"
import { Label } from "../ui/primitives/label"
import {
  EmptyState,
  MeterBar,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  type PanelTone,
} from "../ui/panels/panel-shell"

/** Most rows shown per breakdown; the rest are summarised. */
const MAX_BREAKDOWN_ROWS = 8

/** Logged rounds listed before "Show all". */
const LOGGED_ROUNDS_PREVIEW = 5

const SELECT_CLASS =
  "border-input bg-transparent h-9 w-full rounded-md border px-3 text-sm shadow-xs outline-none focus-visible:ring-ring/50 focus-visible:ring-[3px]"

const TREND_LABEL: Record<FormTrend, string> = {
  improving: "Improving",
  declining: "Declining",
  steady: "Steady",
  "insufficient-data": "Not enough rounds yet",
}

const TREND_TONE: Record<FormTrend, PanelTone> = {
  improving: "positive",
  declining: "critical",
  steady: "info",
  "insufficient-data": "neutral",
}

/** `0.67` → `"67%"`; `null` (no rounds) → an em dash. */
export function formatWinRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`
}

/** A word count, or an em dash when no such round logged one. */
export function formatWords(words: number | null): string {
  return words === null ? "—" : words.toLocaleString("en-US")
}

function recordHint(record: WinLossRecord): string {
  return `${record.wins}–${record.losses} in ${record.rounds} ${record.rounds === 1 ? "round" : "rounds"}`
}

function rateTone(rate: number | null): PanelTone {
  if (rate === null) return "neutral"
  return rate >= 0.6 ? "positive" : rate < 0.4 ? "critical" : "warning"
}

function Breakdown({ title, rows }: { title: string; rows: LabeledWinLossRecord[] }) {
  if (rows.length === 0) return null
  const shown = rows.slice(0, MAX_BREAKDOWN_ROWS)
  return (
    <PanelSection title={title}>
      <div className="flex flex-col gap-2">
        {shown.map((row) => (
          <MeterBar
            key={row.label}
            label={row.label}
            value={row.wins}
            max={row.rounds}
            caption={`${formatWinRate(row.winRate)} · ${recordHint(row)}`}
            tone={rateTone(row.winRate)}
          />
        ))}
        {rows.length > shown.length ? (
          <p className="text-muted-foreground text-xs">+{rows.length - shown.length} more not shown</p>
        ) : null}
      </div>
    </PanelSection>
  )
}

/** The panel's own "Log a round" form. Opponent, case, arguments and words are optional. */
function LogRoundForm({ onSaved, onCancel }: { onSaved: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<OwnRoundLogDraft>(EMPTY_OWN_ROUND_LOG_DRAFT)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof OwnRoundLogDraft>(key: K, value: OwnRoundLogDraft[K]) =>
    setDraft((prev) => ({ ...prev, [key]: value }))

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const result = buildOwnRoundLogRecord(draft, newOwnRoundId())
    if (!result.ok) {
      setError(result.error)
      return
    }
    try {
      saveOwnRoundHistoryRecord(result.record)
    } catch {
      setError("Couldn't save the round on this device. Free up browser storage and try again.")
      return
    }
    setError(null)
    // Keep tournament and division: the next round logged is usually from the same tournament.
    setDraft({ ...EMPTY_OWN_ROUND_LOG_DRAFT, tournamentName: draft.tournamentName, division: draft.division, date: draft.date })
    onSaved()
  }

  const text = (key: "tournamentName" | "division" | "opponent" | "caseName", label: string, placeholder: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`stats-log-${key}`}>{label}</Label>
      <Input
        id={`stats-log-${key}`}
        value={draft[key]}
        maxLength={MAX_OWN_ROUND_TEXT_LENGTH}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value)}
      />
    </div>
  )

  return (
    <form
      onSubmit={submit}
      aria-label="Log a round"
      data-testid="debater-stats-log-form"
      className="flex flex-col gap-3 rounded-lg border border-border p-3"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {text("tournamentName", "Tournament", "Blake")}
        <div className="space-y-1.5">
          <Label htmlFor="stats-log-date">Date</Label>
          <Input id="stats-log-date" type="date" value={draft.date} onChange={(e) => set("date", e.target.value)} />
        </div>
        {text("division", "Division", "LD")}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="stats-log-side">Side</Label>
            <select
              id="stats-log-side"
              className={SELECT_CLASS}
              value={draft.side}
              onChange={(e) => set("side", e.target.value as OwnRoundLogDraft["side"])}
            >
              <option value="aff">Aff</option>
              <option value="neg">Neg</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="stats-log-result">Result</Label>
            <select
              id="stats-log-result"
              className={SELECT_CLASS}
              value={draft.result}
              onChange={(e) => set("result", e.target.value as OwnRoundLogDraft["result"])}
            >
              <option value="won">Won</option>
              <option value="lost">Lost</option>
            </select>
          </div>
        </div>
        {text("opponent", "Opponent (optional)", "Team code")}
        {text("caseName", "Case (optional)", "Climate Aff")}
        <div className="space-y-1.5">
          <Label htmlFor="stats-log-argumentTags">Arguments run (optional)</Label>
          <Input
            id="stats-log-argumentTags"
            value={draft.argumentTags}
            placeholder="Capitalism K, Topicality"
            onChange={(e) => set("argumentTags", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="stats-log-speechWordCount">Words spoken (optional)</Label>
          <Input
            id="stats-log-speechWordCount"
            inputMode="numeric"
            value={draft.speechWordCount}
            placeholder="4200"
            onChange={(e) => set("speechWordCount", e.target.value)}
          />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-destructive text-xs">
          {error}
        </p>
      ) : null}
      <div className="flex items-center gap-2">
        <Button type="submit" size="sm">
          Save round
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onCancel}>
          Close
        </Button>
      </div>
    </form>
  )
}

/** Newest-first list of logged rounds, each removable after a confirm. */
function LoggedRounds({ records, onDeleted }: { records: OwnRoundHistoryRecord[]; onDeleted: () => void }) {
  const [showAll, setShowAll] = useState(false)
  const sorted = useMemo(() => sortOwnRoundsNewestFirst(records), [records])
  const shown = showAll ? sorted : sorted.slice(0, LOGGED_ROUNDS_PREVIEW)

  const remove = (record: OwnRoundHistoryRecord) => {
    const label = describeOwnRound(record)
    if (typeof window !== "undefined" && !window.confirm(`Delete the logged round "${label}" (${record.date})?`)) return
    deleteOwnRoundHistoryRecord(record.id)
    onDeleted()
  }

  return (
    <PanelSection title="Logged rounds" description="Delete a round you logged by mistake; your stats update right away.">
      <ul className="flex flex-col gap-1" aria-label="Logged rounds" data-testid="debater-stats-logged-rounds">
        {shown.map((record) => (
          <li key={record.id} className="flex items-center justify-between gap-2 text-sm">
            <span className="truncate">
              <span className="text-muted-foreground tabular-nums">{record.date}</span> {describeOwnRound(record)}
            </span>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive shrink-0"
              aria-label={`Delete ${describeOwnRound(record)} on ${record.date}`}
              onClick={() => remove(record)}
            >
              Delete
            </Button>
          </li>
        ))}
      </ul>
      {sorted.length > LOGGED_ROUNDS_PREVIEW ? (
        <Button type="button" size="sm" variant="link" className="self-start px-0" onClick={() => setShowAll((v) => !v)}>
          {showAll ? "Show fewer" : `Show all ${sorted.length}`}
        </Button>
      ) : null}
    </PanelSection>
  )
}

/** Personal win/loss analytics over this team's logged rounds. */
export function DebaterStatsPanel() {
  const [records, setRecords] = useState<OwnRoundHistoryRecord[]>([])
  const [logging, setLogging] = useState(false)
  const refresh = () => setRecords(listOwnRoundHistory())

  useEffect(() => {
    setRecords(listOwnRoundHistory())
    const handleStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === "ownRoundHistory") setRecords(listOwnRoundHistory())
    }
    window.addEventListener("storage", handleStorage)
    return () => window.removeEventListener("storage", handleStorage)
  }, [])

  const stats = useMemo(() => buildDebaterStats(records), [records])

  return (
    <PanelShell
      title="Debater Stats"
      description="Win rate, side split and recent form from the rounds you've logged."
      data-testid="debater-stats-panel"
      actions={
        logging ? null : (
          <Button type="button" size="sm" variant="outline" onClick={() => setLogging(true)}>
            Log a round
          </Button>
        )
      }
    >
      {logging ? <LogRoundForm onSaved={refresh} onCancel={() => setLogging(false)} /> : null}
      {records.length === 0 ? (
        <EmptyState
          title="No rounds logged yet"
          message="Use Log a round (here or in Pre-Round Briefings) and your win rate, side split, form and speech length show up here."
        />
      ) : (
        <>
          <StatGrid columns={4}>
            <StatTile
              label="Win rate"
              value={formatWinRate(stats.overall.winRate)}
              hint={recordHint(stats.overall)}
              tone={rateTone(stats.overall.winRate)}
            />
            <StatTile label="Aff" value={formatWinRate(stats.aff.winRate)} hint={recordHint(stats.aff)} />
            <StatTile label="Neg" value={formatWinRate(stats.neg.winRate)} hint={recordHint(stats.neg)} />
            <StatTile
              label="Recent form"
              value={formatWinRate(stats.recent.winRate)}
              hint={recordHint(stats.recent)}
              tone={TREND_TONE[stats.trend]}
            />
          </StatGrid>
          <p className="text-sm" data-testid="debater-stats-trend">
            Trend: <Pill tone={TREND_TONE[stats.trend]}>{TREND_LABEL[stats.trend]}</Pill>
            {stats.streak.kind ? (
              <span data-testid="debater-stats-streak">
                {" "}· {stats.streak.length}-round {stats.streak.kind} streak
              </span>
            ) : null}
          </p>
          {stats.speechLength.rounds > 0 ? (
            <PanelSection title="Speech length">
              <StatGrid columns={3}>
                <StatTile
                  label="Avg words"
                  value={formatWords(stats.speechLength.averageWords)}
                  hint={`over ${stats.speechLength.rounds} ${stats.speechLength.rounds === 1 ? "round" : "rounds"}`}
                />
                <StatTile label="In wins" value={formatWords(stats.speechLength.averageWordsInWins)} />
                <StatTile label="In losses" value={formatWords(stats.speechLength.averageWordsInLosses)} />
              </StatGrid>
            </PanelSection>
          ) : null}
          <Breakdown title="By division" rows={stats.byDivision} />
          <Breakdown title="By argument" rows={stats.byArgumentTag} />
          <Breakdown title="By case" rows={stats.byCase} />
          <LoggedRounds records={records} onDeleted={refresh} />
        </>
      )}
    </PanelShell>
  )
}
