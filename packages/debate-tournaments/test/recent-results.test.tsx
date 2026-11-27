// @vitest-environment jsdom
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { createTournamentsClient, RECENT_RESULTS_DAYS, resultsCompletedAt, type PublishedRound, type ResultsIndexEvent, type RoundSchematic, type UpcomingTournament } from "../src/ui/client";
import { RecentResultsSection } from "../src/ui/pages/RecentResults";
import { UpcomingTournamentsPage } from "../src/ui/pages/UpcomingTournamentsPage";
import { pickResultSets, topFormatEvents, topFormatOf } from "../src/ui/top-formats";
import elims from "./fixtures/ucla-2026-opld-elims.json";
import { click, clientWith, contextValue, render, settle, text, unmountAll } from "./helpers/dom";

beforeAll(() => {
  class RO {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= RO;
});
afterEach(unmountAll);

describe("topFormatOf", () => {
  const cases: Array<[string, string, string | null]> = [
    ["PF", "Public Forum", "pf"],
    ["VPF", "Varsity Public Forum", "pf"],
    ["OPF", "Open PF", "pf"],
    ["OPLD", "Lincoln Douglas (Open)", "ld"],
    ["JVLD", "JV LD", "ld"],
    ["LD", "Lincoln-Douglas", "ld"],
    ["VCX", "Varsity Policy", "policy"],
    ["CX", "Cross Examination", "policy"],
    ["NDT", "NDT Open", "college-policy"],
    ["CEDA", "CEDA Novice", "college-policy"],
    ["OP", "College Policy Open", "college-policy"],
    ["CONG", "Congress", null],
    ["PARLI", "Parliamentary Debate", null],
    ["IE", "Original Oratory", null],
    ["WSD", "World Schools", null],
    ["TOPF", "Top Forum", null],
  ];
  it.each(cases)("%s / %s -> %s", (abbr, name, format) => {
    expect(topFormatOf({ abbr, name })).toBe(format);
  });
});

const ev = (id: number, name: string, abbr: string, sets: Array<[number, string | null, string]> = [[id * 10, "final", "Final Places"]]): ResultsIndexEvent => ({
  id,
  name,
  abbr,
  type: "debate",
  ResultSets: sets.map(([sid, tag, label]) => ({ id: sid, tag, label, createdAt: "2026-11-20T00:00:00Z" })),
});

describe("topFormatEvents", () => {
  it("keeps only PF, LD, Policy and College Policy events with results, in that order", () => {
    const found = topFormatEvents({
      a: ev(1, "Varsity Policy", "VCX"),
      b: ev(2, "Congress", "CONG"),
      c: ev(3, "NDT", "NDT"),
      d: ev(4, "Public Forum", "PF"),
      e: ev(5, "Lincoln Douglas", "LD"),
      f: ev(6, "JV PF", "JVPF", []),
    });
    expect(found.map((f) => [f.format, f.event.abbr])).toEqual([
      ["pf", "PF"],
      ["ld", "LD"],
      ["policy", "VCX"],
      ["college-policy", "NDT"],
    ]);
    expect(topFormatEvents(null)).toEqual([]);
  });
});

describe("pickResultSets", () => {
  it("finds final places, the bracket set and speaker awards", () => {
    const picked = pickResultSets([
      { id: 1, tag: "prelim_seed", label: "Prelim Seeds", createdAt: null },
      { id: 2, tag: "final", label: "Final Places", createdAt: null },
      { id: 3, tag: "bracket", label: "Bracket", createdAt: null },
      { id: 4, tag: "speaker", label: "Speaker Awards", createdAt: null },
    ]);
    expect([picked.finals?.id, picked.bracket?.id, picked.speakers?.id]).toEqual([2, 3, 4]);
    expect(pickResultSets([])).toEqual({ finals: null, bracket: null, speakers: null });
  });
});

describe("recentResults client", () => {
  const NOW = new Date("2026-11-27T12:00:00Z");
  const row = (id: number, start: string, end: string | null) => ({ id, name: `T${id}`, start, end });

  function fake(rows: unknown[]) {
    const calls: string[] = [];
    const client = createTournamentsClient("/api/tabroom", async (url) => {
      calls.push(String(url));
      return new Response(JSON.stringify(String(url).includes("/rest/tourns?") ? rows : []), { status: 200 });
    });
    return { client, calls };
  }

  it("keeps tournaments that ended in the last 7 days, newest first, and drops ongoing or older ones", async () => {
    const { client, calls } = fake([
      row(1, "2026-11-13 14:00:00", "2026-11-14 23:00:00"),
      row(2, "2026-11-20 14:00:00", "2026-11-22 23:00:00"),
      row(3, "2026-11-10 14:00:00", "2026-11-12 23:00:00"),
      row(4, "2026-11-26 14:00:00", "2026-11-29 23:00:00"),
      row(5, "2026-11-12 08:00:00", "2026-11-13 11:00:00"),
      row(6, "2026-11-25 14:00:00", null),
      row(7, "2026-11-20 11:00:00", "2026-11-20 11:59:59"),
      row(8, "2026-11-18 10:00:00", "2026-11-20 12:00:00"),
    ]);
    expect(RECENT_RESULTS_DAYS).toBe(7);
    const rows = await client.recentResults({ now: NOW });
    expect(rows.map((r) => r.tournId)).toEqual([6, 2, 8]);
    const query = new URL(calls[0], "http://x").searchParams;
    expect(query.get("publishedResults")).toBe("true");
    expect(query.get("startAfter")).toBe("2026-11-13T12:00:00.000Z");
  });

  it("measures the window by end date, falling back to start date, with a fixed clock", async () => {
    const { client } = fake([
      row(1, "2026-11-01 14:00:00", "2026-11-26 23:00:00"),
      row(2, "2026-11-19 14:00:00", null),
      row(3, "2026-11-21 14:00:00", null),
    ]);
    const rows = await client.recentResults({ now: NOW });
    expect(rows.map((r) => r.tournId)).toEqual([1, 3]);
  });

  it("falls back to the start date when a row has no end", () => {
    expect(resultsCompletedAt({ start: "2026-11-25 14:00:00", end: "" })).toBe(Date.parse("2026-11-25T14:00:00Z"));
    expect(resultsCompletedAt({ start: "", end: "" })).toBeNaN();
  });
});

const schematics = elims as unknown as RoundSchematic[];
const elimRounds: PublishedRound[] = schematics.map((r, i) => ({ id: r.id, type: i === 3 ? "final" : "elim", name: r.name, label: r.label, Event: r.Event }));

const tourn = (over: Partial<UpcomingTournament> = {}): UpcomingTournament => ({
  id: "1-past",
  tournId: 40372,
  webname: null,
  name: "UCLA Invitational",
  location: "Los Angeles",
  state: "CA",
  country: "US",
  start: "2026-11-20 14:00:00",
  end: "2026-11-22 23:00:00",
  fullDates: "Nov 20, 2026 – Nov 22, 2026",
  source: "hosted",
  ...over,
});

const index = {
  1: ev(1, "Lincoln Douglas (Open)", "OPLD", [
    [11, "final", "Final Places"],
    [12, "speaker", "Speaker Awards"],
  ]),
  2: ev(2, "Public Forum", "PF", [[21, "final", "Final Places"]]),
  3: ev(3, "Congress", "CONG"),
  4: ev(4, "NDT", "NDT", [[41, "bracket", "Bracket"]]),
};

const finals = (id: number) => [
  {
    id,
    label: "Final Places",
    tag: "final",
    results: [
      { place: "2", Entry: { id: 2, code: "Silver", name: "Silver One" }, School: { id: 2, code: "S", name: "Second High" } },
      { place: "1", Entry: { id: 1, code: "Gold", name: "Gold One" }, School: { id: 1, code: "G", name: "First High" } },
    ],
  },
];

function handler(requested: string[]) {
  return (path: string) => {
    requested.push(path);
    if (path.endsWith("/results")) return index;
    if (path.endsWith("/rounds")) return elimRounds;
    const set = /\/results\/(\d+)$/.exec(path);
    if (set) {
      if (set[1] === "12")
        return [
          {
            id: 12,
            label: "Speaker Awards",
            tag: "speaker",
            results: [
              { place: "2", Student: { id: 8, first: "Bo", last: "Two" }, School: { id: 2, code: null, name: "Second High" } },
              { place: "1", Student: { id: 7, first: "Al", last: "One" }, School: { id: 1, code: null, name: "First High" } },
            ],
          },
        ];
      if (set[1] === "41") return [{ id: 41, label: "Bracket", tag: "bracket" }];
      return finals(Number(set[1]));
    }
    const round = /\/pages\/invite\/40372\/OPLD\/(\d+)$/.exec(path);
    return round ? schematics.find((r) => String(r.name) === round[1]) : new Response("{}", { status: 404 });
  };
}

const toggle = (el: HTMLElement, label: string) => el.querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;

describe("RecentResultsSection", () => {
  it("lists recent tournaments collapsed and requests nothing until one is expanded", async () => {
    const requested: string[] = [];
    const el = await render(<RecentResultsSection tourns={[tourn()]} state="ready" />, contextValue({ client: clientWith(handler(requested)) }));
    expect(text(el)).toContain("Recent results");
    expect(text(el)).toContain("UCLA Invitational");
    expect(text(el)).toContain("Nov 20, 2026 – Nov 22, 2026");
    expect(toggle(el, "Expand tournament UCLA Invitational").getAttribute("aria-expanded")).toBe("false");
    expect(requested).toEqual([]);
  });

  it("expands to the top formats only: bracket first, then final places, then speakers last", async () => {
    const requested: string[] = [];
    const el = await render(<RecentResultsSection tourns={[tourn()]} state="ready" />, contextValue({ client: clientWith(handler(requested)) }));
    await click(toggle(el, "Expand tournament UCLA Invitational"));
    await settle();

    const events = [...el.querySelectorAll("tr[data-depth='1']")].map((r) => r.textContent);
    expect(events).toEqual(["Public ForumPF", "Lincoln Douglas (Open)LD", "NDTCollege Policy"]);
    expect(text(el)).not.toContain("Congress");
    expect(requested.some((p) => p.includes("/results/11") || p.includes("/results/41"))).toBe(false);

    // The first event is open already; the others load only when expanded.
    expect(toggle(el, "Collapse event Public Forum").getAttribute("aria-expanded")).toBe("true");
    expect(requested.filter((p) => /\/results\/\d+$/.test(p))).toEqual(["/api/tabroom/rest/tourns/40372/results/21"]);

    await click(toggle(el, "Expand event Lincoln Douglas (Open)"));
    await settle();
    const ld = el.querySelector("[data-event-results='OPLD']")!;
    const order = [...ld.querySelectorAll("[data-elim-bracket], [data-final-places], [data-speaker-awards]")].map((n) =>
      n.hasAttribute("data-elim-bracket") ? "bracket" : n.hasAttribute("data-final-places") ? "finals" : "speakers",
    );
    expect(order).toEqual(["bracket", "finals", "speakers"]);
    expect(ld.querySelector("[data-final-places]")!.textContent).toBe("1Gold Gold One · First High2Silver Silver One · Second High");
    expect(ld.querySelector("[data-speaker-awards]")!.textContent).toBe("1Al One First High2Bo Two Second High");
    expect(ld.querySelector("[data-speaker-awards]")!.className).toContain("text-[11px]");
  });

  it("collapses again", async () => {
    const el = await render(<RecentResultsSection tourns={[tourn()]} state="ready" />, contextValue({ client: clientWith(handler([])) }));
    await click(toggle(el, "Expand tournament UCLA Invitational"));
    await settle();
    await click(toggle(el, "Collapse tournament UCLA Invitational"));
    expect(el.querySelector("tr[data-depth='1']")).toBeNull();
  });

  it("says so for a tournament with no top-format results", async () => {
    const client = clientWith((path) => (path.endsWith("/results") ? { 3: index[3] } : []));
    const el = await render(<RecentResultsSection tourns={[tourn()]} state="ready" />, contextValue({ client }));
    await click(toggle(el, "Expand tournament UCLA Invitational"));
    await settle();
    expect(text(el)).toContain("No PF, LD, Policy or College Policy results have been posted for this tournament.");
  });

  it("shows the error when a tournament's results cannot be loaded", async () => {
    const client = clientWith(() => new Response(JSON.stringify({ detail: "Boom" }), { status: 500 }));
    const el = await render(<RecentResultsSection tourns={[tourn()]} state="ready" />, contextValue({ client }));
    await click(toggle(el, "Expand tournament UCLA Invitational"));
    await settle();
    expect(el.querySelector("[role=alert]")?.textContent).toBe("Boom");
  });

  it("shows a bracket result set when only that is posted, and a note when nothing else is", async () => {
    const el = await render(
      <RecentResultsSection tourns={[tourn()]} state="ready" />,
      contextValue({ client: clientWith((p) => (p.endsWith("/results") ? { 4: index[4] } : p.endsWith("/rounds") ? [] : [{ id: 41, label: "Bracket", tag: "bracket" }])) }),
    );
    await click(toggle(el, "Expand tournament UCLA Invitational"));
    await settle();
    expect(text(el)).toContain("Bracket");
    expect(text(el)).toContain("aren’t available here yet");
  });

  it("shows an empty note, and a loading state", async () => {
    let el = await render(<RecentResultsSection tourns={[]} state="ready" />);
    expect(text(el)).toContain("No tournaments finished with results in the last 7 days.");
    expect(el.querySelector("button")).toBeNull();
    let opened = 0;
    el = await render(<RecentResultsSection tourns={[]} state="ready" onShowArchive={() => opened++} />);
    await click(el.querySelector("button")!);
    expect(text(el)).toContain("Browse all past results");
    expect(opened).toBe(1);
    el = await render(<RecentResultsSection tourns={[]} state="loading" />);
    expect(text(el)).toContain("Loading recent results…");
  });
});

describe("UpcomingTournamentsPage", () => {
  it("lists recent results above the upcoming tournaments", async () => {
    const day = 86_400_000;
    const iso = (ms: number) => new Date(ms).toISOString();
    const client = clientWith((path) => {
      if (path.includes("/host/demo")) return { tournId: 1, username: "demo" };
      if (path.includes("/rest/tourns?"))
        return [{ id: 40372, name: "UCLA Invitational", start: iso(Date.now() - 4 * day), end: iso(Date.now() - 3 * day), city: "Los Angeles", state: "CA" }];
      if (path.includes("/rest/circuits/active")) return [];
      if (path.endsWith("/pages/invite/upcoming"))
        return [{ id: "9", tournId: 9, webname: null, name: "Future Classic", location: null, state: "TX", country: null, start: iso(Date.now() + 5 * day), end: iso(Date.now() + 6 * day) }];
      if (path.includes("/host/tourns")) return new Response("{}", { status: 401 });
      return [];
    });
    const el = await render(<UpcomingTournamentsPage />, contextValue({ client }));
    await settle();
    const html = el.innerHTML;
    expect(html.indexOf("Recent results")).toBeGreaterThan(-1);
    expect(html.indexOf("Recent results")).toBeLessThan(html.indexOf("Upcoming tournaments"));
    expect(html.indexOf("UCLA Invitational")).toBeLessThan(html.indexOf("Future Classic"));
  });
});
