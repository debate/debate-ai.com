import { beforeAll, describe, expect, it } from "vitest";
import { applySqlFile, createSqliteD1, pkgPath } from "./helpers/sqlite-d1";
import { createTournamentsHandler } from "../src/api/handler";

// seed/demo.sql is what `db:seed:tournaments` loads into D1; every UI page must
// have something to show from it alone.
const d1 = createSqliteD1();

beforeAll(() => {
  applySqlFile(d1, pkgPath("migrations/0001_tabroom_schema.sql"));
  applySqlFile(d1, pkgPath("seed/demo.sql"));
});

const handler = createTournamentsHandler({
  basePath: "/api/tabroom",
  getDb: () => d1,
  getUser: (req) => (req.headers.get("x-user") ? { email: req.headers.get("x-user") } : null),
});

async function get(path: string, init: RequestInit = {}) {
  const res = await handler(new Request(`https://debate-ai.test/api/tabroom${path}`, init));
  const text = await res.text();
  let body: any = text;
  try {
    body = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { status: res.status, body };
}

describe("demo seed", () => {
  it("is idempotent", () => {
    expect(() => applySqlFile(d1, pkgPath("seed/demo.sql"))).not.toThrow();
    expect(d1.raw.prepare("SELECT count(*) n FROM tourn WHERE id >= 90000").get()).toEqual({ n: 4 });
  });

  it("lists the public demo tournaments as upcoming, never the hidden one", async () => {
    const { status, body } = await get("/pages/invite/upcoming");
    expect(status).toBe(200);
    const ids = body.map((t: any) => t.tournId);
    expect(ids).toEqual(expect.arrayContaining([90001, 90002, 90003]));
    expect(ids).not.toContain(90004);
  });

  it("builds each invite with its events and welcome page", async () => {
    const { status, body } = await get("/rest/tourns/90002/invite");
    expect(status).toBe(200);
    expect(body.Events.map((e: any) => e.abbr).sort()).toEqual(["VCX", "VLD", "VPF"]);
    expect(body.Webpages.length).toBeGreaterThan(0);
  });

  it("publishes pairings for the running tournament", async () => {
    const rounds = await get("/rest/tourns/90001/rounds");
    expect(rounds.status).toBe(200);
    expect(rounds.body.map((r: any) => r.id).sort()).toEqual([90001, 90002, 90003]);

    const round = await get("/pages/invite/90001/VLD/1");
    expect(round.status).toBe(200);
    const sections = Object.values(round.body.Sections) as any[];
    expect(sections).toHaveLength(2);
    expect(Object.keys(sections[0].Entries ?? {})).toHaveLength(2);
    expect(sections[0].Room?.name).toMatch(/^Room/);
  });

  it("does not expose the unpublished round", async () => {
    expect((await get("/pages/invite/90001/VLD/3")).status).toBe(404);
  });

  it("serves results and a result set", async () => {
    const results = await get("/rest/tourns/90001/results");
    expect(results.status).toBe(200);
    const events = Object.values(results.body) as any[];
    expect(events.flatMap((e) => e.ResultSets.map((s: any) => s.id)).sort()).toEqual([90001, 90002]);

    const set = await get("/rest/tourns/90001/results/90001");
    expect(set.status).toBe(200);
    expect(set.body[0].results[0].Entry.code).toBe("LO MC");
  });

  it("finds demo paradigms for a signed-in user", async () => {
    const { status, body } = await get("/rest/paradigms?search=Whitfield", {
      headers: { "x-user": "demo.judge@debate-ai.com" },
    });
    expect(status).toBe(200);
    expect(JSON.stringify(body)).toContain("Whitfield");
  });
});
