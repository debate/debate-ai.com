import { beforeEach, describe, expect, it } from "vitest";
import {
  deleteSprintSession,
  getSprintSession,
  listSprintSessions,
  listSprintSessionsForTopic,
  saveSprintSession,
} from "../src/state/sprintSessions";
import type { SprintSession } from "../src/lib/team-collaboration-mode";

/** Minimal in-memory `localStorage` mock — this package's Vitest environment is `node`, with no DOM. */
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

const SOLVENCY_SESSION: SprintSession = {
  id: "session-1",
  topic: "solvency",
  title: "Kickoff — divide up cards",
  scheduledDayKey: "2026-09-10",
  createdAt: 100,
};
const TOPICALITY_SESSION: SprintSession = {
  id: "session-2",
  topic: "topicality",
  title: "Shell review",
  scheduledDayKey: "2026-09-05",
  createdAt: 200,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listSprintSessions", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listSprintSessions()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("sprintSessions", "{not json");
    expect(listSprintSessions()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("sprintSessions", JSON.stringify({ not: "an array" }));
    expect(listSprintSessions()).toEqual([]);
  });

  it("lists every saved session across topics", () => {
    saveSprintSession(SOLVENCY_SESSION);
    saveSprintSession(TOPICALITY_SESSION);
    expect(listSprintSessions()).toEqual([SOLVENCY_SESSION, TOPICALITY_SESSION]);
  });
});

describe("listSprintSessionsForTopic", () => {
  it("returns only sessions for the given topic, soonest first", () => {
    const laterSolvencySession: SprintSession = { ...SOLVENCY_SESSION, id: "session-3", scheduledDayKey: "2026-09-20" };
    saveSprintSession(laterSolvencySession);
    saveSprintSession(SOLVENCY_SESSION);
    saveSprintSession(TOPICALITY_SESSION);

    expect(listSprintSessionsForTopic("solvency")).toEqual([SOLVENCY_SESSION, laterSolvencySession]);
    expect(listSprintSessionsForTopic("topicality")).toEqual([TOPICALITY_SESSION]);
  });

  it("returns an empty list for a topic with no sessions", () => {
    saveSprintSession(SOLVENCY_SESSION);
    expect(listSprintSessionsForTopic("inherency")).toEqual([]);
  });
});

describe("getSprintSession", () => {
  it("finds a saved session by id", () => {
    saveSprintSession(SOLVENCY_SESSION);
    expect(getSprintSession("session-1")).toEqual(SOLVENCY_SESSION);
  });

  it("returns undefined for an id that isn't stored", () => {
    expect(getSprintSession("missing")).toBeUndefined();
  });
});

describe("saveSprintSession", () => {
  it("upserts — saving an existing id overwrites rather than duplicating it", () => {
    saveSprintSession(SOLVENCY_SESSION);
    const rescheduled: SprintSession = { ...SOLVENCY_SESSION, scheduledDayKey: "2026-09-15" };
    saveSprintSession(rescheduled);

    expect(listSprintSessions()).toEqual([rescheduled]);
    expect(getSprintSession("session-1")).toEqual(rescheduled);
  });
});

describe("deleteSprintSession", () => {
  it("removes a stored session by id", () => {
    saveSprintSession(SOLVENCY_SESSION);
    saveSprintSession(TOPICALITY_SESSION);
    deleteSprintSession("session-1");

    expect(listSprintSessions()).toEqual([TOPICALITY_SESSION]);
    expect(getSprintSession("session-1")).toBeUndefined();
  });

  it("is a no-op when the id isn't stored", () => {
    saveSprintSession(TOPICALITY_SESSION);
    deleteSprintSession("missing");
    expect(listSprintSessions()).toEqual([TOPICALITY_SESSION]);
  });
});
