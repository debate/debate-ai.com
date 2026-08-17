/**
 * @fileoverview Judge profiles — UI over `debate-speech-writer`'s
 * `judge-profile.ts`, backed by the persisted profiles in
 * `state/judgeProfiles.ts`.
 *
 * Builds tendency profiles from round records, saves them, and shows side
 * bias, speaker points, speed tolerance and theory receptiveness per judge.
 */

"use client";

import { useMemo, useState } from "react";
import { Gavel, Trash2 } from "lucide-react";

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
  type PanelTone,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import {
  buildJudgeProfiles,
  buildJudgeTendencySummary,
  groupRecordsByJudge,
  type JudgeProfile,
  type JudgeRoundRecord,
} from "debate-speech-writer/src/judge/judge-profile";
import {
  deleteJudgeProfile,
  listJudgeProfiles,
  saveJudgeProfile,
} from "debate-speech-writer/src/state/judgeProfiles";

const TOLERANCE_TONE: Record<"low" | "medium" | "high", PanelTone> = {
  low: "critical",
  medium: "warning",
  high: "positive",
};

/** Props for {@link JudgeProfilePanel}. */
export interface JudgeProfilePanelProps {
  /**
   * Round records to derive profiles from. When given, the panel shows the
   * derived profiles and offers to save them; otherwise it shows the
   * persisted ones.
   */
  records?: JudgeRoundRecord[];
  /** Highlights one judge, e.g. the judge for the next round. */
  highlightJudgeId?: string;
  /** Invoked when a judge row is clicked. */
  onSelectJudge?: (profile: JudgeProfile) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Judge tendency profiles with side bias and speaker-point averages.
 *
 * @param props - See {@link JudgeProfilePanelProps}.
 * @returns The judge profile panel.
 */
export function JudgeProfilePanel({
  records,
  highlightJudgeId,
  onSelectJudge,
  className,
}: JudgeProfilePanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<JudgeProfile[]>(listJudgeProfiles, []);
  const [openJudgeId, setOpenJudgeId] = useState<string | null>(null);

  const derived = useMemo(
    () => (records ? buildJudgeProfiles(groupRecordsByJudge(records)) : []),
    [records],
  );
  const profiles = records ? derived : persisted;

  const saveDerived = () => {
    for (const profile of derived) saveJudgeProfile(profile);
    refresh();
  };

  return (
    <PanelShell
      title="Judge Profiles"
      description="Tendencies derived from a judge's past rounds."
      icon={<Gavel className="h-4 w-4" />}
      className={className}
      data-testid="judge-profile-panel"
      actions={
        records && derived.length > 0 ? (
          <Button variant="outline" size="sm" onClick={saveDerived}>
            Save {derived.length} profile{derived.length === 1 ? "" : "s"}
          </Button>
        ) : null
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Judges" value={profiles.length} />
        <StatTile
          label="Rounds recorded"
          value={profiles.reduce((sum, profile) => sum + profile.roundsJudged, 0)}
        />
        <StatTile
          label="With side bias"
          value={profiles.filter((profile) => profile.sideBias.hasNotableSideBias).length}
          tone="warning"
        />
      </StatGrid>

      <PanelSection title="Judges">
        {profiles.length === 0 ? (
          <EmptyState
            title="No judge profiles"
            message="Add round records for a judge to build their profile."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {profiles.map((profile) => {
              const open = openJudgeId === profile.judgeId;
              return (
                <PanelRow
                  key={profile.judgeId}
                  className={profile.judgeId === highlightJudgeId ? "border-primary" : undefined}
                  title={
                    <button
                      type="button"
                      className="text-left"
                      aria-expanded={open}
                      onClick={() => {
                        setOpenJudgeId(open ? null : profile.judgeId);
                        onSelectJudge?.(profile);
                      }}
                    >
                      {open ? "▾" : "▸"} {profile.judgeId}
                    </button>
                  }
                  subtitle={`${profile.roundsJudged} rounds · ${profile.tournamentsJudged} tournaments${
                    profile.mostCommonParadigm ? ` · ${profile.mostCommonParadigm}` : ""
                  }`}
                  trailing={
                    <>
                      {profile.sideBias.hasNotableSideBias ? (
                        <Pill tone="warning">side bias</Pill>
                      ) : null}
                      {profile.speedTolerance ? (
                        <Pill tone={TOLERANCE_TONE[profile.speedTolerance]}>
                          {profile.speedTolerance} speed
                        </Pill>
                      ) : null}
                      {!records ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete ${profile.judgeId}`}
                          onClick={() => {
                            deleteJudgeProfile(profile.judgeId);
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
                    value={profile.sideBias.affWins}
                    max={Math.max(1, profile.sideBias.affWins + profile.sideBias.negWins)}
                    tone={profile.sideBias.hasNotableSideBias ? "warning" : "info"}
                    label="Aff wins"
                    caption={`${profile.sideBias.affWins} aff / ${profile.sideBias.negWins} neg`}
                  />
                  {open ? (
                    <>
                      <StatGrid columns={4}>
                        <StatTile
                          label="Speaks (aff)"
                          value={profile.avgSpeakerPoints.aff.toFixed(1)}
                        />
                        <StatTile
                          label="Speaks (neg)"
                          value={profile.avgSpeakerPoints.neg.toFixed(1)}
                        />
                        <StatTile
                          label="Pace"
                          value={profile.avgPaceWpm ? `${Math.round(profile.avgPaceWpm)} wpm` : "—"}
                        />
                        <StatTile
                          label="Theory"
                          value={profile.theoryReceptiveness ?? "—"}
                          tone={
                            profile.theoryReceptiveness
                              ? TOLERANCE_TONE[profile.theoryReceptiveness]
                              : "neutral"
                          }
                          hint={
                            profile.theoryWinRate !== null
                              ? `${Math.round(profile.theoryWinRate * 100)}% win rate`
                              : undefined
                          }
                        />
                      </StatGrid>
                      <SummaryText text={buildJudgeTendencySummary(profile)} />
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
