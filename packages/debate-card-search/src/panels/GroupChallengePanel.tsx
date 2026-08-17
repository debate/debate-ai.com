/**
 * @fileoverview Group challenges — UI over `lib/group-challenges.ts` reading
 * and writing the persisted challenge configs in `state/groupChallenges.ts`.
 */

"use client";

import { useMemo, useState } from "react";
import { Swords, Trash2 } from "lucide-react";

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

import {
  buildGroupChallengeBoard,
  buildGroupChallengeSummaryText,
  type ChallengeWinEvent,
  type GroupChallenge,
  type GroupChallengeProgress,
} from "../lib/group-challenges";
import type { QuestContribution } from "../lib/daily-quests";
import {
  deleteGroupChallenge,
  listGroupChallenges,
  saveGroupChallenge,
} from "../state/groupChallenges";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Props for {@link GroupChallengePanel}. */
export interface GroupChallengePanelProps {
  /** Challenges to score. Defaults to the persisted challenge store. */
  challenges?: GroupChallenge[];
  /** Contributions counted toward contribution-target challenges. */
  contributions: QuestContribution[];
  /** Round wins counted toward win-target challenges. */
  winEvents?: ChallengeWinEvent[];
  /** "Now" in epoch ms. */
  now?: number;
  /** Hides the create-challenge form. */
  readOnly?: boolean;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Squad-scoped friendly challenges with per-member standings.
 *
 * @param props - See {@link GroupChallengePanelProps}.
 * @returns The group challenge panel.
 */
export function GroupChallengePanel({
  challenges,
  contributions,
  winEvents = [],
  now = Date.now(),
  readOnly = false,
  className,
}: GroupChallengePanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<GroupChallenge[]>(listGroupChallenges, []);
  const source = challenges ?? persisted;
  const editable = challenges === undefined && !readOnly;

  const [title, setTitle] = useState("");
  const [targetCount, setTargetCount] = useState("10");
  const [members, setMembers] = useState("");
  const [days, setDays] = useState("7");
  const [expanded, setExpanded] = useState<string | null>(null);

  const board = useMemo(
    () => buildGroupChallengeBoard(source, contributions, winEvents, now),
    [source, contributions, winEvents, now],
  );

  const active = board.filter((progress) => !progress.hasEnded).length;
  const complete = board.filter((progress) => progress.isComplete).length;

  const createChallenge = () => {
    const parsedTarget = Number.parseInt(targetCount, 10);
    const parsedDays = Number.parseInt(days, 10);
    if (!title.trim() || !Number.isFinite(parsedTarget) || parsedTarget <= 0) return;
    saveGroupChallenge({
      id: `challenge-${Date.now()}`,
      title: title.trim(),
      goal: { kind: "contribution_target", target: {}, targetCount: parsedTarget },
      memberIds: members
        .split(",")
        .map((member) => member.trim())
        .filter(Boolean),
      startsAt: now,
      endsAt: now + (Number.isFinite(parsedDays) ? parsedDays : 7) * DAY_MS,
    });
    setTitle("");
    setMembers("");
    refresh();
  };

  const removeChallenge = (id: string) => {
    deleteGroupChallenge(id);
    refresh();
  };

  return (
    <PanelShell
      title="Group Challenges"
      description="Squad challenges with per-member standings and an MVP."
      icon={<Swords className="h-4 w-4" />}
      className={className}
      data-testid="group-challenge-panel"
    >
      <StatGrid columns={3}>
        <StatTile label="Challenges" value={board.length} />
        <StatTile label="Active" value={active} tone="info" />
        <StatTile label="Complete" value={complete} tone="positive" />
      </StatGrid>

      <PanelSection title="Standings">
        {board.length === 0 ? (
          <EmptyState
            title="No challenges yet"
            message={editable ? "Create one below to get the squad competing." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {board.map((progress) => (
              <ChallengeRow
                key={progress.challengeId}
                progress={progress}
                open={expanded === progress.challengeId}
                onToggle={() =>
                  setExpanded((current) =>
                    current === progress.challengeId ? null : progress.challengeId,
                  )
                }
                onDelete={editable ? () => removeChallenge(progress.challengeId) : undefined}
              />
            ))}
          </div>
        )}
      </PanelSection>

      {editable ? (
        <PanelSection title="New challenge" description="Contribution-target challenge.">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <LabeledField label="Title">
              <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Cards blitz" />
            </LabeledField>
            <LabeledField label="Target contributions">
              <Input
                value={targetCount}
                inputMode="numeric"
                onChange={(e) => setTargetCount(e.target.value)}
              />
            </LabeledField>
            <LabeledField label="Members (comma separated)">
              <Input value={members} onChange={(e) => setMembers(e.target.value)} />
            </LabeledField>
            <LabeledField label="Runs for (days)">
              <Input value={days} inputMode="numeric" onChange={(e) => setDays(e.target.value)} />
            </LabeledField>
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={createChallenge} disabled={!title.trim()}>
              Create challenge
            </Button>
          </div>
        </PanelSection>
      ) : null}
    </PanelShell>
  );
}

function ChallengeRow({
  progress,
  open,
  onToggle,
  onDelete,
}: {
  progress: GroupChallengeProgress;
  open: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  return (
    <PanelRow
      title={
        <button type="button" className="text-left" aria-expanded={open} onClick={onToggle}>
          {open ? "▾" : "▸"} {progress.title}
        </button>
      }
      subtitle={
        progress.hasEnded
          ? "Ended"
          : `${progress.daysRemaining} day${progress.daysRemaining === 1 ? "" : "s"} remaining`
      }
      trailing={
        <>
          {progress.isComplete ? (
            <Pill tone="positive">Complete</Pill>
          ) : progress.hasEnded ? (
            <Pill tone="critical">Missed</Pill>
          ) : (
            <Pill tone="warning">{progress.remainingCount} to go</Pill>
          )}
          {onDelete ? (
            <Button
              variant="ghost"
              size="sm"
              aria-label={`Delete ${progress.title}`}
              onClick={onDelete}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : null}
        </>
      }
    >
      <MeterBar
        value={progress.completedCount}
        max={progress.targetCount}
        tone={progress.isComplete ? "positive" : progress.hasEnded ? "critical" : "info"}
        caption={`${progress.completedCount} / ${progress.targetCount}`}
      />
      {open ? (
        <>
          <ul className="flex flex-col gap-1">
            {progress.memberStandings.map((standing) => (
              <li
                key={standing.contributorId}
                className="flex items-center justify-between gap-2 text-xs"
              >
                <span className="flex items-center gap-1">
                  {standing.contributorId === progress.mvpContributorId ? "⭐" : "•"}
                  {standing.contributorId}
                </span>
                <span className="text-muted-foreground tabular-nums">
                  {standing.matchingCount}
                  {standing.helpfulnessScore !== undefined
                    ? ` · ${standing.helpfulnessScore.toFixed(2)}`
                    : ""}
                </span>
              </li>
            ))}
            {progress.memberStandings.length === 0 ? (
              <li className="text-muted-foreground text-xs">No members recorded.</li>
            ) : null}
          </ul>
          <SummaryText text={buildGroupChallengeSummaryText(progress)} />
        </>
      ) : null}
    </PanelRow>
  );
}
