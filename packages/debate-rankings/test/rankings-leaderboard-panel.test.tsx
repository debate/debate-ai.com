// @vitest-environment jsdom
/**
 * @fileoverview Mounts the Team Rankings panel (`LeaderboardPanel`) over
 * mocked datasets: the division table and its sorting/filtering, the LD
 * scope switcher, the Schools roll-up, past seasons, the champion banner and
 * the error states. The CSV loader, `grab` and the Next router are mocked.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RankingEntry } from "@debate-ai/rankings";
import { click, flush, mount, type, type Mounted } from "./helpers/mount";

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
  useRouter: () => ({ replace: m.replace, push: vi.fn() }),
}));

const { LeaderboardPanel } = await import("../src/leaderboard/RankingsLeaderboardPanel");
const { currentSeasonYear } = await import("../src/leaderboard/leaderboardUtils");

function entry(rank: number, name: string, school: string, adjustedRating: number): RankingEntry {
  return {
    rank,
    name,
    school,
    adjustedRating,
    deviation: 40,
    matches: 20 + rank,
    rating: adjustedRating + 80,
    hash: `${name}-${rank}`,
    affWinRate: 60,
    negWinRate: 55,
    affElimWinRate: 50,
    negElimWinRate: null,
  };
}

function dataset(id: string, entries: RankingEntry[]) {
  return {
    id,
    label: id,
    tournaments: ["toc"],
    majors: [],
    entries,
    field: { affWinRate: 51.2, negWinRate: 48.8, affElimWinRate: 47.5, negElimWinRate: 52.5 },
  };
}

const PF = dataset("hspf", [
  entry(1, "Kim & Lee", "Harker", 1900),
  entry(2, "Doe & Roe", "Strake Jesuit", 1800),
  entry(3, "Ng & Oh", "Harker", 1700),
]);

/** Fires the mousedown Radix tabs activate on. */
async function pressTab(root: HTMLElement, label: string) {
  const tab = [...root.querySelectorAll('[role="tab"]')].find((t) => t.textContent?.trim() === label);
  if (!tab) throw new Error(`no tab ${label}`);
  await flush(() => {
    tab.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, button: 0 }));
  });
}

function headerButton(root: HTMLElement, label: string): HTMLButtonElement {
  const btn = [...root.querySelectorAll("th button")].find((b) => b.textContent?.trim() === label);
  if (!btn) throw new Error(`no header ${label}`);
  return btn as HTMLButtonElement;
}

/** Team labels (school, then debaters) in the table body, in row order. */
function rowNames(root: HTMLElement): string[] {
  return [...root.querySelectorAll("tbody tr")].map((tr) => tr.querySelectorAll("td")[1]?.textContent ?? "");
}

let view: Mounted | undefined;

beforeEach(() => {
  m.search = "";
  m.replace.mockReset();
  m.loadRankingDataset.mockReset();
  m.loadRankingDataset.mockImplementation(async (id: string) =>
    id === "hspf" ? PF : dataset(id, [entry(1, `Top ${id}`, `School ${id}`, 1500)]),
  );
  m.grab.mockReset();
  m.grab.mockResolvedValue({
    data: {
      [String(currentSeasonYear())]: { pf_champion: "Harker KL", policy_topic: "Oceans", policy_topic_name: "Ocean policy" },
      "2010": { pf_champion: "Old Champs" },
    },
  });
});

afterEach(async () => {
  await view?.unmount();
  view = undefined;
});

describe("LeaderboardPanel", () => {
  it("loads the PF dataset with the champion banner and field summary", async () => {
    view = await mount(<LeaderboardPanel />);
    await flush();
    const root = view.container;

    expect(m.loadRankingDataset).toHaveBeenCalledWith("hspf");
    // The app serves this at /api/history; a bare "history" resolves to the
    // page route /history, which 404s.
    expect(m.grab).toHaveBeenCalledWith("history", expect.objectContaining({ baseURL: "/api/" }));
    expect(root.textContent).toContain("Harker KL");
    expect(root.querySelectorAll("tbody tr")).toHaveLength(3);
    expect(root.textContent).toContain("Kim & Lee");
    expect(root.textContent).toContain("Side bias");
    expect(root.querySelector('[role="img"][aria-label^="Overall"]')?.getAttribute("aria-label")).toBe(
      "Overall: aff 51.20 percent, neg 48.80 percent.",
    );
    expect(root.querySelector('[role="img"][aria-label^="Elims"]')?.getAttribute("aria-label")).toBe(
      "Elims: aff 47.50 percent, neg 52.50 percent.",
    );
  });

  it("sorts by a header and toggles direction, and filters rows", async () => {
    view = await mount(<LeaderboardPanel />);
    await flush();
    const root = view.container;

    // The Team column sorts by school: Harker first, then Strake Jesuit.
    await click(headerButton(root, "Team"));
    expect(rowNames(root)[0]).toContain("Harker");
    expect(root.querySelector('th[aria-sort="ascending"]')?.textContent).toContain("Team");
    await click(headerButton(root, "Team"));
    expect(rowNames(root)[0]).toContain("Doe & Roe");
    expect(root.querySelector('th[aria-sort="descending"]')?.textContent).toContain("Team");

    await click(headerButton(root, "Matches"));
    expect(root.querySelector('th[aria-sort="descending"]')?.textContent).toContain("Matches");

    const filter = root.querySelector<HTMLInputElement>('[aria-label="Filter rankings by name or school"]')!;
    await type(filter, "strake");
    expect(root.querySelectorAll("tbody tr")).toHaveLength(1);
    await type(filter, "nobody");
    expect(root.textContent).toContain('No entries match "nobody".');
  });

  it("switches division through the tabs and writes ?format=", async () => {
    view = await mount(<LeaderboardPanel />);
    await flush();
    await pressTab(view.container, "LD");
    await flush();

    expect(m.replace).toHaveBeenCalledWith("?format=VLD", { scroll: false });
    expect(m.loadRankingDataset).toHaveBeenCalledWith("hsld");
    // LD has two datasets, so a scope switcher appears.
    const scopes = [...view.container.querySelectorAll('[role="tab"]')].map((t) => t.textContent);
    expect(scopes).toContain("Full season");
    const sepOct = scopes.find((s) => s && s !== "Full season" && /Sep/.test(s));
    expect(sepOct).toBeTruthy();
    await pressTab(view.container, sepOct!);
    await flush();
    expect(m.loadRankingDataset).toHaveBeenCalledWith("hsld_sepoct");
  });

  it("reads the initial tab from ?format= and rolls schools up", async () => {
    m.search = "format=SCHOOLS";
    view = await mount(<LeaderboardPanel />);
    await flush();
    const root = view.container;

    expect(m.loadRankingDataset.mock.calls.map((c) => c[0]).sort()).toEqual(["cpd", "hscx", "hsld", "hspf"]);
    expect(root.textContent).toContain("5 schools, ranked by a balanced score");
    // Harker has a logo, so its name rides on the cell's title, not its text.
    expect(root.querySelector('[title="Harker"]')).not.toBeNull();

    await click([...root.querySelectorAll("th button")].find((b) => b.textContent?.includes("School"))!);
    expect(root.querySelector("th[aria-sort]")).not.toBeNull();
    await click([...root.querySelectorAll("th button")].find((b) => b.textContent?.includes("Teams"))!);
    await click([...root.querySelectorAll("th button")].find((b) => b.textContent?.includes("Teams"))!);
    expect(root.querySelector('th[aria-sort="ascending"]')?.textContent).toContain("Teams");

    await pressTab(root, "PF");
    expect(root.querySelector('[title="Strake Jesuit"]')).not.toBeNull();
    expect(root.textContent).not.toContain("School hscx");

    const filter = root.querySelector<HTMLInputElement>('[aria-label="Filter school rankings by school or team"]')!;
    await type(filter, "zzz");
    expect(root.textContent).toContain('No schools match "zzz".');
  });

  it("shows the Schools error when every dataset fails", async () => {
    m.search = "format=SCHOOLS";
    m.loadRankingDataset.mockRejectedValue(new Error("rankings offline"));
    view = await mount(<LeaderboardPanel />);
    await flush();
    expect(view.container.textContent).toContain("Error Loading Rankings");
    expect(view.container.textContent).toContain("rankings offline");
  });

  it("shows a division load error", async () => {
    m.loadRankingDataset.mockRejectedValue(new Error("CSV gone"));
    view = await mount(<LeaderboardPanel history={{}} />);
    await flush();
    expect(view.container.textContent).toContain("CSV gone");
    expect(m.grab).not.toHaveBeenCalled();
  });

  it("shows only the banner for a past season, under parent control", async () => {
    const onDivision = vi.fn();
    view = await mount(
      <LeaderboardPanel controlledDivision="VPF" controlledYear="2010" onControlledDivisionChange={onDivision} />,
    );
    await flush();
    const root = view.container;
    expect(root.textContent).toContain("Rankings are computed for the current season only.");
    expect(root.textContent).toContain("Old Champs");
    expect(m.loadRankingDataset).not.toHaveBeenCalled();
    // The internal filter bar is hidden when the parent controls the division.
    expect(root.querySelectorAll('[role="tab"]')).toHaveLength(0);
  });

  it("shows the policy topic name on the policy tab", async () => {
    view = await mount(<LeaderboardPanel controlledDivision="VCX" />);
    await flush();
    expect(view.container.textContent).toContain("Ocean policy");
    expect(m.loadRankingDataset).toHaveBeenCalledWith("hscx");
  });
});
