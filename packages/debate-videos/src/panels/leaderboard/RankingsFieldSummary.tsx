/**
 * @fileoverview Summary strip above the rankings table: the field-wide side
 * bias from `output/<prefix>field_statistics.csv` and the tournaments rated.
 * @module components/debate/DebateVideos/panels/RankingsFieldSummary
 */

import type { RankingDataset } from "debate-rankings-adapter"

const STATS: { key: keyof NonNullable<RankingDataset["field"]>; label: string }[] = [
  { key: "affWinRate", label: "Aff win rate" },
  { key: "negWinRate", label: "Neg win rate" },
  { key: "affElimWinRate", label: "Aff elim win rate" },
  { key: "negElimWinRate", label: "Neg elim win rate" },
]

/** Turns a tournament folder slug (`greenhill-rr`) into a label (`Greenhill RR`). */
function tournamentLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
}

/**
 * Four field-wide win-rate tiles plus the entry count and the list of
 * tournaments that fed the ratings (majors marked, since they count double).
 *
 * @param props.dataset - The loaded rankings dataset.
 */
export function RankingsFieldSummary({ dataset }: { dataset: RankingDataset }) {
  const majors = new Set(dataset.majors)
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <div className="rounded-lg border bg-card px-3 py-2">
          <div className="text-xs text-muted-foreground">Ranked entries</div>
          <div className="text-lg font-semibold tabular-nums">{dataset.entries.length}</div>
        </div>
        {STATS.map(({ key, label }) => {
          const value = dataset.field?.[key] ?? null
          return (
            <div key={key} className="rounded-lg border bg-card px-3 py-2">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-lg font-semibold tabular-nums">
                {value === null ? "—" : `${value}%`}
              </div>
            </div>
          )
        })}
      </div>
      {dataset.tournaments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Glicko-2 ratings from {dataset.tournaments.length} tournament
          {dataset.tournaments.length === 1 ? "" : "s"}:{" "}
          {dataset.tournaments.map((t, i) => (
            <span key={t}>
              {i > 0 && ", "}
              {tournamentLabel(t)}
              {majors.has(t) && <span title="Major — rounds count double"> (major)</span>}
            </span>
          ))}
          .
        </p>
      )}
    </div>
  )
}
