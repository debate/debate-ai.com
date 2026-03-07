import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("axios", () => ({
  default: {
    get: vi.fn(),
  },
}));

import axios from "axios";
import { scrapeToc } from "../lib/third-party-sync/sync-rankings-tocbidlist";

const axiosGetMock = vi.mocked(axios.get);

describe("sync-rankings-tocbidlist", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("parses row data and retains sorted ranks", async () => {
    axiosGetMock.mockResolvedValueOnce({
      data: {
        rows: [
          {
            rank: 5,
            schoolOrTeam: "Gamma",
            totalScore: 50,
            bids: 1,
            students: "A & B",
            state: "CA",
          },
          {
            rank: 2,
            schoolOrTeam: "Alpha",
            totalScore: 90,
            bids: 2,
            students: "X & Y",
            state: "NY",
            hasDetails: true,
            details: [
              {
                tournament: "Eagles",
                placement: "1st",
                placementNormalized: "1",
                bidTier: "Bid Tier 1",
                score: 95,
              },
            ],
          },
        ],
      },
    });

    const entries = await scrapeToc("PF");
    expect(entries[0].rank).toBe(2);
    expect(entries[0].teamName).toBe("Alpha");
    expect(entries[0].details).toHaveLength(1);
    expect(entries[1].rank).toBe(5);
  });

  it("throws when the API response is malformed", async () => {
    axiosGetMock.mockResolvedValueOnce({ data: {} });
    await expect(scrapeToc("LD")).rejects.toThrow(
      "Invalid TOC API response for LD",
    );
  });
});
