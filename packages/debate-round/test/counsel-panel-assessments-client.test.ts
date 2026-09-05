import { afterEach, describe, expect, it } from "vitest";
import {
  deleteSavedCounselPanelAssessmentFromAccount,
  listSavedCounselPanelAssessments,
  saveCounselPanelAssessmentToAccount,
} from "../src/flow/counsel-panel-assessments-client";
import type { CounselPanelAssessmentRecord } from "../src/state/counselPanelAssessments";
import { mockFetchError, mockFetchJson } from "./helpers/mock-api-fetch";
import { vi } from "vitest";

const RECORD: CounselPanelAssessmentRecord = {
  id: "counsel-1700000000000-ab12cd",
  roundId: "round-1",
  result: {
    argumentAssessments: [
      {
        rowIndex: 0,
        counselRole: "Policy Counsel",
        likelyResponsePath: "Negative reads a solvency deficit.",
        clashEstimate: "Clash on mechanism feasibility.",
      },
    ],
    overallClashSummary: "Clash concentrates on solvency.",
  },
  generatedAt: 1700000000000,
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("listSavedCounselPanelAssessments", () => {
  it("GETs the endpoint and returns the parsed record list", async () => {
    const fetchMock = mockFetchJson([RECORD]);

    const result = await listSavedCounselPanelAssessments();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/counsel-panel-assessments", expect.anything());
  });

  it("returns null on a 401 rather than throwing", async () => {
    mockFetchError(401, "Unauthorized");

    expect(await listSavedCounselPanelAssessments()).toBeNull();
  });

  it("throws on another failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(listSavedCounselPanelAssessments()).rejects.toThrow("Failed to load your synced counsel-panel assessments.");
  });
});

describe("saveCounselPanelAssessmentToAccount", () => {
  it("PUTs to the record's id-keyed endpoint", async () => {
    const fetchMock = mockFetchJson({});

    await saveCounselPanelAssessmentToAccount(RECORD);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/counsel-panel-assessments/counsel-1700000000000-ab12cd");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ record: RECORD });
  });

  it("throws on failure", async () => {
    mockFetchError(400, "Bad Request");

    await expect(saveCounselPanelAssessmentToAccount(RECORD)).rejects.toThrow(
      "Failed to sync this counsel-panel assessment to your account.",
    );
  });
});

describe("deleteSavedCounselPanelAssessmentFromAccount", () => {
  it("DELETEs the id-keyed endpoint, URI-encoded", async () => {
    const fetchMock = mockFetchJson({});

    await deleteSavedCounselPanelAssessmentFromAccount("counsel with spaces");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/counsel-panel-assessments/counsel%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws on failure", async () => {
    mockFetchError(500, "Internal Server Error");

    await expect(deleteSavedCounselPanelAssessmentFromAccount("counsel-1")).rejects.toThrow(
      "Failed to remove this synced counsel-panel assessment.",
    );
  });
});
