import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { renderToString } from "react-dom/server";
import { parseTabroomSidebar, sidebarFromInvite, tabroomTournamentLinks } from "../src/sidebar";
import { createTournamentsClient, type TournamentInvite } from "../src/ui/client";
import { TournamentsContext, defaultLink } from "../src/ui/shared";
import { TournamentNav } from "../src/ui/TournamentNav";
import { tournamentHrefs } from "../src/routes";

// The sidebar of Heart of Texas 2026 (tourn 40242) on classic Tabroom.
const html = readFileSync(new URL("./fixtures/tabroom-sidebar.html", import.meta.url), "utf8");

describe("parseTabroomSidebar", () => {
  const sidebar = parseTabroomSidebar(html);

  it("reads every link group, in Tabroom's order", () => {
    expect(sidebar.groups.map((g) => g.title)).toEqual(["Locations", "Contacts", "General", "Pages & Uploads", "Circuits"]);
  });

  it("reads the uploads and pages, marking files as downloads", () => {
    const pages = sidebar.groups.find((g) => g.title === "Pages & Uploads")!.links;
    expect(pages[0]).toEqual({
      label: "Tournament Program",
      href: "https://s3.amazonaws.com/tabroom-files/tourns/40242/postings/71921/2026HOTTournamentprogramcompressed.pdf",
      download: true,
    });
    expect(pages.map((p) => p.label)).toContain("LD Sophomore Hoe Down");
    expect(pages.find((p) => p.label === "Hotel")?.href).toBe("https://www.tabroom.com/index/tourn/main.mhtml?webpage_id=38898&tourn_id=40242");
  });

  it("reads circuits with their full names and the past editions link", () => {
    const circuits = sidebar.groups.find((g) => g.title === "Circuits")!.links;
    expect(circuits.map((c) => c.label)).toEqual([
      "NatCir – National Circuit (US HS)",
      "TFA – Texas Forensic Association",
      "TOC-UK – Tournament of Champions",
    ]);
    expect(circuits[0]?.href).toBe("https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=6");
    expect(sidebar.pastEditions).toBe("https://www.tabroom.com/index/tourn/past.mhtml?webname=heartoftx");
  });

  it("reads dates and deadlines with their time zone and notes", () => {
    expect(sidebar.tz).toBe("CDT");
    expect(sidebar.deadlines.slice(0, 5).map((d) => d.label)).toEqual([
      "Tournament Dates",
      "Registration Opens",
      "Registration Closes",
      "Fees Freeze After",
      "Judge Information Due",
    ]);
    expect(sidebar.deadlines[0]?.value).toBe("Oct 16 to Oct 18 2026");
    expect(sidebar.deadlines[3]?.note).toMatch(/still must pay entry fees/);
    expect(sidebar.deadlines.at(-1)).toEqual({ label: "VPF Entry Deadline", value: "Wed Sep 30 at 5:00 AM" });
  });

  it("gives an empty sidebar for a page without one", () => {
    expect(parseTabroomSidebar("<html><body>Nope</body></html>")).toEqual({ groups: [], pastEditions: null, deadlines: [], tz: null });
  });

  it("drops links that are not http(s) or mailto", () => {
    const parsed = parseTabroomSidebar('<div class="menu"><h6>Pages</h6><a href="javascript:alert(1)">x</a><a href="a.mhtml">ok</a></div>');
    expect(parsed.groups[0]?.links).toEqual([{ label: "ok", href: "https://www.tabroom.com/index/tourn/a.mhtml" }]);
  });
});

describe("tabroomTournamentLinks", () => {
  it("lists the pages every Tabroom tournament has", () => {
    const links = tabroomTournamentLinks(40242, "heartoftx");
    expect(links.map((l) => l.label)).toEqual([
      "Invitation",
      "Entries",
      "Judges",
      "Pairings",
      "Live Updates",
      "Results",
      "Events & Divisions",
      "Institutions In Attendance",
      "Email Archive",
      "Past Years' Editions",
    ]);
    expect(links.at(-1)?.href).toBe("https://www.tabroom.com/index/tourn/past.mhtml?webname=heartoftx");
  });
});

const invite: TournamentInvite = {
  id: 40242,
  name: "Heart of Texas Invitational",
  city: "Dallas",
  state: "TX",
  country: "US",
  tz: "America/Chicago",
  webname: "heartoftx",
  start: "2026-10-16T13:00:00.000Z",
  end: "2026-10-19T04:00:00.000Z",
  reg_start: "2026-08-07T13:00:00.000Z",
  reg_end: "2026-10-15T20:00:00.000Z",
  Files: [{ id: 71921, label: "Tournament Program", filename: "program.pdf", tag: "front" }],
  Webpages: [
    { id: 38899, title: "Main", content: "", special: "main" },
    { id: 38898, title: "Hotel", content: "" },
    { id: 39442, title: "Fees", content: "" },
  ],
  Events: [],
  Contacts: [{ id: 1, first: "Tim", last: "Mahoney", email: "coach@example.com" }],
};

describe("sidebarFromInvite", () => {
  it("builds uploads, pages (without the front page), contacts and dates from an invite", () => {
    const sidebar = sidebarFromInvite(invite, {
      fileUrl: (f) => `/files/${f.id}`,
      pageHref: (p) => `#page-${p.id}`,
      formatDate: (value, withTime) => (withTime ? `${value.slice(0, 10)} t` : value.slice(0, 10)),
    });
    expect(sidebar.groups).toEqual([
      {
        title: "Pages & Uploads",
        links: [
          { label: "Tournament Program", href: "/files/71921", download: true },
          { label: "Fees", href: "#page-39442" },
          { label: "Hotel", href: "#page-38898" },
        ],
      },
      { title: "Contacts", links: [{ label: "Tim Mahoney", href: "mailto:coach@example.com" }] },
    ]);
    expect(sidebar.deadlines.map((d) => d.label)).toEqual(["Tournament Dates", "Registration Opens", "Registration Closes"]);
  });

  it("leaves out empty groups", () => {
    const sidebar = sidebarFromInvite(
      { ...invite, Files: [], Webpages: [], Contacts: [], start: null, end: null, reg_start: null, reg_end: null },
      { fileUrl: () => null, pageHref: () => "", formatDate: (v) => v },
    );
    expect(sidebar).toEqual({ groups: [], pastEditions: null, deadlines: [], tz: null });
  });
});

describe("client.sidebar", () => {
  it("fetches a live tournament's sidebar once, and skips hosted ones", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const url = String(input);
      calls.push(url);
      if (url === "/api/tabroom/rest/tourns/1/invite") return new Response(JSON.stringify({ ...invite, id: 1 }));
      if (url === "/api/tabroom-beta/rest/tourns/40242/invite") return new Response(JSON.stringify(invite));
      if (url === "/api/tabroom-beta/sidebar/40242") return new Response(JSON.stringify(parseTabroomSidebar(html)));
      return new Response("{}", { status: 404 });
    }) as typeof fetch;
    const client = createTournamentsClient("/api/tabroom", fetchImpl, { liveApiBase: "/api/tabroom-beta" });
    const first = await client.sidebar(40242);
    const second = await client.sidebar(40242);
    expect(first?.pastEditions).toContain("heartoftx");
    expect(second).toBe(first);
    expect(calls.filter((c) => c.includes("/sidebar/"))).toHaveLength(1);
    expect(await client.sidebar(1)).toBeNull();
    expect(calls).not.toContain("/api/tabroom-beta/sidebar/1");
  });
});

describe("TournamentNav", () => {
  it("renders the Info & links dropdown beside the tabs when given the invite", () => {
    const client = createTournamentsClient("/api/tabroom");
    const out = renderToString(
      <TournamentsContext.Provider value={{ client, hrefs: tournamentHrefs("/tournaments"), Link: defaultLink }}>
        <TournamentNav tournId={40242} active="invite" name={invite.name} source="tabroom" invite={invite} />
      </TournamentsContext.Provider>,
    );
    expect(out).toContain("Info &amp; links");
    expect(out).toContain('aria-expanded="false"');
  });
});
