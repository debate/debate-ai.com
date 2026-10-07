// @vitest-environment jsdom
/**
 * @fileoverview `useCounselPanelAssessments` — local-first counsel-panel
 * history: the once-per-page-load account merge by id, best-effort pushes
 * (including deletes for entries trimmed past the per-round cap), and the
 * cross-tab `storage` refresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CounselPanelAiResult } from "../src/flow/response-outcome-ai";
import {
  MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND,
  type CounselPanelAssessmentRecord,
} from "../src/state/counselPanelAssessments";
import { flush } from "./helpers/mount";
import { renderHook, type RenderedHook } from "./helpers/render-hook";

const client = vi.hoisted(() => ({
  listSavedCounselPanelAssessments: vi.fn<() => Promise<CounselPanelAssessmentRecord[] | null>>(),
  saveCounselPanelAssessmentToAccount: vi.fn<(record: CounselPanelAssessmentRecord) => Promise<void>>(),
  deleteSavedCounselPanelAssessmentFromAccount: vi.fn<(id: string) => Promise<void>>(),
}));
const listOverride = vi.hoisted(() => ({
  current: null as null | (() => Promise<CounselPanelAssessmentRecord[] | null>),
}));
vi.mock("../src/flow/counsel-panel-assessments-client", () => ({
  ...client,
  // A plain rejecting function rather than a rejecting `vi.fn` result,
  // which Vitest reports as a test error even once the hook has caught it.
  listSavedCounselPanelAssessments: () =>
    listOverride.current ? listOverride.current() : client.listSavedCounselPanelAssessments(),
}));

const RESULT: CounselPanelAiResult = {
  argumentAssessments: [
    {
      rowIndex: 0,
      counselRole: "Policy Counsel",
      likelyResponsePath: "Negative reads a solvency deficit.",
      clashEstimate: "Clash on mechanism feasibility.",
    },
  ],
  overallClashSummary: "Clash concentrates on solvency.",
};

type Hook = typeof import("../src/hooks/useCounselPanelAssessments");
type State = typeof import("../src/state/counselPanelAssessments");

let hookModule: Hook;
let state: State;
let rendered: RenderedHook<ReturnType<Hook["useCounselPanelAssessments"]>> | null = null;

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  listOverride.current = null;
  client.saveCounselPanelAssessmentToAccount.mockResolvedValue(undefined);
  client.deleteSavedCounselPanelAssessmentFromAccount.mockResolvedValue(undefined);
  vi.resetModules();
  hookModule = await import("../src/hooks/useCounselPanelAssessments");
  state = await import("../src/state/counselPanelAssessments");
});

afterEach(async () => {
  await rendered?.unmount();
  rendered = null;
});

async function render() {
  rendered = await renderHook(() => hookModule.useCounselPanelAssessments());
  await flush(async () => {});
  return rendered.result;
}

describe("useCounselPanelAssessments signed out", () => {
  beforeEach(() => client.listSavedCounselPanelAssessments.mockResolvedValue(null));

  it("groups local history by round and stays unsynced", async () => {
    state.appendCounselPanelAssessment({ roundId: "round-1", result: RESULT, generatedAt: 1 });
    state.appendCounselPanelAssessment({ roundId: "round-2", result: RESULT, generatedAt: 2 });
    const result = await render();
    expect(result.current.synced).toBe(false);
    expect(result.current.groups?.map((group) => group.roundId).sort()).toEqual(["round-1", "round-2"]);
  });

  it("appends, deletes and clears a round locally only", async () => {
    const result = await render();
    let appended: CounselPanelAssessmentRecord | undefined;
    await flush(() => {
      appended = result.current.appendAssessment("round-1", RESULT);
      result.current.appendAssessment("round-1", RESULT);
    });
    expect(appended?.roundId).toBe("round-1");
    expect(state.listCounselPanelAssessments()).toHaveLength(2);

    await flush(() => result.current.deleteAssessment(appended!.id));
    expect(state.listCounselPanelAssessments()).toHaveLength(1);

    await flush(() => result.current.deleteRoundHistory("round-1"));
    expect(state.listCounselPanelAssessments()).toHaveLength(0);
    expect(client.saveCounselPanelAssessmentToAccount).not.toHaveBeenCalled();
    expect(client.deleteSavedCounselPanelAssessmentFromAccount).not.toHaveBeenCalled();
  });

  it("treats a failing account fetch like being signed out", async () => {
    listOverride.current = () => Promise.reject(new Error("offline"));
    const result = await render();
    expect(result.current.synced).toBe(false);
    expect(result.current.groups).toEqual([]);
  });
});

describe("useCounselPanelAssessments signed in", () => {
  it("adopts remote-only entries and pushes local-only ones", async () => {
    const local = state.appendCounselPanelAssessment({ roundId: "round-1", result: RESULT, generatedAt: 1 }).record;
    const remote: CounselPanelAssessmentRecord = { id: "remote-1", roundId: "round-2", result: RESULT, generatedAt: 2 };
    client.listSavedCounselPanelAssessments.mockResolvedValue([remote]);

    const result = await render();
    expect(result.current.synced).toBe(true);
    expect(state.getCounselPanelAssessment("remote-1")).toEqual(remote);
    expect(client.saveCounselPanelAssessmentToAccount).toHaveBeenCalledWith(local);
  });

  it("deletes trimmed entries from the account when an append overflows the cap", async () => {
    client.listSavedCounselPanelAssessments.mockResolvedValue([]);
    const result = await render();
    await flush(() => {
      for (let i = 0; i < MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND; i++) {
        result.current.appendAssessment("round-1", RESULT);
      }
    });
    client.deleteSavedCounselPanelAssessmentFromAccount.mockClear();

    await flush(() => {
      result.current.appendAssessment("round-1", RESULT);
    });
    expect(state.listCounselPanelAssessments()).toHaveLength(MAX_COUNSEL_PANEL_ASSESSMENTS_PER_ROUND);
    expect(client.deleteSavedCounselPanelAssessmentFromAccount).toHaveBeenCalledTimes(1);
    const trimmedId = client.deleteSavedCounselPanelAssessmentFromAccount.mock.calls[0]![0];
    expect(state.getCounselPanelAssessment(trimmedId)).toBeUndefined();
  });

  it("pushes single deletes and whole-round clears", async () => {
    client.listSavedCounselPanelAssessments.mockResolvedValue([]);
    const result = await render();
    let first: CounselPanelAssessmentRecord | undefined;
    await flush(() => {
      first = result.current.appendAssessment("round-1", RESULT);
      result.current.appendAssessment("round-2", RESULT);
    });

    await flush(() => result.current.deleteAssessment(first!.id));
    expect(client.deleteSavedCounselPanelAssessmentFromAccount).toHaveBeenCalledWith(first!.id);

    const roundTwoId = state.listCounselPanelAssessmentsForRound("round-2")[0]!.id;
    await flush(() => result.current.deleteRoundHistory("round-2"));
    expect(client.deleteSavedCounselPanelAssessmentFromAccount).toHaveBeenCalledWith(roundTwoId);

    client.deleteSavedCounselPanelAssessmentFromAccount.mockClear();
    await flush(() => result.current.deleteRoundHistory("round-2"));
    expect(client.deleteSavedCounselPanelAssessmentFromAccount).not.toHaveBeenCalled();
  });
});

describe("useCounselPanelAssessments live update", () => {
  it("re-reads on another tab's write to the assessments store", async () => {
    client.listSavedCounselPanelAssessments.mockResolvedValue(null);
    const result = await render();
    state.appendCounselPanelAssessment({ roundId: "round-1", result: RESULT, generatedAt: 1 });
    await flush(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "counselPanelAssessments" }));
    });
    expect(result.current.groups).toHaveLength(1);
  });
});
