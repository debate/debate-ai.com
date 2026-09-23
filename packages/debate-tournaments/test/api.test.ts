import { beforeAll, describe, expect, it } from "vitest";
import { applySqlFile, createSqliteD1, pkgPath } from "./helpers/sqlite-d1";
import { createTournamentsHandler, routedPath } from "../src/api/handler";

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

async function get(path: string, init: RequestInit = {}) {
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

describe("routedPath", () => {
  it("strips the mount path and an optional /v1", () => {
    expect(routedPath("/api/tournaments/rest/tourns", "/api/tournaments")).toBe("/rest/tourns");
    expect(routedPath("/api/tournaments/v1/rest/tourns", "/api/tournaments/")).toBe("/rest/tourns");
    expect(routedPath("/api/tournaments", "/api/tournaments")).toBe("/");
  });
});

describe("tournaments API on D1", () => {
  it("lists public tournaments and hides hidden ones", async () => {
    const { status, body, headers } = await get("/rest/tourns");
    expect(status).toBe(200);
    expect(body.map((t: any) => t.id)).toEqual([1]);
    expect(body[0].name).toBe("Golden Gate Invitational");
    expect(headers.get("cache-control")).toContain("max-age");
  });

  it("returns a tournament with datetimes as ISO strings, like upstream's MariaDB driver", async () => {
    const { status, body } = await get("/v1/rest/tourns/1");
    expect(status).toBe(200);
    expect(body.start).toBe("2030-02-01T16:00:00.000Z");
    expect(body.hidden).toBe(false);
  });

  it("404s a hidden tournament with a problem document", async () => {
    const { status, body, headers } = await get("/rest/tourns/2");
    expect(status).toBe(404);
    expect(headers.get("content-type")).toContain("application/problem+json");
    expect(body.detail).toMatch(/No such tournament/);
  });

  it("builds the invite with events", async () => {
    const { status, body } = await get("/rest/tourns/1/invite");
    expect(status).toBe(200);
    expect(body.Events.map((e: any) => e.abbr)).toEqual(["LD"]);
  });

  it("lists published rounds and serves one by id (patched upstream route)", async () => {
    const rounds = await get("/rest/tourns/1/rounds");
    expect(rounds.status).toBe(200);
    expect(rounds.body[0]).toMatchObject({ id: 500, Event: { abbr: "LD" } });
    const round = await get("/rest/tourns/1/rounds/500");
    expect(round.status).toBe(200);
    expect(round.body.id).toBe(500);
    expect((await get("/rest/tourns/2/rounds/500")).status).toBe(404);
  });

  it("serves the raw-SQL (Sequelize) invite pages", async () => {
    const byWebname = await get("/pages/invite/webname/goldengate");
    expect(byWebname.status).toBe(200);
    expect(byWebname.body.id).toBe(1);
    const event = await get("/rest/tourns/1/events/byAbbr/LD");
    expect(event.status).toBe(200);
    expect(event.body.rounds.map((r: any) => r.id)).toEqual([500]);
  });

  it("serves sitewide pages (patched upstream route)", async () => {
    const { status, body } = await get("/rest/pages");
    expect(status).toBe(200);
    expect(body[0].slug).toBe("about");
  });

  it("requires a signed-in host user for paradigm search", async () => {
    expect((await get("/rest/paradigms?search=a")).status).toBe(401);
    expect((await get("/rest/paradigms?search=a", { headers: { "x-user": "judge@example.com" } })).status).toBe(200);
  });

  it("rejects writes and unknown routes", async () => {
    expect((await get("/rest/tourns", { method: "POST" })).status).toBe(405);
    expect((await get("/rest/nope")).status).toBe(404);
  });
});
