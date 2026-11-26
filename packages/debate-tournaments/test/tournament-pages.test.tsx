// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DEMO_TOURN_ID } from "../src/host/demo-account";
import { liveRoundState } from "../src/ui/live/demo-live";
import type { PublishedRound, TournamentInvite } from "../src/ui/client";
import { LiveNowList, ResultsPage } from "../src/ui/pages/ResultsPage";
import { RoundsPage } from "../src/ui/pages/RoundsPage";
import { TabroomTournamentPage } from "../src/ui/pages/TabroomTournamentPage";
import { TournamentInvitePage } from "../src/ui/pages/TournamentInvitePage";
import { clientWith, contextValue, render, text, unmountAll } from "./helpers/dom";

afterEach(unmountAll);

const round = (id: number, name: number, abbr: string, over: Partial<PublishedRound> = {}): PublishedRound => ({
  id,
  type: "prelim",
  name,
  label: null,
  Event: { id: abbr === "VCX" ? 1 : 2, name: abbr === "VCX" ? "Varsity Policy" : "Varsity LD", abbr, type: "debate" },
  ...over,
});

const linkTexts = (el: HTMLElement) => [...el.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href")]);

describe("RoundsPage", () => {
  const ctxFor = (rounds: PublishedRound[]) => contextValue({ client: clientWith(() => rounds) });

  it("says so when no pairings are published", async () => {
    const el = await render(<RoundsPage tournId={5} />, ctxFor([]));
    expect(text(el)).toContain("No pairings have been published yet.");
  });

  it("groups rounds by event, in name order, linking each to its pairings", async () => {
    const el = await render(
      <RoundsPage tournId={5} />,
      ctxFor([round(3, 2, "VCX"), round(1, 1, "VCX"), round(2, 1, "VLD", { label: "Round Robin" })]),
    );
    const titles = [...el.querySelectorAll("h2, h3, [data-slot=card-title]")].map((t) => t.textContent);
    expect(titles.join("|")).toContain("Varsity LD (VLD)|Varsity Policy (VCX)");
    expect(linkTexts(el)).toEqual([
      ["Round Robin", "/tournament/5/rounds/VLD/1"],
      ["R1", "/tournament/5/rounds/VCX/1"],
      ["R2", "/tournament/5/rounds/VCX/2"],
    ]);
    expect(text(el)).not.toContain("Bracket");
  });

  it("adds a bracket link, pointing at the last elimination round", async () => {
    const el = await render(
      <RoundsPage tournId={5} />,
      ctxFor([round(1, 1, "VCX"), round(2, 2, "VCX", { type: "elim", label: "Quarters" }), round(3, 3, "VCX", { type: "elim", label: "Semis" })]),
    );
    const bracket = [...el.querySelectorAll("a")].find((a) => a.textContent === "Bracket")!;
    expect(bracket.getAttribute("href")).toMatch(/VCX\/3$/);
    expect(bracket.getAttribute("title")).toBe("Every elimination round in one bracket");
    expect(text(el)).toContain("Quarters");
    expect(text(el)).toContain("Semis");
  });

  it("shows the live badge on every round of the demo tournament", async () => {
    const el = await render(<RoundsPage tournId={DEMO_TOURN_ID} />, ctxFor([round(1, 1, "VCX")]));
    expect(el.querySelector("[data-live-phase]")).not.toBeNull();
  });
});

describe("ResultsPage", () => {
  const results = {
    "2": { id: 2, name: "Varsity LD", abbr: "VLD", type: "debate", ResultSets: [{ id: 21, tag: "final", label: null, createdAt: "2026-03-02T10:00:00Z" }] },
    "1": {
      id: 1,
      name: "Varsity Policy",
      abbr: "VCX",
      type: "debate",
      ResultSets: [
        { id: 11, tag: "prelim_seed", label: "Prelim Seeds", createdAt: "2026-03-01T10:00:00Z" },
        { id: 12, tag: "bracket", label: "Bracket", createdAt: null },
      ],
    },
    "3": { id: 3, name: "Empty Event", abbr: "EE", type: "speech", ResultSets: [] },
  };

  it("lists result sets by event, skipping events with none", async () => {
    const el = await render(<ResultsPage tournId={5} />, contextFor(results));
    const headings = [...el.querySelectorAll("[data-slot=card-title], h2, h3")].map((n) => n.textContent);
    expect(headings.join("|")).toContain("Varsity LD (VLD)|Varsity Policy (VCX)");
    expect(text(el)).not.toContain("Empty Event");
    expect(linkTexts(el)).toEqual([
      ["finalMar 2, 2026", "/tournament/5/results/21"],
      ["Prelim SeedsMar 1, 2026", "/tournament/5/results/11"],
      ["Bracket", "/tournament/5/results/12"],
    ]);
  });

  it("says so when nothing has been published", async () => {
    const el = await render(<ResultsPage tournId={5} />, contextFor({ "3": results["3"] }));
    expect(text(el)).toContain("No results have been published yet.");
  });

  it("shows a failed load", async () => {
    const client = clientWith(() => new Response(JSON.stringify({ detail: "Nope" }), { status: 500 }));
    const el = await render(<ResultsPage tournId={5} />, contextValue({ client }));
    expect(el.querySelector('[role="alert"]')?.textContent).toBe("Nope");
  });

  function contextFor(body: unknown) {
    return contextValue({ client: clientWith(() => body) });
  }

  it("adds the simulated live rounds above the demo tournament's results", async () => {
    const el = await render(<ResultsPage tournId={DEMO_TOURN_ID} />, contextValue({ client: clientWith((path) => (path.endsWith("/rounds") ? [round(1, 1, "VCX")] : results)) }));
    expect(text(el)).toContain("Varsity Policy (VCX)");
  });
});

describe("LiveNowList", () => {
  /** A moment at which `roundId`'s simulated round is live. */
  function liveAt(r: PublishedRound): number {
    for (let now = 0; now < 60 * 60_000; now += 5_000) if (liveRoundState(r.id, r.Event.abbr, r.Event.type, now).phase === "live") return now;
    throw new Error("never live");
  }

  it("shows nothing before the clock starts or when no round is live", async () => {
    const live = round(1, 1, "VCX");
    const quiet = await render(<LiveNowList tournId={DEMO_TOURN_ID} rounds={[]} at={liveAt(live)} />);
    expect(quiet.innerHTML).toBe("");
    let idleAt = 0;
    while (liveRoundState(live.id, "VCX", "debate", idleAt).phase === "live") idleAt += 5_000;
    const idle = await render(<LiveNowList tournId={DEMO_TOURN_ID} rounds={[live]} at={idleAt} />);
    expect(idle.innerHTML).toBe("");
  });

  it("lists only each event's latest live round, sorted by event name", async () => {
    const early = round(1, 1, "VCX");
    const late = round(4, 2, "VCX", { label: "Round Two" });
    const ld = round(2, 1, "VLD");
    const at = liveAt(early);
    const all = [early, late, ld];
    const expected = new Map<number, PublishedRound>();
    for (const r of all) {
      if (liveRoundState(r.id, r.Event.abbr, r.Event.type, at).phase !== "live") continue;
      const seen = expected.get(r.Event.id);
      if (!seen || r.name > seen.name) expected.set(r.Event.id, r);
    }
    const el = await render(<LiveNowList tournId={DEMO_TOURN_ID} rounds={all} at={at} />);
    expect(text(el)).toContain("Live now (simulated)");
    const hrefs = [...el.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    expect(hrefs).toHaveLength(expected.size);
    for (const r of expected.values()) expect(hrefs.some((h) => h?.endsWith(`/${r.Event.abbr}/${r.name}`))).toBe(true);
    expect(el.querySelectorAll("[data-live-phase]").length).toBe(expected.size);
  });
});

describe("TabroomTournamentPage", () => {
  it("frames Tabroom's own page for the tournament, with a new-tab link", async () => {
    const el = await render(<TabroomTournamentPage tournId={321} name="Glenbrooks" />);
    const frame = el.querySelector("iframe")!;
    expect(frame.getAttribute("src")).toBe("https://beta.tabroom.com/invite/321");
    expect(frame.getAttribute("title")).toBe("Tabroom: Glenbrooks");
    const open = [...el.querySelectorAll("a")].find((a) => a.textContent?.includes("Open in new tab"))!;
    expect(open.getAttribute("href")).toBe("https://beta.tabroom.com/invite/321");
    expect(open.getAttribute("rel")).toBe("noopener noreferrer");
    expect(text(el)).toContain("Glenbrooks overview");
  });

  it("falls back to the id and a generic back link without a name", async () => {
    const el = await render(<TabroomTournamentPage tournId={321} />);
    expect(el.querySelector("iframe")?.getAttribute("title")).toBe("Tabroom: 321");
    expect(text(el)).toContain("Tournament overview");
  });
});

describe("TournamentInvitePage", () => {
  const invite: TournamentInvite = {
    id: 9,
    name: "Spring Open",
    city: "Austin",
    state: "TX",
    country: "US",
    tz: "America/Chicago",
    webname: "spring",
    start: "2026-03-06T15:00:00Z",
    end: "2026-03-08T23:00:00Z",
    reg_start: null,
    reg_end: "2026-03-01T06:00:00Z",
    Files: [
      { id: 1, label: "Invitation", filename: "invite.pdf", tag: null },
      { id: 2, label: null, filename: null, tag: null },
      { id: 3, label: null, filename: "rules & regs.pdf", tag: null },
    ],
    Webpages: [
      { id: 7, title: "Housing", content: "<p>Hotel &amp; <b>food</b></p><p>Rooms&nbsp;at 5&lt;6&gt;</p><br/>\n\n\n\n<div>&quot;ok&quot; &#39;fine&#39;</div>" },
      { id: 8, title: null, content: null },
    ],
    Events: [
      { id: 1, abbr: "VCX", name: "Varsity Policy", type: "debate", fee: 40, settings: { currency: "$" }, metadata: { entryCount: 12 } },
      { id: 2, abbr: "OO", name: "Oratory", type: "speech", fee: null },
      { id: 3, abbr: "JV", name: "JV LD", type: "debate", fee: 0, settings: { currency: "€" } },
    ],
    Contacts: [
      { id: 1, first: "Pat", last: "Lee", email: "pat@example.com" },
      { id: 2, first: "Sam", last: null, email: null },
    ],
  };

  it("shows dates, place and registration deadline in the tournament's time zone", async () => {
    const el = await render(<TournamentInvitePage invite={invite} />);
    const facts = [...el.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(facts).toEqual([
      ["Dates", "Mar 6, 2026 – Mar 8, 2026"],
      ["Location", "Austin, TX, US"],
      ["Registration", "Closes Mar 1, 12:00 AM CST"],
    ]);
  });

  it("lists events with entries and fees, using a dash for what is unknown", async () => {
    const el = await render(<TournamentInvitePage invite={invite} />);
    expect(text(el)).toContain("Events (3)");
    const rows = [...el.querySelectorAll("tbody tr")].map((tr) => [...tr.children].map((td) => td.textContent));
    expect(rows).toEqual([
      ["Varsity Policy VCX", "debate", "12", "$40"],
      ["Oratory OO", "speech", "—", "—"],
      ["JV LD JV", "debate", "—", "€0"],
    ]);
  });

  it("links documents that have a file, and shows the rest as plain text", async () => {
    const el = await render(<TournamentInvitePage invite={invite} />);
    const links = [...el.querySelectorAll('a[target="_blank"]')];
    expect(links.map((a) => a.getAttribute("href"))).toEqual([
      "https://s3.amazonaws.com/tabroom-files/tourns/9/postings/1/invite.pdf",
      "https://s3.amazonaws.com/tabroom-files/tourns/9/postings/3/rules%20%26%20regs.pdf",
    ]);
    expect(links[1].textContent).toBe("rules & regs.pdf");
    expect(text(el)).toContain("Invitation");
  });

  it("lists contacts, with a mail link only for those with an email", async () => {
    const el = await render(<TournamentInvitePage invite={invite} />);
    expect(text(el)).toContain("Pat Lee");
    expect(text(el)).toContain("Sam");
    expect([...el.querySelectorAll('a[href^="mailto:"]')].map((a) => a.getAttribute("href"))).toEqual(["mailto:pat@example.com"]);
  });

  it("renders tournament-authored pages as text, never as markup", async () => {
    const el = await render(<TournamentInvitePage invite={invite} />);
    const housing = el.querySelector("#page-7")!;
    expect(housing.textContent).toContain("Housing");
    expect(housing.querySelector("b")).toBeNull();
    expect(housing.querySelector("p.whitespace-pre-line")?.textContent).toBe("Hotel & food\nRooms at 5<6>\n\n\"ok\" 'fine'");
    expect(el.querySelector("#page-8")?.textContent).toContain("Information");
  });

  it("explains empty sections and missing facts", async () => {
    const bare: TournamentInvite = { ...invite, city: null, state: null, country: null, reg_end: null, Events: [], Files: [], Contacts: [], Webpages: [] };
    const el = await render(<TournamentInvitePage invite={bare} />);
    expect(text(el)).toContain("No events posted yet.");
    expect(text(el)).toContain("No documents posted.");
    expect(text(el)).toContain("No contacts listed.");
    const facts = [...el.querySelectorAll("dd")].map((dd) => dd.textContent);
    expect(facts.slice(1)).toEqual(["—", "—"]);
  });
});
