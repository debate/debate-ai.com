import { afterEach, describe, expect, it, vi } from "vitest";
import {
  deleteSavedCounselPanelAssessmentFromAccount,
  listSavedCounselPanelAssessments,
  saveCounselPanelAssessmentToAccount,
} from "../src/flow/counsel-panel-assessments-client";
import type { CounselPanelAssessmentRecord } from "../src/state/counselPanelAssessments";

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
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => [RECORD],
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await listSavedCounselPanelAssessments();

    expect(result).toEqual([RECORD]);
    expect(fetchMock).toHaveBeenCalledWith("/api/counsel-panel-assessments");
  });

  it("returns null on a 401 rather than throwing", async () => {
    const fetchMock = vi.fn(async () => ({ ok: false, status: 401 })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await listSavedCounselPanelAssessments()).toBeNull();
  });

  it("throws the server's error message on another failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Something broke." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(listSavedCounselPanelAssessments()).rejects.toThrow("Something broke.");
  });
});

describe("saveCounselPanelAssessmentToAccount", () => {
  it("PUTs to the record's id-keyed endpoint", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await saveCounselPanelAssessmentToAccount(RECORD);

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/counsel-panel-assessments/counsel-1700000000000-ab12cd");
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

    await expect(saveCounselPanelAssessmentToAccount(RECORD)).rejects.toThrow("Invalid record.");
  });
});

describe("deleteSavedCounselPanelAssessmentFromAccount", () => {
  it("DELETEs the id-keyed endpoint, URI-encoded", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await deleteSavedCounselPanelAssessmentFromAccount("counsel with spaces");

    const [endpoint, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(endpoint).toBe("/api/counsel-panel-assessments/counsel%20with%20spaces");
    expect((init as RequestInit).method).toBe("DELETE");
  });

  it("throws the server's error message on failure", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Delete failed." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(deleteSavedCounselPanelAssessmentFromAccount("counsel-1")).rejects.toThrow("Delete failed.");
  });
});
