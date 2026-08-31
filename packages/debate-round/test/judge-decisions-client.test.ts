import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedJudgeDecisionFromAccount,
  listSavedJudgeDecisions,
  saveJudgeDecisionToAccount,
} from "../src/round/judge-decisions-client";
import type { JudgeDecisionRecord } from "../src/state/judgeDecisions";

const RECORD: JudgeDecisionRecord = {
  id: "decision-1700000000000-ab12cd",
  roundId: "round-1",
  paradigmName: "Flow / Tech Judge",
  sideNames: { primary: "Affirmative", secondary: "Negative" },
  result: {
    winner: "primary",
    keyVotingIssues: ["Dropped disadvantage"],
    rationale: "The negative dropped a key disadvantage.",
  },
  generatedAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedJudgeDecisions", () => {
  it("GETs the endpoint and returns the parsed record list", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [RECORD],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSavedJudgeDecisions();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/judge-decisions");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listSavedJudgeDecisions()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedJudgeDecisions()).rejects.toThrow("Something broke.");
  });
});

describe("saveJudgeDecisionToAccount", () => {
  it("PUTs to the record's id-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveJudgeDecisionToAccount(RECORD);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/judge-decisions/decision-1700000000000-ab12cd");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ record: RECORD });
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: "Invalid record." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveJudgeDecisionToAccount(RECORD)).rejects.toThrow("Invalid record.");
  });
});

describe("deleteSavedJudgeDecisionFromAccount", () => {
  it("DELETEs the id-keyed endpoint, URI-encoded", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteSavedJudgeDecisionFromAccount("decision with spaces");

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/judge-decisions/decision%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Delete failed." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSavedJudgeDecisionFromAccount("decision-1")).rejects.toThrow("Delete failed.");
  });
});
