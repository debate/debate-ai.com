import { beforeEach, describe, expect, it } from "vitest";
import {
  buildAndSaveRoundContributorFlow,
  buildCoachingProgramMemberFlows,
  buildCoachingProgramMemberPracticeRounds,
  deleteRoundContributorFlow,
  getRoundContributorFlow,
  listRoundContributorFlows,
  saveRoundContributorFlow,
} from "../src/state/roundContributorFlows";
import type { RoundContributorFlowRecord } from "../src/state/roundContributorFlows";
import { savePracticeRound, type PracticeRoundRecord } from "../src/state/practiceRounds";
import { buildPracticeRoundSetup } from "../src/round/practice-round-simulator";

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

const ALICE: RoundContributorFlowRecord = {
  contributorId: "alice",
  roundId: "round-1",
  sideKey: "A",
  flow: { columns: ["1AC", "1NC"], children: [] },
};

const BOB: RoundContributorFlowRecord = {
  contributorId: "bob",
  roundId: "round-2",
  sideKey: "N",
  flow: { columns: ["1AC", "1NC"], children: [] },
};

beforeEach(() => {
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = new MemoryStorage();
});

describe("listRoundContributorFlows", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listRoundContributorFlows()).toEqual([]);
  });

  it("returns an empty list when the stored value is corrupt JSON", () => {
    localStorage.setItem("roundContributorFlows", "{not json");
    expect(listRoundContributorFlows()).toEqual([]);
  });

  it("returns an empty list when the stored value isn't an array", () => {
    localStorage.setItem("roundContributorFlows", JSON.stringify({ not: "an array" }));
    expect(listRoundContributorFlows()).toEqual([]);
  });

  it("lists every saved record", () => {
    saveRoundContributorFlow(ALICE);
    saveRoundContributorFlow(BOB);
    expect(listRoundContributorFlows()).toEqual([ALICE, BOB]);
  });
});

describe("getRoundContributorFlow", () => {
  it("finds a saved record by contributorId", () => {
    saveRoundContributorFlow(ALICE);
    expect(getRoundContributorFlow("alice")).toEqual(ALICE);
  });

  it("returns undefined for a contributorId that isn't stored", () => {
    expect(getRoundContributorFlow("missing")).toBeUndefined();
  });
});

describe("saveRoundContributorFlow", () => {
  it("upserts — saving an existing contributorId overwrites rather than duplicating it", () => {
    saveRoundContributorFlow(ALICE);
    const revised: RoundContributorFlowRecord = { ...ALICE, roundId: "round-3", sideKey: "N" };
    saveRoundContributorFlow(revised);

    expect(listRoundContributorFlows()).toEqual([revised]);
    expect(getRoundContributorFlow("alice")).toEqual(revised);
  });
});

describe("deleteRoundContributorFlow", () => {
  it("removes a stored record by contributorId", () => {
    saveRoundContributorFlow(ALICE);
    saveRoundContributorFlow(BOB);
    deleteRoundContributorFlow("alice");

    expect(listRoundContributorFlows()).toEqual([BOB]);
    expect(getRoundContributorFlow("alice")).toBeUndefined();
  });

  it("is a no-op when the contributorId isn't stored", () => {
    saveRoundContributorFlow(BOB);
    deleteRoundContributorFlow("missing");
    expect(listRoundContributorFlows()).toEqual([BOB]);
  });
});

describe("buildAndSaveRoundContributorFlow", () => {
  it("builds a record from a flow and persists it", () => {
    const flow = { columns: ["1AC", "1NC"], children: [] };
    const record = buildAndSaveRoundContributorFlow(flow, "round-9", "carol", "A");

    expect(record).toEqual({ contributorId: "carol", roundId: "round-9", sideKey: "A", flow });
    expect(getRoundContributorFlow("carol")).toEqual(record);
  });
});

describe("buildCoachingProgramMemberFlows", () => {
  it("maps every stored record for a given roster to a CoachingProgramMemberFlow", () => {
    saveRoundContributorFlow(ALICE);
    saveRoundContributorFlow(BOB);

    expect(buildCoachingProgramMemberFlows(["alice", "bob"])).toEqual([
      { contributorId: "alice", sideKey: "A", flow: ALICE.flow },
      { contributorId: "bob", sideKey: "N", flow: BOB.flow },
    ]);
  });

  it("excludes a stored record whose contributorId isn't in the given roster", () => {
    saveRoundContributorFlow(ALICE);
    saveRoundContributorFlow(BOB);

    expect(buildCoachingProgramMemberFlows(["alice"])).toEqual([
      { contributorId: "alice", sideKey: "A", flow: ALICE.flow },
    ]);
  });

  it("returns an empty list when no roster member has a recorded flow", () => {
    expect(buildCoachingProgramMemberFlows(["alice", "bob"])).toEqual([]);
  });
});

describe("buildCoachingProgramMemberPracticeRounds", () => {
  const SETUP = buildPracticeRoundSetup({ styleKey: "lincolnDouglas", judgeParadigm: "lay" });

  it("joins a roster member's recorded roundId to its persisted PracticeRoundRecord", () => {
    saveRoundContributorFlow(ALICE);
    const record: PracticeRoundRecord = { roundId: ALICE.roundId, setup: SETUP };
    savePracticeRound(record);

    expect(buildCoachingProgramMemberPracticeRounds(["alice", "bob"])).toEqual([
      { contributorId: "alice", setup: SETUP, feedback: undefined },
    ]);
  });

  it("excludes a stored flow whose contributorId isn't in the given roster", () => {
    saveRoundContributorFlow(ALICE);
    savePracticeRound({ roundId: ALICE.roundId, setup: SETUP });

    expect(buildCoachingProgramMemberPracticeRounds(["bob"])).toEqual([]);
  });

  it("excludes a roster member whose recorded round has no persisted PracticeRoundRecord", () => {
    saveRoundContributorFlow(ALICE);
    expect(buildCoachingProgramMemberPracticeRounds(["alice"])).toEqual([]);
  });

  it("includes feedback once the practice round's PracticeRoundRecord has it", () => {
    saveRoundContributorFlow(ALICE);
    const feedback = { judgeParadigm: SETUP.judgeParadigm, coachingPrompts: [], sections: [] };
    savePracticeRound({ roundId: ALICE.roundId, setup: SETUP, feedback });

    expect(buildCoachingProgramMemberPracticeRounds(["alice"])).toEqual([
      { contributorId: "alice", setup: SETUP, feedback },
    ]);
  });

  it("returns an empty list when no roster member has a recorded flow", () => {
    expect(buildCoachingProgramMemberPracticeRounds(["alice", "bob"])).toEqual([]);
  });
});
