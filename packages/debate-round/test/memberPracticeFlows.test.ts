import { beforeEach, describe, expect, it } from "vitest";
import {
  buildMemberPracticeFlowsForRoster,
  deleteMemberPracticeFlow,
  getMemberPracticeFlow,
  listMemberPracticeFlows,
  resolveFlowForRound,
  saveMemberPracticeFlow,
  type MemberPracticeFlowRecord,
} from "../src/state/memberPracticeFlows";
import type { Box, Flow, Round } from "debate-core/src/types/flow";

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

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
  (globalThis as unknown as { localStorage: MemoryStorage }).localStorage = storage;
});

function row(content: string): Box {
  return { content, children: [], index: 0, level: 1, focus: false };
}

const ROUND: Round = {
  id: 42,
  tournamentName: "Glenbrooks",
  roundLevel: "Octos",
  debaters: { aff: ["A1", "A2"], neg: ["N1", "N2"] },
  judges: [],
  flowIds: [100],
  timestamp: 0,
  status: "completed",
};

const FLOWED_FLOW: Flow = {
  content: "",
  level: 0,
  columns: ["1AC", "1NC"],
  invert: false,
  focus: false,
  index: 0,
  lastFocus: [],
  children: [row("Case advantage"), row("Solvency")],
  id: 100,
};

const STARTER_FLOW: Flow = {
  content: "",
  level: 0,
  columns: ["1AC", "1NC"],
  invert: false,
  focus: false,
  index: 1,
  lastFocus: [],
  children: [],
  id: 101,
};

const RECORD: MemberPracticeFlowRecord = { contributorId: "alice", roundId: 42, sideKey: "A" };

describe("member practice flow CRUD", () => {
  it("returns an empty list when nothing is stored", () => {
    expect(listMemberPracticeFlows()).toEqual([]);
    expect(getMemberPracticeFlow("alice")).toBeUndefined();
  });

  it("returns an empty list for corrupt storage", () => {
    storage.setItem("memberPracticeFlows", "not json");
    expect(listMemberPracticeFlows()).toEqual([]);
  });

  it("returns an empty list when storage holds a non-array value", () => {
    storage.setItem("memberPracticeFlows", JSON.stringify({ not: "an array" }));
    expect(listMemberPracticeFlows()).toEqual([]);
  });

  it("saves and looks up a contributor's registered round", () => {
    saveMemberPracticeFlow(RECORD);
    expect(getMemberPracticeFlow("alice")).toEqual(RECORD);
    expect(listMemberPracticeFlows()).toEqual([RECORD]);
  });

  it("replaces a contributor's existing registration rather than duplicating it", () => {
    saveMemberPracticeFlow(RECORD);
    saveMemberPracticeFlow({ contributorId: "alice", roundId: 99, sideKey: "N" });
    expect(listMemberPracticeFlows()).toEqual([{ contributorId: "alice", roundId: 99, sideKey: "N" }]);
  });

  it("deletes a contributor's registration", () => {
    saveMemberPracticeFlow(RECORD);
    deleteMemberPracticeFlow("alice");
    expect(listMemberPracticeFlows()).toEqual([]);
  });

  it("deleting an unregistered contributor is a no-op", () => {
    saveMemberPracticeFlow(RECORD);
    deleteMemberPracticeFlow("bob");
    expect(listMemberPracticeFlows()).toEqual([RECORD]);
  });
});

describe("resolveFlowForRound", () => {
  it("returns undefined when the round isn't stored", () => {
    expect(resolveFlowForRound(42)).toBeUndefined();
  });

  it("returns undefined when the round is stored but none of its flows are", () => {
    storage.setItem("rounds", JSON.stringify([ROUND]));
    expect(resolveFlowForRound(42)).toBeUndefined();
  });

  it("resolves the round's actual flowed content", () => {
    storage.setItem("rounds", JSON.stringify([ROUND]));
    storage.setItem("flows", JSON.stringify([FLOWED_FLOW]));
    expect(resolveFlowForRound(42)).toEqual({ columns: FLOWED_FLOW.columns, children: FLOWED_FLOW.children });
  });

  it("prefers the flow with the most flowed content when a round has more than one", () => {
    const round: Round = { ...ROUND, flowIds: [100, 101] };
    storage.setItem("rounds", JSON.stringify([round]));
    storage.setItem("flows", JSON.stringify([STARTER_FLOW, FLOWED_FLOW]));
    expect(resolveFlowForRound(42)?.children).toEqual(FLOWED_FLOW.children);
  });
});

describe("buildMemberPracticeFlowsForRoster", () => {
  it("returns an empty list when nothing is registered", () => {
    expect(buildMemberPracticeFlowsForRoster(["alice", "bob"])).toEqual([]);
  });

  it("resolves a registered, flowed round into a real drill-ready CoachingProgramMemberFlow", () => {
    storage.setItem("rounds", JSON.stringify([ROUND]));
    storage.setItem("flows", JSON.stringify([FLOWED_FLOW]));
    saveMemberPracticeFlow(RECORD);

    const flows = buildMemberPracticeFlowsForRoster(["alice", "bob"]);
    expect(flows).toEqual([
      { contributorId: "alice", sideKey: "A", flow: { columns: FLOWED_FLOW.columns, children: FLOWED_FLOW.children } },
    ]);
  });

  it("skips a registration for a contributor outside the roster", () => {
    storage.setItem("rounds", JSON.stringify([ROUND]));
    storage.setItem("flows", JSON.stringify([FLOWED_FLOW]));
    saveMemberPracticeFlow(RECORD);

    expect(buildMemberPracticeFlowsForRoster(["bob"])).toEqual([]);
  });

  it("skips a registration whose round can't be resolved", () => {
    saveMemberPracticeFlow(RECORD);
    expect(buildMemberPracticeFlowsForRoster(["alice"])).toEqual([]);
  });

  it("sorts resolved flows by contributorId", () => {
    storage.setItem("rounds", JSON.stringify([ROUND, { ...ROUND, id: 43, flowIds: [102] }]));
    storage.setItem(
      "flows",
      JSON.stringify([FLOWED_FLOW, { ...FLOWED_FLOW, id: 102, children: [row("Topicality")] }]),
    );
    saveMemberPracticeFlow({ contributorId: "zed", roundId: 42, sideKey: "A" });
    saveMemberPracticeFlow({ contributorId: "alice", roundId: 43, sideKey: "N" });

    const flows = buildMemberPracticeFlowsForRoster(["zed", "alice"]);
    expect(flows.map((flow) => flow.contributorId)).toEqual(["alice", "zed"]);
  });
});
