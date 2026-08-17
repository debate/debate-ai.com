/**
 * @fileoverview Pre-round intelligence panel — UI over
 * `round/pre-round-briefing.ts`, persisting the generated briefing per round
 * through `state/preRoundBriefings.ts`.
 */

"use client";

import { useMemo } from "react";
import { Radar } from "lucide-react";

import {
  EmptyState,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
  SummaryText,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import type { JudgeProfile } from "debate-speech-writer/src/judge/judge-profile";
import type {
  OpponentRoundRecord,
  OpponentTeamProfile,
} from "debate-data-sync/src/rankings/opponent-team-profile";

import {
  buildPreRoundBriefing,
  buildPreRoundBriefingText,
  type RoundEventInfo,
} from "../round/pre-round-briefing";
import {
  deletePreRoundBriefing,
  getPreRoundBriefing,
  savePreRoundBriefing,
  type PreRoundBriefingRecord,
} from "../state/preRoundBriefings";

/** Props for {@link PreRoundBriefingPanel}. */
export interface PreRoundBriefingPanelProps {
  /** Tournament / division / round / side context. */
  event: RoundEventInfo;
  /** Round id the briefing is stored under. */
  roundId?: string;
  /** Our own past rounds, used for the head-to-head record. */
  ownRecords?: OpponentRoundRecord[];
  /** Opponent team id used to filter `ownRecords`. */
  opponentTeamId?: string;
  /** Scouting profile for the opponent. */
  opponentProfile?: OpponentTeamProfile;
  /** Tendency profile for the judge. */
  judgeProfile?: JudgeProfile;
  /** Free-form prep notes to fold into the briefing. */
  teamPrepNotes?: string[];
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Pre-round briefing: opponent, judge, head-to-head and prep notes.
 *
 * @param props - See {@link PreRoundBriefingPanelProps}.
 * @returns The briefing panel.
 */
export function PreRoundBriefingPanel({
  event,
  roundId,
  ownRecords,
  opponentTeamId,
  opponentProfile,
  judgeProfile,
  teamPrepNotes,
  className,
}: PreRoundBriefingPanelProps) {
  const { data: saved, refresh } = useStoreSnapshot<PreRoundBriefingRecord | undefined>(
    () => (roundId ? getPreRoundBriefing(roundId) : undefined),
    undefined,
  );

  const briefing = useMemo(
    () =>
      buildPreRoundBriefing({
        event,
        ...(ownRecords ? { ownRecords } : {}),
        ...(opponentTeamId ? { opponentTeamId } : {}),
        ...(opponentProfile ? { opponentProfile } : {}),
        ...(judgeProfile ? { judgeProfile } : {}),
        ...(teamPrepNotes ? { teamPrepNotes } : {}),
      }),
    [event, ownRecords, opponentTeamId, opponentProfile, judgeProfile, teamPrepNotes],
  );

  const { priorMeetings } = briefing;

  return (
    <PanelShell
      title="Pre-Round Briefing"
      description={`${event.tournamentName} · ${event.division} · ${event.roundLabel}`}
      icon={<Radar className="h-4 w-4" />}
      className={className}
      data-testid="pre-round-briefing-panel"
      actions={
        <>
          <Pill tone={event.side === "aff" ? "positive" : "info"}>{event.side}</Pill>
          {roundId ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                savePreRoundBriefing({ roundId, briefing });
                refresh();
              }}
            >
              {saved ? "Update saved" : "Save briefing"}
            </Button>
          ) : null}
        </>
      }
    >
      <StatGrid columns={4}>
        <StatTile label="Prior meetings" value={priorMeetings.meetings} />
        <StatTile label="Wins" value={priorMeetings.wins} tone="positive" />
        <StatTile label="Losses" value={priorMeetings.losses} tone="critical" />
        <StatTile label="Room" value={event.room ?? "—"} />
      </StatGrid>

      <PanelSection title="Briefing">
        {briefing.sections.length === 0 ? (
          <EmptyState
            title="Nothing to brief yet"
            message="Add an opponent profile, a judge profile or prep notes."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {briefing.sections.map((section) => (
              <PanelRow key={section.title} title={section.title} subtitle={section.body} />
            ))}
          </div>
        )}
      </PanelSection>

      <SummaryText label="Plain-text briefing" text={buildPreRoundBriefingText(briefing)} />

      {roundId && saved ? (
        <div className="flex justify-end">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              deletePreRoundBriefing(roundId);
              refresh();
            }}
          >
            Delete saved briefing
          </Button>
        </div>
      ) : null}
    </PanelShell>
  );
}
