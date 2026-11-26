import { beforeEach, describe, expect, it, vi } from "vitest";

const rankings = vi.hoisted(() => ({
  getRankingDatasetInfo: vi.fn(),
  loadRankingDataset: vi.fn(),
}));

vi.mock("@debate-ai/rankings", () => rankings);

import { currentRating, findRatedTeam, rankedTeams } from "../../../src/lib/predictions/ratings";

const info = (id: string, label: string, scope?: string) => ({ id, label, scope });
const entries = [
  { hash: "ABC123", name: "Harker LL", school: "Harker", rating: 1710, rank: 1 },
  { hash: "def456", name: "Dartmouth KS", school: "Dartmouth", rating: 1650, rank: 2 },
];

beforeEach(() => {
  vi.resetAllMocks();
  rankings.getRankingDatasetInfo.mockImplementation((id: string) =>
    id === "cpd-2025" ? info("cpd-2025", "CPD", "college") : id === "plain" ? info("plain", "Plain") : null,
  );
});

describe("findRatedTeam", () => {
  it("returns null for an unknown dataset without loading anything", async () => {
    expect(await findRatedTeam("nope", "abc123")).toBeNull();
    expect(rankings.loadRankingDataset).not.toHaveBeenCalled();
  });

  it("finds a team by hash regardless of case and lowercases the hash it returns", async () => {
    rankings.loadRankingDataset.mockResolvedValue({ entries });
    expect(await findRatedTeam("cpd-2025", "abc123")).toEqual({
      dataset: "cpd-2025",
      datasetLabel: "CPD (college)",
      hash: "abc123",
      name: "Harker LL",
      school: "Harker",
      rating: 1710,
    });
  });

  it("labels a dataset without a scope by its name alone", async () => {
    rankings.loadRankingDataset.mockResolvedValue({ entries });
    expect((await findRatedTeam("plain", "DEF456"))?.datasetLabel).toBe("Plain");
  });

  it("returns null for a team that is no longer ranked", async () => {
    rankings.loadRankingDataset.mockResolvedValue({ entries });
    expect(await findRatedTeam("cpd-2025", "ffffff")).toBeNull();
  });

  it("loads each dataset once and reuses it", async () => {
    rankings.getRankingDatasetInfo.mockImplementation((id: string) => info(id, id));
    rankings.loadRankingDataset.mockResolvedValue({ entries });
    await findRatedTeam("reused", "abc123");
    await findRatedTeam("reused", "def456");
    await rankedTeams("reused");
    expect(rankings.loadRankingDataset).toHaveBeenCalledTimes(1);
  });

  it("does not cache a failed load, so the next read retries", async () => {
    rankings.getRankingDatasetInfo.mockImplementation((id: string) => info(id, id));
    rankings.loadRankingDataset.mockRejectedValueOnce(new Error("boom")).mockResolvedValue({ entries });
    await expect(findRatedTeam("flaky", "abc123")).rejects.toThrow("boom");
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect((await findRatedTeam("flaky", "abc123"))?.name).toBe("Harker LL");
    expect(rankings.loadRankingDataset).toHaveBeenCalledTimes(2);
  });
});

describe("currentRating", () => {
  it("returns the rating, or null when the team left the rankings or the dataset is unknown", async () => {
    rankings.loadRankingDataset.mockResolvedValue({ entries });
    expect(await currentRating("cpd-2025", "def456")).toBe(1650);
    expect(await currentRating("cpd-2025", "missing")).toBeNull();
    expect(await currentRating("nope", "def456")).toBeNull();
  });
});

describe("rankedTeams", () => {
  it("is empty for an unknown dataset", async () => {
    expect(await rankedTeams("nope")).toEqual([]);
  });

  it("maps every entry to a preset team with a lowercase hash", async () => {
    rankings.loadRankingDataset.mockResolvedValue({ entries });
    expect(await rankedTeams("cpd-2025")).toEqual([
      { hash: "abc123", name: "Harker LL", school: "Harker", rating: 1710, rank: 1 },
      { hash: "def456", name: "Dartmouth KS", school: "Dartmouth", rating: 1650, rank: 2 },
    ]);
  });
});
