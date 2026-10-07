/**
 * @fileoverview Summary strip above the rankings table: the field-wide side
 * bias from `output/<prefix>field_statistics.csv` and the tournaments rated.
 * @module components/debate/DebateVideos/panels/RankingsFieldSummary
 */

import type { RankingDataset } from "@debate/rankings-adapter";
import { SPEECH_SIDE_STYLES } from "../../components/watch/speech-side-styles";

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
 * A fixed `NN.NN` percentage with the first two digits bold (and side-tinted,
 * when given a side) and only the trailing hundredths digit shrunk down — the
 * digits that matter for comparing sides stay full-size.
 */
function EmphasizedPercent({
  value,
  side,
}: {
  value: number;
  side?: "aff" | "neg";
}) {
  const text = value.toFixed(2);
  const highlight = text.slice(0, 2);
  const middle = text.slice(2, -1);
  const last = text.slice(-1);
  const highlightColor =
    side === "aff"
      ? "text-blue-600 dark:text-blue-400"
      : side === "neg"
        ? "text-red-600 dark:text-red-400"
        : "";
  return (
    <span className="tabular-nums">
      <span className={`font-bold ${highlightColor}`}>{highlight}</span>
      <span>{middle}</span>
      <span className="text-[0.65em] text-muted-foreground">{last}</span>
      <span className="text-[0.65em] text-muted-foreground">%</span>
    </span>
  );
}

/** "Aff +2.50" / "Neg +1.20" / "Even" — how far a split leans from 50%. */
function SkewLabel({ aff }: { aff: number }) {
  const skew = aff - 50;
  return (
    <span
      className={
        skew === 0
          ? ""
          : skew > 0
            ? "font-medium text-blue-600 dark:text-blue-400"
            : "font-medium text-red-600 dark:text-red-400"
      }
    >
      {skew === 0
        ? "Even"
        : `${skew > 0 ? "Aff" : "Neg"} +${Math.abs(skew).toFixed(2)}`}
    </span>
  );
}

/**
 * One aff/neg split drawn as a diverging bar with the 50% line marked, the
 * aff and neg win rates under it and the lean on the right of its label.
 */
function SideSplitBar({
  label,
  aff,
  neg,
}: {
  label: string;
  aff: number | null;
  neg: number | null;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
        <span>{label}</span>
        {aff !== null && neg !== null && <SkewLabel aff={aff} />}
      </div>
      {aff === null || neg === null ? (
        <div className="relative h-3 rounded-sm bg-muted" aria-hidden />
      ) : (
        <>
          <div
            className="relative flex h-3 overflow-hidden rounded-sm bg-muted"
            role="img"
            aria-label={`${label}: aff ${aff.toFixed(2)} percent, neg ${neg.toFixed(2)} percent.`}
          >
            <span
              className={`${SPEECH_SIDE_STYLES.aff.dot} transition-[width] duration-500`}
              style={{ width: `${aff}%` }}
            />
            <span
              className={`${SPEECH_SIDE_STYLES.neg.dot} flex-1 opacity-80`}
            />
            <span className="absolute inset-y-0 left-1/2 w-px bg-background" />
          </div>
          <div className="mt-1 flex justify-between text-xs text-muted-foreground">
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
  );
}

/**
 * The field-wide side bias as one chart with two bars: the aff/neg split for
 * prelims and the same split for elims, stacked on a shared 50% line so the
 * two round types compare at a glance.
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
    <div className="col-span-2 rounded-lg border bg-card px-3 py-2 sm:col-span-4">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">
        Side bias
      </div>
      <div className="space-y-2">
        <SideSplitBar label="Prelims" aff={aff} neg={neg} />
        <SideSplitBar label="Elims" aff={affElim} neg={negElim} />
      </div>
    </div>
  );
}

/**
 * The field-wide side bias (prelim and elim aff vs. neg win rates, as two
 * split bars on one chart), the entry count, and the list of tournaments that fed the ratings (majors marked, since
 * they count double).
 *
 * @param props.dataset - The loaded rankings dataset.
 */
export function RankingsFieldSummary({ dataset }: { dataset: RankingDataset }) {
  const majors = new Set(dataset.majors);
  const field = dataset.field;
  return (
    <div className="mb-4 space-y-3">
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
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
