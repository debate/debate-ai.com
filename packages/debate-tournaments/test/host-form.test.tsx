// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { TOURNAMENT_FORMATS } from "../src/host/formats";
import { HostTournamentPage } from "../src/ui/pages/HostTournamentPage";
import { byText, click, clientWith, contextValue, render, submit, text, type, unmountAll } from "./helpers/dom";

afterEach(unmountAll);

const field = (root: ParentNode, label: string, nth = 0) => {
  const holder = [...root.querySelectorAll("label")].filter((l) => l.textContent === label)[nth]?.parentElement;
  return holder?.querySelector("input, select, textarea") ?? null;
};
const toggle = (root: ParentNode, name: string) =>
  [...root.querySelectorAll('button[role="switch"]')].find((b) => b.parentElement?.textContent?.startsWith(name)) as HTMLElement;

const created = { id: 77, name: "Golden Gate Invitational", webname: "golden-gate", start: null, end: null, tz: "UTC", events: [] };

function setup(respond: (init?: RequestInit) => Response | unknown = () => ({ tournament: created })) {
  const posts: Array<{ path: string; body: any }> = [];
  const client = clientWith((path, init) => {
    posts.push({ path, body: init?.body ? JSON.parse(String(init.body)) : null });
    return respond(init);
  });
  return { posts, client };
}

describe("HostTournamentPage form", () => {
  it("starts with Policy picked, the start date prefilled, and a draft per picked format", async () => {
    const { client } = setup();
    const el = await render(<HostTournamentPage />, contextValue({ client }));
    expect(toggle(el, "Policy").getAttribute("aria-checked")).toBe("true");
    expect(toggle(el, "Lincoln").getAttribute("aria-checked")).toBe("false");
    expect((field(el, "Starts") as HTMLInputElement).value).toMatch(/^\d{4}-\d{2}-\d{2}T09:00$/);
    expect((field(el, "Ends") as HTMLInputElement).value).toBe("");
    expect(field(el, "Entries per school")).not.toBeNull();
    expect(byText(el, "button", /Create tournament/)?.hasAttribute("disabled")).toBe(false);
    expect(text(el)).toContain("Runs Policy");
    expect(el.querySelector('a[href="/tournament/admin/-1"], a[href*="admin"]')).not.toBeNull();
  });

  it("posts the whole form, normalized, and links to the new tournament", async () => {
    const { client, posts } = setup();
    const el = await render(<HostTournamentPage />, contextValue({ client }));

    await type(field(el, "Name"), "  Golden Gate Invitational ");
    await type(field(el, "Starts"), "2031-04-11T09:00");
    await type(field(el, "Ends"), "2031-04-12T17:00");
    await type(field(el, "Registration closes"), "2031-04-01T12:00");
    await type(field(el, "Entry fees are charged in"), "EUR");
    await click(byText(el, "button", /Virtual/));
    expect(byText(el, "button", /Virtual/)?.getAttribute("aria-pressed")).toBe("true");
    expect(byText(el, "button", /In-Person/)?.getAttribute("aria-pressed")).toBe("false");
    await type(field(el, "Venue"), " Online ");
    await type(field(el, "City"), "Oakland");
    await type(field(el, "State / region"), "CA");
    await type(field(el, "Country"), "US");

    await click(toggle(el, "Lincoln"));
    expect(text(el)).toContain("Runs Policy, Lincoln");
    await type(field(el, "Division", 0), "novice");
    await type(field(el, "Entries written as", 0), "initials");
    await type(field(el, "Entries per school", 0), "4");
    await type(field(el, "Entry fee", 0), "12.5");
    await type(field(el, "Invite note", 0), "  Bring a laptop  ");
    expect(text(el)).toContain("Blank for free, in eur.");

    await submit(el.querySelector("form"));

    expect(posts).toHaveLength(1);
    expect(posts[0].path).toBe("/api/tabroom/host/tourns");
    const body = posts[0].body;
    expect(body).toMatchObject({
      name: "Golden Gate Invitational",
      scheduledType: "virtual",
      venue: "Online",
      city: "Oakland",
      state: "CA",
      country: "us",
      currency: "eur",
      start: new Date("2031-04-11T09:00").toISOString(),
      end: new Date("2031-04-12T17:00").toISOString(),
      regEnd: new Date("2031-04-01T12:00").toISOString(),
    });
    expect(body.events).toHaveLength(2);
    expect(body.events[0]).toMatchObject({ level: "novice", codeStyle: "initials", schoolCap: 4, fee: 12.5, description: "Bring a laptop" });
    expect(body.events[1]).toMatchObject({ schoolCap: null, fee: null, description: "" });

    expect(text(el)).toContain("Golden Gate Invitational is set up");
    const hrefs = [...el.querySelectorAll("a")].map((a) => [a.textContent?.trim(), a.getAttribute("href")]);
    expect(hrefs).toContainEqual(["Open the admin view", "/tournament/77/admin"]);
    expect(hrefs).toContainEqual(["Public invite", "/tournament/77"]);
    expect(hrefs).toContainEqual(["Pairings", "/tournament/77/rounds"]);
  });

  it("requires an end date before anything is posted", async () => {
    const { client, posts } = setup();
    const el = await render(<HostTournamentPage />, contextValue({ client }));
    await type(field(el, "Name"), "Golden Gate");
    await submit(el.querySelector("form"));
    expect(el.querySelector('[role="alert"]')?.textContent).toBe("Give the tournament a start and an end date.");
    expect(posts).toHaveLength(0);
  });

  it("requires at least one format, and disables the button without one", async () => {
    const { client, posts } = setup();
    const el = await render(<HostTournamentPage />, contextValue({ client }));
    await type(field(el, "Ends"), "2031-04-12T17:00");
    await click(toggle(el, "Policy"));
    expect(byText(el, "button", /Create tournament/)?.hasAttribute("disabled")).toBe(true);
    expect(text(el)).toContain("Pick at least one format above.");
    expect(field(el, "Entries per school")).toBeNull();
    await submit(el.querySelector("form"));
    expect(el.querySelector('[role="alert"]')?.textContent).toBe("Pick at least one format to run.");
    expect(posts).toHaveLength(0);
  });

  it("shows the API's refusal and lets the host try again", async () => {
    let attempts = 0;
    const { client } = setup(() => {
      attempts += 1;
      return attempts === 1
        ? new Response(JSON.stringify({ detail: "Sign in to host a tournament." }), { status: 401, headers: { "content-type": "application/json" } })
        : { tournament: created };
    });
    const el = await render(<HostTournamentPage />, contextValue({ client }));
    await type(field(el, "Name"), "Golden Gate");
    await type(field(el, "Ends"), "2031-04-12T17:00");
    await submit(el.querySelector("form"));
    expect(el.querySelector('[role="alert"]')?.textContent).toContain("Sign in");
    expect(byText(el, "button", /Create tournament/)?.hasAttribute("disabled")).toBe(false);

    await submit(el.querySelector("form"));
    expect(el.querySelector('[role="alert"]')).toBeNull();
    expect(text(el)).toContain("is set up");
    expect(attempts).toBe(2);
  });

  it("lists every format with how its entries are sized", async () => {
    const el = await render(<HostTournamentPage />, contextValue({ client: setup().client }));
    expect(el.querySelectorAll('button[role="switch"]')).toHaveLength(TOURNAMENT_FORMATS.length);
    expect(text(el)).toContain("Teams of 2");
  });
});
