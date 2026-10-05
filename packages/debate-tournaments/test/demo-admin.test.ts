import { beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { applySqlFile, createSqliteD1, pkgPath } from "./helpers/sqlite-d1";
import { createTournamentsHandler } from "../src/api/handler";
import { splitSqlStatements } from "../src/host/demo";
import { DEMO_TOURN_ID } from "../src/host/demo-account";

// A database with Tabroom's schema and nothing else, as a fresh deployment has:
// the demo must load itself through `POST /host/demo`.
const d1 = createSqliteD1();

beforeAll(() => {
  applySqlFile(d1, pkgPath("migrations/0001_tabroom_schema.sql"));
});

const handler = createTournamentsHandler({
  basePath: "/api/tabroom",
  getDb: () => d1,
  getUser: (req) => (req.headers.get("x-user") ? { email: req.headers.get("x-user") } : null),
});

async function call(path: string, init: RequestInit & { user?: string } = {}) {
  const headers = new Headers(init.headers);
  if (init.user) headers.set("x-user", init.user);
  const res = await handler(new Request(`https://debate-ai.test/api/tabroom${path}`, { ...init, headers }));
  return { status: res.status, body: (await res.json()) as any };
}

describe("splitSqlStatements", () => {
  it("splits the seed into whole statements, comments dropped", () => {
    const statements = splitSqlStatements(readFileSync(pkgPath("seed/demo.sql"), "utf8"));
    expect(statements.every((s) => /^INSERT OR REPLACE INTO /.test(s))).toBe(true);
    // A `;` inside a quoted paradigm must not end its statement.
    expect(statements.some((s) => s.includes("Frameworks are fine; tell me"))).toBe(true);
  });
});

describe("the demo tournament", () => {
  it("loads itself on demand, once", async () => {
    const first = await call("/host/demo", { method: "POST" });
    expect(first).toMatchObject({ status: 200, body: { tournId: DEMO_TOURN_ID, username: "demo.admin", seeded: true } });
    expect((await call("/host/demo", { method: "POST" })).body.seeded).toBe(false);
    expect(d1.raw.prepare("SELECT count(*) n FROM tourn WHERE id >= 90000").get()).toEqual({ n: 4 });
  });

  it("reloads when it is over, so its dates stay current", async () => {
    d1.raw.prepare("UPDATE tourn SET end = '2000-01-01 00:00:00' WHERE id = ?").run(DEMO_TOURN_ID);
    expect((await call("/host/demo", { method: "POST" })).body.seeded).toBe(true);
  });

  it("opens its admin view to anyone, as the mock admin", async () => {
    const { status, body } = await call(`/host/tourns/${DEMO_TOURN_ID}/admin`);
    expect(status).toBe(200);
    expect(body.viewer).toEqual({ username: "demo.admin", name: "Demo Admin", mock: true });
    expect(body.tourn.name).toBe("Bay Area Invitational");
    expect(body.events.map((e: any) => [e.abbr, e.entryCount])).toEqual([
      ["VLD", 4],
      ["VPF", 4],
    ]);
    expect(body.entries).toHaveLength(8);
    expect(body.schools).toHaveLength(4);
    expect(body.judges).toHaveLength(4);
    expect(body.rooms).toHaveLength(4);
    // Admins see the unpublished round 3 the public pairings hide.
    const vld = body.rounds.filter((r: any) => r.eventAbbr === "VLD");
    expect(vld.map((r: any) => [r.name, r.published])).toEqual([
      [1, true],
      [2, true],
      [3, false],
    ]);
    expect(body.resultSets.map((s: any) => s.id).sort()).toEqual([90001, 90002]);
  });

  it("shows the real account when its owner signs in", async () => {
    const { body } = await call(`/host/tourns/${DEMO_TOURN_ID}/admin`, { user: "demo.admin@debate-ai.com" });
    expect(body.viewer).toEqual({ username: "demo.admin", name: "Demo Admin", mock: false });
  });
});

describe("a hosted tournament's admin view", () => {
  it("is closed to visitors and to people who do not run it", async () => {
    expect((await call("/host/tourns/90002/admin")).status).toBe(401);
    expect((await call("/host/tourns/90002/admin", { user: "demo.judge@debate-ai.com" })).status).toBe(403);
  });

  it("opens for the tournament's creator", async () => {
    const created = await call("/host/tourns", {
      method: "POST",
      user: "host@example.com",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: "Golden Gate Invitational",
        start: "2030-03-01T09:00:00-08:00",
        end: "2030-03-02T18:00:00-08:00",
        events: [{ format: "ld" }],
      }),
    });
    expect(created.status).toBe(201);
    const id = created.body.tournament.id;
    const { status, body } = await call(`/host/tourns/${id}/admin`, { user: "host@example.com" });
    expect(status).toBe(200);
    expect(body.viewer).toMatchObject({ username: "host", mock: false });
    expect(body.tourn.name).toBe("Golden Gate Invitational");
    expect(body.events).toHaveLength(1);
  });

  it("answers 404 for a tournament that does not exist", async () => {
    expect((await call("/host/tourns/12345/admin", { user: "demo.admin@debate-ai.com" })).status).toBe(403);
    expect((await call("/host/tourns/nope/admin")).status).toBe(404);
  });
});
