import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAndSaveCoachingSession,
  buildCoachingNotesText,
  buildCoachingSessionComparison,
  buildCoachingSessionComparisonText,
  buildCoachingSessionsPanelView,
  coachingNotesFilename,
  coachingSessionComparisonFilename,
  coachingSessionNews,
  deleteCoachingSession,
  getCoachingSession,
  getCoachingSessionsForRound,
  listCoachingSessions,
  saveCoachingSession,
  saveCoachingSessionAiFeedback,
  type CoachingSessionRecord,
} from "../src/state/coachingSessions";
import { listVersionsForCoachingSession } from "../src/state/coachingSessionHistory";
import type { Box } from "../src/types/flow";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment has no DOM by default here. */
class MemoryStorage {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? this.store.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

const SESSION_AFF: CoachingSessionRecord = {
  roundId: "round-1",
  sideKey: "AFF",
  prompts: [
    { kind: "refutation", rowIndex: 0, prompt: 'Answer "Solvency deficit" before it\'s extended against you.' },
    { kind: "weighing", rowIndex: null, prompt: "Weighing guidance: shore up your case before weighing." },
  ],
};
const SESSION_NEG: CoachingSessionRecord = {
  roundId: "round-1",
  sideKey: "NEG",
  prompts: [
    { kind: "extension", rowIndex: 0, prompt: 'Extend "Solvency deficit" as dropped/conceded.' },
  ],
};
const SESSION_OTHER_ROUND: CoachingSessionRecord = {
  roundId: "round-2",
  sideKey: "AFF",
  prompts: [{ kind: "collapse", rowIndex: 1, prompt: "Collapse onto the most vulnerable opposing argument." }],
};

const COLUMNS = ["1AC", "1NC", "2AC", "2NC"];

/** Builds a row's box chain from per-column content; "" leaves a column unflowed. */
function rowFromContents(contents: string[], overrides: Partial<Box> = {}): Box {
  let box: Box | undefined;
  for (let i = contents.length - 1; i >= 0; i--) {
    const current: Box = {
      content: contents[i],
      children: box ? [box] : [],
      index: 0,
      level: i + 1,
      focus: false,
      empty: !contents[i].trim(),
    };
    box = current;
  }
  return { ...box!, ...overrides };
}

const MIXED_FLOW = {
  columns: COLUMNS,
  children: [
    rowFromContents(["Case advantage", "Turn", "", ""]),
    rowFromContents(["", "Disad link", "Extend", "Frontline"]),
  ],
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listCoachingSessions", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listCoachingSessions()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("coachingSessions", "{not json");
    expect(listCoachingSessions()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("coachingSessions", JSON.stringify({ not: "an array" }));
    expect(listCoachingSessions()).toEqual([]);
  });

  it("lists every saved coaching session", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession(SESSION_NEG);
    expect(listCoachingSessions()).toEqual([SESSION_AFF, SESSION_NEG]);
  });
});

describe("getCoachingSession", () => {
  it("finds a saved coaching session by roundId + sideKey", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession(SESSION_NEG);
    expect(getCoachingSession("round-1", "AFF")).toEqual(SESSION_AFF);
    expect(getCoachingSession("round-1", "NEG")).toEqual(SESSION_NEG);
  });

  it("returns undefined for a roundId/sideKey pair that isn't stored", () => {
    saveCoachingSession(SESSION_AFF);
    expect(getCoachingSession("round-1", "NEG")).toBeUndefined();
    expect(getCoachingSession("missing", "AFF")).toBeUndefined();
  });
});

describe("getCoachingSessionsForRound", () => {
  it("lists every session for a round across sides, excluding other rounds", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession(SESSION_NEG);
    saveCoachingSession(SESSION_OTHER_ROUND);
    expect(getCoachingSessionsForRound("round-1")).toEqual([SESSION_AFF, SESSION_NEG]);
  });

  it("returns an empty list for a roundId with no stored sessions", () => {
    expect(getCoachingSessionsForRound("missing")).toEqual([]);
  });
});

describe("saveCoachingSession", () => {
  it("upserts — saving an existing roundId+sideKey pair overwrites rather than duplicating it", () => {
    saveCoachingSession(SESSION_AFF);
    const updated: CoachingSessionRecord = {
      ...SESSION_AFF,
      prompts: [...SESSION_AFF.prompts, { kind: "collapse", rowIndex: 2, prompt: "Collapse here too." }],
    };
    saveCoachingSession(updated);

    expect(listCoachingSessions()).toEqual([updated]);
    expect(getCoachingSession("round-1", "AFF")).toEqual(updated);
  });

  it("keeps sessions for different sides of the same round distinct", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession(SESSION_NEG);
    expect(listCoachingSessions()).toHaveLength(2);
  });

  it("returns the saved record with no version on the first save for a roundId+sideKey pair", () => {
    const result = saveCoachingSession(SESSION_AFF);
    expect(result).toEqual({ record: SESSION_AFF });
  });

  it("snapshots the overwritten record into coaching-session history and returns it", () => {
    saveCoachingSession(SESSION_AFF);
    const updated: CoachingSessionRecord = { ...SESSION_AFF, aiFeedback: "Revised feedback." };
    const result = saveCoachingSession(updated);

    expect(result.record).toEqual(updated);
    expect(result.version).toMatchObject({ roundId: "round-1", sideKey: "AFF", prompts: SESSION_AFF.prompts });
    expect(listVersionsForCoachingSession("round-1", "AFF")).toEqual([result.version]);
  });

  it("does not snapshot anything for a different roundId+sideKey pair's first save", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession(SESSION_NEG);
    expect(listVersionsForCoachingSession("round-1", "NEG")).toEqual([]);
  });
});

describe("deleteCoachingSession", () => {
  it("removes a stored coaching session by roundId + sideKey", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession(SESSION_NEG);
    deleteCoachingSession("round-1", "AFF");

    expect(listCoachingSessions()).toEqual([SESSION_NEG]);
    expect(getCoachingSession("round-1", "AFF")).toBeUndefined();
  });

  it("is a no-op when the roundId/sideKey pair isn't stored", () => {
    saveCoachingSession(SESSION_NEG);
    deleteCoachingSession("round-1", "AFF");
    expect(listCoachingSessions()).toEqual([SESSION_NEG]);
  });

  it("also clears every history snapshot for that roundId+sideKey pair", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession({ ...SESSION_AFF, aiFeedback: "Revised." });
    expect(listVersionsForCoachingSession("round-1", "AFF")).toHaveLength(1);

    deleteCoachingSession("round-1", "AFF");

    expect(listVersionsForCoachingSession("round-1", "AFF")).toEqual([]);
  });

  it("leaves another roundId+sideKey pair's history untouched", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession({ ...SESSION_AFF, aiFeedback: "Revised." });
    saveCoachingSession(SESSION_NEG);
    saveCoachingSession({ ...SESSION_NEG, aiFeedback: "Revised NEG." });

    deleteCoachingSession("round-1", "AFF");

    expect(listVersionsForCoachingSession("round-1", "NEG")).toHaveLength(1);
  });
});

describe("saveCoachingSessionAiFeedback", () => {
  it("sets aiFeedback on an existing session without touching its prompts", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSessionAiFeedback("round-1", "AFF", "Lead with the solvency deficit.");

    expect(getCoachingSession("round-1", "AFF")).toEqual({
      ...SESSION_AFF,
      aiFeedback: "Lead with the solvency deficit.",
    });
  });

  it("overwrites a previously saved aiFeedback", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSessionAiFeedback("round-1", "AFF", "First pass.");
    saveCoachingSessionAiFeedback("round-1", "AFF", "Revised feedback.");

    expect(getCoachingSession("round-1", "AFF")?.aiFeedback).toBe("Revised feedback.");
  });

  it("leaves other sessions untouched", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession(SESSION_NEG);
    saveCoachingSessionAiFeedback("round-1", "AFF", "Feedback for AFF only.");

    expect(getCoachingSession("round-1", "NEG")).toEqual(SESSION_NEG);
  });

  it("is a no-op when the roundId/sideKey pair isn't stored", () => {
    saveCoachingSessionAiFeedback("round-1", "AFF", "Feedback.");
    expect(listCoachingSessions()).toEqual([]);
  });
});

describe("buildAndSaveCoachingSession", () => {
  it("derives a round+side's coaching session from a flow and persists it", () => {
    const record = buildAndSaveCoachingSession(MIXED_FLOW, "round-3", "A");

    expect(record.roundId).toBe("round-3");
    expect(record.sideKey).toBe("A");
    expect(record.prompts.length).toBeGreaterThan(0);
    expect(getCoachingSession("round-3", "A")).toEqual(record);
  });

  it("stamps createdAt on the generated session", () => {
    const before = Date.now();
    const record = buildAndSaveCoachingSession(MIXED_FLOW, "round-3", "A");
    expect(record.createdAt).toBeGreaterThanOrEqual(before);
    expect(record.createdAt).toBeLessThanOrEqual(Date.now());
  });

  it("overwrites any existing session for that roundId+sideKey pair", () => {
    saveCoachingSession(SESSION_AFF);
    const record = buildAndSaveCoachingSession(MIXED_FLOW, "round-1", "AFF");

    expect(listCoachingSessions()).toEqual([record]);
  });

  it("snapshots the prior session into history when regenerating an existing roundId+sideKey pair", () => {
    saveCoachingSession(SESSION_AFF);
    buildAndSaveCoachingSession(MIXED_FLOW, "round-1", "AFF");

    const versions = listVersionsForCoachingSession("round-1", "AFF");
    expect(versions).toHaveLength(1);
    expect(versions[0]?.prompts).toEqual(SESSION_AFF.prompts);
  });

  it("keeps sessions for a different side of the same round distinct", () => {
    buildAndSaveCoachingSession(MIXED_FLOW, "round-1", "AFF");
    buildAndSaveCoachingSession(MIXED_FLOW, "round-1", "NEG");

    expect(listCoachingSessions()).toHaveLength(2);
  });

  it("passes collapseLimit through to buildCoachingSession", () => {
    const unlimited = buildAndSaveCoachingSession(MIXED_FLOW, "round-4", "A");
    const limited = buildAndSaveCoachingSession(MIXED_FLOW, "round-4", "A", { collapseLimit: 0 });

    const collapseCount = (prompts: CoachingSessionRecord["prompts"]) =>
      prompts.filter((prompt) => prompt.kind === "collapse").length;
    expect(collapseCount(limited.prompts)).toBeLessThan(collapseCount(unlimited.prompts));
  });
});

describe("buildCoachingSessionsPanelView", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(buildCoachingSessionsPanelView()).toEqual([]);
  });

  it("sorts persisted sessions by roundId then sideKey", () => {
    saveCoachingSession(SESSION_OTHER_ROUND);
    saveCoachingSession(SESSION_NEG);
    saveCoachingSession(SESSION_AFF);
    expect(buildCoachingSessionsPanelView()).toEqual([SESSION_AFF, SESSION_NEG, SESSION_OTHER_ROUND]);
  });

  it("reflects a session removed via deleteCoachingSession", () => {
    saveCoachingSession(SESSION_AFF);
    saveCoachingSession(SESSION_NEG);
    deleteCoachingSession("round-1", "AFF");
    expect(buildCoachingSessionsPanelView()).toEqual([SESSION_NEG]);
  });
});

describe("coachingSessionNews", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(coachingSessionNews()).toEqual([]);
  });

  it("skips a session with no createdAt rather than backdating it", () => {
    saveCoachingSession(SESSION_AFF);
    expect(coachingSessionNews()).toEqual([]);
  });

  it("turns a freshly generated session into a community NewsItem", () => {
    const record = buildAndSaveCoachingSession(MIXED_FLOW, "round-3", "A");

    const items = coachingSessionNews();
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      id: `coaching-session-round-3-A-${record.createdAt}`,
      category: "community",
      title: "New coaching session generated for round round-3 (A)",
      timestamp: record.createdAt,
      href: "/coaching",
    });
    expect(items[0].body).toContain("Round round-3 (A)");
  });

  it("includes one item per generated session, across rounds and sides", () => {
    buildAndSaveCoachingSession(MIXED_FLOW, "round-1", "AFF");
    buildAndSaveCoachingSession(MIXED_FLOW, "round-1", "NEG");
    buildAndSaveCoachingSession(MIXED_FLOW, "round-2", "AFF");

    expect(coachingSessionNews()).toHaveLength(3);
  });
});

describe("buildCoachingNotesText", () => {
  it("headers the notes with the round and side", () => {
    const text = buildCoachingNotesText(SESSION_AFF);
    expect(text).toMatch(/^Coaching Notes — Round round-1 \(AFF\)\n\n/);
  });

  it("includes the rendered template prompts", () => {
    const text = buildCoachingNotesText(SESSION_AFF);
    expect(text).toContain('Answer "Solvency deficit" before it\'s extended against you.');
    expect(text).toContain("Weighing guidance: shore up your case before weighing.");
  });

  it("omits the AI Feedback section when no feedback has been generated", () => {
    const text = buildCoachingNotesText(SESSION_AFF);
    expect(text).not.toContain("AI Feedback");
  });

  it("appends the AI feedback as its own section when present", () => {
    const session: CoachingSessionRecord = { ...SESSION_AFF, aiFeedback: "Focus on the solvency deficit." };
    const text = buildCoachingNotesText(session);
    expect(text).toContain("### AI Feedback\nFocus on the solvency deficit.");
  });

  it("renders the no-prompts placeholder for a session with no prompts", () => {
    const session: CoachingSessionRecord = { roundId: "round-9", sideKey: "NEG", prompts: [] };
    const text = buildCoachingNotesText(session);
    expect(text).toContain("No coaching prompts available yet — nothing has been flowed.");
  });
});

describe("coachingNotesFilename", () => {
  it("builds a filesystem-safe filename from the round id and side", () => {
    expect(coachingNotesFilename("round-1", "AFF")).toBe("coaching-notes-round-1-aff.txt");
  });

  it("collapses non-alphanumeric characters to single hyphens", () => {
    expect(coachingNotesFilename("Round #4!", "neg side")).toBe("coaching-notes-round-4-neg-side.txt");
  });

  it("falls back to a generic name when both inputs sanitize to nothing", () => {
    expect(coachingNotesFilename("###", "!!!")).toBe("coaching-notes-session.txt");
  });
});

describe("buildCoachingSessionComparison", () => {
  it("groups each session's prompts by kind into rows, in a fixed kind order", () => {
    const comparison = buildCoachingSessionComparison(SESSION_AFF, SESSION_NEG);

    expect(comparison.a).toEqual(SESSION_AFF);
    expect(comparison.b).toEqual(SESSION_NEG);
    expect(comparison.rowsByKind.map((row) => row.kind)).toEqual([
      "extension",
      "refutation",
      "collapse",
      "weighing",
    ]);
  });

  it("puts each session's prompts under its matching kind's row", () => {
    const comparison = buildCoachingSessionComparison(SESSION_AFF, SESSION_NEG);
    const refutationRow = comparison.rowsByKind.find((row) => row.kind === "refutation");
    const extensionRow = comparison.rowsByKind.find((row) => row.kind === "extension");
    const weighingRow = comparison.rowsByKind.find((row) => row.kind === "weighing");

    expect(refutationRow?.a).toEqual([SESSION_AFF.prompts[0]]);
    expect(refutationRow?.b).toEqual([]);
    expect(extensionRow?.a).toEqual([]);
    expect(extensionRow?.b).toEqual([SESSION_NEG.prompts[0]]);
    expect(weighingRow?.a).toEqual([SESSION_AFF.prompts[1]]);
    expect(weighingRow?.b).toEqual([]);
  });

  it("returns an empty array for a kind neither session has any prompts for", () => {
    const comparison = buildCoachingSessionComparison(SESSION_AFF, SESSION_NEG);
    const collapseRow = comparison.rowsByKind.find((row) => row.kind === "collapse");
    expect(collapseRow).toEqual({ kind: "collapse", a: [], b: [] });
  });

  it("works for two sessions of the same round and side compared against themselves", () => {
    const comparison = buildCoachingSessionComparison(SESSION_AFF, SESSION_AFF);
    expect(comparison.rowsByKind.every((row) => row.a.length === row.b.length)).toBe(true);
  });
});

describe("buildCoachingSessionComparisonText", () => {
  it("headers the comparison with both sessions' round and side", () => {
    const comparison = buildCoachingSessionComparison(SESSION_AFF, SESSION_NEG);
    const text = buildCoachingSessionComparisonText(comparison);
    expect(text).toMatch(/^Coaching Comparison — Round round-1 \(AFF\) vs\. Round round-1 \(NEG\)\n\n/);
  });

  it("includes each session's prompt text under its own kind section", () => {
    const comparison = buildCoachingSessionComparison(SESSION_AFF, SESSION_NEG);
    const text = buildCoachingSessionComparisonText(comparison);
    expect(text).toContain('Answer "Solvency deficit" before it\'s extended against you.');
    expect(text).toContain('Extend "Solvency deficit" as dropped/conceded.');
  });

  it("marks a session's empty side of a row as (none)", () => {
    const comparison = buildCoachingSessionComparison(SESSION_AFF, SESSION_NEG);
    const text = buildCoachingSessionComparisonText(comparison);
    expect(text).toContain("(none)");
  });
});

describe("coachingSessionComparisonFilename", () => {
  it("builds a filesystem-safe filename from both sessions' round id and side", () => {
    expect(coachingSessionComparisonFilename(SESSION_AFF, SESSION_NEG)).toBe(
      "coaching-comparison-round-1-aff-vs-round-1-neg.txt",
    );
  });

  it("keeps the literal 'vs' separator even when both sessions otherwise sanitize to nothing", () => {
    const blank: CoachingSessionRecord = { roundId: "###", sideKey: "!!!", prompts: [] };
    expect(coachingSessionComparisonFilename(blank, blank)).toBe("coaching-comparison-vs.txt");
  });
});
