/**
 * @fileoverview Live prep-note data model + query helpers for the
 * "Strategy Sync Notes" idea in TODO.md ("Let teammates leave live prep
 * notes, assign tasks, and mark which arguments have been covered or need
 * follow-up"). A `PrepNote` attaches to a specific flow `Box` the same way
 * `flow-annotations.ts` already addresses boxes (`boxPath`/`boxFromPath`),
 * so a note lives on the exact argument it's about, can be assigned to a
 * teammate as a task, and tracks whether that argument still needs
 * follow-up or has been covered. This is the first slice only — it is pure
 * data-model/query logic over caller-supplied notes; nothing in this repo
 * persists a `PrepNote`, notifies an assignee, or renders a prep-notes UI
 * yet. See the follow-ups noted in TODO.md.
 */

import type { Box } from "debate-core/src/types/flow";
import { boxFromPath } from "../utils/flow-utils";

/** Where a note's underlying argument currently stands. */
export type PrepNoteStatus = "open" | "covered" | "needs-follow-up";

export type PrepNote = {
  id: string;
  flowId: number;
  /** Path from the flow's root children down to the box this note is about (see `boxFromPath`). */
  boxPath: number[];
  authorId: string;
  text: string;
  status: PrepNoteStatus;
  /** Teammate currently responsible for acting on this note, if assigned as a task. */
  assignedToId?: string;
  createdAt: number;
  updatedAt: number;
};

const MAX_NOTE_LENGTH = 1000;

export type CreatePrepNoteInput = {
  id: string;
  flowId: number;
  boxPath: number[];
  authorId: string;
  text: string;
  createdAt: number;
  assignedToId?: string;
};

/**
 * Builds a `PrepNote` in the "open" status, validating that it actually
 * addresses a box (non-empty `boxPath`), has an author, and has non-blank
 * text. `text` is trimmed and clamped to `MAX_NOTE_LENGTH`.
 */
export function createPrepNote(input: CreatePrepNoteInput): PrepNote {
  if (input.boxPath.length === 0) {
    throw new Error("createPrepNote: boxPath must address a box");
  }
  if (!input.authorId.trim()) {
    throw new Error("createPrepNote: authorId is required");
  }
  const text = input.text.trim();
  if (!text) {
    throw new Error("createPrepNote: text is required");
  }

  return {
    id: input.id,
    flowId: input.flowId,
    boxPath: input.boxPath,
    authorId: input.authorId,
    text: text.slice(0, MAX_NOTE_LENGTH),
    status: "open",
    createdAt: input.createdAt,
    updatedAt: input.createdAt,
    ...(input.assignedToId ? { assignedToId: input.assignedToId } : {}),
  };
}

/** Returns a copy of `note` with its status changed and `updatedAt` bumped. */
export function updateNoteStatus(note: PrepNote, status: PrepNoteStatus, updatedAt: number): PrepNote {
  return { ...note, status, updatedAt };
}

/**
 * Returns a copy of `note` assigned to `assignedToId` as a task, or
 * unassigned (task released) when `assignedToId` is `null`.
 */
export function assignNote(note: PrepNote, assignedToId: string | null, updatedAt: number): PrepNote {
  if (assignedToId === null) {
    const { assignedToId: _omit, ...rest } = note;
    return { ...rest, updatedAt };
  }
  return { ...note, assignedToId, updatedAt };
}

function pathsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

/** Ascending by `createdAt`, without mutating the input array. */
export function sortNotesByCreatedAt(notes: PrepNote[]): PrepNote[] {
  return [...notes].sort((a, b) => a.createdAt - b.createdAt);
}

/** All notes attached to one specific box on one specific flow, oldest first. */
export function getNotesForBox(notes: PrepNote[], flowId: number, boxPath: number[]): PrepNote[] {
  return sortNotesByCreatedAt(
    notes.filter((note) => note.flowId === flowId && pathsEqual(note.boxPath, boxPath)),
  );
}

/** All notes on a given flow, oldest first. */
export function getNotesForFlow(notes: PrepNote[], flowId: number): PrepNote[] {
  return sortNotesByCreatedAt(notes.filter((note) => note.flowId === flowId));
}

/** All notes currently assigned to a teammate as a task, oldest first. */
export function getNotesAssignedTo(notes: PrepNote[], assignedToId: string): PrepNote[] {
  return sortNotesByCreatedAt(notes.filter((note) => note.assignedToId === assignedToId));
}

/**
 * Notes still flagged `needs-follow-up`, oldest first — the longest a note
 * has stood open, the more it's worth surfacing.
 */
export function getOpenFollowUps(notes: PrepNote[]): PrepNote[] {
  return sortNotesByCreatedAt(notes.filter((note) => note.status === "needs-follow-up"));
}

/**
 * Resolves the flow `Box` a note points to, for rendering a "jump to
 * argument" link. Returns `null` if the path no longer resolves to a box
 * (e.g. the flow was edited/rows removed after the note was made).
 */
export function resolvePrepNoteBox(flow: { children: Box[] }, note: PrepNote): Box | null {
  const resolved = boxFromPath(flow, note.boxPath);
  return resolved !== null && "content" in resolved ? (resolved as Box) : null;
}

/** A parsed "jump to argument" deep-link target — see `buildPrepNoteJumpHref`. */
export type PrepNoteJumpTarget = { flowId: number; boxPath: number[] };

/**
 * Builds the "jump to argument" link for a note — `/debate` with
 * `flowId`/`boxPath` query params `parsePrepNoteJumpParams` reads back to
 * select the note's flow tab and scroll to its box (see
 * `hooks/useJumpToPrepNoteBox.ts`), the panel-side counterpart to
 * `resolvePrepNoteBox` for a cross-flow panel that has no live `Flow`
 * mounted to resolve against directly.
 */
export function buildPrepNoteJumpHref(note: PrepNote): string {
  return `/debate?flowId=${note.flowId}&boxPath=${note.boxPath.join(",")}`;
}

/**
 * Parses `flowId`/`boxPath` query params (see `buildPrepNoteJumpHref`) into
 * a jump target. Returns `null` if either is missing or malformed (a
 * non-numeric `flowId`, or a `boxPath` that isn't a comma-separated list of
 * non-negative integers) rather than throwing, since this reads
 * caller-supplied URL state.
 */
export function parsePrepNoteJumpParams(params: { get(name: string): string | null }): PrepNoteJumpTarget | null {
  const flowIdRaw = params.get("flowId");
  const boxPathRaw = params.get("boxPath");
  if (!flowIdRaw || !boxPathRaw) return null;

  const flowId = Number(flowIdRaw);
  if (!Number.isFinite(flowId)) return null;

  const boxPath = boxPathRaw.split(",").map(Number);
  if (boxPath.some((value) => !Number.isInteger(value) || value < 0)) return null;

  return { flowId, boxPath };
}

/**
 * Renders a short, human-readable summary of a flow's prep notes — status
 * counts plus one line per note still needing follow-up — for a prep-notes
 * panel or sync-status banner.
 */
export function buildPrepNoteSummaryText(notes: PrepNote[]): string {
  if (notes.length === 0) {
    return "No prep notes yet.";
  }

  const openCount = notes.filter((note) => note.status === "open").length;
  const coveredCount = notes.filter((note) => note.status === "covered").length;
  const followUps = getOpenFollowUps(notes);

  const lines = [
    `${notes.length} note${notes.length === 1 ? "" : "s"}: ${openCount} open, ${coveredCount} covered, ${followUps.length} need follow-up`,
    ...followUps.map((note) => {
      const assignee = note.assignedToId ? ` (assigned to ${note.assignedToId})` : "";
      return `- ${note.text}${assignee}`;
    }),
  ];
  return lines.join("\n");
}
