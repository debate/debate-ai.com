// @vitest-environment jsdom
/**
 * @fileoverview Mounts the team and school profile pages over mocked
 * rankings, plus their caselist-documents section: loading, error and
 * not-found states, the per-division stats, the school roll-up table, and
 * expanding / downloading / copying a caselist file.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RankingEntry } from "@debate-ai/rankings-adapter";
import { click, flush, mount, type Mounted } from "./helpers/mount";

const m = vi.hoisted(() => ({
  loadRankingDataset: vi.fn(),
  grab: vi.fn(),
}));

vi.mock("@debate-ai/rankings-adapter", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@debate-ai/rankings-adapter")>()),
  loadRankingDataset: m.loadRankingDataset,
}));
vi.mock("grab-url", () => ({ default: m.grab }));

function entry(rank: number, name: string, school: string, extra: Partial<RankingEntry> = {}): RankingEntry {
  return {
    rank,
    name,
    school,
    adjustedRating: 1800 - rank * 10,
    deviation: 40,
    matches: 20,
    rating: 1900,
    hash: `${school}-${name}`,
    affWinRate: 62.5,
    negWinRate: 50,
    affElimWinRate: null,
    negElimWinRate: 40,
    ...extra,
  };
}

function ds(id: string, entries: RankingEntry[]) {
  return { id, label: `Label ${id}`, tournaments: [], majors: [], entries, field: null };
}

const DOCS = {
  total: 3,
  documents: [
    {
      id: 1,
      pathHash: "a",
      caselistSlug: "hspolicy",
      caselistLabel: "HS Policy",
      school: "Harker",
      team: "Kim & Lee",
      side: "Aff",
      fileName: "Aff - Oceans.docx",
      archivePath: "x",
      html: "<p>Card text</p>",
      cardCount: 12,
      ingestedAt: 1_700_000_000,
      archiveDate: "2026-01-01",
    },
    {
      id: 2,
      pathHash: "b",
      caselistSlug: "hspolicy",
      caselistLabel: "HS Policy",
      school: "Harker",
      team: null,
      side: null,
      fileName: "Neg.docx",
      archivePath: "y",
      html: "<p>Neg</p>",
      cardCount: 3,
      ingestedAt: 1_700_000_000,
      archiveDate: null,
    },
  ],
};

let view: Mounted | undefined;
type FetchMock = ReturnType<typeof vi.fn<(url: string, init?: RequestInit) => Promise<unknown>>>;
let fetchMock: FetchMock;
let followMock: FetchMock;

async function load() {
  vi.resetModules();
  return import("../src/panels/leaderboard/profile/RankingProfiles");
}

beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
  m.grab.mockReset();
  m.grab.mockResolvedValue({ videos: [], total: 0, hasMore: false });
  m.loadRankingDataset.mockReset();
  m.loadRankingDataset.mockImplementation(async (id: string) => {
    if (id === "hspf") return ds(id, [entry(1, "Kim & Lee", "Harker"), entry(2, "Ng & Oh", "Harker"), entry(3, "Doe", "Other")]);
    if (id === "hsld") return ds(id, [entry(4, "Jane Kim", "Harker", { affWinRate: null })]);
    return ds(id, []);
  });
  fetchMock = vi.fn(async (_url: string, _init?: RequestInit): Promise<unknown> => ({ ok: true, json: async () => DOCS }));
  followMock = vi.fn(async (_url: string, _init?: RequestInit): Promise<unknown> => ({
    ok: true,
    json: async () => ({ following: false, followers: 4, signedIn: false }),
  }));
  // The profile header's follow button reads `/api/follows` and the matchup
  // simulator reads the account's `/api/settings` (answered as signed out);
  // everything else these pages fetch is the caselist-documents list.
  vi.stubGlobal("fetch", (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.startsWith("/api/follows")) return followMock(url, init);
    if (path.startsWith("/api/settings")) return Promise.resolve({ ok: false, status: 401, json: async () => ({}) });
    return fetchMock(url, init);
  });
});

afterEach(async () => {
  await view?.unmount();
  view = undefined;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("TeamProfilePage", () => {
  it("shows the team's stats, school link and caselist files", async () => {
    const { TeamProfilePage } = await load();
    const { teamHref } = await import("../src/panels/leaderboard/profile/rankingProfileHelpers");
    const slug = teamHref({ school: "Harker", name: "Kim & Lee" }).split("/").pop()!;
    view = await mount(<TeamProfilePage slug={slug} />);
    await flush();
    const root = view.container;

    // The heading is the team label: Harker's logo (its name kept for screen readers), then the last names.
    expect(root.querySelector("h1")?.textContent).toBe("Harker Kim & Lee");
    expect(root.querySelector('a[href="/@harker"]')?.textContent).toBe("Harker");
    expect(root.textContent).toContain("Label hspf · rank 1 of 3");
    expect(root.textContent).toContain("62.5%");
    expect(root.textContent).toContain("Elim neg win %");
    expect(root.textContent).toContain("40%");
    expect(root.textContent).toContain("Top 33.3%");
    expect(fetchMock.mock.calls[0][0]).toBe("/api/caselist-documents?school=Harker&team=Kim+%26+Lee&limit=50");
    expect(root.textContent).toContain("Files from Harker / Kim & Lee");
    expect(root.textContent).toContain("3 documents found");
    expect(root.textContent).toContain("Showing 2 of 3 documents.");
    expect(root.querySelector('a[href^="/search?caselist=1"]')?.getAttribute("href")).toBe(
      "/search?caselist=1&school=Harker&team=Kim%20%26%20Lee",
    );
    expect(followMock.mock.calls[0][0]).toMatch(/^\/api\/follows\?/);
    expect(followMock.mock.calls[0][0]).toContain("kind=team");
    expect(root.textContent).toContain("0.0k followers");
    expect(root.querySelector('a[href="/login"]')?.textContent).toContain("Sign in to follow");
  });

  it("reports a link that matches no team", async () => {
    const { TeamProfilePage } = await load();
    view = await mount(<TeamProfilePage slug="nobody-at-all" />);
    await flush();
    expect(view.container.textContent).toContain("No ranked team matches this link.");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("shows the loading copy, then a load error", async () => {
    let reject!: (e: unknown) => void;
    m.loadRankingDataset.mockImplementation(() => new Promise((_res, rej) => (reject = rej)));
    const { TeamProfilePage } = await load();
    view = await mount(<TeamProfilePage slug="x" />);
    expect(view.container.textContent).toContain("Loading rankings…");
    await flush(() => reject(new Error("rankings down")));
    expect(view.container.textContent).toContain("rankings down");
  });
});

describe("SchoolProfilePage", () => {
  it("summarises the school across divisions and lists every entry", async () => {
    const { SchoolProfilePage } = await load();
    view = await mount(<SchoolProfilePage slug="harker" />);
    await flush();
    const root = view.container;

    expect(root.querySelector("h1")?.textContent).toBe("Harker");
    expect(root.querySelector("header p")?.textContent).toBe("Label hsld · Label hspf");
    expect(root.textContent).toContain("Ranked entries");
    expect(root.textContent).toContain("Label hspf · 2 teams");
    const rows = root.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(3);
    // LD rows name the debater by last name, after the school.
    expect(rows[0].textContent).toContain("Harker Kim");
    expect(rows[0].textContent).toContain("—");
    const { teamHref } = await import("../src/panels/leaderboard/profile/rankingProfileHelpers");
    expect(root.querySelector(`a[href="${teamHref({ school: "Harker", name: "Jane Kim" })}"]`)?.textContent).toBe(
      "Kim",
    );
    expect(fetchMock.mock.calls[0][0]).toBe("/api/caselist-documents?school=Harker&limit=50");
    expect(root.textContent).toContain("Files from Harker");
  });

  it("reports a link that matches no school", async () => {
    const { SchoolProfilePage } = await load();
    view = await mount(<SchoolProfilePage slug="nowhere" />);
    await flush();
    expect(view.container.textContent).toContain("No ranked school matches this link.");
  });
});

describe("ProfileCaselistDocuments", () => {
  async function render(props: { school?: string; team?: string }) {
    const { ProfileCaselistDocuments } = await import(
      "../src/panels/leaderboard/profile/ProfileCaselistDocuments"
    );
    view = await mount(<ProfileCaselistDocuments {...props} />);
    await flush();
    return view.container;
  }

  it("renders nothing without a school or team", async () => {
    const root = await render({});
    expect(root.innerHTML).toBe("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("expands a file to show its details, downloads and copies it", async () => {
    const writeText = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    const createObjectURL = vi.fn(() => "blob:doc");
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const anchorClick = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    const root = await render({ team: "Kim & Lee" });
    expect(root.textContent).toContain("Files from Kim & Lee");
    expect(root.textContent).toContain("Aff - Oceans.docx");
    expect(root.textContent).not.toContain("Card text");

    const header = [...root.querySelectorAll("div")].find(
      (d) => d.className.includes("cursor-pointer") && d.textContent?.includes("Aff - Oceans.docx"),
    )!;
    await click(header);
    expect(root.textContent).toContain("Card text");
    expect(root.textContent).toContain("Cards: 12");
    expect(root.textContent).toContain("Archive: 2026-01-01");

    const buttons = [...root.querySelectorAll("button")];
    await click(buttons.find((b) => b.textContent?.includes("Download HTML"))!);
    expect(createObjectURL).toHaveBeenCalled();
    expect(anchorClick).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:doc");

    await click(buttons.find((b) => b.textContent?.includes("Copy HTML"))!);
    expect(writeText).toHaveBeenCalledWith("<p>Card text</p>");

    await click(header);
    expect(root.textContent).not.toContain("Card text");

    const second = [...root.querySelectorAll("div")].find(
      (d) => d.className.includes("cursor-pointer") && d.textContent?.includes("Neg.docx"),
    )!;
    await click(second);
    expect(root.textContent).toContain("Side: —");
  });

  it("shows an error for a failed response and the empty state for none", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503, json: async () => ({}) });
    const root = await render({ school: "Harker" });
    expect(root.textContent).toContain("Error: Failed to fetch: 503");
    await view!.unmount();

    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ documents: [], total: 1 }) });
    const empty = await render({ school: "Solo" });
    expect(empty.textContent).toContain("No caselist documents found.");
    expect(empty.textContent).toContain("1 document found");
  });

  it("ignores an aborted request", async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error("aborted"), { name: "AbortError" }));
    const root = await render({ school: "Harker" });
    expect(root.textContent).not.toContain("Error:");
  });
});
