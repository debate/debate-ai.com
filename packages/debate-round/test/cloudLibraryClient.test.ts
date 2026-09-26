import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchRecentCloudItems } from "../src/state/cloudLibraryClient";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

describe("fetchRecentCloudItems", () => {
  it("merges documents, flows, rounds, word-count rounds, debates, speech outcome runs, drill sets, judge decisions, and counsel-panel assessments from their own endpoints", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/doc/documents") {
        return jsonResponse(200, [{ id: 1, title: "Case Neg", updatedAt: "2026-08-28T00:00:00.000Z" }]);
      }
      if (url === "/api/flows") {
        return jsonResponse(200, [{ clientId: 2, label: "1AC vs Policy K", updatedAt: "2026-08-30T00:00:00.000Z" }]);
      }
      if (url === "/api/rounds") {
        return jsonResponse(200, [{ clientId: 3, label: "Round 4", updatedAt: "2026-08-29T00:00:00.000Z" }]);
      }
      if (url === "/api/word-count-rounds") {
        return jsonResponse(200, [{ roundId: "round-9", updatedAt: Date.parse("2026-08-31T00:00:00.000Z") }]);
      }
      if (url === "/api/vsbot/history") {
        return jsonResponse(200, {
          debates: [{ id: "debate-4", topic: "AI regulation", createdAt: Date.parse("2026-08-27T00:00:00.000Z") / 1000 }],
        });
      }
      if (url === "/api/tool-records/speechOutcomeRuns") {
        return jsonResponse(200, [
          { id: "video-1::1AR::flow", speechKey: "1AR", savedAt: Date.parse("2026-09-01T00:00:00.000Z") },
        ]);
      }
      if (url === "/api/drill-sets") {
        return jsonResponse(200, [{ roundId: "round-9-drills", updatedAt: Date.parse("2026-08-25T00:00:00.000Z") }]);
      }
      if (url === "/api/judge-decisions") {
        return jsonResponse(200, [
          { id: "decision-1", paradigmName: "Flow", generatedAt: Date.parse("2026-09-02T00:00:00.000Z") },
        ]);
      }
      if (url === "/api/counsel-panel-assessments") {
        return jsonResponse(200, [
          { id: "assessment-1", roundId: "round-9", generatedAt: Date.parse("2026-09-03T00:00:00.000Z") },
        ]);
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const items = await fetchRecentCloudItems({ limit: 9 });

    expect(items.map((i) => i.kind)).toEqual([
      "counselPanelAssessment",
      "judgeDecision",
      "speechOutcome",
      "wordCountRound",
      "flow",
      "round",
      "document",
      "debate",
      "drillSet",
    ]);
  });

  it("degrades a signed-out 401 on flows/rounds/word-count-rounds/debates/speech-outcome-runs/drill-sets/judge-decisions/counsel-panel-assessments to no items from that kind, without throwing", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/doc/documents") {
        return jsonResponse(200, [{ id: 1, title: "Case Neg", updatedAt: "2026-08-28T00:00:00.000Z" }]);
      }
      return jsonResponse(401, { error: "Sign in to view your saved items." });
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const items = await fetchRecentCloudItems();

    expect(items).toEqual([
      expect.objectContaining({ kind: "document", key: "document-1" }),
    ]);
  });

  it("degrades a 500 or a network error on any single source instead of rejecting the whole call", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/doc/documents") throw new Error("network error");
      if (url === "/api/flows") return jsonResponse(500, { error: "Something went wrong." });
      if (url === "/api/word-count-rounds") return jsonResponse(500, { error: "Something went wrong." });
      if (url === "/api/vsbot/history") return jsonResponse(500, { error: "Something went wrong." });
      if (url === "/api/tool-records/speechOutcomeRuns") return jsonResponse(500, { error: "Something went wrong." });
      if (url === "/api/drill-sets") return jsonResponse(500, { error: "Something went wrong." });
      if (url === "/api/judge-decisions") return jsonResponse(500, { error: "Something went wrong." });
      if (url === "/api/counsel-panel-assessments") return jsonResponse(500, { error: "Something went wrong." });
      return jsonResponse(200, [{ clientId: 3, label: "Round 4", updatedAt: "2026-08-29T00:00:00.000Z" }]);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(fetchRecentCloudItems()).resolves.toEqual([
      expect.objectContaining({ kind: "round", key: "round-3" }),
    ]);
  });

  it("resolves to an empty list, not a rejection, when every source fails", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network error");
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    await expect(fetchRecentCloudItems()).resolves.toEqual([]);
  });

  it("forwards options (e.g. limit) through to buildRecentCloudItems", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/doc/documents") {
        return jsonResponse(200, [
          { id: 1, title: "Doc A", updatedAt: "2026-08-28T00:00:00.000Z" },
          { id: 2, title: "Doc B", updatedAt: "2026-08-27T00:00:00.000Z" },
        ]);
      }
      return jsonResponse(200, []);
    });
    vi.stubGlobal("fetch", fetchMock as unknown as typeof fetch);

    const items = await fetchRecentCloudItems({ limit: 1 });

    expect(items).toHaveLength(1);
  });
});
