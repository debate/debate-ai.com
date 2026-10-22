/**
 * @fileoverview Debater Stats panel — mounts `round/debater-stats.ts`'s
 * `buildDebaterStats` over the rounds this team logged in
 * `state/ownRoundHistory.ts` (account-synced as the `ownRoundHistory`
 * tool-record collection), closing the "mount a Stats panel" follow-up of the
 * "Analytics Dashboard for Debaters" idea in IDEAS.md.
 *
 * Read-only: rounds are logged from the Pre-Round Briefings panel's "Log a
 * round" form, so this panel only explains that when nothing is logged yet.
 * Re-reads when another tab changes `ownRoundHistory`.
 *
 * @module panels/DebaterStatsPanel
 */

"use client"

import { useEffect, useMemo, useState } from "react"
import { buildDebaterStats, type LabeledWinLossRecord, type WinLossRecord, type FormTrend } from "../round/debater-stats"
import { listOwnRoundHistory, type OwnRoundHistoryRecord } from "../state/ownRoundHistory"
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

/** Personal win/loss analytics over this team's logged rounds. */
export function DebaterStatsPanel() {
  const [records, setRecords] = useState<OwnRoundHistoryRecord[]>([])

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
    >
      {records.length === 0 ? (
        <EmptyState
          title="No rounds logged yet"
          message="Log a round in Pre-Round Briefings and your win rate, side split, form and speech length show up here."
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
        </>
      )}
    </PanelShell>
  )
}
