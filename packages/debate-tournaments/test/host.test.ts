/**
 * The host API — `POST /host/tourns` and `GET /host/tourns` — against the
 * same SQLite-backed D1 the read tests use, so the rows a created tournament
 * writes can be checked directly as well as through the invite the vendored
 * routes build from them.
 */

import { beforeAll, describe, expect, it } from "vitest";
import { applySqlFile, createSqliteD1, pkgPath } from "./helpers/sqlite-d1";
import { createTournamentsHandler } from "../src/api/handler";
import { runWithTabroomDb } from "../src/db/runtime";
import { TOURNAMENT_FORMATS, formatSummary, tournamentFormat } from "../src/host/formats";
import { slugifyTournamentName } from "../src/host/create-tournament";

const d1 = createSqliteD1();

beforeAll(() => {
  applySqlFile(d1, pkgPath("migrations/0001_tabroom_schema.sql"));
  applySqlFile(d1, pkgPath("test/fixtures/tournament.sql"));
});

const handler = createTournamentsHandler({
  basePath: "/api/tournaments",
  getDb: () => d1,
  getUser: (req) => (req.headers.get("x-user") ? { email: req.headers.get("x-user") } : null),
});

async function call(path: string, init: RequestInit = {}) {
  const res = await handler(new Request(`https://debate-ai.test/api/tournaments${path}`, init));
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, headers: res.headers, body };
}

const post = (path: string, body: unknown, email?: string) =>
  call(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(email ? { "x-user": email } : {}),
    },
    body: JSON.stringify(body),
  });

/** A minimal valid body, so each test can change one thing. */
const tournament = (overrides: Record<string, unknown> = {}) => ({
  name: "Bay Area Novice Invitational",
  scheduledType: "in-person",
  venue: "Glenbrook High",
  city: "San Jose",
  state: "CA",
  country: "us",
  tz: "America/Los_Angeles",
  start: "2031-04-11T16:00:00.000Z",
  end: "2031-04-12T02:00:00.000Z",
  currency: "usd",
  events: [{ format: "policy" }],
  ...overrides,
});

const rows = (sql: string, ...params: unknown[]) =>
  runWithTabroomDb(d1, async () => (await d1.prepare(sql).bind(...params).all<Record<string, unknown>>()).results);

describe("the three styles", () => {
  it("are Policy, LD and Public Forum, each with its own speech order", () => {
    expect(TOURNAMENT_FORMATS.map((format) => format.id)).toEqual(["policy", "ld", "pf"]);
    expect(TOURNAMENT_FORMATS.map((format) => format.abbr)).toEqual(["Policy", "LD", "PF"]);

    expect(tournamentFormat("policy")?.aff.map((speech) => speech.short)).toEqual(["1AC", "2AC", "1AR", "2AR"]);
    expect(tournamentFormat("ld")?.neg.map((speech) => speech.short)).toEqual(["1NC", "2NR"]);
    expect(tournamentFormat("pf")?.aff.map((speech) => speech.short)).toEqual(["AFF", "AS", "NAF"]);
  });

  it("mark PF as flip-decided and give the other two a fixed order", () => {
    expect(tournamentFormat("pf")?.variableOrder).toBe(true);
    expect(tournamentFormat("policy")?.variableOrder).toBe(false);
    expect(tournamentFormat("ld")?.variableOrder).toBe(false);
  });

  it("summarise each style for the creation form", () => {
    const summary = formatSummary(tournamentFormat("pf")!);
    expect(summary).toContain("CON");
    expect(summary).toContain("NEG");
    expect(summary).toMatch(/flip decides speaking order/);
  });

  it("slug a tournament name into a webname", () => {
    expect(slugifyTournamentName("Golden Gate Invitational")).toBe("golden-gate-invitational");
    expect(slugifyTournamentName("Ünïcodé  Debates!")).toBe("unicode-debates");
  });
});

describe("POST /host/tourns", () => {
  it("refuses an anonymous caller", async () => {
    const { status, body } = await post("/host/tourns", tournament());
    expect(status).toBe(401);
    expect(body.detail).toMatch(/Sign in/);
  });

  it("rejects a body that does not describe a tournament", async () => {
    const { status, body } = await post("/host/tourns", { name: "x" }, "host@example.com");
    expect(status).toBe(400);
    expect(body.detail).toBeTruthy();
    expect(Array.isArray(body.issues)).toBe(true);
  });

  it("rejects a tournament that ends before it starts", async () => {
    const { status, body } = await post(
      "/host/tourns",
      tournament({ start: "2031-04-12T02:00:00.000Z", end: "2031-04-11T16:00:00.000Z" }),
      "host@example.com",
    );
    expect(status).toBe(400);
    expect(body.detail).toMatch(/end before it starts/);
  });

  it("creates a tournament with a site, an owner and one event per format", async () => {
    const { status, body } = await post(
      "/host/tourns",
      tournament({
        events: [{ format: "policy" }, { format: "pf", level: "novice", schoolCap: 3, description: "Two on each side." }],
      }),
      "owner@example.com",
    );

    expect(status).toBe(201);
    expect(body.tournament.name).toBe("Bay Area Novice Invitational");
    expect(body.tournament.webname).toBe("bay-area-novice-invitational");
    expect(body.tournament.events.map((event: any) => event.abbr)).toEqual(["Policy", "PF"]);

    // The host's Tabroom person, and their ownership of the new tournament.
    const person = await rows("SELECT id, email FROM person WHERE email = ?", "owner@example.com");
    expect(person).toHaveLength(1);
    const permissions = await rows("SELECT tag, tourn FROM permission WHERE person = ?", person[0].id);
    expect(permissions).toEqual([{ tag: "owner", tourn: body.tournament.id }]);

    // A physical venue, linked to the tournament.
    const sites = await rows("SELECT name, online FROM site");
    expect(sites).toEqual([{ name: "Glenbrook High", online: 0 }]);
    const linked = await rows("SELECT site FROM tourn_site WHERE tourn = ?", body.tournament.id);
    expect(linked).toHaveLength(1);

    // The customizations, in the columns and setting tags the invite reads.
    const events = await rows("SELECT abbr, level, code_style, category FROM event WHERE tourn = ?", body.tournament.id);
    expect(events).toEqual([
      { abbr: "Policy", level: "open", code_style: "names", category: 11 },
      { abbr: "PF", level: "novice", code_style: "names", category: 12 },
    ]);
    const settings = await rows("SELECT event, tag, value, value_text FROM event_setting ORDER BY tag");
    expect(settings).toEqual([
      { event: 102, tag: "description", value: "text", value_text: "Two on each side." },
      { event: 102, tag: "school_cap", value: "3", value_text: null },
    ]);
    const currency = await rows("SELECT tag, value FROM tourn_setting WHERE tourn = ?", body.tournament.id);
    expect(currency).toEqual([{ tag: "currency", value: "usd" }]);
  });

  it("registers the host in every event, so pairings are never empty", async () => {
    const { body } = await post("/host/tourns", tournament({ name: "Second Invitational" }), "owner@example.com");
    const entries = await rows("SELECT event, active, waitlist FROM entry WHERE tourn = ?", body.tournament.id);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ event: body.tournament.events[0].id, active: 1, waitlist: 0 });
  });

  it("marks a virtual tournament's site online", async () => {
    const { status } = await post(
      "/host/tourns",
      tournament({ name: "Remote Regional", scheduledType: "virtual", venue: "" }),
      "owner@example.com",
    );
    expect(status).toBe(201);
    const online = await rows("SELECT name, online FROM site WHERE name = 'Online'");
    expect(online).toEqual([{ name: "Online", online: 1 }]);
  });

  it("gives a duplicate name a free webname rather than failing", async () => {
    const first = await post("/host/tourns", tournament({ name: "Clash Cup" }), "owner@example.com");
    const second = await post("/host/tourns", tournament({ name: "Clash Cup" }), "owner@example.com");
    expect(first.body.tournament.webname).toBe("clash-cup");
    expect(second.body.tournament.webname).toBe("clash-cup-2");
  });

  it("reuses the Tabroom person a second host already has", async () => {
    await post("/host/tourns", tournament({ name: "Third Invitational" }), "owner@example.com");
    const person = await rows("SELECT id FROM person WHERE email = ?", "owner@example.com");
    expect(person).toHaveLength(1);
  });

  it("publishes the created tournament to the vendored invite route", async () => {
    const { body } = await post(
      "/host/tourns",
      tournament({ name: "Readable Invitational", events: [{ format: "ld" }] }),
      "owner@example.com",
    );
    const invite = await call(`/rest/tourns/${body.tournament.id}/invite`);
    expect(invite.status).toBe(200);
    expect(invite.body.Events.map((event: any) => event.abbr)).toEqual(["LD"]);
    expect(invite.body.name).toBe("Readable Invitational");
  });

  it("leaves the vendored read trees read-only", async () => {
    expect((await post("/rest/tourns", tournament(), "owner@example.com")).status).toBe(405);
    expect((await post("/pages/invite/upcoming", {}, "owner@example.com")).status).toBe(405);
  });
});

describe("GET /host/tourns", () => {
  it("refuses an anonymous caller", async () => {
    expect((await call("/host/tourns")).status).toBe(401);
  });

  it("lists the tournaments a person owns, with their format count", async () => {
    const { body } = await call("/host/tourns", { headers: { "x-user": "owner@example.com" } });
    expect(body.tournaments.length).toBeGreaterThan(0);
    const listed = body.tournaments.find((tourn: any) => tourn.name === "Bay Area Novice Invitational");
    expect(listed).toMatchObject({ eventCount: 2, hidden: false });
  });

  it("does not list another person's tournaments", async () => {
    const { body } = await call("/host/tourns", { headers: { "x-user": "stranger@example.com" } });
    expect(body.tournaments).toEqual([]);
  });
});
