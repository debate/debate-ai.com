/**
 * @fileoverview Summary strip above the rankings table: the field-wide side
 * bias from `output/<prefix>field_statistics.csv` and the tournaments rated.
 * @module leaderboard/RankingsFieldSummary
 */

import type { RankingDataset } from "../index";

/** Turns a tournament folder slug (`greenhill-rr`) into a label (`Greenhill RR`). */
function tournamentLabel(slug: string): string {
  return slug
    .split("-")
    .map((w) =>
      w.length <= 2 ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/**
 * One aff/neg split as a compact line — "Neg Bias +1", "Aff Elims Bias +3", or
 * "No Elims Bias". The lean is how far the split sits from 50%, rounded down to
 * whole points (under one point reads as no bias); the exact rates are in the
 * tooltip.
 */
function BiasLine({
  label,
  aff,
  neg,
}: {
  label: string;
  aff: number | null;
  neg: number | null;
}) {
  const name = label ? `${label} Bias` : "Bias";
  if (aff === null || neg === null) {
    return <div className="text-sm text-muted-foreground">{name} —</div>;
  }
  const skew = aff - 50;
  const points = Math.floor(Math.abs(skew));
  return (
    <div
      className={`text-sm tabular-nums ${
        points === 0
          ? "text-muted-foreground"
          : skew > 0
            ? "font-medium text-blue-600 dark:text-blue-400"
            : "font-medium text-red-600 dark:text-red-400"
      }`}
      title={`${label || "Overall"}: aff ${aff.toFixed(2)}%, neg ${neg.toFixed(2)}%`}
    >
      {points === 0 ? `No ${name}` : `${skew > 0 ? "Aff" : "Neg"} ${name} +${points}`}
    </div>
  );
}

/**
 * The field-wide side bias as two short lines: the aff/neg lean over all
 * rounds and the lean in elims.
 */
function SideBiasCard({
  aff,
  neg,
  affElim,
  negElim,
}: {
  aff: number | null;
  neg: number | null;
  affElim: number | null;
  negElim: number | null;
}) {
  return (
    <div className="col-span-2 rounded-lg border bg-card px-3 py-2">
      <div className="text-xs text-muted-foreground">Side bias</div>
      <BiasLine label="" aff={aff} neg={neg} />
      <BiasLine label="Elims" aff={affElim} neg={negElim} />
    </div>
  );
}

/**
 * The field-wide side bias (overall and elim aff vs. neg lean, as
 * short text lines), the entry count, and the list of tournaments that fed the ratings (majors marked, since
 * they count double).
 *
 * @param props.dataset - The loaded rankings dataset.
 */
export function RankingsFieldSummary({ dataset }: { dataset: RankingDataset }) {
  const majors = new Set(dataset.majors);
  const field = dataset.field;
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <SideBiasCard
          aff={field?.affWinRate ?? null}
          neg={field?.negWinRate ?? null}
          affElim={field?.affElimWinRate ?? null}
          negElim={field?.negElimWinRate ?? null}
        />
        <div className="col-span-2 rounded-lg border bg-card px-3 py-2 sm:col-span-1">
          <div className="text-xs text-muted-foreground">Ranked entries</div>
          <div className="text-lg font-semibold tabular-nums">
            {dataset.entries.length}
          </div>
        </div>
      </div>
      {dataset.tournaments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Bradley-Terry ratings from {dataset.tournaments.length} tournament
          {dataset.tournaments.length === 1 ? "" : "s"}:{" "}
          {dataset.tournaments.map((t, i) => (
            <span key={t}>
              {i > 0 && ", "}
              {tournamentLabel(t)}
              {majors.has(t) && (
                <span title="Major — rounds count double"> (major)</span>
              )}
            </span>
          ))}
          .
        </p>
      )}
    </div>
  );
}
