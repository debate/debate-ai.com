/**
 * @fileoverview Team collaboration mode — UI over `lib/team-collaboration-mode.ts`
 * with sprint notes read from and written to `state/sprintNotes.ts`.
 *
 * One topic sprint in a single view: the quest board, the routing for the
 * topic's gaps, per-contributor progress and the shared note wall.
 *
 * Also subscribes to the browser's `storage` event via `state/live-update.ts`'s
 * `isTopicSprintLiveUpdateStorageEvent`, so a quest, contribution, tracked
 * argument, coverage-report entry, contributor-availability change, routed/
 * completed task, or sprint note recorded in another tab refreshes this
 * panel's board/routing/progress/notes without a manual reload — closing the
 * "Every other localStorage-backed panel in this repo still has no
 * cross-tab live-update mechanism" Known gap noted in `shared-flow-sync.md`,
 * for this panel.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Users2 } from "lucide-react";

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
  type PanelTone,
} from "debate-research-evidence/src/ui/panels/panel-shell";
import { useStoreSnapshot } from "../ui/panels/use-store-snapshot";
import { Button } from "debate-research-evidence/src/ui/primitives/button";
import { Input } from "debate-research-evidence/src/ui/primitives/input";
import { Textarea } from "debate-research-evidence/src/ui/primitives/textarea";

import {
  buildTopicSprint,
  buildTopicSprintSummaryText,
  createSprintNote,
  assignSprintNote,
  getOpenFollowUps,
  updateSprintNoteStatus,
  type SprintNote,
  type SprintNoteStatus,
} from "../lib/team-collaboration-mode";
import type { QuestContribution, QuestTemplate } from "../lib/daily-quests";
import type { ContributorAvailability } from "debate-research-evidence/src/lib/research-task-routing";
import type { TrackedTopicAssignment } from "../lib/research-progress";
import type { TopicCoverageReport } from "debate-research-evidence/src/lib/topic-coverage";
import { deleteSprintNote, listSprintNotes, saveSprintNote } from "../state/sprintNotes";
import {
  readPersistedTopicSprintInputs,
  type PersistedTopicSprintInputs,
} from "../state/topicSprints";
import { isTopicSprintLiveUpdateStorageEvent } from "debate-research-evidence/src/state/live-update";

/** Everything a topic sprint needs before any persisted store has been read (first render/SSR). */
const EMPTY_SPRINT_INPUTS: PersistedTopicSprintInputs = {
  quests: [],
  contributions: [],
  coverageReport: { tracked: [], untracked: [] },
  contributors: [],
  assignments: [],
  notes: [],
};

const STATUS_TONE: Record<SprintNoteStatus, PanelTone> = {
  open: "info",
  covered: "positive",
  "needs-follow-up": "warning",
};

const STATUSES: SprintNoteStatus[] = ["open", "covered", "needs-follow-up"];

/** Props for {@link TopicSprintPanel}. */
export interface TopicSprintPanelProps {
  /** Topic the sprint is scoped to. */
  topic: string;
  /** Quests offered during the sprint. Defaults to every persisted quest template. */
  quests?: QuestTemplate[];
  /** Contributions counted toward the quests. Defaults to every persisted, timestamped contribution. */
  contributions?: QuestContribution[];
  /** Coverage report for the topic. Defaults to the topic's persisted coverage report. */
  coverageReport?: TopicCoverageReport;
  /** Assignments tracked for the progress board. Defaults to the topic's persisted assignments. */
  assignments?: TrackedTopicAssignment[];
  /** Contributors available for routing. Defaults to persisted profiles. */
  contributors?: ContributorAvailability[];
  /** Notes to show. Defaults to the persisted sprint notes for this topic. */
  notes?: SprintNote[];
  /** Author attributed to notes added here. */
  authorId?: string;
  /** "Now" in epoch ms. */
  now?: number;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * A single topic sprint: quests, routing, progress and notes.
 *
 * @param props - See {@link TopicSprintPanelProps}.
 * @returns The topic sprint panel.
 */
export function TopicSprintPanel({
  topic,
  quests,
  contributions,
  coverageReport,
  assignments,
  contributors,
  notes,
  authorId = "me",
  now = Date.now(),
  className,
}: TopicSprintPanelProps) {
  const { data: persistedNotes, refresh } = useStoreSnapshot<SprintNote[]>(listSprintNotes, []);
  const editable = notes === undefined;

  const [noteText, setNoteText] = useState("");
  const [assignTo, setAssignTo] = useState("");

  // `quests`/`contributions`/`coverageReport`/`assignments`/`contributors` are
  // topic-scoped, so — unlike the mount-only `useStoreSnapshot` reads above —
  // they're re-read whenever `topic` changes, not just once on mount.
  const [persistedInputs, setPersistedInputs] = useState<PersistedTopicSprintInputs>(EMPTY_SPRINT_INPUTS);
  useEffect(() => {
    setPersistedInputs(readPersistedTopicSprintInputs(topic));
  }, [topic]);

  /**
   * Live-update every persisted input when another browser tab adds a quest,
   * submits a contribution, tracks an argument or coverage-report entry,
   * changes contributor availability, routes/completes a task, or logs a
   * sprint note. A `storage` event never fires in the tab that made the
   * write, only in other tabs. Depends on `topic` so a change to it
   * re-registers the listener with a fresh closure rather than re-reading a
   * stale topic's inputs.
   */
  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (!isTopicSprintLiveUpdateStorageEvent(event)) return;
      setPersistedInputs(readPersistedTopicSprintInputs(topic));
      refresh();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [topic, refresh]);

  const sprint = useMemo(
    () =>
      buildTopicSprint({
        topic,
        quests: quests ?? persistedInputs.quests,
        contributions: contributions ?? persistedInputs.contributions,
        now,
        coverageReport: coverageReport ?? persistedInputs.coverageReport,
        contributors: contributors ?? persistedInputs.contributors,
        assignments: assignments ?? persistedInputs.assignments,
        notes: notes ?? persistedNotes,
      }),
    [
      topic,
      quests,
      contributions,
      now,
      coverageReport,
      contributors,
      assignments,
      persistedInputs,
      notes,
      persistedNotes,
    ],
  );

  const followUps = useMemo(() => getOpenFollowUps(sprint.notes), [sprint.notes]);
  const questsComplete = sprint.questBoard.filter((quest) => quest.isComplete).length;

  const addNote = () => {
    if (!noteText.trim()) return;
    saveSprintNote(
      createSprintNote({
        id: `note-${Date.now()}`,
        topic,
        authorId,
        text: noteText.trim(),
        createdAt: now,
        ...(assignTo.trim() ? { assignedToId: assignTo.trim() } : {}),
      }),
    );
    setNoteText("");
    refresh();
  };

  const setStatus = (note: SprintNote, status: SprintNoteStatus) => {
    saveSprintNote(updateSprintNoteStatus(note, status, Date.now()));
    refresh();
  };

  const reassign = (note: SprintNote, assignedToId: string | null) => {
    saveSprintNote(assignSprintNote(note, assignedToId, Date.now()));
    refresh();
  };

  return (
    <PanelShell
      title={`Topic Sprint — ${topic}`}
      description="Quests, routing, progress and shared notes for one topic."
      icon={<Users2 className="h-4 w-4" />}
      className={className}
      data-testid="topic-sprint-panel"
    >
      <StatGrid columns={4}>
        <StatTile
          label="Quests complete"
          value={`${questsComplete}/${sprint.questBoard.length}`}
          tone={
            sprint.questBoard.length > 0 && questsComplete === sprint.questBoard.length
              ? "positive"
              : "info"
          }
        />
        <StatTile label="Assigned" value={sprint.routing.assignments.length} />
        <StatTile
          label="Unassigned"
          value={sprint.routing.unassignedTasks.length}
          tone={sprint.routing.unassignedTasks.length > 0 ? "warning" : "neutral"}
        />
        <StatTile
          label="Open follow-ups"
          value={followUps.length}
          tone={followUps.length > 0 ? "warning" : "positive"}
        />
      </StatGrid>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <PanelSection title="Quest board">
          {sprint.questBoard.length === 0 ? (
            <EmptyState title="No quests in this sprint" />
          ) : (
            <div className="flex flex-col gap-2">
              {sprint.questBoard.map((quest) => (
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

        <PanelSection title="Progress board">
          {sprint.progressBoard.length === 0 ? (
            <EmptyState title="No tracked progress" />
          ) : (
            <div className="flex flex-col gap-2">
              {sprint.progressBoard.map((progress) => (
                <MeterBar
                  key={progress.contributorId}
                  value={progress.totalCompletedTasks}
                  max={progress.totalAssignedTasks}
                  tone={progress.overallCompletionRate === 1 ? "positive" : "info"}
                  label={progress.contributorId}
                  caption={`${progress.totalCompletedTasks} / ${progress.totalAssignedTasks}`}
                />
              ))}
            </div>
          )}
        </PanelSection>
      </div>

      <PanelSection title="Sprint notes">
        {sprint.notes.length === 0 ? (
          <EmptyState title="No notes yet" message={editable ? "Add the first note below." : undefined} />
        ) : (
          <div className="flex flex-col gap-2">
            {sprint.notes.map((note) => (
              <PanelRow
                key={note.id}
                title={note.text}
                subtitle={`${note.authorId}${note.assignedToId ? ` → ${note.assignedToId}` : ""}`}
                trailing={<Pill tone={STATUS_TONE[note.status]}>{note.status}</Pill>}
              >
                {editable ? (
                  <div className="flex flex-wrap items-center gap-1.5">
                    {STATUSES.map((status) => (
                      <Button
                        key={status}
                        variant="ghost"
                        size="sm"
                        disabled={note.status === status}
                        onClick={() => setStatus(note, status)}
                      >
                        {status}
                      </Button>
                    ))}
                    {note.assignedToId ? (
                      <Button variant="ghost" size="sm" onClick={() => reassign(note, null)}>
                        Unassign
                      </Button>
                    ) : null}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        deleteSprintNote(note.id);
                        refresh();
                      }}
                    >
                      Remove
                    </Button>
                  </div>
                ) : null}
              </PanelRow>
            ))}
          </div>
        )}

        {editable ? (
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <LabeledField label="New note">
              <Textarea rows={2} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
            </LabeledField>
            <LabeledField label="Assign to (optional)">
              <Input value={assignTo} onChange={(e) => setAssignTo(e.target.value)} />
            </LabeledField>
            <Button size="sm" onClick={addNote} disabled={!noteText.trim()}>
              Add note
            </Button>
          </div>
        ) : null}
      </PanelSection>

      <SummaryText label="Plain-text summary" text={buildTopicSprintSummaryText(sprint)} />
    </PanelShell>
  );
}
