import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedJudgeDecisionFromAccount,
  listSavedJudgeDecisions,
  saveJudgeDecisionToAccount,
} from "../src/round/judge-decisions-client";
import type { JudgeDecisionRecord } from "../src/state/judgeDecisions";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";

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
    const fetchMock = mockFetchJson([RECORD]);

    const result = await listSavedJudgeDecisions();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/judge-decisions", expect.anything());
  });

  it("returns null on a 401 rather than throwing", async () => {
    mockFetchError(401, "Unauthorized");

    expect(await listSavedJudgeDecisions()).toBeNull();
  });

  it("throws on another failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(listSavedJudgeDecisions()).rejects.toThrow("Failed to load your synced judge decisions.");
  });
});

describe("saveJudgeDecisionToAccount", () => {
  it("PUTs to the record's id-keyed endpoint", async () => {
    const fetchMock = mockFetchJson({});

    await saveJudgeDecisionToAccount(RECORD);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/judge-decisions/decision-1700000000000-ab12cd");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ record: RECORD });
  });

  it("throws on failure", async () => {
    mockFetchError(400, "Bad Request");

    await expect(saveJudgeDecisionToAccount(RECORD)).rejects.toThrow(
      "Failed to sync this judge decision to your account.",
    );
  });
});

describe("deleteSavedJudgeDecisionFromAccount", () => {
  it("DELETEs the id-keyed endpoint, URI-encoded", async () => {
    const fetchMock = mockFetchJson({});

    await deleteSavedJudgeDecisionFromAccount("decision with spaces");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/judge-decisions/decision%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws on failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(deleteSavedJudgeDecisionFromAccount("decision-1")).rejects.toThrow(
      "Failed to remove this synced judge decision.",
    );
  });
});
