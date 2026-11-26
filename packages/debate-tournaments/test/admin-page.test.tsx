// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { TournamentAdmin } from "../src/ui/client";
import { AdminView, TournamentAdminPage } from "../src/ui/pages/TournamentAdminPage";
import { byText, click, clientWith, contextValue, render, text, unmountAll } from "./helpers/dom";

afterEach(unmountAll);

const view = (patch: Partial<TournamentAdmin> = {}): TournamentAdmin => ({
  viewer: { username: "owner@example.com", name: "Olive Owner", mock: false },
  tourn: {
    id: 7,
    name: "Golden Gate Invitational",
    webname: "golden-gate",
    city: "Oakland",
    state: "CA",
    country: "US",
    tz: "America/Los_Angeles",
    start: "2031-04-11T16:00:00Z",
    end: "2031-04-12T23:00:00Z",
    regStart: null,
    regEnd: "2031-04-01T19:00:00Z",
    hidden: false,
  },
  events: [
    { id: 1, abbr: "CX", name: "Policy", type: "debate", level: "open", fee: 30, entryCount: 2 },
    { id: 2, abbr: "PF", name: "Public Forum", type: "debate", level: null, fee: null, entryCount: 0 },
  ],
  schools: [{ id: 1, name: "Oakland Tech", code: null, entryCount: 2 }],
  entries: [
    { id: 1, code: "Oakland AB", name: "Ann Bee", eventAbbr: "CX", schoolName: "Oakland Tech", status: "active" },
    { id: 2, code: "Oakland CD", name: "Oakland CD", eventAbbr: null, schoolName: null, status: "dropped" },
    { id: 3, code: null, name: null, eventAbbr: "CX", schoolName: "Oakland Tech", status: "waitlist" },
  ],
  judges: [
    { id: 1, code: "J1", name: "Jo Judge", first: "Jo", last: "Judge", schoolName: "Oakland Tech", active: true },
    { id: 2, code: null, name: "", first: null, last: null, schoolName: null, active: false },
  ],
  rooms: [
    { id: 1, name: "Room 101", building: "Main" },
    { id: 2, name: "Gym", building: null },
  ],
  rounds: [
    { id: 1, name: 1, label: null, type: "prelim", eventAbbr: "CX", published: true, resultsPosted: true, sectionCount: 4, start: "2031-04-11T17:00:00Z" },
    { id: 2, name: 2, label: "Round Two", type: "prelim", eventAbbr: "CX", published: false, resultsPosted: false, sectionCount: 0, start: null },
  ],
  resultSets: [
    { id: 11, label: "Speaker Awards", eventAbbr: "CX", published: true },
    { id: 12, label: null, eventAbbr: null, published: false },
  ],
  ...patch,
});

const tab = (el: HTMLElement, label: string) => byText(el, "nav button", new RegExp(`^${label}`)) as HTMLElement;
const rows = (el: HTMLElement) => [...el.querySelectorAll("tbody tr")].map((r) => [...r.querySelectorAll("td")].map((c) => c.textContent));

describe("TournamentAdminPage", () => {
  it("loads the admin view from the host API and the owner's setup from the tab API", async () => {
    const requested: string[] = [];
    const client = clientWith((path) => {
      requested.push(path);
      if (path.endsWith("/admin")) return view();
      if (path.endsWith("/timeslots")) return [{ id: 1, name: "Friday", start: "2031-04-11T16:00:00Z", end: null }];
      if (path.endsWith("/categories")) return [{ id: 1, name: "Policy Judges", abbr: "POL" }];
    });
    const el = await render(<TournamentAdminPage tournId={7} />, contextValue({ client }));

    expect(requested).toEqual(expect.arrayContaining(["/api/tabroom/host/tourns/7/admin", "/api/tabroom/tab/tourns/7/timeslots", "/api/tabroom/tab/tourns/7/categories"]));
    expect(text(el)).toContain("Golden Gate Invitational");
    expect(text(el)).toContain("Tournament setup");
    expect(rows(el).find((r) => r[0] === "Friday")).toEqual(["Friday", expect.stringContaining("Apr 11"), "—"]);
    expect(rows(el)).toContainEqual(["Policy Judges", "POL"]);
    expect(byText(el, "a", /All tournaments/)?.getAttribute("href")).toBe("/tournament");
  });

  it("shows a refusal from the API instead of the view", async () => {
    const client = clientWith(() => new Response(JSON.stringify({ detail: "Only the owner can see this." }), { status: 403 }));
    const el = await render(<TournamentAdminPage tournId={7} />, contextValue({ client }));
    expect(text(el)).toContain("Only the owner can see this.");
    expect(text(el)).not.toContain("Tournament admin");
  });

  it("skips the setup section for the shared demo admin and offers the demo's mock-data editor", async () => {
    const requested: string[] = [];
    const demo = view({
      viewer: { username: "demo.admin", name: "demo.admin", mock: true },
      tourn: { ...view().tourn, id: 90001, name: "Demo Open" },
    });
    const client = clientWith((path) => {
      requested.push(path);
      return demo;
    });
    const el = await render(<TournamentAdminPage tournId={90001} />, contextValue({ client }));
    expect(requested.some((p) => p.includes("/tab/"))).toBe(false);
    expect(text(el)).toContain("Demo admin");
    expect(text(el)).toContain("Edit mock data");
    expect(text(el)).not.toContain("Tournament setup");
  });
});

const show = (v: TournamentAdmin) => render(<AdminView view={v} />, contextValue({ client: clientWith(() => []) }));

describe("AdminView", () => {
  it("summarizes the tournament, its viewer and its events", async () => {
    const el = await show(view());
    expect(text(el.querySelector("h1"))).toBe("Golden Gate Invitational");
    expect(text(el)).toContain("Apr 11, 2031 – Apr 12, 2031 · Oakland, CA, US");
    expect(text(el)).toContain("Signed in as owner@example.com");
    expect(text(el)).toContain("(Olive Owner)");
    expect(text(el)).toContain("Owner");
    expect(text(el)).not.toContain("Demo admin");
    expect(text(el)).toContain("Closes Apr 1, 2031");
    const stats = [...el.querySelectorAll("dl > div, dl > *")].map((n) => n.textContent);
    expect(stats).toEqual(["Events2", "Entries1", "Judges2", expect.stringContaining("Closes")]);

    expect(rows(el).slice(0, 2)).toEqual([
      ["Policy CX", "open", "2", "$30"],
      ["Public Forum PF", "—", "0", "—"],
    ]);
    const links = Object.fromEntries([...el.querySelectorAll("a")].map((a) => [a.textContent?.trim(), a.getAttribute("href")]));
    expect(links["Public invite"]).toBe("/tournament/7");
    expect(links["Pairings"]).toBe("/tournament/7/rounds");
    expect(links["Results"]).toBe("/tournament/7/results");
  });

  it("flags a hidden tournament and a mock viewer", async () => {
    const el = await show(view({ viewer: { username: "demo.admin", name: "demo.admin", mock: true }, tourn: { ...view().tourn, hidden: true, regEnd: null, city: null, state: null, country: null } }));
    expect(text(el.querySelector("h1"))).toContain("Hidden");
    expect(text(el)).toContain("Demo admin");
    expect(text(el)).not.toContain("(demo.admin)");
    expect(text(el)).toContain("RegistrationOpen");
    expect(text(el)).toContain("Apr 12, 2031");
  });

  it("says when there are no events", async () => {
    const el = await show(view({ events: [] }));
    expect(text(el)).toContain("Events (0)");
    expect(text(el)).toContain("No events yet.");
  });

  it("counts each section on its tab", async () => {
    const el = await show(view());
    const counts = [...el.querySelectorAll("nav button")].map((b) => b.textContent);
    expect(counts).toEqual(["Schedule2", "Entries3", "Schools1", "Judges2", "Rooms2", "Results2"]);
    expect(tab(el, "Schedule").getAttribute("aria-pressed")).toBe("true");
  });

  it("starts on the schedule, linking only published rounds", async () => {
    const el = await show(view());
    const [first, second] = rows(el).slice(2);
    expect(first).toEqual(["Round 1", "CX", expect.stringMatching(/Apr 11.*(PDT|PST)/), "4", "Published", "Posted"]);
    expect(second).toEqual(["Round Two", "CX", "—", "0", "Draft", "—"]);
    const published = byText(el, "td a", /Round 1/);
    expect(published?.getAttribute("href")).toBe("/tournament/7/rounds/CX/1");
    expect(byText(el, "td a", /Round Two/)).toBeNull();
  });

  it("says when nothing is scheduled", async () => {
    const el = await show(view({ rounds: [] }));
    expect(text(el)).toContain("No rounds scheduled yet.");
  });

  it("lists entries with their codes, names and status", async () => {
    const el = await show(view());
    await click(tab(el, "Entries"));
    expect(tab(el, "Entries").getAttribute("aria-pressed")).toBe("true");
    expect(rows(el).slice(2)).toEqual([
      ["Oakland ABAnn Bee", "CX", "Oakland Tech", "active"],
      ["Oakland CD", "—", "—", "dropped"],
      ["—", "CX", "Oakland Tech", "waitlist"],
    ]);
  });

  it("lists schools, judges, rooms and result sets", async () => {
    const el = await show(view());
    await click(tab(el, "Schools"));
    expect(rows(el).slice(2)).toEqual([["Oakland Tech", "—", "2"]]);
    await click(tab(el, "Judges"));
    expect(rows(el).slice(2)).toEqual([
      ["Jo Judge", "J1", "Oakland Tech", "Active"],
      ["—", "—", "Hired", "Inactive"],
    ]);
    await click(tab(el, "Rooms"));
    expect(rows(el).slice(2)).toEqual([["Room 101", "Main"], ["Gym", "—"]]);
    await click(tab(el, "Results"));
    expect(rows(el).slice(2)).toEqual([
      ["Speaker Awards", "CX", "Published"],
      ["Result set 12", "—", "Not published"],
    ]);
    expect(byText(el, "td a", "Speaker Awards")?.getAttribute("href")).toBe("/tournament/7/results/11");
    expect(byText(el, "td a", "Result set 12")).toBeNull();
  });

  it("shows an empty message for each section with nothing in it", async () => {
    const el = await show(view({ entries: [], schools: [], judges: [], rooms: [], resultSets: [] }));
    const expected: Array<[string, string]> = [
      ["Entries", "No entries yet."],
      ["Schools", "No schools registered yet."],
      ["Judges", "No judges yet."],
      ["Rooms", "No rooms yet."],
      ["Results", "No result sets yet."],
    ];
    for (const [label, message] of expected) {
      await click(tab(el, label));
      expect(text(el)).toContain(message);
    }
  });
});
