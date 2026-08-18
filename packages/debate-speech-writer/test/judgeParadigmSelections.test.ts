import { beforeEach, describe, expect, it } from "vitest";
import {
  buildJudgeParadigmSelectionsPanelView,
  deleteJudgeParadigmSelection,
  getJudgeParadigmSelection,
  listJudgeParadigmSelections,
  saveJudgeParadigmSelection,
} from "../src/state/judgeParadigmSelections";
import { buildCustomJudgeParadigm, judgeParadigms } from "../src/judge/judge-paradigms";
import type { JudgeParadigmSelection } from "../src/state/judgeParadigmSelections";

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

const ROUND_1_BUILTIN: JudgeParadigmSelection = {
  roundId: "round-1",
  paradigm: judgeParadigms.flow,
};

const ROUND_2_CUSTOM: JudgeParadigmSelection = {
  roundId: "round-2",
  paradigm: buildCustomJudgeParadigm({
    name: "Judge Smith",
    notes: "Votes on framework first, dislikes speed.",
  }),
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listJudgeParadigmSelections", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listJudgeParadigmSelections()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("judgeParadigmSelections", "{not json");
    expect(listJudgeParadigmSelections()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("judgeParadigmSelections", JSON.stringify({ not: "an array" }));
    expect(listJudgeParadigmSelections()).toEqual([]);
  });

  it("lists every saved selection, including custom paradigms", () => {
    saveJudgeParadigmSelection(ROUND_1_BUILTIN);
    saveJudgeParadigmSelection(ROUND_2_CUSTOM);
    expect(listJudgeParadigmSelections()).toEqual([ROUND_1_BUILTIN, ROUND_2_CUSTOM]);
  });
});

describe("getJudgeParadigmSelection", () => {
  it("finds a saved selection by roundId", () => {
    saveJudgeParadigmSelection(ROUND_1_BUILTIN);
    expect(getJudgeParadigmSelection("round-1")).toEqual(ROUND_1_BUILTIN);
  });

  it("returns undefined for a roundId that isn't stored", () => {
    expect(getJudgeParadigmSelection("missing")).toBeUndefined();
  });
});

describe("saveJudgeParadigmSelection", () => {
  it("upserts — saving an existing roundId overwrites rather than duplicating it", () => {
    saveJudgeParadigmSelection(ROUND_1_BUILTIN);
    const revised: JudgeParadigmSelection = { roundId: "round-1", paradigm: judgeParadigms.policymaker };
    saveJudgeParadigmSelection(revised);

    expect(listJudgeParadigmSelections()).toEqual([revised]);
    expect(getJudgeParadigmSelection("round-1")).toEqual(revised);
  });
});

describe("deleteJudgeParadigmSelection", () => {
  it("removes a stored selection by roundId", () => {
    saveJudgeParadigmSelection(ROUND_1_BUILTIN);
    saveJudgeParadigmSelection(ROUND_2_CUSTOM);
    deleteJudgeParadigmSelection("round-1");

    expect(listJudgeParadigmSelections()).toEqual([ROUND_2_CUSTOM]);
    expect(getJudgeParadigmSelection("round-1")).toBeUndefined();
  });

  it("is a no-op when the roundId isn't stored", () => {
    saveJudgeParadigmSelection(ROUND_2_CUSTOM);
    deleteJudgeParadigmSelection("missing");
    expect(listJudgeParadigmSelections()).toEqual([ROUND_2_CUSTOM]);
  });
});

describe("buildJudgeParadigmSelectionsPanelView", () => {
  it("returns an empty view when nothing is stored", () => {
    expect(buildJudgeParadigmSelectionsPanelView()).toEqual([]);
  });

  it("sorts every persisted selection by roundId", () => {
    saveJudgeParadigmSelection(ROUND_2_CUSTOM);
    saveJudgeParadigmSelection(ROUND_1_BUILTIN);

    expect(buildJudgeParadigmSelectionsPanelView()).toEqual([ROUND_1_BUILTIN, ROUND_2_CUSTOM]);
  });

  it("does not mutate the underlying stored order", () => {
    saveJudgeParadigmSelection(ROUND_2_CUSTOM);
    saveJudgeParadigmSelection(ROUND_1_BUILTIN);

    buildJudgeParadigmSelectionsPanelView();

    expect(listJudgeParadigmSelections()).toEqual([ROUND_2_CUSTOM, ROUND_1_BUILTIN]);
  });
});
