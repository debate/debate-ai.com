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

const EVENTS = ["VCX", "VLD", "VPF", "VPRL", "OO", "IX", "DI", "INF"];
const scalar = (sql: string, ...params: Array<string | number>) => d1.raw.prepare(sql).get(...params) as Record<string, any>;

describe("demo seed", () => {
  it("is idempotent", () => {
    expect(() => applySqlFile(d1, pkgPath("seed/demo.sql"))).not.toThrow();
    expect(scalar("SELECT count(*) n FROM tourn WHERE id >= 90000")).toEqual({ n: 1 });
    expect(scalar("SELECT count(*) n FROM entry WHERE tourn = 90001")).toEqual({ n: 320 });
  });

  it("is one tournament: reloading clears the older demos and their rows", () => {
    d1.raw.exec(`
      INSERT INTO tourn (id, name, webname, hidden) VALUES (90002, 'Golden State Classic', 'demogoldenstate', 0);
      INSERT INTO event (id, name, abbr, type, tourn) VALUES (90003, 'Varsity LD', 'VLD', 'debate', 90002);
      INSERT INTO entry (id, code, tourn, event) VALUES (90009, 'LO MC', 90002, 90003);
      INSERT INTO tourn (id, name, webname, hidden) VALUES (12, 'Someone Else''s Open', 'someone', 0);
      INSERT INTO entry (id, code, tourn) VALUES (12, 'XX YY', 12);
    `);
    applySqlFile(d1, pkgPath("seed/demo.sql"));
    expect(scalar("SELECT count(*) n FROM tourn WHERE id IN (90002, 90003, 90004)")).toEqual({ n: 0 });
    expect(scalar("SELECT count(*) n FROM entry WHERE tourn = 90002")).toEqual({ n: 0 });
    // Rows that are not the demo's are left alone.
    expect(scalar("SELECT count(*) n FROM entry WHERE tourn = 12")).toEqual({ n: 1 });
  });

  it("runs four debate divisions and four speech events, with 40 entries in each", async () => {
    const { status, body } = await get("/rest/tourns/90001/invite");
    expect(status).toBe(200);
    expect(body.Events.map((e: any) => e.abbr).sort()).toEqual([...EVENTS].sort());
    for (const abbr of EVENTS) {
      expect(scalar("SELECT count(*) n FROM entry JOIN event ON event.id = entry.event WHERE event.abbr = ? AND entry.tourn = 90001", abbr)).toEqual({ n: 40 });
    }
    expect(scalar("SELECT count(*) n FROM school WHERE tourn = 90001").n).toBeGreaterThanOrEqual(30);
    expect(body.Webpages.length).toBeGreaterThan(0);
  });

  it("lists the demo as running", async () => {
    // Under NODE_ENV=test upstream swaps its `NOW() - INTERVAL 2 DAY` scope for a
    // fixed date; run the production query, which is what D1 sees.
    const nodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    const { status, body } = await get("/pages/invite/upcoming").finally(() => {
      process.env.NODE_ENV = nodeEnv;
    });
    expect(status).toBe(200);
    expect(body.map((t: any) => t.tournId)).toEqual([90001]);
  });

  it("publishes six prelims and four elimination rounds per debate division", async () => {
    const rounds = await get("/rest/tourns/90001/rounds");
    expect(rounds.status).toBe(200);
    expect(rounds.body.length).toBe(4 * 10 + 4 * 5);

    const round = await get("/pages/invite/90001/VLD/1");
    expect(round.status).toBe(200);
    const sections = Object.values(round.body.Sections) as any[];
    expect(sections).toHaveLength(20);
    expect(Object.keys(sections[0].Entries ?? {})).toHaveLength(2);
    expect(Object.keys(sections[0].Judges ?? {})).toHaveLength(1);
  });

  it("power-matches later prelims and shows each entry's record", async () => {
    const round = await get("/pages/invite/90001/VPF/6");
    const entries = (Object.values(round.body.Sections) as any[]).flatMap((s) => Object.values(s.Entries));
    expect(entries.every((e: any) => /^\d+-\d+$/.test(e.record))).toBe(true);
  });

  it("seats three judges on every elimination panel", async () => {
    const octas = await get("/pages/invite/90001/VCX/7");
    expect(octas.status).toBe(200);
    expect(octas.body.label).toBe("Octafinals");
    const sections = Object.values(octas.body.Sections) as any[];
    expect(sections).toHaveLength(8);
    expect(sections.every((s) => Object.keys(s.Judges).length === 3)).toBe(true);
    const finals = await get("/pages/invite/90001/VCX/10");
    expect(Object.values(finals.body.Sections)).toHaveLength(1);
  });

  it("runs speech in sections of six with a six-person final", async () => {
    const r1 = await get("/pages/invite/90001/OO/1");
    const sizes = (Object.values(r1.body.Sections) as any[]).map((s) => Object.keys(s.Entries).length);
    expect(sizes.reduce((a, b) => a + b, 0)).toBe(40);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(6);
    const finals = await get("/pages/invite/90001/OO/5");
    const [final] = Object.values(finals.body.Sections) as any[];
    expect(Object.keys(final.Entries)).toHaveLength(6);
    expect(Object.keys(final.Judges)).toHaveLength(3);
  });

  it("posts seeds, final places, speaker awards and a bracket for each debate division", async () => {
    const results = await get("/rest/tourns/90001/results");
    expect(results.status).toBe(200);
    const events = Object.values(results.body) as any[];
    const vcx = events.find((e) => e.abbr === "VCX");
    expect(vcx.ResultSets.map((s: any) => s.label).sort()).toEqual([
      "Elimination Bracket",
      "Final Places",
      "Prelim Seeds",
      "Speaker Awards",
    ]);
    const oo = events.find((e) => e.abbr === "OO");
    expect(oo.ResultSets.map((s: any) => s.label).sort()).toEqual(["Final Places", "Prelim Ranks"]);

    const id = (label: string) => vcx.ResultSets.find((s: any) => s.label === label).id;
    const seeds = (await get(`/rest/tourns/90001/results/${id("Prelim Seeds")}`)).body[0];
    expect(seeds.results).toHaveLength(40);
    expect(Object.values(seeds.headers).map((h: any) => h.tag)).toEqual(["W", "L", "Pts"]);
    expect(seeds.results[0].values["1"]).toMatch(/^[4-6]$/);

    const places = (await get(`/rest/tourns/90001/results/${id("Final Places")}`)).body[0];
    expect(places.results).toHaveLength(16);
    expect(places.results[0].place).toBe("Champion");
    expect(places.results[1].place).toBe("Finalist");

    const speakers = (await get(`/rest/tourns/90001/results/${id("Speaker Awards")}`)).body[0];
    expect(speakers.results).toHaveLength(20);
    expect(speakers.results[0].Student.last).toBeTruthy();
    expect(speakers.results[0].place).toBe("1st Speaker");

    const bracket = (await get(`/rest/tourns/90001/results/${id("Elimination Bracket")}`)).body[0];
    const rounds = Object.values(bracket.rounds) as any[];
    expect(rounds.map((r) => r.label)).toEqual(["Octafinals", "Quarterfinals", "Semifinals", "Finals"]);
    expect(Object.keys(rounds[0].Sections)).toHaveLength(8);
  });

  it("finds demo paradigms for a signed-in user", async () => {
    const { status, body } = await get("/rest/paradigms?search=Whitfield", {
      headers: { "x-user": "demo.judge@debate-ai.com" },
    });
    expect(status).toBe(200);
    expect(JSON.stringify(body)).toContain("Whitfield");
  });
});
