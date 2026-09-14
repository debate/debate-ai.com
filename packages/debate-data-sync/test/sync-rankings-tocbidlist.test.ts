import { beforeEach, describe, expect, it, vi } from "vitest";

const grabMock = vi.fn();

vi.mock("grab-url", () => ({
  default: (...args: unknown[]) => grabMock(...args),
}));

const { scrapeToc, scrapeVCX, scrapeVLD, scrapeVPF } = await import(
  "../src/rankings/sync-rankings-tocbidlist"
);

const row = (over: Record<string, unknown> = {}) => ({
  rank: 1,
  schoolOrTeam: "Strake Jesuit MS",
  totalScore: 42,
  bids: 3,
  students: "Mira Sen & Sam Ng",
  state: "TX",
  hasDetails: false,
  ...over,
});

describe("scrapeToc", () => {
  beforeEach(() => {
    grabMock.mockReset();
  });

  it("requests the enriched-leaderboard endpoint for the event", async () => {
    grabMock.mockResolvedValue({ rows: [] });

    await scrapeToc("PF");

    const [url, options] = grabMock.mock.calls[0];
    expect(url).toBe(
      "https://tocbidlist.com/api/enriched-leaderboard?event=PF",
    );
    expect(options.headers).toEqual({ Accept: "application/json" });
    expect(options.timeout).toBe(20);
  });

  it("opts out of grab's path-keyed request cancellation", async () => {
    // On by default in grab, and wrong on the server: two concurrent visitors
    // asking for the same division would cancel each other's fetch.
    grabMock.mockResolvedValue({ rows: [] });

    await scrapeToc("PF");

    expect(grabMock.mock.calls[0][1].cancelOngoingIfNew).toBe(false);
  });

  it("maps API rows onto leaderboard entries", async () => {
    grabMock.mockResolvedValue({ rows: [row()] });

    const [entry] = await scrapeToc("PF");

    expect(entry).toMatchObject({
      rank: 1,
      teamName: "Strake Jesuit MS",
      tocScore: 42,
      bids: 3,
      students: "Mira Sen & Sam Ng",
      state: "TX",
    });
    expect(entry.details).toBeUndefined();
  });

  it("keeps the tournament breakdown when the row carries one", async () => {
    grabMock.mockResolvedValue({
      rows: [
        row({
          hasDetails: true,
          details: [
            {
              tournament: "Glenbrooks",
              placement: "Octafinalist",
              placementNormalized: "octas",
              bidTier: "Octas",
              score: 12,
            },
          ],
        }),
      ],
    });

    const [entry] = await scrapeToc("PF");

    expect(entry.details).toEqual([
      {
        tournament: "Glenbrooks",
        placement: "Octafinalist",
        placementNormalized: "octas",
        bidTier: "Octas",
        score: 12,
      },
    ]);
  });

  it("drops a details array the row does not flag as present", async () => {
    grabMock.mockResolvedValue({
      rows: [row({ hasDetails: false, details: [{ tournament: "Glenbrooks" }] })],
    });

    const [entry] = await scrapeToc("PF");

    expect(entry.details).toBeUndefined();
  });

  it("sorts by numeric rank, sending unrankable rows to the back", async () => {
    grabMock.mockResolvedValue({
      rows: [
        row({ rank: 3, schoolOrTeam: "C" }),
        row({ rank: "—", schoolOrTeam: "Unranked" }),
        row({ rank: 1, schoolOrTeam: "A" }),
      ],
    });

    const entries = await scrapeToc("PF");

    expect(entries.map((e) => e.teamName)).toEqual(["A", "C", "Unranked"]);
  });

  it("reads rows from `.data` when grab does not lift them to the root", async () => {
    grabMock.mockResolvedValue({ data: { rows: [row()] } });

    const entries = await scrapeToc("PF");

    expect(entries).toHaveLength(1);
  });

  it("throws when grab reports a failed request", async () => {
    // grab resolves with `.error` rather than rejecting, so an unchecked
    // result would have looked like a successful empty response.
    grabMock.mockResolvedValue({ error: "503 Service Unavailable" });

    await expect(scrapeToc("CX")).rejects.toThrow(
      /TOC API request failed for CX: 503 Service Unavailable/,
    );
  });

  it("throws when the payload has no rows array", async () => {
    grabMock.mockResolvedValue({ leaderboard: [] });

    await expect(scrapeToc("LD")).rejects.toThrow(
      /Invalid TOC API response for LD/,
    );
  });

  it("throws rather than returning empty when the body is not an object", async () => {
    grabMock.mockResolvedValue(undefined);

    await expect(scrapeToc("PF")).rejects.toThrow(/Invalid TOC API response/);
  });
});

describe("division helpers", () => {
  beforeEach(() => {
    grabMock.mockReset();
    grabMock.mockResolvedValue({ rows: [] });
  });

  it.each([
    [scrapeVCX, "CX"],
    [scrapeVPF, "PF"],
    [scrapeVLD, "LD"],
  ])("maps its division onto the right event code", async (scrape, event) => {
    await scrape();

    expect(grabMock.mock.calls[0][0]).toContain(`event=${event}`);
  });
});
