import { beforeEach, describe, expect, it } from "vitest";
import {
  buildCoachingSessionsPanelView,
  deleteCoachingSession,
  getCoachingSession,
  getCoachingSessionsForRound,
  listCoachingSessions,
  saveCoachingSession,
  saveCoachingSessionAiFeedback,
  type CoachingSessionRecord,
} from "../src/state/coachingSessions";

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
