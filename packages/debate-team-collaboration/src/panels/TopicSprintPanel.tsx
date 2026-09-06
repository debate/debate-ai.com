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
import { motion, type PanInfo } from "motion/react";

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
import { Label } from "debate-research-evidence/src/ui/primitives/label";
import { RadioGroup, RadioGroupItem } from "debate-research-evidence/src/ui/primitives/radio-group";
import { Textarea } from "debate-research-evidence/src/ui/primitives/textarea";

import {
  buildTopicSprint,
  buildTopicSprintSummaryText,
  buildSprintRetrospective,
  buildSprintRetrospectiveText,
  createSprintNote,
  createSprintSession,
  createWhiteboardNote,
  assignSprintNote,
  getOpenFollowUps,
  getPastSprintSessions,
  getSessionsForTopic,
  getUpcomingSprintSessions,
  getWhiteboardNotePosition,
  getWhiteboardNotesForTopic,
  nextWhiteboardNoteColor,
  nextWhiteboardNotePosition,
  sprintRetrospectiveFilename,
  updateSprintNoteStatus,
  WHITEBOARD_NOTE_COLORS,
  type SprintNote,
  type SprintNoteStatus,
  type SprintSession,
  type WhiteboardNote,
  type WhiteboardNoteColor,
} from "../lib/team-collaboration-mode";
import type { QuestContribution, QuestTemplate } from "../lib/daily-quests";
import type { ContributorAvailability } from "debate-research-evidence/src/lib/research-task-routing";
import type { TrackedTopicAssignment } from "../lib/research-progress";
import type { TopicCoverageReport } from "debate-research-evidence/src/lib/topic-coverage";
import { deleteSprintNote, listSprintNotes, saveSprintNote } from "../state/sprintNotes";
import { deleteSprintSession, listSprintSessions, saveSprintSession } from "../state/sprintSessions";
import {
  deleteWhiteboardNote,
  listWhiteboardNotes,
  saveWhiteboardNote,
  updateWhiteboardNotePosition,
} from "../state/sprintWhiteboard";
import {
  readPersistedTopicSprintInputs,
  type PersistedTopicSprintInputs,
} from "../state/topicSprints";
import { getUtcDayKey } from "debate-research-evidence/src/lib/daily-best-card";
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

/** Tailwind classes per `WhiteboardNoteColor`, theme-aware via opacity rather than solid fills. */
const WHITEBOARD_NOTE_COLOR_CLASSES: Record<WhiteboardNoteColor, string> = {
  yellow: "bg-yellow-500/15 border-yellow-500/40",
  pink: "bg-pink-500/15 border-pink-500/40",
  blue: "bg-blue-500/15 border-blue-500/40",
  green: "bg-emerald-500/15 border-emerald-500/40",
  purple: "bg-purple-500/15 border-purple-500/40",
};

/** The rendered height of one whiteboard note card, in pixels — used to size the freeform board around its notes' positions. */
const WHITEBOARD_NOTE_CARD_HEIGHT = 150;
const WHITEBOARD_MIN_BOARD_HEIGHT = 210;

/** Renders a "YYYY-MM-DD" day key as a human-readable UTC calendar date, e.g. "Thu, Sep 10, 2026". */
function formatSprintSessionDay(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
  const { data: persistedSessions, refresh: refreshSessions } = useStoreSnapshot<SprintSession[]>(
    listSprintSessions,
    [],
  );
  const { data: persistedWhiteboardNotes, refresh: refreshWhiteboard } = useStoreSnapshot<WhiteboardNote[]>(
    listWhiteboardNotes,
    [],
  );
  const editable = notes === undefined;

  const [noteText, setNoteText] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [sessionTitle, setSessionTitle] = useState("");
  const [sessionDayKey, setSessionDayKey] = useState("");
  const [showPastSessions, setShowPastSessions] = useState(false);
  const [whiteboardNoteText, setWhiteboardNoteText] = useState("");
  const [whiteboardNoteColor, setWhiteboardNoteColor] = useState<WhiteboardNoteColor>(
    WHITEBOARD_NOTE_COLORS[0],
  );

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
      refreshSessions();
      refreshWhiteboard();
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, [topic, refresh, refreshSessions, refreshWhiteboard]);

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
  const retrospective = useMemo(() => buildSprintRetrospective(sprint), [sprint]);

  /** Mirrors `ResearchProgressPanel.tsx`'s anchor+Blob download pattern. */
  const downloadRetrospective = () => {
    const text = buildSprintRetrospectiveText(retrospective);
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);

    const link = document.createElement("a");
    link.href = url;
    link.download = sprintRetrospectiveFilename(topic);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

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

  const sessionsForTopic = useMemo(
    () => getSessionsForTopic(persistedSessions, topic),
    [persistedSessions, topic],
  );
  const todayKey = useMemo(() => getUtcDayKey(now), [now]);
  const upcomingSessions = useMemo(
    () => getUpcomingSprintSessions(sessionsForTopic, todayKey),
    [sessionsForTopic, todayKey],
  );
  const pastSessions = useMemo(
    () => getPastSprintSessions(sessionsForTopic, todayKey),
    [sessionsForTopic, todayKey],
  );

  const addSession = () => {
    if (!sessionTitle.trim() || !sessionDayKey) return;
    saveSprintSession(
      createSprintSession({
        id: `session-${Date.now()}`,
        topic,
        title: sessionTitle.trim(),
        scheduledDayKey: sessionDayKey,
        createdAt: now,
      }),
    );
    setSessionTitle("");
    setSessionDayKey("");
    refreshSessions();
  };

  const removeSession = (id: string) => {
    deleteSprintSession(id);
    refreshSessions();
  };

  const whiteboardNotesForTopic = useMemo(
    () => getWhiteboardNotesForTopic(persistedWhiteboardNotes, topic),
    [persistedWhiteboardNotes, topic],
  );

  const addWhiteboardNote = () => {
    if (!whiteboardNoteText.trim()) return;
    const position = nextWhiteboardNotePosition(whiteboardNotesForTopic.length);
    saveWhiteboardNote(
      createWhiteboardNote({
        id: `whiteboard-note-${Date.now()}`,
        topic,
        authorId,
        text: whiteboardNoteText.trim(),
        color: whiteboardNoteColor,
        createdAt: now,
        x: position.x,
        y: position.y,
      }),
    );
    setWhiteboardNoteText("");
    setWhiteboardNoteColor(nextWhiteboardNoteColor(whiteboardNotesForTopic.length + 1));
    refreshWhiteboard();
  };

  const removeWhiteboardNote = (id: string) => {
    deleteWhiteboardNote(id);
    refreshWhiteboard();
  };

  /**
   * Persists a note's new position once a drag gesture ends. `info.offset`
   * is the drag's total displacement, so the new position is the note's
   * pre-drag position plus that offset — never `info.point`, which is a page
   * coordinate unrelated to the board's own origin.
   */
  const moveWhiteboardNoteTo = (note: WhiteboardNote, indexInTopic: number, info: PanInfo) => {
    const position = getWhiteboardNotePosition(note, indexInTopic);
    updateWhiteboardNotePosition(note.id, position.x + info.offset.x, position.y + info.offset.y);
    refreshWhiteboard();
  };

  const whiteboardBoardHeight = useMemo(() => {
    const maxY = whiteboardNotesForTopic.reduce((max, note, index) => {
      const position = getWhiteboardNotePosition(note, index);
      return Math.max(max, position.y);
    }, 0);
    return Math.max(WHITEBOARD_MIN_BOARD_HEIGHT, maxY + WHITEBOARD_NOTE_CARD_HEIGHT);
  }, [whiteboardNotesForTopic]);

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

      <PanelSection title="Shared whiteboard">
        {whiteboardNotesForTopic.length === 0 ? (
          <EmptyState
            title="No sticky notes yet"
            message={editable ? "Add the first brainstorming note below." : undefined}
          />
        ) : (
          <div
            className="relative w-full overflow-auto rounded-md border border-dashed border-border/60 bg-muted/20 p-2"
            style={{ height: whiteboardBoardHeight }}
            data-testid="whiteboard-note-board"
          >
            {whiteboardNotesForTopic.map((note, index) => {
              const position = getWhiteboardNotePosition(note, index);
              return (
                <motion.div
                  // Remounting on every position change resets the drag
                  // transform Motion accumulates during a gesture, so the
                  // next drag starts fresh from the persisted left/top
                  // rather than compounding on top of it.
                  key={`${note.id}-${position.x}-${position.y}`}
                  drag={editable}
                  dragMomentum={false}
                  onDragEnd={(_event, info) => moveWhiteboardNoteTo(note, index, info)}
                  style={{ position: "absolute", left: position.x, top: position.y }}
                  className={`flex w-40 flex-col gap-1.5 rounded-md border p-2.5 text-sm shadow-sm ${WHITEBOARD_NOTE_COLOR_CLASSES[note.color]} ${editable ? "cursor-grab active:cursor-grabbing" : ""}`}
                >
                  <p className="whitespace-pre-wrap break-words">{note.text}</p>
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs text-muted-foreground">{note.authorId}</span>
                    {editable ? (
                      <Button variant="ghost" size="sm" onClick={() => removeWhiteboardNote(note.id)}>
                        Remove
                      </Button>
                    ) : null}
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}

        {editable ? (
          <div className="flex flex-col gap-2">
            <LabeledField label="New sticky note">
              <Textarea
                rows={2}
                value={whiteboardNoteText}
                onChange={(e) => setWhiteboardNoteText(e.target.value)}
              />
            </LabeledField>
            <div className="space-y-1.5">
              <Label>Color</Label>
              <RadioGroup
                value={whiteboardNoteColor}
                onValueChange={(value) => setWhiteboardNoteColor(value as WhiteboardNoteColor)}
                className="flex flex-wrap items-center gap-3"
              >
                {WHITEBOARD_NOTE_COLORS.map((color) => (
                  <div key={color} className="flex items-center gap-1.5">
                    <RadioGroupItem value={color} id={`whiteboard-note-color-${color}`} />
                    <Label htmlFor={`whiteboard-note-color-${color}`} className="font-normal capitalize">
                      {color}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <Button size="sm" onClick={addWhiteboardNote} disabled={!whiteboardNoteText.trim()}>
              Add sticky note
            </Button>
          </div>
        ) : null}
      </PanelSection>

      <PanelSection title="Scheduled sessions">
        {upcomingSessions.length === 0 ? (
          <EmptyState title="No upcoming sessions" message="Schedule the next one below." />
        ) : (
          <div className="flex flex-col gap-2">
            {upcomingSessions.map((session) => (
              <PanelRow
                key={session.id}
                title={session.title}
                subtitle={formatSprintSessionDay(session.scheduledDayKey)}
                trailing={
                  session.scheduledDayKey === todayKey ? <Pill tone="info">Today</Pill> : undefined
                }
              >
                <Button variant="ghost" size="sm" onClick={() => removeSession(session.id)}>
                  Cancel
                </Button>
              </PanelRow>
            ))}
          </div>
        )}

        <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[2fr_1fr_auto]">
          <LabeledField label="New session">
            <Input value={sessionTitle} onChange={(e) => setSessionTitle(e.target.value)} />
          </LabeledField>
          <LabeledField label="Date">
            <Input type="date" value={sessionDayKey} onChange={(e) => setSessionDayKey(e.target.value)} />
          </LabeledField>
          <Button size="sm" onClick={addSession} disabled={!sessionTitle.trim() || !sessionDayKey}>
            Schedule
          </Button>
        </div>

        {pastSessions.length > 0 ? (
          <div className="flex flex-col gap-2">
            <Button variant="ghost" size="sm" onClick={() => setShowPastSessions((v) => !v)}>
              {showPastSessions ? "Hide" : "Show"} past sessions ({pastSessions.length})
            </Button>
            {showPastSessions ? (
              <div className="flex flex-col gap-2">
                {pastSessions.map((session) => (
                  <PanelRow
                    key={session.id}
                    title={session.title}
                    subtitle={formatSprintSessionDay(session.scheduledDayKey)}
                  >
                    <Button variant="ghost" size="sm" onClick={() => removeSession(session.id)}>
                      Remove
                    </Button>
                  </PanelRow>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </PanelSection>

      <PanelSection
        title="End-of-sprint retrospective"
        actions={
          <Button size="sm" variant="outline" onClick={downloadRetrospective}>
            Download retrospective
          </Button>
        }
      >
        <StatGrid columns={4}>
          <StatTile
            label="Quests complete"
            value={`${retrospective.questsCompleted}/${retrospective.questsTotal}`}
          />
          <StatTile label="Tasks completed" value={retrospective.tasksCompletedByTeam} />
          <StatTile
            label="Tasks unassigned"
            value={retrospective.tasksUnassigned}
            tone={retrospective.tasksUnassigned > 0 ? "warning" : "neutral"}
          />
          <StatTile
            label="Notes covered"
            value={`${retrospective.notesCovered}/${retrospective.notesTotal}`}
            tone={
              retrospective.notesTotal > 0 && retrospective.notesCovered === retrospective.notesTotal
                ? "positive"
                : "neutral"
            }
          />
        </StatGrid>
        {retrospective.carriedOverFollowUps.length === 0 ? (
          <EmptyState title="Nothing carrying into the next sprint" />
        ) : (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted-foreground">Carrying into the next sprint</p>
            {retrospective.carriedOverFollowUps.map((note) => (
              <PanelRow key={note.id} title={note.text} subtitle={note.authorId} />
            ))}
          </div>
        )}
      </PanelSection>

      <SummaryText label="Plain-text summary" text={buildTopicSprintSummaryText(sprint)} />
    </PanelShell>
  );
}
