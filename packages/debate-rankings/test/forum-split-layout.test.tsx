// @vitest-environment jsdom
/**
 * @fileoverview The Forum rankings page puts the topic and side bias in a left
 * column and the "Who debated whom" graph in a right one; other formats keep
 * the stacked layout.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RankingEntry } from "@debate-ai/rankings";
import { flush, mount, type Mounted } from "./helpers/mount";

const m = vi.hoisted(() => ({
  loadRankingDataset: vi.fn(),
  grab: vi.fn(),
  loadRounds: vi.fn(),
  search: "",
  pathname: "/rank",
}));

vi.mock("@debate-ai/rankings", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/rankings")>()),
  loadRankingDataset: m.loadRankingDataset,
}));
vi.mock("grab-url", () => ({ default: m.grab }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(m.search),
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
  usePathname: () => m.pathname,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: unknown }) => (
    <a href={href} {...rest}>
      {children as never}
    </a>
  ),
}));
vi.mock("../src/leaderboard/network/loadHeadToHeadRounds", () => ({ loadHeadToHeadRounds: m.loadRounds }));

vi.spyOn(window.history, "replaceState").mockImplementation(() => {});

const { LeaderboardPanel } = await import("../src/leaderboard/RankingsLeaderboardPanel");
const { clearSchoolRankingsMemory } = await import("../src/leaderboard/hooks/useSchoolRankingsSnapshot");
const { currentSeasonYear } = await import("../src/leaderboard/leaderboardUtils");
const { entryKey } = await import("../src/leaderboard/network/headToHeadNetwork");

const RESOLUTION = "Resolved: The United States federal government should substantially increase its investment in space.";

function entry(rank: number): RankingEntry {
  return {
    rank,
    name: `Debater ${rank} & Partner ${rank}`,
    school: `School ${rank}`,
    adjustedRating: 2000 - rank * 10,
    deviation: 40,
    matches: 20,
    rating: 2100 - rank * 10,
    hash: `h${rank}`,
    affWinRate: 60,
    negWinRate: 55,
    affElimWinRate: 50,
    negElimWinRate: null,
  };
}

function dataset(id: string) {
  return {
    id,
    label: id,
    tournaments: ["toc"],
    majors: [],
    entries: Array.from({ length: 14 }, (_, i) => entry(i + 1)),
    field: { affWinRate: 51.2, negWinRate: 48.8, affElimWinRate: 47.5, negElimWinRate: 52.5 },
  };
}

/** Every entry debates the next three, so the graph clears its minimum size. */
function rounds(entries: RankingEntry[]) {
  const keys = entries.map((e) => entryKey(e.school, e.name));
  return keys.flatMap((aff, i) =>
    [1, 2, 3].map((step, j) => ({
      aff,
      neg: keys[(i + step) % keys.length],
      winner: aff,
      tournament: "toc",
      elim: false,
      roundId: `${i}${j}`,
      roundLabel: `Round ${j + 1}`,
    })),
  );
}

let view: Mounted | undefined;

beforeEach(() => {
  clearSchoolRankingsMemory();
  m.search = "";
  m.pathname = "/rank";
  m.loadRankingDataset.mockReset();
  m.loadRankingDataset.mockImplementation(async (id: string) => dataset(id));
  m.loadRounds.mockReset();
  m.loadRounds.mockImplementation(async () => rounds(dataset("hspf").entries));
  m.grab.mockReset();
  m.grab.mockResolvedValue({
    data: {
      [String(currentSeasonYear())]: {
        pf_champion: "Harker KL",
        pf_topic: RESOLUTION,
        policy_topic: "Oceans",
        policy_topic_name: "Ocean policy",
      },
    },
  });
});

afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

async function settle() {
  for (let i = 0; i < 5; i++) await flush();
}

describe("Forum rankings split layout", () => {
  it("shows the topic and side bias on the left and the network graph on the right", async () => {
    view = await mount(<LeaderboardPanel />);
    await settle();
    const root = view.container;

    const split = root.querySelector('[data-testid="forum-split"]');
    const left = root.querySelector('[data-testid="forum-split-left"]');
    const right = root.querySelector('[data-testid="forum-split-right"]');
    expect(split).not.toBeNull();
    expect(left?.textContent).toContain(RESOLUTION);
    expect(left?.textContent).toContain("Harker KL");
    expect(left?.textContent).toContain("Side bias");
    expect(left?.querySelector("#h2h-network-title")).toBeNull();
    expect(right?.querySelector("#h2h-network-title")?.textContent).toBe("Who debated whom");
    expect(right?.textContent).not.toContain("Side bias");
    // Left comes first in the DOM (top on mobile, left on desktop), and the columns stack until `lg`.
    expect(split?.firstElementChild).toBe(left);
    expect(split?.className).toContain("flex-col");
    expect(split?.className).toContain("lg:flex-row");
    // The topic is shown once, not again above the split.
    expect(root.textContent?.split(RESOLUTION).length).toBe(2);
  });

  it("keeps the stacked layout for other formats", async () => {
    m.search = "";
    m.pathname = "/rank/VCX";
    view = await mount(<LeaderboardPanel controlledDivision="VCX" />);
    await settle();

    expect(view.container.querySelector('[data-testid="forum-split"]')).toBeNull();
  });

  it("keeps the left column when the graph has no rounds to draw", async () => {
    m.loadRounds.mockImplementation(async () => []);
    view = await mount(<LeaderboardPanel />);
    await settle();
    const root = view.container;

    expect(root.querySelector('[data-testid="forum-split-left"]')?.textContent).toContain(RESOLUTION);
    expect(root.querySelector("#h2h-network-title")).toBeNull();
    expect(root.querySelector('[data-testid="forum-split-right"]')?.childElementCount).toBe(0);
  });
});
