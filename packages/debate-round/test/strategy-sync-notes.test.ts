import { describe, expect, it } from "vitest";
import {
  assignNote,
  buildPrepNoteJumpHref,
  buildPrepNoteSummaryText,
  createPrepNote,
  getNotesAssignedTo,
  getNotesForBox,
  getNotesForFlow,
  getOpenFollowUps,
  parsePrepNoteJumpParams,
  resolvePrepNoteBox,
  sortNotesByCreatedAt,
  updateNoteStatus,
  type PrepNote,
} from "../src/flow/strategy-sync-notes";
import { newBox } from "../src/utils/flow-utils";

function note(overrides: Partial<PrepNote> = {}): PrepNote {
  return {
    id: "n1",
    flowId: 1,
    boxPath: [0],
    authorId: "alex",
    text: "check this warrant",
    status: "open",
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  };
}

describe("createPrepNote", () => {
  it("builds an open note from valid input", () => {
    expect(
      createPrepNote({
        id: "n1",
        flowId: 1,
        boxPath: [0, 1],
        authorId: "alex",
        text: "  needs a link  ",
        createdAt: 1000,
      }),
    ).toEqual({
      id: "n1",
      flowId: 1,
      boxPath: [0, 1],
      authorId: "alex",
      text: "needs a link",
      status: "open",
      createdAt: 1000,
      updatedAt: 1000,
    });
  });

  it("includes assignedToId when supplied", () => {
    expect(
      createPrepNote({
        id: "n1",
        flowId: 1,
        boxPath: [0],
        authorId: "alex",
        text: "find a card",
        createdAt: 0,
        assignedToId: "sam",
      }).assignedToId,
    ).toBe("sam");
  });

  it("clamps overlong text to the max length", () => {
    const result = createPrepNote({
      id: "n1",
      flowId: 1,
      boxPath: [0],
      authorId: "alex",
      text: "x".repeat(1200),
      createdAt: 0,
    });
    expect(result.text).toHaveLength(1000);
  });

  it("throws for an empty boxPath", () => {
    expect(() =>
      createPrepNote({ id: "n1", flowId: 1, boxPath: [], authorId: "alex", text: "hi", createdAt: 0 }),
    ).toThrow(/boxPath/);
  });

  it("throws for a blank authorId", () => {
    expect(() =>
      createPrepNote({ id: "n1", flowId: 1, boxPath: [0], authorId: "  ", text: "hi", createdAt: 0 }),
    ).toThrow(/authorId/);
  });

  it("throws for blank text", () => {
    expect(() =>
      createPrepNote({ id: "n1", flowId: 1, boxPath: [0], authorId: "alex", text: "   ", createdAt: 0 }),
    ).toThrow(/text/);
  });
});

describe("updateNoteStatus", () => {
  it("returns a copy with the new status and bumped updatedAt", () => {
    const original = note({ status: "open", updatedAt: 0 });
    const updated = updateNoteStatus(original, "covered", 500);

    expect(updated).toEqual({ ...original, status: "covered", updatedAt: 500 });
    expect(original.status).toBe("open");
  });
});

describe("assignNote", () => {
  it("assigns a note to a teammate", () => {
    const updated = assignNote(note(), "sam", 100);
    expect(updated.assignedToId).toBe("sam");
    expect(updated.updatedAt).toBe(100);
  });

  it("unassigns a note when passed null", () => {
    const assigned = note({ assignedToId: "sam" });
    const updated = assignNote(assigned, null, 200);

    expect(updated.assignedToId).toBeUndefined();
    expect(updated.updatedAt).toBe(200);
    expect(assigned.assignedToId).toBe("sam");
  });
});

describe("sortNotesByCreatedAt", () => {
  it("sorts ascending without mutating the input", () => {
    const input = [note({ id: "b", createdAt: 3000 }), note({ id: "a", createdAt: 1000 })];
    const sorted = sortNotesByCreatedAt(input);

    expect(sorted.map((n) => n.id)).toEqual(["a", "b"]);
    expect(input.map((n) => n.id)).toEqual(["b", "a"]);
  });
});

describe("getNotesForBox", () => {
  it("filters by both flowId and boxPath, oldest first", () => {
    const notes = [
      note({ id: "match", flowId: 1, boxPath: [0, 1], createdAt: 2000 }),
      note({ id: "other-flow", flowId: 2, boxPath: [0, 1], createdAt: 1000 }),
      note({ id: "other-path", flowId: 1, boxPath: [0, 2], createdAt: 1000 }),
      note({ id: "match-earlier", flowId: 1, boxPath: [0, 1], createdAt: 500 }),
    ];

    expect(getNotesForBox(notes, 1, [0, 1]).map((n) => n.id)).toEqual(["match-earlier", "match"]);
  });
});

describe("getNotesForFlow", () => {
  it("filters to the given flow, oldest first", () => {
    const notes = [
      note({ id: "f1-b", flowId: 1, createdAt: 2000 }),
      note({ id: "f2", flowId: 2, createdAt: 500 }),
      note({ id: "f1-a", flowId: 1, createdAt: 1000 }),
    ];

    expect(getNotesForFlow(notes, 1).map((n) => n.id)).toEqual(["f1-a", "f1-b"]);
  });
});

describe("getNotesAssignedTo", () => {
  it("filters to notes assigned to the given teammate, oldest first", () => {
    const notes = [
      note({ id: "sam-2", assignedToId: "sam", createdAt: 2000 }),
      note({ id: "alex", assignedToId: "alex", createdAt: 500 }),
      note({ id: "sam-1", assignedToId: "sam", createdAt: 1000 }),
      note({ id: "unassigned" }),
    ];

    expect(getNotesAssignedTo(notes, "sam").map((n) => n.id)).toEqual(["sam-1", "sam-2"]);
  });
});

describe("getOpenFollowUps", () => {
  it("filters to needs-follow-up notes, oldest first", () => {
    const notes = [
      note({ id: "b", status: "needs-follow-up", createdAt: 2000 }),
      note({ id: "covered", status: "covered", createdAt: 500 }),
      note({ id: "a", status: "needs-follow-up", createdAt: 1000 }),
      note({ id: "open", status: "open", createdAt: 1500 }),
    ];

    expect(getOpenFollowUps(notes).map((n) => n.id)).toEqual(["a", "b"]);
  });
});

describe("resolvePrepNoteBox", () => {
  const flow = {
    children: [
      { ...newBox(0, 1), children: [newBox(0, 2, false), newBox(1, 2, true)] },
      newBox(1, 1),
    ],
  };

  it("resolves the box a nested note path points to", () => {
    const box = resolvePrepNoteBox(flow, note({ boxPath: [0, 1] }));
    expect(box).toMatchObject({ index: 1, level: 2, focus: true });
  });

  it("returns null when the path no longer resolves (e.g. rows were removed)", () => {
    expect(resolvePrepNoteBox(flow, note({ boxPath: [5, 0] }))).toBeNull();
  });
});

describe("buildPrepNoteJumpHref", () => {
  it("builds a /debate link carrying the note's flowId and boxPath", () => {
    expect(buildPrepNoteJumpHref(note({ flowId: 3, boxPath: [0, 1] }))).toBe(
      "/debate?flowId=3&boxPath=0,1",
    );
  });

  it("joins a single-segment boxPath without a trailing comma", () => {
    expect(buildPrepNoteJumpHref(note({ flowId: 7, boxPath: [2] }))).toBe("/debate?flowId=7&boxPath=2");
  });
});

describe("parsePrepNoteJumpParams", () => {
  function params(values: Record<string, string>) {
    return { get: (name: string) => values[name] ?? null };
  }

  it("round-trips through buildPrepNoteJumpHref's query params", () => {
    expect(parsePrepNoteJumpParams(params({ flowId: "3", boxPath: "0,1" }))).toEqual({
      flowId: 3,
      boxPath: [0, 1],
    });
  });

  it("returns null when flowId is missing", () => {
    expect(parsePrepNoteJumpParams(params({ boxPath: "0,1" }))).toBeNull();
  });

  it("returns null when boxPath is missing", () => {
    expect(parsePrepNoteJumpParams(params({ flowId: "3" }))).toBeNull();
  });

  it("returns null when flowId isn't numeric", () => {
    expect(parsePrepNoteJumpParams(params({ flowId: "abc", boxPath: "0,1" }))).toBeNull();
  });

  it("returns null when boxPath contains a non-integer segment", () => {
    expect(parsePrepNoteJumpParams(params({ flowId: "3", boxPath: "0,abc" }))).toBeNull();
  });

  it("returns null when boxPath contains a negative segment", () => {
    expect(parsePrepNoteJumpParams(params({ flowId: "3", boxPath: "0,-1" }))).toBeNull();
  });
});

describe("buildPrepNoteSummaryText", () => {
  it("reports no notes yet when the list is empty", () => {
    expect(buildPrepNoteSummaryText([])).toBe("No prep notes yet.");
  });

  it("summarizes status counts and lists follow-ups with their assignee", () => {
    const notes = [
      note({ id: "1", status: "open" }),
      note({ id: "2", status: "covered" }),
      note({ id: "3", status: "needs-follow-up", text: "find a turn", createdAt: 100 }),
      note({
        id: "4",
        status: "needs-follow-up",
        text: "confirm the card",
        assignedToId: "sam",
        createdAt: 50,
      }),
    ];

    const summary = buildPrepNoteSummaryText(notes);
    expect(summary).toContain("4 notes: 1 open, 1 covered, 2 need follow-up");
    expect(summary).toContain("- confirm the card (assigned to sam)");
    expect(summary).toContain("- find a turn");
  });

  it("uses singular note wording for a single note", () => {
    expect(buildPrepNoteSummaryText([note()])).toContain("1 note: 1 open, 0 covered, 0 need follow-up");
  });
});
