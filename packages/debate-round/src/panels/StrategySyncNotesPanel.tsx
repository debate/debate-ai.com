/**
 * @fileoverview Strategy sync notes — UI over `flow/strategy-sync-notes.ts`
 * backed by the persisted notes in `state/prepNotes.ts`.
 *
 * Box-addressed prep notes with status, assignment and an open-follow-ups view
 * so a partner can see what still needs covering.
 */

"use client";

import { useMemo, useState } from "react";
import { StickyNote, Trash2 } from "lucide-react";

import {
  EmptyState,
  LabeledField,
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
import { Input } from "debate-ui/src/primitives/input";
import { Textarea } from "debate-ui/src/primitives/textarea";
import type { Flow } from "debate-core/src/types/flow";

import {
  assignNote,
  buildPrepNoteSummaryText,
  createPrepNote,
  getOpenFollowUps,
  resolvePrepNoteBox,
  sortNotesByCreatedAt,
  updateNoteStatus,
  type PrepNote,
  type PrepNoteStatus,
} from "../flow/strategy-sync-notes";
import { deletePrepNote, listPrepNotesForFlow, savePrepNote } from "../state/prepNotes";

const STATUS_TONE: Record<PrepNoteStatus, PanelTone> = {
  open: "info",
  covered: "positive",
  "needs-follow-up": "warning",
};

const STATUSES: PrepNoteStatus[] = ["open", "covered", "needs-follow-up"];

/** Props for {@link StrategySyncNotesPanel}. */
export interface StrategySyncNotesPanelProps {
  /** The flow notes are addressed against. */
  flow: Pick<Flow, "id" | "children">;
  /** Notes to show. Defaults to the persisted notes for the flow. */
  notes?: PrepNote[];
  /** Author attributed to notes added here. */
  authorId?: string;
  /** Box path a new note attaches to. */
  activeBoxPath?: number[];
  /** Invoked when a note row is clicked, e.g. to focus its box in the grid. */
  onSelectNote?: (note: PrepNote) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Box-addressed prep notes with status and assignment.
 *
 * @param props - See {@link StrategySyncNotesPanelProps}.
 * @returns The strategy sync notes panel.
 */
export function StrategySyncNotesPanel({
  flow,
  notes,
  authorId = "me",
  activeBoxPath = [0],
  onSelectNote,
  className,
}: StrategySyncNotesPanelProps) {
  const { data: persisted, refresh } = useStoreSnapshot<PrepNote[]>(
    () => listPrepNotesForFlow(flow.id),
    [],
  );
  const source = notes ?? persisted;
  const editable = notes === undefined;

  const [text, setText] = useState("");
  const [assignTo, setAssignTo] = useState("");
  const [followUpsOnly, setFollowUpsOnly] = useState(false);

  const sorted = useMemo(() => sortNotesByCreatedAt(source), [source]);
  const followUps = useMemo(() => getOpenFollowUps(source), [source]);
  const visible = followUpsOnly ? followUps : sorted;

  const addNote = () => {
    if (!text.trim()) return;
    savePrepNote(
      createPrepNote({
        id: `prep-note-${Date.now()}`,
        flowId: flow.id,
        boxPath: activeBoxPath,
        authorId,
        text: text.trim(),
        createdAt: Date.now(),
        ...(assignTo.trim() ? { assignedToId: assignTo.trim() } : {}),
      }),
    );
    setText("");
    refresh();
  };

  const setStatus = (note: PrepNote, status: PrepNoteStatus) => {
    savePrepNote(updateNoteStatus(note, status, Date.now()));
    refresh();
  };

  return (
    <PanelShell
      title="Strategy Sync Notes"
      description="Prep notes pinned to the boxes they are about."
      icon={<StickyNote className="h-4 w-4" />}
      className={className}
      data-testid="strategy-sync-notes-panel"
      actions={
        <Button variant="outline" size="sm" onClick={() => setFollowUpsOnly((v) => !v)}>
          {followUpsOnly ? "Show all" : "Follow-ups only"}
        </Button>
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Notes" value={source.length} />
        <StatTile
          label="Covered"
          value={source.filter((note) => note.status === "covered").length}
          tone="positive"
        />
        <StatTile
          label="Open follow-ups"
          value={followUps.length}
          tone={followUps.length > 0 ? "warning" : "positive"}
        />
      </StatGrid>

      <PanelSection title={followUpsOnly ? "Open follow-ups" : "Notes"}>
        {visible.length === 0 ? (
          <EmptyState
            title={followUpsOnly ? "No open follow-ups" : "No notes yet"}
            message={editable && !followUpsOnly ? "Add the first note below." : undefined}
          />
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((note) => {
              const box = resolvePrepNoteBox({ children: flow.children }, note);
              return (
                <PanelRow
                  key={note.id}
                  title={
                    <button type="button" className="text-left" onClick={() => onSelectNote?.(note)}>
                      {note.text}
                    </button>
                  }
                  subtitle={`${note.authorId}${note.assignedToId ? ` → ${note.assignedToId}` : ""} · ${
                    box ? box.content || "(empty box)" : `box ${note.boxPath.join(".")}`
                  }`}
                  trailing={
                    <>
                      <Pill tone={STATUS_TONE[note.status]}>{note.status}</Pill>
                      {editable ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={`Delete note ${note.id}`}
                          onClick={() => {
                            deletePrepNote(note.id);
                            refresh();
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      ) : null}
                    </>
                  }
                >
                  {editable ? (
                    <div className="flex flex-wrap items-center gap-1">
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            savePrepNote(assignNote(note, null, Date.now()));
                            refresh();
                          }}
                        >
                          Unassign
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </PanelRow>
              );
            })}
          </div>
        )}
      </PanelSection>

      {editable ? (
        <PanelSection title="Add note" description={`Attaches to box ${activeBoxPath.join(".")}.`}>
          <div className="grid grid-cols-1 items-end gap-2 sm:grid-cols-[2fr_1fr_auto]">
            <LabeledField label="Note">
              <Textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} />
            </LabeledField>
            <LabeledField label="Assign to (optional)">
              <Input value={assignTo} onChange={(e) => setAssignTo(e.target.value)} />
            </LabeledField>
            <Button size="sm" onClick={addNote} disabled={!text.trim()}>
              Add note
            </Button>
          </div>
        </PanelSection>
      ) : null}

      {source.length > 0 ? (
        <SummaryText label="Plain-text summary" text={buildPrepNoteSummaryText(source)} />
      ) : null}
    </PanelShell>
  );
}
