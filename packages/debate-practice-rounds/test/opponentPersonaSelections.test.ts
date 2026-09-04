import { beforeEach, describe, expect, it } from "vitest";
import {
  buildOpponentPersonaSelectionsPanelView,
  deleteOpponentPersonaSelection,
  getOpponentPersonaSelection,
  listOpponentPersonaSelections,
  saveOpponentPersonaSelection,
} from "../src/state/opponentPersonaSelections";
import { opponentPersonas } from "debate-speech-writer/src/opponent/opponent-personas";
import type { OpponentPersonaSelection } from "../src/state/opponentPersonaSelections";

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

const SESSION_1_POLICY_HEAVY: OpponentPersonaSelection = {
  sessionId: "session-1",
  persona: opponentPersonas["policy-heavy"],
};

const SESSION_2_KRITIK: OpponentPersonaSelection = {
  sessionId: "session-2",
  persona: opponentPersonas.kritik,
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listOpponentPersonaSelections", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listOpponentPersonaSelections()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("opponentPersonaSelections", "{not json");
    expect(listOpponentPersonaSelections()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("opponentPersonaSelections", JSON.stringify({ not: "an array" }));
    expect(listOpponentPersonaSelections()).toEqual([]);
  });

  it("lists every saved selection", () => {
    saveOpponentPersonaSelection(SESSION_1_POLICY_HEAVY);
    saveOpponentPersonaSelection(SESSION_2_KRITIK);
    expect(listOpponentPersonaSelections()).toEqual([SESSION_1_POLICY_HEAVY, SESSION_2_KRITIK]);
  });
});

describe("getOpponentPersonaSelection", () => {
  it("finds a saved selection by sessionId", () => {
    saveOpponentPersonaSelection(SESSION_1_POLICY_HEAVY);
    expect(getOpponentPersonaSelection("session-1")).toEqual(SESSION_1_POLICY_HEAVY);
  });

  it("returns undefined for a sessionId that isn't stored", () => {
    expect(getOpponentPersonaSelection("missing")).toBeUndefined();
  });
});

describe("saveOpponentPersonaSelection", () => {
  it("upserts — saving an existing sessionId overwrites rather than duplicating it", () => {
    saveOpponentPersonaSelection(SESSION_1_POLICY_HEAVY);
    const revised: OpponentPersonaSelection = { sessionId: "session-1", persona: opponentPersonas["fast-flow"] };
    saveOpponentPersonaSelection(revised);

    expect(listOpponentPersonaSelections()).toEqual([revised]);
    expect(getOpponentPersonaSelection("session-1")).toEqual(revised);
  });

  it("persists an optional difficulty alongside the persona", () => {
    const withDifficulty: OpponentPersonaSelection = {
      sessionId: "session-3",
      persona: opponentPersonas["fast-flow"],
      difficulty: "elite",
    };
    saveOpponentPersonaSelection(withDifficulty);

    expect(getOpponentPersonaSelection("session-3")).toEqual(withDifficulty);
  });

  it("leaves difficulty unset when the caller doesn't provide one", () => {
    saveOpponentPersonaSelection(SESSION_1_POLICY_HEAVY);
    expect(getOpponentPersonaSelection("session-1")?.difficulty).toBeUndefined();
  });
});

describe("deleteOpponentPersonaSelection", () => {
  it("removes a stored selection by sessionId", () => {
    saveOpponentPersonaSelection(SESSION_1_POLICY_HEAVY);
    saveOpponentPersonaSelection(SESSION_2_KRITIK);
    deleteOpponentPersonaSelection("session-1");

    expect(listOpponentPersonaSelections()).toEqual([SESSION_2_KRITIK]);
    expect(getOpponentPersonaSelection("session-1")).toBeUndefined();
  });

  it("is a no-op when the sessionId isn't stored", () => {
    saveOpponentPersonaSelection(SESSION_2_KRITIK);
    deleteOpponentPersonaSelection("missing");
    expect(listOpponentPersonaSelections()).toEqual([SESSION_2_KRITIK]);
  });
});

describe("buildOpponentPersonaSelectionsPanelView", () => {
  it("returns an empty view when nothing is stored", () => {
    expect(buildOpponentPersonaSelectionsPanelView()).toEqual([]);
  });

  it("sorts every persisted selection by sessionId", () => {
    saveOpponentPersonaSelection(SESSION_2_KRITIK);
    saveOpponentPersonaSelection(SESSION_1_POLICY_HEAVY);

    expect(buildOpponentPersonaSelectionsPanelView()).toEqual([SESSION_1_POLICY_HEAVY, SESSION_2_KRITIK]);
  });

  it("does not mutate the underlying stored order", () => {
    saveOpponentPersonaSelection(SESSION_2_KRITIK);
    saveOpponentPersonaSelection(SESSION_1_POLICY_HEAVY);

    buildOpponentPersonaSelectionsPanelView();

    expect(listOpponentPersonaSelections()).toEqual([SESSION_2_KRITIK, SESSION_1_POLICY_HEAVY]);
  });
});
