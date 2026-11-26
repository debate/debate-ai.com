// @vitest-environment jsdom
import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import type { TournamentSidebar } from "../src/sidebar";
import type { TournamentInvite } from "../src/ui/client";
import { TournamentLinksMenu } from "../src/ui/TournamentLinksMenu";
import { byText, click, clientWith, contextValue, render, settle, text, unmountAll } from "./helpers/dom";

afterEach(unmountAll);

const invite: TournamentInvite = {
  id: 42,
  name: "Spring Open",
  city: null,
  state: null,
  country: null,
  tz: "UTC",
  webname: "springopen",
  start: "2026-03-06T15:00:00Z",
  end: "2026-03-08T15:00:00Z",
  reg_start: "2026-01-01T15:00:00Z",
  reg_end: "2026-03-01T15:00:00Z",
  Files: [{ id: 1, label: "Invitation PDF", filename: "invite.pdf", tag: null }],
  Webpages: [
    { id: 5, title: "Housing", content: "x" },
    { id: 6, title: "Awards", content: "x" },
    { id: 7, title: "Front", content: "x", special: "main" },
  ],
  Events: [],
  Contacts: [{ id: 1, first: "Pat", last: "Lee", email: "pat@example.com" }, { id: 2, first: null, last: null, email: "x@example.com" }, { id: 3, first: "No", last: "Mail", email: null }],
};

const scraped: TournamentSidebar = {
  groups: [
    { title: "General", links: [{ label: "Invitation", href: "https://www.tabroom.com/index/tourn/main.mhtml?tourn_id=42" }, { label: "Livestream", href: "https://www.tabroom.com/index/tourn/stream.mhtml?tourn_id=42" }] },
    { title: "Locations", links: [{ label: "Campus map", href: "https://maps.example/campus" }] },
    { title: "Circuits", links: [{ label: "TFA", href: "https://www.tabroom.com/index/circuit/index.mhtml?circuit_id=3", title: "Texas Forensic Association" }] },
    { title: "Pages & Uploads", links: [{ label: "Program", href: "https://s3.amazonaws.com/f/p.pdf", download: true }, { label: "Rules", href: "/rules" }] },
  ],
  pastEditions: "https://www.tabroom.com/index/tourn/past.mhtml?webname=springopen",
  deadlines: [{ label: "Entries Due", value: "Thu Mar 5 at 5:00 PM", note: "Hard deadline" }],
  tz: "CST",
};

const panel = (el: HTMLElement) => el.querySelector("[id]:not(button)") as HTMLElement | null;
const trigger = (el: HTMLElement) => byText(el, "button", /Info & links/) as HTMLButtonElement;
const headings = (el: HTMLElement) => [...el.querySelectorAll("h3")].map((h) => h.textContent);
const hrefs = (root: ParentNode) => [...root.querySelectorAll("a")].map((a) => a.getAttribute("href"));

describe("TournamentLinksMenu for a hosted tournament", () => {
  it("builds the menu from the invite and opens ours in place", async () => {
    const el = await render(<TournamentLinksMenu invite={invite} />);
    expect(trigger(el).getAttribute("aria-expanded")).toBe("false");
    expect(panel(el)).toBeNull();

    await click(trigger(el));
    expect(trigger(el).getAttribute("aria-expanded")).toBe("true");
    expect(trigger(el).getAttribute("aria-controls")).toBe(panel(el)!.id);
    expect(headings(el)).toEqual(["Pages & Uploads", "Dates & Deadlines", "Contacts"]);

    const links = [...panel(el)!.querySelectorAll("a")].map((a) => [a.textContent, a.getAttribute("href"), a.getAttribute("target")]);
    expect(links).toEqual([
      ["Invitation PDF", "https://s3.amazonaws.com/tabroom-files/tourns/42/postings/1/invite.pdf", "_blank"],
      ["Awards", "/tournament/42#page-6", null],
      ["Housing", "/tournament/42#page-5", null],
      ["Pat Lee", "mailto:pat@example.com", "_blank"],
      ["x@example.com", "mailto:x@example.com", "_blank"],
    ]);
    const dates = [...panel(el)!.querySelectorAll("dt")].map((dt) => [dt.textContent, dt.nextElementSibling?.textContent]);
    expect(dates.map(([label]) => label)).toEqual(["Tournament Dates", "Registration Opens", "Registration Closes"]);
    expect(dates[0][1]).toBe("Mar 6, 2026 to Mar 8, 2026");
  });

  it("does not ask the live proxy for a sidebar", async () => {
    const calls: string[] = [];
    const client = clientWith((path) => (calls.push(path), {}));
    const el = await render(<TournamentLinksMenu invite={invite} />, contextValue({ client }));
    await click(trigger(el));
    expect(calls).toEqual([]);
  });

  it("closes on Escape and on a click outside, but not on a click inside", async () => {
    const el = await render(<TournamentLinksMenu invite={invite} />);
    await click(trigger(el));
    await act(async () => panel(el)!.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(panel(el)).not.toBeNull();

    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab" })));
    expect(panel(el)).not.toBeNull();
    await act(async () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })));
    expect(panel(el)).toBeNull();

    await click(trigger(el));
    await act(async () => document.body.dispatchEvent(new Event("pointerdown", { bubbles: true })));
    expect(panel(el)).toBeNull();
  });

  it("toggles closed from its own button", async () => {
    const el = await render(<TournamentLinksMenu invite={invite} />);
    await click(trigger(el));
    await click(trigger(el));
    expect(panel(el)).toBeNull();
  });

  it("renders nothing when the invite has no pages, uploads, contacts or dates", async () => {
    const bare = { ...invite, Files: [], Webpages: [], Contacts: [], start: null, end: null, reg_start: null, reg_end: null };
    const el = await render(<TournamentLinksMenu invite={bare} />);
    expect(el.querySelector("button")).toBeNull();
  });

  it("shows a single start date, not a range, for a one-day tournament", async () => {
    const el = await render(<TournamentLinksMenu invite={{ ...invite, end: invite.start, Files: [], Webpages: [], Contacts: [], reg_start: null, reg_end: null }} />);
    await click(trigger(el));
    expect(text(el)).toContain("Mar 6, 2026");
    expect(text(el)).not.toContain(" to ");
  });
});

describe("TournamentLinksMenu for a live Tabroom tournament", () => {
  const liveClient = (sidebar: () => unknown) =>
    clientWith((path) => {
      if (!path.startsWith("/api/tabroom-beta")) return new Response("{}", { status: 404 });
      if (path.includes("/sidebar/")) return sidebar();
      if (path.includes("/invite")) return invite;
      return {};
    }, { liveApiBase: "/api/tabroom-beta" });

  it("builds from the invite with Tabroom's own page links, and the common Tabroom pages", async () => {
    const el = await render(<TournamentLinksMenu invite={invite} source="tabroom" />, contextValue({ client: clientWith(() => ({}), { liveApiBase: "/api/live" }) }));
    await click(trigger(el));
    const onTabroom = [...panel(el)!.querySelectorAll("section")].find((s) => s.querySelector("h3")?.textContent === "On Tabroom")!;
    const others = [...onTabroom.querySelectorAll("a")].filter((a) => !a.hasAttribute("aria-label") && a.getAttribute("target") === "_blank").map((a) => a.textContent);
    expect(others).toEqual(["Entries", "Judges", "Live Updates", "Events & Divisions", "Institutions In Attendance", "Email Archive"]);
    expect(hrefs(panel(el)!)).toContain("https://www.tabroom.com/index/tourn/main.mhtml?webpage_id=5&tourn_id=42");
    // Our own Invitation, Pairings and Results pages are opened here, with Tabroom's beside them.
    const own = [...onTabroom.querySelectorAll("div > a:first-child")].map((a) => [a.textContent, a.getAttribute("href")]);
    expect(own).toEqual([
      ["Invitation", "/tournament/42"],
      ["Pairings", "/tournament/42/rounds"],
      ["Results", "/tournament/42/results"],
    ]);
    expect(onTabroom.querySelector('a[aria-label="Pairings on Tabroom"]')?.getAttribute("href")).toBe(
      "https://www.tabroom.com/index/tourn/postings/index.mhtml?tourn_id=42",
    );
    expect(headings(el)).toContain("Past Years' Editions");
    expect(hrefs(panel(el)!)).toContain("https://www.tabroom.com/index/tourn/past.mhtml?webname=springopen");
    expect(text(onTabroom)).toContain("Judges");
    expect(text(onTabroom)).not.toContain("Past Years' Editions");
  });

  it("loads the scraped sidebar once, on hover, and shows its groups in order", async () => {
    let requests = 0;
    const client = liveClient(() => (requests++, scraped));
    const el = await render(<TournamentLinksMenu invite={invite} source="tabroom" />, contextValue({ client }));
    // Resolve the invite so the client knows the tournament is live.
    await client.invite(invite.id);
    await act(async () => {
      el.firstElementChild!.dispatchEvent(new FocusEvent("focusin", { bubbles: true }));
    });
    await settle();
    expect(requests).toBe(1);
    await click(trigger(el));
    await settle();
    await click(trigger(el));
    await click(trigger(el));
    expect(requests).toBe(1);

    expect(headings(el)).toEqual(["Pages & Uploads", "Circuits", "Dates & DeadlinesCST", "On Tabroom", "Locations"]);
    const circuits = [...panel(el)!.querySelectorAll("section")][1];
    // The circuits group carries the past-editions link.
    expect([...circuits.querySelectorAll("a")].map((a) => a.textContent)).toEqual(["TFA", "Past Years' Editions"]);
    expect(circuits.querySelector("a")?.getAttribute("title")).toBe("Texas Forensic Association");

    const uploads = [...panel(el)!.querySelectorAll("section")][0];
    expect(uploads.querySelector("a")?.getAttribute("href")).toBe("https://s3.amazonaws.com/f/p.pdf");
    // A relative link stays in the app and has no new-tab target.
    expect(byText(uploads, "a", "Rules")?.getAttribute("target")).toBeNull();

    expect(text(panel(el)!.querySelector("dl"))).toContain("Entries Due");
    expect(panel(el)!.querySelector("[title='Hard deadline']")).not.toBeNull();
    expect(text(el)).toContain("CST");
    // An extra General link Tabroom lists is kept; the invitation it already has in common is not repeated.
    expect(text(el)).toContain("Livestream");
    expect([...panel(el)!.querySelectorAll("a")].filter((a) => a.textContent === "Invitation")).toHaveLength(1);
  });

  it("tries again on the next hover when the sidebar could not be read", async () => {
    let requests = 0;
    const client = liveClient(() => {
      requests++;
      return requests === 1 ? new Response("{}", { status: 502 }) : scraped;
    });
    const el = await render(<TournamentLinksMenu invite={invite} source="tabroom" />, contextValue({ client }));
    await client.invite(invite.id);
    await click(trigger(el));
    await settle();
    expect(headings(el)).not.toContain("Locations");

    await click(trigger(el));
    await click(trigger(el));
    await settle();
    expect(requests).toBe(2);
    expect(headings(el)).toContain("Locations");
  });
});
