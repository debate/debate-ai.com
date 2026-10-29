// @vitest-environment jsdom
/**
 * @fileoverview Tests the rankings data hooks — `useLeaderboardData`,
 * `useSchoolRankingsData`, `useAllRankingDatasets` — and the channel stats
 * fetch `useYouTubeStats`. The CSV loader and `grab` are mocked so the tests
 * pin loading/error state and stale-load handling, not network parsing.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mount, renderHook, flush } from "./helpers/mount";

const m = vi.hoisted(() => ({
  loadRankingDataset: vi.fn(),
  grab: vi.fn(),
}));

vi.mock("@debate-ai/rankings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/rankings")>()),
  loadRankingDataset: m.loadRankingDataset,
}));
vi.mock("grab-url", () => ({ default: m.grab }));

const ds = (id: string) => ({ id, label: id, tournaments: [], majors: [], entries: [], field: null }) as any;

/** A promise whose settle functions the test holds on to. */
function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  m.loadRankingDataset.mockReset();
  m.grab.mockReset();
});

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useLeaderboardData", () => {
  it("loads the dataset and fetched champion history", async () => {
    m.loadRankingDataset.mockResolvedValue(ds("hspf"));
    m.grab.mockResolvedValue({ data: { "2026": { pf_champion: "Harker" } } });
    const { useLeaderboardData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useLeaderboardData");
    const hook = await renderHook(() => useLeaderboardData("hspf"));
    await flush();

    expect(m.grab).toHaveBeenCalledWith("history", { cache: true, baseURL: "/api/" });
    expect(hook.result.current).toMatchObject({
      dataset: { id: "hspf" },
      loading: false,
      error: null,
      debateHistory: { "2026": { pf_champion: "Harker" } },
      championsLoading: false,
    });
  });

  it("skips the history fetch when history is provided, and ignores a failed fetch", async () => {
    m.loadRankingDataset.mockResolvedValue(ds("hsld"));
    const { useLeaderboardData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useLeaderboardData");
    const history = { "2025": { ld_champion: "X" } };
    const withProp = await renderHook(() => useLeaderboardData("hsld", history));
    await flush();
    expect(m.grab).not.toHaveBeenCalled();
    expect(withProp.result.current.debateHistory).toBe(history);
    expect(withProp.result.current.championsLoading).toBe(false);

    m.grab.mockResolvedValue({ error: "nope" });
    const failed = await renderHook(() => useLeaderboardData("hsld"));
    await flush();
    expect(failed.result.current.debateHistory).toBeNull();
    expect(failed.result.current.championsLoading).toBe(false);
  });

  it("loads nothing for a null dataset id", async () => {
    m.grab.mockResolvedValue(null);
    const { useLeaderboardData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useLeaderboardData");
    const hook = await renderHook(() => useLeaderboardData(null));
    await flush();
    expect(m.loadRankingDataset).not.toHaveBeenCalled();
    expect(hook.result.current).toMatchObject({ dataset: null, loading: false, error: null });
  });

  it("reports a load error message, or a fallback for non-errors", async () => {
    m.grab.mockResolvedValue(null);
    const { useLeaderboardData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useLeaderboardData");
    m.loadRankingDataset.mockRejectedValueOnce(new Error("CSV missing"));
    const a = await renderHook(() => useLeaderboardData("hscx"));
    await flush();
    expect(a.result.current).toMatchObject({ dataset: null, loading: false, error: "CSV missing" });

    m.loadRankingDataset.mockRejectedValueOnce("weird");
    const b = await renderHook(() => useLeaderboardData("cpd"));
    await flush();
    expect(b.result.current.error).toBe("Failed to load rankings");
  });

  it("discards a stale load when the dataset changes", async () => {
    m.grab.mockResolvedValue(null);
    const first = deferred<any>();
    const second = deferred<any>();
    m.loadRankingDataset.mockImplementation((id: string) => (id === "hsld" ? first.promise : second.promise));
    const { useLeaderboardData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useLeaderboardData");
    const seen: any[] = [];
    function Probe({ id }: { id: any }) {
      seen.push(useLeaderboardData(id, {}));
      return null;
    }
    const hook = await mount(<Probe id="hsld" />);
    expect(seen.at(-1).loading).toBe(true);
    await hook.rerender(<Probe id="hsld_sepoct" />);

    // The second load settles first; the first one's late answer is dropped.
    await flush(() => second.resolve(ds("hsld_sepoct")));
    await flush(() => first.resolve(ds("hsld")));
    expect(seen.at(-1).dataset).toMatchObject({ id: "hsld_sepoct" });
    expect(seen.at(-1).loading).toBe(false);

    // A rejection that lands after unmount is ignored too.
    const third = deferred<any>();
    m.loadRankingDataset.mockReturnValue(third.promise);
    const hook3 = await renderHook(() => useLeaderboardData("hscx"));
    await hook3.unmount();
    await flush(() => third.reject(new Error("late")));
    expect(hook3.result.current.error).toBeNull();
  });
});

describe("useSchoolRankingsData", () => {
  it("does nothing until enabled", async () => {
    const { useSchoolRankingsData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useSchoolRankingsData");
    const hook = await renderHook(() => useSchoolRankingsData(false));
    await flush();
    expect(m.loadRankingDataset).not.toHaveBeenCalled();
    expect(hook.result.current).toEqual({ datasets: {}, loading: false, error: null });
  });

  it("loads every division's full-season dataset, leaving failures out", async () => {
    m.loadRankingDataset.mockImplementation(async (id: string) => {
      if (id === "hscx") throw new Error("down");
      return ds(id);
    });
    const { useSchoolRankingsData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useSchoolRankingsData");
    const hook = await renderHook(() => useSchoolRankingsData(true));
    await flush();

    expect(m.loadRankingDataset.mock.calls.map((c) => c[0])).toEqual(["hspf", "hsld", "hscx", "cpd"]);
    expect(Object.keys(hook.result.current.datasets).sort()).toEqual(["NDT", "VLD", "VPF"]);
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.error).toBeNull();
  });

  it("reports an error only when every dataset fails", async () => {
    m.loadRankingDataset.mockRejectedValue(new Error("all down"));
    const { useSchoolRankingsData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useSchoolRankingsData");
    const hook = await renderHook(() => useSchoolRankingsData(true));
    await flush();
    expect(hook.result.current.datasets).toEqual({});
    expect(hook.result.current.error).toBe("all down");

    m.loadRankingDataset.mockRejectedValue("not an error");
    const other = await renderHook(() => useSchoolRankingsData(true));
    await flush();
    expect(other.result.current.error).toBe("Failed to load rankings");
  });

  it("ignores results that arrive after unmount", async () => {
    const pending = deferred<any>();
    m.loadRankingDataset.mockReturnValue(pending.promise);
    const { useSchoolRankingsData } = await import("@debate-ai/rankings/src/leaderboard/hooks/useSchoolRankingsData");
    const hook = await renderHook(() => useSchoolRankingsData(true));
    await hook.unmount();
    await flush(() => pending.resolve(ds("x")));
    expect(hook.result.current.datasets).toEqual({});
  });
});

describe("useAllRankingDatasets", () => {
  it("loads full-season datasets once and shares them across mounts", async () => {
    vi.resetModules();
    m.loadRankingDataset.mockImplementation(async (id: string) => ds(id));
    const { useAllRankingDatasets } = await import("@debate-ai/rankings/src/leaderboard/hooks/useAllRankingDatasets");
    const a = await renderHook(() => useAllRankingDatasets());
    await flush();
    const ids = a.result.current.datasets.map((d) => d.id);
    expect(ids).not.toContain("hsld_sepoct");
    expect(ids).toContain("hspf");
    expect(a.result.current.loading).toBe(false);

    const callsAfterFirst = m.loadRankingDataset.mock.calls.length;
    const b = await renderHook(() => useAllRankingDatasets());
    await flush();
    expect(m.loadRankingDataset.mock.calls.length).toBe(callsAfterFirst);
    expect(b.result.current.datasets).toHaveLength(ids.length);
  });

  it("reports an error and retries on the next mount", async () => {
    vi.resetModules();
    m.loadRankingDataset.mockRejectedValue(new Error("boom"));
    const { useAllRankingDatasets } = await import("@debate-ai/rankings/src/leaderboard/hooks/useAllRankingDatasets");
    const a = await renderHook(() => useAllRankingDatasets());
    await flush();
    expect(a.result.current).toMatchObject({ datasets: [], loading: false, error: "boom" });

    m.loadRankingDataset.mockReset();
    m.loadRankingDataset.mockRejectedValue(42);
    const b = await renderHook(() => useAllRankingDatasets());
    await flush();
    expect(m.loadRankingDataset).toHaveBeenCalled();
    expect(b.result.current.error).toBe("Failed to load rankings");
  });
});

describe("useYouTubeStats", () => {
  function response(ok: boolean, type: string | null, body: unknown) {
    return {
      ok,
      headers: { get: () => type },
      json: async () => body,
    };
  }

  it("returns parsed JSON stats", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => response(true, "application/json; charset=utf-8", { views: 9 })));
    const { useYouTubeStats } = await import("../src/hooks/useYouTubeStats");
    const hook = await renderHook(() => useYouTubeStats());
    await flush();
    expect(hook.result.current).toEqual({ views: 9 });
  });

  it("stays null for an error status or an HTML body", async () => {
    const { useYouTubeStats } = await import("../src/hooks/useYouTubeStats");
    vi.stubGlobal("fetch", vi.fn(async () => response(false, "application/json", { x: 1 })));
    const a = await renderHook(() => useYouTubeStats());
    await flush();
    expect(a.result.current).toBeNull();

    vi.stubGlobal("fetch", vi.fn(async () => response(true, "text/html", "<html>")));
    const b = await renderHook(() => useYouTubeStats());
    await flush();
    expect(b.result.current).toBeNull();
  });

  it("logs real failures but not aborts, and aborts on unmount", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { useYouTubeStats } = await import("../src/hooks/useYouTubeStats");

    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("network"))));
    await renderHook(() => useYouTubeStats());
    await flush();
    expect(errorSpy).toHaveBeenCalledWith("Failed to load YouTube stats:", expect.any(TypeError));

    errorSpy.mockClear();
    let signal: AbortSignal | undefined;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init: { signal: AbortSignal }) => {
        signal = init.signal;
        return Promise.reject(Object.assign(new Error("aborted"), { name: "AbortError" }));
      }),
    );
    const hook = await renderHook(() => useYouTubeStats());
    await flush();
    await hook.unmount();
    expect(signal?.aborted).toBe(true);
    expect(errorSpy).not.toHaveBeenCalled();
  });
});
