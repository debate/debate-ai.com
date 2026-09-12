import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const scrapeDivision = vi.fn();
const getDatasets = vi.fn();
const scrapeVCX = vi.fn();
const scrapeVPF = vi.fn();
const scrapeVLD = vi.fn();

vi.mock("debate-data-sync/src/rankings/sync-rankings-debatedrills", () => ({
  scrapeDivision: (...args: unknown[]) => scrapeDivision(...args),
  getDatasets: (...args: unknown[]) => getDatasets(...args),
}));

vi.mock("debate-data-sync/src/rankings/sync-rankings-tocbidlist", () => ({
  scrapeVCX: () => scrapeVCX(),
  scrapeVPF: () => scrapeVPF(),
  scrapeVLD: () => scrapeVLD(),
}));

const { resolveLeaderboard } = await import("../resolve");

const PF_DATASET = { division: "VPF", url: "https://example.test/pf.csv" };
const LD_DATASET = { division: "VLD", url: "https://example.test/ld.csv" };

const tocRow = (over: Record<string, unknown> = {}) => ({
  rank: 1,
  teamName: "Strake Jesuit MS",
  tocScore: 42,
  bids: 3,
  ...over,
});

const eloRow = (over: Record<string, unknown> = {}) => ({
  rank: 4,
  teamName: "Strake Jesuit MS",
  debateElo: 1712,
  eloRank: 4,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  getDatasets.mockReturnValue([PF_DATASET, LD_DATASET]);
  // Upstream failures are logged deliberately; keep the test output readable.
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("resolveLeaderboard — current season", () => {
  it("merges Elo onto the bid list when both sources answer", async () => {
    scrapeVPF.mockResolvedValue([tocRow()]);
    scrapeDivision.mockResolvedValue([eloRow()]);

    const result = await resolveLeaderboard("VPF", "2026");

    expect(result.status).toBe(200);
    expect(result).toMatchObject({
      rows: [expect.objectContaining({ tocScore: 42, debateElo: 1712 })],
    });
  });

  it("serves the bid list alone when DebateDrills is down", async () => {
    scrapeVPF.mockResolvedValue([tocRow()]);
    scrapeDivision.mockRejectedValue(new Error("drills 500"));

    const result = await resolveLeaderboard("VPF", "2026");

    expect(result.status).toBe(200);
    expect(result).toMatchObject({ rows: [expect.objectContaining({ tocScore: 42 })] });
  });

  it("falls back to Elo-only rows when the bid list is down", async () => {
    // The regression this guards: one dead upstream used to 502/500 the whole
    // panel even though the other source had perfectly good rows.
    scrapeVPF.mockRejectedValue(new Error("tocbidlist unreachable"));
    scrapeDivision.mockResolvedValue([eloRow()]);

    const result = await resolveLeaderboard("VPF", "2026");

    expect(result.status).toBe(200);
    expect(result).toMatchObject({ rows: [expect.objectContaining({ debateElo: 1712 })] });
  });

  it("reports 502 when neither source answers", async () => {
    scrapeVPF.mockRejectedValue(new Error("tocbidlist unreachable"));
    scrapeDivision.mockRejectedValue(new Error("drills 500"));

    const result = await resolveLeaderboard("VPF", "2026");

    expect(result.status).toBe(502);
    expect(result).toMatchObject({
      error: "Leaderboard data is temporarily unavailable",
      details: expect.stringContaining("VPF"),
    });
  });

  it("reports 502 rather than 200 when the bid list dies and Elo is empty", async () => {
    scrapeVPF.mockRejectedValue(new Error("tocbidlist unreachable"));
    scrapeDivision.mockResolvedValue([]);

    const result = await resolveLeaderboard("VPF", "2026");

    expect(result.status).toBe(502);
  });

  it("logs the upstream failure so it is diagnosable in Workers Logs", async () => {
    scrapeVPF.mockRejectedValue(new Error("tocbidlist unreachable"));
    scrapeDivision.mockResolvedValue([eloRow()]);

    await resolveLeaderboard("VPF", "2026");

    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining("TOC bid list scrape failed for VPF"),
      "tocbidlist unreachable",
    );
  });

  it("never asks DebateDrills for a division it has no dataset for", async () => {
    scrapeVCX.mockResolvedValue([tocRow({ teamName: "Westminster BK" })]);

    const result = await resolveLeaderboard("VCX", "2026");

    expect(result.status).toBe(200);
    expect(scrapeDivision).not.toHaveBeenCalled();
  });

  it("502s for CX when the bid list is down, since it has no Elo fallback", async () => {
    scrapeVCX.mockRejectedValue(new Error("tocbidlist unreachable"));

    const result = await resolveLeaderboard("VCX", "2026");

    expect(result.status).toBe(502);
  });

  it("rejects an unknown division with 400", async () => {
    const result = await resolveLeaderboard("VNDT", "2026");

    expect(result.status).toBe(400);
    expect(result).toMatchObject({ error: "Invalid division" });
    expect(scrapeVPF).not.toHaveBeenCalled();
  });

  it("queries the two upstreams concurrently, not one after the other", async () => {
    const order: string[] = [];
    scrapeVPF.mockImplementation(async () => {
      order.push("toc:start");
      await new Promise((r) => setTimeout(r, 10));
      order.push("toc:end");
      return [tocRow()];
    });
    scrapeDivision.mockImplementation(async () => {
      order.push("elo:start");
      return [eloRow()];
    });

    await resolveLeaderboard("VPF", "2026");

    // Elo starts before the slower TOC request has finished.
    expect(order.indexOf("elo:start")).toBeLessThan(order.indexOf("toc:end"));
  });
});

describe("resolveLeaderboard — prior seasons", () => {
  it("serves DebateDrills rows without touching the bid list", async () => {
    scrapeDivision.mockResolvedValue([eloRow()]);

    const result = await resolveLeaderboard("VLD", "2024");

    expect(result.status).toBe(200);
    expect(scrapeVLD).not.toHaveBeenCalled();
    expect(getDatasets).toHaveBeenCalledWith("2024");
  });

  it("returns an empty list for divisions with no historical dataset", async () => {
    const result = await resolveLeaderboard("VCX", "2024");

    expect(result).toEqual({ status: 200, rows: [] });
    expect(scrapeDivision).not.toHaveBeenCalled();
  });

  it("502s when the historical source fails", async () => {
    scrapeDivision.mockRejectedValue(new Error("raw.githubusercontent 404"));

    const result = await resolveLeaderboard("VPF", "2023");

    expect(result.status).toBe(502);
  });

  it("502s without a fetch when the year has no dataset config", async () => {
    getDatasets.mockReturnValue([]);

    const result = await resolveLeaderboard("VPF", "2021");

    expect(result.status).toBe(502);
    expect(scrapeDivision).not.toHaveBeenCalled();
  });
});
