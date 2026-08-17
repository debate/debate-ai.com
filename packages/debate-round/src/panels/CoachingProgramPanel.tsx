/**
 * @fileoverview Coaching program space — UI over `round/coaching-program.ts`,
 * with the program config persisted through `state/coachingPrograms.ts`.
 *
 * One coach-facing view over a squad: the topic sprint, the challenge board
 * and the per-member drill set generated from each member's own flow.
 */

"use client";

import { useMemo, useState } from "react";
import { School, Trash2 } from "lucide-react";

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
  SummaryText,
} from "debate-ui/src/panels/panel-shell";
import { useStoreSnapshot } from "debate-ui/src/panels/use-store-snapshot";
import { Button } from "debate-ui/src/primitives/button";
import { Input } from "debate-ui/src/primitives/input";
import type { ChallengeWinEvent, GroupChallenge } from "debate-card-search/src/lib/group-challenges";

import {
  buildCoachingProgramBoard,
  buildCoachingProgramSummaryText,
  buildMemberDrillSummaryText,
  type BuildCoachingProgramBoardInput,
  type CoachingProgramConfig,
  type CoachingProgramMemberFlow,
} from "../round/coaching-program";
import {
  deleteCoachingProgram,
  listCoachingPrograms,
  saveCoachingProgram,
} from "../state/coachingPrograms";

/** Props for {@link CoachingProgramPanel}. */
export interface CoachingProgramPanelProps {
  /**
   * Program to show. Defaults to the first persisted program, and the panel
   * offers to create one when there are none.
   */
  program?: CoachingProgramConfig;
  /** Topic sprint inputs for the program's current topic. */
  topicSprint: BuildCoachingProgramBoardInput["topicSprint"];
  /** Challenges running for the squad. */
  challenges: GroupChallenge[];
  /** Round wins counted toward win-target challenges. */
  winEvents?: ChallengeWinEvent[];
  /** Each member's most recent flow, used to generate their drills. */
  memberFlows: CoachingProgramMemberFlow[];
  /** Drill generation options. */
  drillOptions?: { collapseLimit?: number };
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Coach-facing squad view: sprint, challenges and per-member drills.
 *
 * @param props - See {@link CoachingProgramPanelProps}.
 * @returns The coaching program panel.
 */
export function CoachingProgramPanel({
  program,
  topicSprint,
  challenges,
  winEvents = [],
  memberFlows,
  drillOptions,
  className,
}: CoachingProgramPanelProps) {
  const { data: programs, refresh } = useStoreSnapshot<CoachingProgramConfig[]>(
    listCoachingPrograms,
    [],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [members, setMembers] = useState("");

  const activeProgram =
    program ?? programs.find((entry) => entry.id === selectedId) ?? programs[0] ?? null;

  const board = useMemo(
    () =>
      activeProgram
        ? buildCoachingProgramBoard({
            program: activeProgram,
            topicSprint,
            challenges,
            contributions: topicSprint.contributions,
            winEvents,
            memberFlows,
            ...(drillOptions ? { drillOptions } : {}),
          })
        : null,
    [activeProgram, topicSprint, challenges, winEvents, memberFlows, drillOptions],
  );

  const createProgram = () => {
    if (!name.trim()) return;
    const created: CoachingProgramConfig = {
      id: `program-${Date.now()}`,
      name: name.trim(),
      memberIds: members
        .split(",")
        .map((member) => member.trim())
        .filter(Boolean),
    };
    saveCoachingProgram(created);
    setSelectedId(created.id);
    setName("");
    setMembers("");
    refresh();
  };

  return (
    <PanelShell
      title="Coaching Program"
      description="Squad sprint, challenges and per-member drills in one place."
      icon={<School className="h-4 w-4" />}
      className={className}
      data-testid="coaching-program-panel"
      actions={
        program
          ? null
          : programs.map((entry) => (
              <button key={entry.id} type="button" onClick={() => setSelectedId(entry.id)}>
                <Pill tone={activeProgram?.id === entry.id ? "info" : "neutral"}>{entry.name}</Pill>
              </button>
            ))
      }
    >
      {board && activeProgram ? (
        <>
          <StatGrid columns={4}>
            <StatTile label="Members" value={activeProgram.memberIds.length} />
            <StatTile
              label="Quests complete"
              value={`${board.topicSprint.questBoard.filter((quest) => quest.isComplete).length}/${board.topicSprint.questBoard.length}`}
              tone="info"
            />
            <StatTile
              label="Challenges"
              value={board.challengeBoard.length}
              hint={`${board.challengeBoard.filter((entry) => entry.isComplete).length} complete`}
            />
            <StatTile
              label="Members with drills"
              value={Object.keys(board.memberDrills).length}
              tone="positive"
            />
          </StatGrid>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <PanelSection title={`Topic sprint — ${board.topicSprint.topic}`}>
              {board.topicSprint.questBoard.length === 0 ? (
                <EmptyState title="No quests in this sprint" />
              ) : (
                <div className="flex flex-col gap-2">
                  {board.topicSprint.questBoard.map((quest) => (
                    <MeterBar
                      key={quest.questId}
                      value={quest.completedCount}
                      max={quest.targetCount}
                      tone={quest.isComplete ? "positive" : "info"}
                      label={quest.description}
                      caption={`${quest.completedCount} / ${quest.targetCount}`}
                    />
                  ))}
                </div>
              )}
            </PanelSection>

            <PanelSection title="Challenge board">
              {board.challengeBoard.length === 0 ? (
                <EmptyState title="No challenges running" />
              ) : (
                <div className="flex flex-col gap-2">
                  {board.challengeBoard.map((entry) => (
                    <MeterBar
                      key={entry.challengeId}
                      value={entry.completedCount}
                      max={entry.targetCount}
                      tone={entry.isComplete ? "positive" : entry.hasEnded ? "critical" : "warning"}
                      label={entry.title}
                      caption={
                        entry.mvpContributorId
                          ? `MVP ${entry.mvpContributorId}`
                          : `${entry.remainingCount} to go`
                      }
                    />
                  ))}
                </div>
              )}
            </PanelSection>
          </div>

          <PanelSection title="Member drills">
            {activeProgram.memberIds.length === 0 ? (
              <EmptyState title="No members" message="Add members to the program." />
            ) : (
              <div className="flex flex-col gap-2">
                {activeProgram.memberIds.map((memberId) => {
                  const drills = board.memberDrills[memberId] ?? [];
                  const open = openMemberId === memberId;
                  return (
                    <PanelRow
                      key={memberId}
                      title={
                        <button
                          type="button"
                          className="text-left"
                          aria-expanded={open}
                          onClick={() => setOpenMemberId(open ? null : memberId)}
                        >
                          {open ? "▾" : "▸"} {memberId}
                        </button>
                      }
                      subtitle={`${drills.length} drill${drills.length === 1 ? "" : "s"}`}
                      trailing={
                        drills.length === 0 ? (
                          <Pill tone="warning">no flow</Pill>
                        ) : (
                          <Pill tone="positive">{drills.length}</Pill>
                        )
                      }
                    >
                      {open ? (
                        drills.length === 0 ? (
                          <p className="text-muted-foreground text-xs">
                            No flow recorded for this member yet.
                          </p>
                        ) : (
                          <SummaryText text={buildMemberDrillSummaryText(board, memberId)} />
                        )
                      ) : null}
                    </PanelRow>
                  );
                })}
              </div>
            )}
          </PanelSection>

          <SummaryText label="Plain-text summary" text={buildCoachingProgramSummaryText(board)} />

          {!program ? (
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  deleteCoachingProgram(activeProgram.id);
                  setSelectedId(null);
                  refresh();
                }}
              >
                <Trash2 className="mr-1 h-3.5 w-3.5" />
                Delete program
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <EmptyState title="No coaching program" message="Create one below to get started." />
      )}

      {program ? null : (
        <PanelSection title="New program">
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[1fr_2fr_auto]">
            <LabeledField label="Program name">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
            </LabeledField>
            <LabeledField label="Members (comma separated)">
              <Input value={members} onChange={(e) => setMembers(e.target.value)} />
            </LabeledField>
            <Button size="sm" onClick={createProgram} disabled={!name.trim()}>
              Create
            </Button>
          </div>
        </PanelSection>
      )}
    </PanelShell>
  );
}
