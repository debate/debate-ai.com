// @vitest-environment jsdom
/**
 * @fileoverview The rankings page's season select: every option, "All time"
 * included, updates the panel and writes `/rank/<format>?season=…`, and a
 * `?season=` address opens on that season. Radix Select can't open in jsdom,
 * so a native `<select>` stands in for it.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { flush, mount, type Mounted } from "./helpers/mount";

const m = vi.hoisted(() => ({
  loadRankingDataset: vi.fn(),
  grab: vi.fn(),
  replace: vi.fn(),
  search: "",
}));

vi.mock("@debate-ai/rankings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/rankings")>()),
  loadRankingDataset: m.loadRankingDataset,
}));
vi.mock("grab-url", () => ({ default: m.grab }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(m.search),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => "/rank",
}));
vi.mock("../src/leaderboard/ui/primitives/select", () => import("./select-mock"));

vi.spyOn(window.history, "replaceState").mockImplementation((_state, _unused, url) => {
  m.replace(String(url));
});

const { LeaderboardPanel } = await import("../src/leaderboard/RankingsLeaderboardPanel");
const { currentSeasonYear } = await import("../src/leaderboard/leaderboardUtils");

/** The season select (the only select the filter bar renders). */
function seasonSelect(root: HTMLElement): HTMLSelectElement {
  const select = root.querySelector<HTMLSelectElement>('select[data-testid="select"]');
  if (!select) throw new Error("no season select");
  return select;
}

/** Picks `value` in the season select, the way choosing an option does. */
async function pickSeason(root: HTMLElement, value: string) {
  const select = seasonSelect(root);
  await flush(() => {
    select.value = value;
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
}

let view: Mounted | undefined;

beforeEach(() => {
  m.search = "";
  m.replace.mockReset();
  m.loadRankingDataset.mockReset();
  m.loadRankingDataset.mockImplementation(async (id: string) => ({
    id,
    label: id,
    tournaments: [],
    majors: [],
    entries: [],
  }));
  m.grab.mockReset();
  m.grab.mockResolvedValue({ data: {} });
});

afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

describe("rankings season select", () => {
  it("All time and every season update the panel and the address", async () => {
    view = await mount(<LeaderboardPanel />);
    await flush();
    const root = view.container;

    await pickSeason(root, "all-time");
    expect(m.replace).toHaveBeenLastCalledWith("/rank/VPF?season=all-time");
    expect(seasonSelect(root).value).toBe("all-time");

    await pickSeason(root, "2020");
    expect(m.replace).toHaveBeenLastCalledWith("/rank/VPF?season=2020");
    expect(seasonSelect(root).value).toBe("2020");

    await pickSeason(root, String(currentSeasonYear()));
    expect(m.replace).toHaveBeenLastCalledWith("/rank/VPF");
    expect(seasonSelect(root).value).toBe(String(currentSeasonYear()));
  });

  it("offers All time on the Parli tab and keeps it when switching to Parli", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) =>
      String(input) === "/api/rankings/npdl/all-time"
        ? new Response(JSON.stringify({ source: "snapshot", seasons: [], teams: [], schools: [] }))
        : new Response("{}", { status: 404 }),
    );
    try {
      view = await mount(<LeaderboardPanel />);
      await flush();
      const root = view.container;
      const parliTab = [...root.querySelectorAll('[role="tab"]')].find((t) => t.textContent === "Parli")!;
      await flush(() => {
        parliTab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
      });
      expect(seasonSelect(root).querySelector('option[value="all-time"]')).not.toBeNull();

      await pickSeason(root, "all-time");
      expect(m.replace).toHaveBeenLastCalledWith("/rank/PARLI?season=all-time");
      expect(seasonSelect(root).value).toBe("all-time");
      expect(fetchSpy.mock.calls.some(([url]) => String(url) === "/api/rankings/npdl/all-time")).toBe(true);
    } finally {
      fetchSpy.mockRestore();
    }
  });

  it("opens on the season ?season= names", async () => {
    m.search = "season=2020";
    view = await mount(<LeaderboardPanel />);
    await flush();
    expect(seasonSelect(view.container).value).toBe("2020");
  });
});
