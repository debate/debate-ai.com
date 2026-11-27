/**
 * @fileoverview The Topics & Statistics page's closing section: the aff (PF:
 * pro) win rate at each format's championship — the Tournament of Champions
 * for PF, LD and HS Policy, the NDT for college policy — over the last ten
 * seasons, as two small charts (all rounds, elims only) and a table of each
 * format's average. A format with no synced ballots for a season has no
 * point; with none at all the table says so.
 * @module components/topic-explorer/SideBiasChart
 */

"use client";

import { CartesianGrid, Line, LineChart, ReferenceLine, XAxis, YAxis } from "recharts";
import {
  SIDE_BIAS_AFF_LABELS,
  SIDE_BIAS_CHAMPIONSHIP_NAMES,
  SIDE_BIAS_YEARS,
  hasSideBiasData,
  type SideBiasFormat,
  type SideBiasSeries,
} from "@debate-ai/rankings/src/side-bias";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../ui/primitives/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "../../ui/charts/chart";
import type { ChartConfig } from "../../ui/charts/chart";

const FORMAT_COLORS: Record<SideBiasFormat, string> = {
  pf: "#2563eb",
  ld: "#16a34a",
  policy: "#ea580c",
  college: "#9333ea",
};

/** `52.3` → `"52.3%"`; `null` → an em dash. */
const pct = (value: number | null) => (value === null ? "—" : `${value.toFixed(1)}%`);

type ChartRow = { year: number } & Partial<Record<SideBiasFormat, number>>;

/** One row per season, one column per format, for the all-rounds or elims aff win rate. */
function chartRows(series: readonly SideBiasSeries[], key: "affWinRate" | "elimAffWinRate"): ChartRow[] {
  const rows = new Map<number, ChartRow>();
  for (const s of series) {
    for (const point of s.points) {
      const value = point[key];
      if (value === null) continue;
      const row = rows.get(point.year) ?? { year: point.year };
      row[s.format] = value;
      rows.set(point.year, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.year - b.year);
}

function RateChart({
  title,
  series,
  dataKey,
  config,
}: {
  title: string;
  series: readonly SideBiasSeries[];
  dataKey: "affWinRate" | "elimAffWinRate";
  config: ChartConfig;
}) {
  const data = chartRows(series, dataKey);
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium">{title}</h3>
      {data.length === 0 ? (
        <p className="text-xs text-muted-foreground">No rounds synced.</p>
      ) : (
        <ChartContainer config={config} className="h-[200px] w-full">
          <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="year" tick={{ fontSize: 9 }} />
            <YAxis domain={[20, 80]} tickFormatter={(v: number) => `${v}%`} tick={{ fontSize: 9 }} width={40} />
            <ReferenceLine y={50} strokeDasharray="4 4" />
            <ChartTooltip content={<ChartTooltipContent />} />
            {series.map((s) => (
              <Line
                key={s.format}
                type="monotone"
                dataKey={s.format}
                stroke={`var(--color-${s.format})`}
                strokeWidth={2}
                dot={{ r: 3 }}
                connectNulls
              />
            ))}
          </LineChart>
        </ChartContainer>
      )}
    </div>
  );
}

/**
 * @param props.series - Each format's synced championship seasons, from `sideBiasSeries`.
 */
export function SideBiasChart({ series }: { series: readonly SideBiasSeries[] }) {
  const config: ChartConfig = Object.fromEntries(
    series.map((s) => [s.format, { label: s.label, color: FORMAT_COLORS[s.format] }]),
  );
  const hasData = hasSideBiasData(series);

  return (
    <section id="side-bias" data-testid="side-bias-section">
      <h2 className="mb-1 text-lg font-semibold">Side Bias at the Championships</h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Aff (PF: pro) win rate at the Tournament of Champions (PF, LD, HS Policy) and the National Debate Tournament
        (college policy) over the last {SIDE_BIAS_YEARS} seasons, from the published ballots. 50% is no bias.
      </p>
      {hasData && (
        <div className="mb-4 grid gap-6 md:grid-cols-2">
          <RateChart title="All rounds" series={series} dataKey="affWinRate" config={config} />
          <RateChart title="Elimination rounds" series={series} dataKey="elimAffWinRate" config={config} />
        </div>
      )}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Format</TableHead>
            <TableHead>Championship</TableHead>
            <TableHead className="text-right">Seasons</TableHead>
            <TableHead className="text-right">Side bias avg</TableHead>
            <TableHead className="text-right">Elim side bias avg</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {series.map((s) => (
            <TableRow key={s.format}>
              <TableCell>
                <span className="mr-2 inline-block h-2 w-2 rounded-full" style={{ background: FORMAT_COLORS[s.format] }} />
                {s.label}
              </TableCell>
              <TableCell>{SIDE_BIAS_CHAMPIONSHIP_NAMES[s.format]}</TableCell>
              <TableCell className="text-right tabular-nums">
                {s.points.length > 0 ? `${s.points[0].year}–${s.points[s.points.length - 1].year} (${s.points.length})` : "—"}
              </TableCell>
              <TableCell className="text-right tabular-nums" title={`${SIDE_BIAS_AFF_LABELS[s.format]} win rate, all rounds`}>
                {pct(s.average?.affWinRate ?? null)}
              </TableCell>
              <TableCell className="text-right tabular-nums" title={`${SIDE_BIAS_AFF_LABELS[s.format]} win rate, elims`}>
                {pct(s.average?.elimAffWinRate ?? null)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      {!hasData && (
        <p className="mt-2 text-xs text-muted-foreground">
          No championship ballots have been synced yet, so there is nothing to chart.
        </p>
      )}
    </section>
  );
}
