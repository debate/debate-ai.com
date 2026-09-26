/**
 * @fileoverview Summary strip above the rankings table: the field-wide side
 * bias from `output/<prefix>field_statistics.csv` and the tournaments rated.
 * @module components/debate/DebateVideos/panels/RankingsFieldSummary
 */

import type { RankingDataset } from "debate-rankings-adapter"
import { SPEECH_SIDE_STYLES } from "../../components/watch/speech-side-styles"

/** Turns a tournament folder slug (`greenhill-rr`) into a label (`Greenhill RR`). */
function tournamentLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) => (w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ")
}

/**
 * A fixed `NN.NN` percentage with the first two digits bold (and side-tinted,
 * when given a side) and only the trailing hundredths digit shrunk down — the
 * digits that matter for comparing sides stay full-size.
 */
function EmphasizedPercent({ value, side }: { value: number; side?: "aff" | "neg" }) {
  const text = value.toFixed(2)
  const highlight = text.slice(0, 2)
  const middle = text.slice(2, -1)
  const last = text.slice(-1)
  const highlightColor =
    side === "aff"
      ? "text-blue-600 dark:text-blue-400"
      : side === "neg"
        ? "text-red-600 dark:text-red-400"
        : ""
  return (
    <span className="tabular-nums">
      <span className={`font-bold ${highlightColor}`}>{highlight}</span>
      <span>{middle}</span>
      <span className="text-[0.65em] text-muted-foreground">{last}</span>
      <span className="text-[0.65em] text-muted-foreground">%</span>
    </span>
  )
}

/** One win rate shown as a number over a filled progress line, not just text. */
function PercentProgressLine({
  label,
  value,
  side,
}: {
  label: string
  value: number | null
  side: "aff" | "neg"
}) {
  return (
    <div className="rounded-lg border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-lg leading-tight">
        {value === null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <EmphasizedPercent value={value} side={side} />
        )}
      </div>
      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
        <div
          className={`h-full rounded-full ${SPEECH_SIDE_STYLES[side].dot} transition-[width] duration-500`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  )
}

/**
 * The field-wide aff/neg split for regular rounds, as one diverging bar with
 * the 50% line marked — how far the whole field's results lean to a side.
 */
function SideBiasCard({ aff, neg }: { aff: number | null; neg: number | null }) {
  const skew = aff !== null && neg !== null ? aff - 50 : null
  return (
    <div className="col-span-2 rounded-lg border bg-card px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Side bias</span>
        {skew !== null && (
          <span
            className={
              skew === 0
                ? ""
                : skew > 0
                  ? "font-medium text-blue-600 dark:text-blue-400"
                  : "font-medium text-red-600 dark:text-red-400"
            }
          >
            {skew === 0 ? "Even" : `${skew > 0 ? "Aff" : "Neg"} +${Math.abs(skew).toFixed(1)}`}
          </span>
        )}
      </div>
      {aff === null || neg === null ? (
        <div className="text-lg font-semibold text-muted-foreground">—</div>
      ) : (
        <>
          <div className="relative flex h-3 overflow-hidden rounded-sm bg-muted" aria-hidden>
            <span
              className={`${SPEECH_SIDE_STYLES.aff.dot} transition-[width] duration-500`}
              style={{ width: `${aff}%` }}
            />
            <span className={`${SPEECH_SIDE_STYLES.neg.dot} flex-1 opacity-80`} />
            <span className="absolute inset-y-0 left-1/2 w-px bg-background" />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>
              Aff <EmphasizedPercent value={aff} side="aff" />
            </span>
            <span>
              Neg <EmphasizedPercent value={neg} side="neg" />
            </span>
          </div>
        </>
      )}
    </div>
  )
}

/**
 * The field-wide side bias (aff vs. neg win rate, as one split bar) plus the
 * elimination-round win rates as individual progress lines, the entry count,
 * and the list of tournaments that fed the ratings (majors marked, since
 * they count double).
 *
 * @param props.dataset - The loaded rankings dataset.
 */
export function RankingsFieldSummary({ dataset }: { dataset: RankingDataset }) {
  const majors = new Set(dataset.majors)
  const field = dataset.field
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SideBiasCard aff={field?.affWinRate ?? null} neg={field?.negWinRate ?? null} />
        <div className="rounded-lg border bg-card px-3 py-2">
          <div className="text-xs text-muted-foreground">Ranked entries</div>
          <div className="text-lg font-semibold tabular-nums">{dataset.entries.length}</div>
        </div>
        <PercentProgressLine label="Aff elim win rate" value={field?.affElimWinRate ?? null} side="aff" />
        <PercentProgressLine label="Neg elim win rate" value={field?.negElimWinRate ?? null} side="neg" />
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
