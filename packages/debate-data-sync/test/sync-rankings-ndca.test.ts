import { beforeEach, describe, expect, it, vi } from "vitest";

const grabMock = vi.fn();

vi.mock("grab-url", () => ({
  default: (...args: unknown[]) => grabMock(...args),
}));

vi.mock("linkedom", () => ({
  parseHTML: (html: string) => {
    const doc = {
      querySelector: (_sel: string) => null,
      querySelectorAll: (_sel: string): Element[] => [],
    } as unknown as Document;
    return { document: doc };
  },
}));

const { scrapeNdca } = await import(
  "../src/rankings/sync-rankings-ndca"
);

describe("scrapeNdca", () => {
  beforeEach(() => {
    grabMock.mockReset();
    vi.clearAllMocks();
  });

  it("requests the NDCA standings page", async () => {
    grabMock.mockResolvedValue({ data: "<table></table>" });
    process.env.TABROOM_API_KEY = "test-token";

    await scrapeNdca();

    const [url, options] = grabMock.mock.calls[0];
    expect(url).toBe("https://www.tabroom.com/index/results/ndca_standings.mhtml");
    expect(options.headers.Cookie).toBe("TabroomToken=test-token");
    expect(options.headers.Referer).toBe(
      "https://www.tabroom.com/index/results/debate_stats_ada.mhtml?circuit_id=103&level=Open",
    );
    expect(options.timeout).toBe(30);
  });

  it("does not include a cookie when TABROOM_API_KEY is unset", async () => {
    delete process.env.TABROOM_API_KEY;
    grabMock.mockResolvedValue({ data: "<table></table>" });

    await scrapeNdca();

    expect(grabMock.mock.calls[0][1].headers.Cookie).toBeUndefined();
  });

  it("throws when grab reports a failed request", async () => {
    grabMock.mockResolvedValue({ error: "403 Forbidden" });
    process.env.TABROOM_API_KEY = "test-token";

    await expect(scrapeNdca()).rejects.toThrow(
      /NDCA scrape failed: 403 Forbidden/,
    );
  });

  it("returns empty array when no table is found", async () => {
    grabMock.mockResolvedValue({ data: "<div>no table</div>" });
    process.env.TABROOM_API_KEY = "test-token";

    const entries = await scrapeNdca();
    expect(entries).toEqual([]);
  });
});

describe("getTabroomCookie (helper)", () => {
  it("returns URL-encoded cookie when TABROOM_API_KEY is set", async () => {
    process.env.TABROOM_API_KEY = "$6$o9PFWnAE$Ce2nWx4.qnj5outS3d/HWrpxQBfvvAb/FOumkAMTu3npQesyzBRkCS.eXcQHAsd1JHOmeuddFserKwS1LTRqn50";
    grabMock.mockResolvedValue({ data: "<table></table>" });

    await scrapeNdca();

    const cookie = grabMock.mock.calls[0][1].headers.Cookie;
    expect(cookie).toContain("TabroomToken=");
    expect(cookie).toContain("%246%24o9PFWnAE");
  });
});
