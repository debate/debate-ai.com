/**
 * @fileoverview CX NDCA standings — UI over `debate-data-sync`'s
 * `ndca-standings.ts`.
 *
 * Ranks teams by qualification points, marks who is currently qualifying
 * under the chosen cutoff, and breaks a team's points down by tournament.
 */

"use client";

import { useMemo, useState } from "react";
import { Trophy } from "lucide-react";

import {
  EmptyState,
  LabeledField,
  MeterBar,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
} from "debate-ui/src/panels/panel-shell";
import { Button } from "debate-ui/src/primitives/button";
import { Input } from "debate-ui/src/primitives/input";
import {
  buildStandings,
  getQualifiedTeams,
  rankStandings,
  type RankedTeamStanding,
  type TournamentResult,
} from "debate-data-sync/src/rankings/ndca-standings";

/** Groups flat tournament results by team, the shape `buildStandings` takes. */
function groupResultsByTeam(results: TournamentResult[]): Record<string, TournamentResult[]> {
  const byTeam: Record<string, TournamentResult[]> = {};
  for (const result of results) {
    (byTeam[result.teamId] ??= []).push(result);
  }
  return byTeam;
}

/** Props for {@link NdcaStandingsPanel}. */
export interface NdcaStandingsPanelProps {
  /** Every tournament result feeding the standings. */
  results: TournamentResult[];
  /** How many best tournaments count toward a team's total. */
  countBestN?: number;
  /** Teams at or above this many points qualify. */
  minPoints?: number;
  /** Hard cap on how many teams qualify. */
  maxQualifiers?: number;
  /** Highlights one team, e.g. the user's own. */
  highlightTeamId?: string;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Qualification-point standings with a qualifier cutoff.
 *
 * @param props - See {@link NdcaStandingsPanelProps}.
 * @returns The standings panel.
 */
export function NdcaStandingsPanel({
  results,
  countBestN,
  minPoints,
  maxQualifiers,
  highlightTeamId,
  className,
}: NdcaStandingsPanelProps) {
  const [bestN, setBestN] = useState(countBestN === undefined ? "" : String(countBestN));
  const [cutoff, setCutoff] = useState(minPoints === undefined ? "" : String(minPoints));
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  const parsedBestN = Number.parseInt(bestN, 10);
  const parsedCutoff = Number.parseFloat(cutoff);

  const ranked = useMemo(() => {
    const standings = buildStandings(groupResultsByTeam(results), {
      ...(Number.isFinite(parsedBestN) ? { countBestN: parsedBestN } : {}),
    });
    return rankStandings(standings);
  }, [results, parsedBestN]);

  const qualified = useMemo(
    () =>
      getQualifiedTeams(ranked, {
        ...(Number.isFinite(parsedCutoff) ? { minPoints: parsedCutoff } : {}),
        ...(maxQualifiers === undefined ? {} : { maxQualifiers }),
      }),
    [ranked, parsedCutoff, maxQualifiers],
  );

  const qualifiedIds = useMemo(
    () => new Set(qualified.map((standing) => standing.teamId)),
    [qualified],
  );
  const topPoints = ranked.length > 0 ? ranked[0].totalPoints : 0;

  return (
    <PanelShell
      title="NDCA Standings"
      description="Qualification points across the season."
      icon={<Trophy className="h-4 w-4" />}
      className={className}
      data-testid="ndca-standings-panel"
    >
      <StatGrid columns={3}>
        <StatTile label="Teams" value={ranked.length} />
        <StatTile label="Qualifying" value={qualified.length} tone="positive" />
        <StatTile label="Top points" value={topPoints.toFixed(1)} tone="info" />
      </StatGrid>

      <PanelSection title="Settings">
        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-3">
          <LabeledField label="Count best N tournaments" hint="Blank counts all.">
            <Input value={bestN} inputMode="numeric" onChange={(e) => setBestN(e.target.value)} />
          </LabeledField>
          <LabeledField label="Qualification cutoff (points)">
            <Input value={cutoff} inputMode="decimal" onChange={(e) => setCutoff(e.target.value)} />
          </LabeledField>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setBestN("");
              setCutoff("");
            }}
          >
            Reset settings
          </Button>
        </div>
      </PanelSection>

      <PanelSection title="Standings">
        {ranked.length === 0 ? (
          <EmptyState title="No results" message="Add tournament results to build standings." />
        ) : (
          <div className="flex flex-col gap-2">
            {ranked.map((standing) => (
              <StandingRow
                key={standing.teamId}
                standing={standing}
                topPoints={topPoints}
                qualified={qualifiedIds.has(standing.teamId)}
                highlighted={standing.teamId === highlightTeamId}
                open={openTeamId === standing.teamId}
                onToggle={() =>
                  setOpenTeamId((current) =>
                    current === standing.teamId ? null : standing.teamId,
                  )
                }
              />
            ))}
          </div>
        )}
      </PanelSection>
    </PanelShell>
  );
}

function StandingRow({
  standing,
  topPoints,
  qualified,
  highlighted,
  open,
  onToggle,
}: {
  standing: RankedTeamStanding;
  topPoints: number;
  qualified: boolean;
  highlighted: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  return (
    <PanelRow
      className={highlighted ? "border-primary" : undefined}
      leading={`#${standing.rank}`}
      title={
        <button type="button" className="text-left" aria-expanded={open} onClick={onToggle}>
          {open ? "▾" : "▸"} {standing.teamId}
        </button>
      }
      subtitle={`${standing.record.wins}-${standing.record.losses} · ${standing.tournamentsCounted} of ${standing.tournamentsAttended} tournaments counted · best ${standing.bestFinish}`}
      trailing={
        <>
          {qualified ? <Pill tone="positive">qualifying</Pill> : null}
          <span className="font-semibold">{standing.totalPoints.toFixed(1)}</span>
        </>
      }
    >
      <MeterBar
        value={standing.totalPoints}
        max={topPoints}
        tone={qualified ? "positive" : "info"}
      />
      {open ? (
        <ul className="flex flex-col gap-1">
          {standing.results.map((result) => (
            <li
              key={`${result.tournamentName}-${result.date}`}
              className="text-muted-foreground flex items-center justify-between gap-2 text-xs"
            >
              <span className="truncate">
                {result.tournamentName} · {result.finish} · {result.prelimWins}-
                {result.prelimLosses}
              </span>
              <span className="tabular-nums">{result.points.toFixed(1)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </PanelRow>
  );
}
