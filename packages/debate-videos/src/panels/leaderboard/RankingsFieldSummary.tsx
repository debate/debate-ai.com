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

/** The triangle that caps a bias bar, pointing the way the offset leans. */
function BiasMarker({ side, value }: { side: "aff" | "neg"; value: number }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute top-1/2 -translate-x-1/2 -translate-y-1/2 text-[10px] leading-none ${
        side === "aff"
          ? "text-blue-600 dark:text-blue-400"
          : "text-red-600 dark:text-red-400"
      }`}
      style={{ left: `${value}%` }}
    >
      {side === "aff" ? "▲" : "▼"}
    </span>
  );
}

/**
 * One elim win rate drawn as a bar that starts at the 50% parity line and runs
 * to the value, so the bar's length *is* the offset bias, with a triangle
 * marker on the endpoint pointing the way the bias leans.
 */
function BiasBar({ side, value }: { side: "aff" | "neg"; value: number }) {
  const start = Math.min(50, value);
  const width = Math.abs(value - 50);
  return (
    <div className="relative h-3.5 rounded-sm bg-muted">
      <span
        className={`absolute inset-y-0 rounded-sm ${SPEECH_SIDE_STYLES[side].dot} transition-all duration-500`}
        style={{ left: `${start}%`, width: `${width}%` }}
      />
      <span className="absolute inset-y-0 left-1/2 w-px bg-background" />
      <BiasMarker side={side} value={value} />
    </div>
  );
}

/**
 * The two elim win rates overlaid on one chart: both bars share a single track
 * that is anchored at the 50% parity line, so the pair reads as one mirrored
 * bias rather than two independent percentages.
 */
function ElimSideBiasCard({
  aff,
  neg,
}: {
  aff: number | null;
  neg: number | null;
}) {
  const skew = aff !== null && neg !== null ? aff - 50 : null;
  return (
    <div className="col-span-2 rounded-lg border bg-card px-3 py-2">
      <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
        <span>Elim side bias</span>
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
            {skew === 0
              ? "Even"
              : `${skew > 0 ? "Aff" : "Neg"} +${Math.abs(skew).toFixed(2)}`}
          </span>
        )}
      </div>
      {aff === null || neg === null ? (
        <div className="text-lg font-semibold text-muted-foreground">—</div>
      ) : (
        <>
          <div
            className="space-y-1"
            role="img"
            aria-label={`Aff elim win rate ${aff.toFixed(2)} percent, neg elim win rate ${neg.toFixed(2)} percent, bars measured from the 50 percent parity line.`}
          >
            <BiasBar side="aff" value={aff} />
            <BiasBar side="neg" value={neg} />
          </div>
          <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
            <span>
              Aff elim <EmphasizedPercent value={aff} side="aff" />
            </span>
            <span>
              Neg elim <EmphasizedPercent value={neg} side="neg" />
            </span>
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The field-wide aff/neg split for regular rounds, as one diverging bar with
 * the 50% line marked — how far the whole field's results lean to a side.
 */
function SideBiasCard({
  aff,
  neg,
}: {
  aff: number | null;
  neg: number | null;
}) {
  const skew = aff !== null && neg !== null ? aff - 50 : null;
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
            {skew === 0
              ? "Even"
              : `${skew > 0 ? "Aff" : "Neg"} +${Math.abs(skew).toFixed(1)}`}
          </span>
        )}
      </div>
      {aff === null || neg === null ? (
        <div className="text-lg font-semibold text-muted-foreground">—</div>
      ) : (
        <>
          <div
            className="relative flex h-3 overflow-hidden rounded-sm bg-muted"
            aria-hidden
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
  );
}

/**
 * The field-wide side bias (aff vs. neg win rate, as one split bar) plus the
 * elimination-round win rates overlaid on one parity-anchored chart, the entry
 * count, and the list of tournaments that fed the ratings (majors marked, since
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
        />
        <div className="col-span-2 rounded-lg border bg-card px-3 py-2 sm:col-span-1">
          <div className="text-xs text-muted-foreground">Ranked entries</div>
          <div className="text-lg font-semibold tabular-nums">
            {dataset.entries.length}
          </div>
        </div>
        <ElimSideBiasCard
          aff={field?.affElimWinRate ?? null}
          neg={field?.negElimWinRate ?? null}
        />
      </div>
      {dataset.tournaments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Glicko-2 ratings from {dataset.tournaments.length} tournament
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
