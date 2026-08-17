/**
 * @fileoverview Opponent team profiles — UI over `debate-data-sync`'s
 * `opponent-team-profile.ts`, backed by the persisted profiles in
 * `state/opponentTeamProfiles.ts`.
 */

"use client";

import { useMemo, useState } from "react";
import { Binoculars, Trash2 } from "lucide-react";

import {
  EmptyState,
  MeterBar,
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
import {
  buildOpponentScoutingSummary,
  buildOpponentTeamProfiles,
  getHeadToHeadRecords,
  groupRecordsByTeam,
  type OpponentRoundRecord,
  type OpponentTeamProfile,
} from "debate-data-sync/src/rankings/opponent-team-profile";
import {
  deleteOpponentTeamProfile,
  listOpponentTeamProfiles,
  saveOpponentTeamProfile,
} from "debate-data-sync/src/state/opponentTeamProfiles";

/** Props for {@link OpponentScoutingPanel}. */
export interface OpponentScoutingPanelProps {
  /**
   * Round records to derive profiles from. When given, the panel shows the
   * derived profiles and offers to save them; otherwise it shows the
   * persisted ones.
   */
  records?: OpponentRoundRecord[];
  /** Our own rounds, used for the head-to-head count against each team. */
  ownRecords?: OpponentRoundRecord[];
  /** Highlights one team, e.g. the next round's opponent. */
  highlightTeamId?: string;
  /** Invoked when a team row is clicked. */
  onSelectTeam?: (profile: OpponentTeamProfile) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Scouting profiles for opponent teams.
 *
 * @param props - See {@link OpponentScoutingPanelProps}.
 * @returns The opponent scouting panel.
 */
export function OpponentScoutingPanel({
  records,
  ownRecords = [],
  highlightTeamId,
  onSelectTeam,
  className,
}: OpponentScoutingPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<OpponentTeamProfile[]>(
    listOpponentTeamProfiles,
    [],
  );
  const [openTeamId, setOpenTeamId] = useState<string | null>(null);

  const derived = useMemo(
    () => (records ? buildOpponentTeamProfiles(groupRecordsByTeam(records)) : []),
    [records],
  );
  const profiles = records ? derived : persisted;

  const saveDerived = () => {
    for (const profile of derived) saveOpponentTeamProfile(profile);
    refresh();
  };

  return (
    <PanelShell
      title="Opponent Scouting"
      description="What each team reads and how often it wins."
      icon={<Binoculars className="h-4 w-4" />}
      className={className}
      data-testid="opponent-scouting-panel"
      actions={
        records && derived.length > 0 ? (
          <Button variant="outline" size="sm" onClick={saveDerived}>
            Save {derived.length} profile{derived.length === 1 ? "" : "s"}
          </Button>
        ) : null
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Teams" value={profiles.length} />
        <StatTile
          label="Rounds recorded"
          value={profiles.reduce((sum, profile) => sum + profile.roundsRecorded, 0)}
        />
        <StatTile
          label="With side preference"
          value={profiles.filter((profile) => profile.sideRecord.hasNotableSidePreference).length}
          tone="warning"
        />
      </StatGrid>

      <PanelSection title="Teams">
        {profiles.length === 0 ? (
          <EmptyState
            title="No scouting profiles"
            message="Add round records for a team to build its profile."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {profiles.map((profile) => {
              const open = openTeamId === profile.teamId;
              const headToHead = getHeadToHeadRecords(ownRecords, profile.teamId);
              return (
                <PanelRow
                  key={profile.teamId}
                  className={profile.teamId === highlightTeamId ? "border-primary" : undefined}
                  title={
                    <button
                      type="button"
                      className="text-left"
                      aria-expanded={open}
                      onClick={() => {
                        setOpenTeamId(open ? null : profile.teamId);
                        onSelectTeam?.(profile);
                      }}
                    >
                      {open ? "▾" : "▸"} {profile.teamId}
                    </button>
                  }
                  subtitle={`${profile.record.wins}-${profile.record.losses} · ${profile.tournamentsAttended} tournaments${
                    headToHead.length > 0 ? ` · ${headToHead.length} vs us` : ""
                  }`}
                  trailing={
                    <>
                      {profile.sideRecord.strongerSide ? (
                        <Pill tone="info">stronger {profile.sideRecord.strongerSide}</Pill>
                      ) : null}
                      <span className="font-semibold">
                        {Math.round(profile.record.winRate * 100)}%
                      </span>
                      {!records ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${profile.teamId}`}
                          onClick={() => {
                            deleteOpponentTeamProfile(profile.teamId);
                            refresh();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </>
                  }
                >
                  <MeterBar
                    value={profile.record.wins}
                    max={Math.max(1, profile.roundsRecorded)}
                    tone={profile.record.winRate >= 0.5 ? "positive" : "warning"}
                    caption={`${profile.record.wins} of ${profile.roundsRecorded} rounds won`}
                  />
                  <div className="flex flex-wrap gap-1">
                    {profile.topArgumentTags.map((tag) => (
                      <Pill key={tag.value}>
                        {tag.value} · {tag.count}
                      </Pill>
                    ))}
                  </div>
                  {open ? (
                    <>
                      <div className="flex flex-wrap gap-1">
                        {profile.topCases.map((entry) => (
                          <Pill key={entry.value} tone="info">
                            {entry.value} · {entry.count}
                          </Pill>
                        ))}
                      </div>
                      <SummaryText text={buildOpponentScoutingSummary(profile)} />
                    </>
                  ) : null}
                </PanelRow>
              );
            })}
          </div>
        )}
      </PanelSection>
    </PanelShell>
  );
}
