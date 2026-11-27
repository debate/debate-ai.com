/**
 * @fileoverview Summary strip above the rankings table: the field-wide side
 * bias from `output/<prefix>field_statistics.csv` and the tournaments rated.
 * @module leaderboard/RankingsFieldSummary
 */

import { currentRankingSeasonYear, type RankingDataset } from "../index";
import {
  SIDE_BIAS_AFF_LABELS,
  SIDE_BIAS_CHAMPIONSHIP_NAMES,
  SIDE_BIAS_FORMAT_BY_DATASET,
  championshipSideBias,
} from "../side-bias";

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
  affName = "Aff",
  negName = "Neg",
}: {
  label: string;
  aff: number | null;
  neg: number | null;
  affName?: string;
  negName?: string;
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
      title={`${label || "Overall"}: ${affName.toLowerCase()} ${aff.toFixed(2)}%, ${negName.toLowerCase()} ${neg.toFixed(2)}%`}
    >
      {points === 0 ? `No ${name}` : `${skew > 0 ? affName : negName} ${name} +${points}`}
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
 * The side bias at the season's championship (Tournament of Champions or NDT),
 * from the synced ballots: the lean over every round and over elims, with the
 * round counts in the tooltip. Absent when no ballots were synced for the season.
 */
function ChampionshipSideBiasCard({ dataset, seasonYear }: { dataset: RankingDataset; seasonYear: number }) {
  const format = SIDE_BIAS_FORMAT_BY_DATASET[dataset.id];
  const bias = format ? championshipSideBias(format, seasonYear) : null;
  if (!format || !bias) return null;
  const affName = SIDE_BIAS_AFF_LABELS[format] === "pro" ? "Pro" : "Aff";
  const negName = affName === "Pro" ? "Con" : "Neg";
  return (
    <div
      className="col-span-2 rounded-lg border bg-card px-3 py-2 sm:col-span-1"
      data-testid="championship-side-bias"
      title={`${SIDE_BIAS_CHAMPIONSHIP_NAMES[format]} ${seasonYear}: ${bias.rounds} decided rounds, ${bias.elimRounds} in elims`}
    >
      <div className="text-xs text-muted-foreground">
        {format === "college" ? "NDT" : "TOC"} {seasonYear} side bias
      </div>
      <BiasLine label="" aff={bias.affWinRate} neg={bias.negWinRate} affName={affName} negName={negName} />
      <BiasLine label="Elims" aff={bias.elimAffWinRate} neg={bias.negElimWinRate} affName={affName} negName={negName} />
    </div>
  );
}

/**
 * The field-wide side bias (overall and elim aff vs. neg lean, as
 * short text lines), the entry count, and the list of tournaments that fed the ratings (majors marked, since
 * they count double).
 *
 * @param props.dataset - The loaded rankings dataset.
 * @param props.seasonYear - The season shown (defaults to the dataset's); looks up that year's championship side bias.
 */
export function RankingsFieldSummary({ dataset, seasonYear }: { dataset: RankingDataset; seasonYear?: number }) {
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
        <ChampionshipSideBiasCard dataset={dataset} seasonYear={seasonYear ?? dataset.seasonYear ?? currentRankingSeasonYear()} />
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
