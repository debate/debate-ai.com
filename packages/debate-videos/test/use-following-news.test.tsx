/** @vitest-environment jsdom */
/**
 * @fileoverview `useFollowingNews`: how a viewer's follows turn into round and
 * research requests, which follows are skipped, how failures degrade, and the
 * loading and signed-in flags the news feed reads.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flush, renderHook, type RenderedHook } from "./helpers/mount";

const rankings = vi.hoisted(() => ({
  state: { loading: false, datasets: [] as unknown[], error: null as unknown },
  enabled: [] as boolean[],
}));
const follows = vi.hoisted(() => ({ fetchMyFollows: vi.fn() }));
const helpers = vi.hoisted(() => ({
  findTeamEntries: vi.fn(),
  findSchoolEntries: vi.fn(),
  teamVideoSearch: vi.fn(),
  schoolVideoSearch: vi.fn(),
  summarizeSchool: vi.fn(),
}));
const feed = vi.hoisted(() => ({ buildFollowNews: vi.fn() }));

vi.mock("@debate-ai/rankings", () => ({
  schoolSearchNames: (name: string) => [`${name} HS`, name],
}));
vi.mock("@debate-ai/rankings/src/leaderboard/hooks/useAllRankingDatasets", () => ({
  useAllRankingDatasets: (enabled: boolean) => {
    rankings.enabled.push(enabled);
    return rankings.state;
  },
}));
vi.mock("@debate-ai/rankings/src/leaderboard/profile/rankingProfileHelpers", () => helpers);
vi.mock("@debate-ai/rankings/src/leaderboard/follows/profile-follows", () => follows);
vi.mock("../src/lib/follows/follow-feed", () => feed);

import { useFollowingNews } from "../src/hooks/useFollowingNews";

const fetchMock = vi.fn();
let hook: RenderedHook<ReturnType<typeof useFollowingNews>> | undefined;

function follow(kind: string, slug: string, name = slug) {
  return { kind, slug, name } as never;
}

function respond(url: string, body: unknown, ok = true) {
  return Promise.resolve({ ok, json: async () => body });
}

async function settle() {
  await flush(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

async function render() {
  hook = await renderHook(() => useFollowingNews());
  await settle();
  await settle();
  return hook;
}

beforeEach(() => {
  vi.clearAllMocks();
  rankings.state = { loading: false, datasets: [{ id: "ds" }], error: null };
  rankings.enabled = [];
  fetchMock.mockImplementation((url: string) =>
    url.startsWith("/api/videos") ? respond(url, { videos: [{ id: "round-1" }] }) : respond(url, { documents: [{ id: "doc-1" }] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  feed.buildFollowNews.mockImplementation(({ follow: f }: { follow: { slug: string } }) => [
    { id: `news-${f.slug}` },
  ]);
  helpers.findTeamEntries.mockReturnValue([{ entry: { school: "Michigan", name: "Michigan AB" } }]);
  helpers.teamVideoSearch.mockReturnValue({ competitors: ["Michigan AB", "AB Michigan"], styles: [4, 1] });
  helpers.findSchoolEntries.mockReturnValue([{ entry: {} }]);
  helpers.summarizeSchool.mockReturnValue({ school: "Michigan" });
  helpers.schoolVideoSearch.mockReturnValue({ competitors: ["Michigan"], styles: [] });
});

afterEach(async () => {
  await hook?.unmount();
  hook = undefined;
  vi.unstubAllGlobals();
});

describe("useFollowingNews", () => {
  it("settles empty and signed out when following fails to load", async () => {
    follows.fetchMyFollows.mockRejectedValue(new Error("offline"));
    const { result } = await render();
    expect(result.current).toEqual({ items: [], follows: [], loading: false, signedIn: false });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("reports a signed-in viewer who follows nothing without loading rankings", async () => {
    follows.fetchMyFollows.mockResolvedValue({ follows: [], signedIn: true });
    const { result } = await render();
    expect(result.current).toEqual({ items: [], follows: [], loading: false, signedIn: true });
    expect(rankings.enabled.every((enabled) => enabled === false)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("is loading until the follows arrive", async () => {
    follows.fetchMyFollows.mockReturnValue(new Promise(() => {}));
    const { result } = await render();
    expect(result.current.loading).toBe(true);
  });

  it("looks a followed team up by its rankings row and searches rounds and research", async () => {
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("team", "michigan-ab", "Michigan AB")], signedIn: true });
    const { result } = await render();

    const roundUrl = new URL(fetchMock.mock.calls.find(([u]) => u.startsWith("/api/videos"))![0], "http://x");
    expect(roundUrl.searchParams.get("source")).toBe("round");
    expect(roundUrl.searchParams.get("competitors")).toBe("Michigan AB|AB Michigan");
    expect(roundUrl.searchParams.get("styles")).toBe("4,1");
    expect(roundUrl.searchParams.get("sort")).toBe("Recency");
    expect(roundUrl.searchParams.get("limit")).toBe("60");

    const docUrl = new URL(fetchMock.mock.calls.find(([u]) => u.startsWith("/api/caselist-documents"))![0], "http://x");
    expect(docUrl.searchParams.get("school")).toBe("Michigan");
    expect(docUrl.searchParams.get("team")).toBe("Michigan AB");
    expect(docUrl.searchParams.get("limit")).toBe("3");

    expect(feed.buildFollowNews).toHaveBeenCalledWith(
      expect.objectContaining({
        competitors: ["Michigan AB", "AB Michigan"],
        rounds: [{ id: "round-1" }],
        docs: [{ id: "doc-1" }],
        datasets: [{ id: "ds" }],
      }),
    );
    expect(result.current.items).toEqual([{ id: "news-michigan-ab" }]);
    expect(result.current.follows).toHaveLength(1);
    expect(result.current.loading).toBe(false);
    expect(result.current.signedIn).toBe(true);
  });

  it("falls back to the saved name for a team whose rankings row is gone", async () => {
    helpers.findTeamEntries.mockReturnValue([]);
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("team", "old-team", "Old Team")], signedIn: true });
    await render();

    const roundUrl = new URL(fetchMock.mock.calls.find(([u]) => u.startsWith("/api/videos"))![0], "http://x");
    expect(roundUrl.searchParams.get("competitors")).toBe("Old Team");
    expect(roundUrl.searchParams.has("styles")).toBe(false);
    const docUrl = new URL(fetchMock.mock.calls.find(([u]) => u.startsWith("/api/caselist-documents"))![0], "http://x");
    expect(docUrl.searchParams.get("school")).toBe("Old Team");
    expect(docUrl.searchParams.has("team")).toBe(false);
  });

  it("looks a followed school up by its rankings entries, or by saved name variants", async () => {
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("school", "michigan", "Michigan")], signedIn: true });
    await render();
    expect(helpers.schoolVideoSearch).toHaveBeenCalledWith("Michigan", [{ entry: {} }]);
    expect(feed.buildFollowNews).toHaveBeenCalledWith(expect.objectContaining({ competitors: ["Michigan"] }));
    await hook!.unmount();

    helpers.findSchoolEntries.mockReturnValue([]);
    fetchMock.mockClear();
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("school", "gone", "Gone")], signedIn: true });
    await render();
    const roundUrl = new URL(fetchMock.mock.calls.find(([u]) => u.startsWith("/api/videos"))![0], "http://x");
    expect(roundUrl.searchParams.get("competitors")).toBe("Gone HS|Gone");
  });

  it("skips publisher follows entirely but still lists them", async () => {
    follows.fetchMyFollows.mockResolvedValue({
      follows: [follow("publisher", "camp"), follow("team", "t1")],
      signedIn: true,
    });
    const { result } = await render();
    expect(feed.buildFollowNews).toHaveBeenCalledTimes(1);
    expect(feed.buildFollowNews.mock.calls[0][0].follow.slug).toBe("t1");
    expect(result.current.follows).toHaveLength(2);
  });

  it("does not search rounds when there is nobody to search for, but still fetches research", async () => {
    helpers.teamVideoSearch.mockReturnValue({ competitors: [], styles: [] });
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("team", "t1")], signedIn: true });
    await render();
    expect(fetchMock.mock.calls.some(([u]) => u.startsWith("/api/videos"))).toBe(false);
    expect(fetchMock.mock.calls.some(([u]) => u.startsWith("/api/caselist-documents"))).toBe(true);
    expect(feed.buildFollowNews).toHaveBeenCalledWith(expect.objectContaining({ rounds: [] }));
  });

  it("treats failed or rejected requests as no rounds and no research", async () => {
    fetchMock.mockImplementation((url: string) =>
      url.startsWith("/api/videos") ? respond(url, {}, false) : Promise.reject(new Error("down")),
    );
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("team", "t1")], signedIn: true });
    await render();
    expect(feed.buildFollowNews).toHaveBeenCalledWith(expect.objectContaining({ rounds: [], docs: [] }));
  });

  it("defaults missing payload lists to empty", async () => {
    fetchMock.mockImplementation((url: string) => respond(url, {}));
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("team", "t1")], signedIn: true });
    await render();
    expect(feed.buildFollowNews).toHaveBeenCalledWith(expect.objectContaining({ rounds: [], docs: [] }));
  });

  it("posts an item once when a followed team and school both produce it", async () => {
    feed.buildFollowNews.mockReturnValue([{ id: "shared" }]);
    follows.fetchMyFollows.mockResolvedValue({
      follows: [follow("team", "t1"), follow("school", "s1")],
      signedIn: true,
    });
    const { result } = await render();
    expect(feed.buildFollowNews).toHaveBeenCalledTimes(2);
    expect(result.current.items).toEqual([{ id: "shared" }]);
  });

  it("works through many follows a few at a time", async () => {
    follows.fetchMyFollows.mockResolvedValue({
      follows: Array.from({ length: 9 }, (_, i) => follow("team", `t${i}`)),
      signedIn: true,
    });
    const { result } = await render();
    expect(feed.buildFollowNews).toHaveBeenCalledTimes(9);
    expect(result.current.items).toHaveLength(9);
  });

  it("waits for the rankings datasets before building, staying in the loading state", async () => {
    rankings.state = { loading: true, datasets: [], error: null };
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("team", "t1")], signedIn: true });
    const { result } = await render();
    expect(feed.buildFollowNews).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(true);
    expect(rankings.enabled.at(-1)).toBe(true);
  });

  it("builds from saved names when the rankings fail to load", async () => {
    rankings.state = { loading: false, datasets: [], error: new Error("csv") };
    helpers.findTeamEntries.mockReturnValue([]);
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("team", "t1", "Team One")], signedIn: true });
    const { result } = await render();
    expect(feed.buildFollowNews).toHaveBeenCalledWith(
      expect.objectContaining({ competitors: ["Team One"], datasets: [] }),
    );
    expect(result.current.loading).toBe(false);
    expect(result.current.items).toEqual([{ id: "news-t1" }]);
  });

  it("drops results that arrive after unmount", async () => {
    let release: (value: unknown) => void = () => {};
    fetchMock.mockImplementation(
      () => new Promise((resolve) => (release = resolve as never)),
    );
    follows.fetchMyFollows.mockResolvedValue({ follows: [follow("team", "t1")], signedIn: true });
    const { result } = await render();
    expect(result.current.loading).toBe(true);
    await hook!.unmount();
    hook = undefined;
    release({ ok: true, json: async () => ({}) });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(result.current.items).toEqual([]);
  });
});
