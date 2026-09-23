/**
 * Every vendored public route against upstream's own sample database
 * (`indexcards/tests/test.sql`, converted by `sync-upstream.mjs --seed`).
 * The seed is 40+ MB and git-ignored, so this suite runs only where it has
 * been generated — run it after every upstream sync.
 */
import { existsSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { applySqlFile, createSqliteD1 } from "./helpers/sqlite-d1";
import { createTournamentsHandler } from "../src/api/handler";

const SEED = ".upstream-seed.sql";

describe.skipIf(!existsSync(SEED))("vendored routes on upstream sample data", () => {
  const d1 = createSqliteD1();
  const handler = createTournamentsHandler({
    getDb: () => d1,
    getUser: (req) => (req.headers.get("x-user") ? { email: req.headers.get("x-user") } : null),
  });
  const rows = (sql: string) => d1.raw.prepare(sql).all() as any[];
  let paths: string[] = [];

  beforeAll(() => {
    applySqlFile(d1, "migrations/0001_tabroom_schema.sql");
    applySqlFile(d1, SEED);
    const [round] = rows(
      "select round.id, round.name, event.abbr, event.tourn from round join event on event.id = round.event join tourn on tourn.id = event.tourn where round.published = 1 and tourn.hidden = 0 limit 1",
    );
    const t = round.tourn;
    const [rs] = rows(`select id from result_set where tourn = ${t} and published = 1 limit 1`);
    const [entry] = rows(`select entry.id from entry join event on event.id = entry.event where event.tourn = ${t} limit 1`);
    paths = [
      "/rest/tourns",
      `/rest/tourns/${t}`,
      `/rest/tourns/${t}/invite`,
      `/rest/tourns/${t}/files`,
      `/rest/tourns/${t}/schedule`,
      `/rest/tourns/${t}/rounds`,
      `/rest/tourns/${t}/rounds/${round.id}`,
      `/rest/tourns/${t}/results`,
      rs && `/rest/tourns/${t}/results/${rs.id}`,
      `/rest/tourns/${t}/events/byAbbr/${round.abbr}`,
      entry && `/rest/tourns/${t}/entries/${entry.id}/records`,
      "/rest/circuits/active",
      "/rest/pages",
      "/rest/ads",
      "/pages/invite/upcoming",
      "/pages/invite/nextweek",
      "/pages/invite/nsdaCategories",
      `/pages/invite/${t}/${round.abbr}/${round.name}`,
      `/pages/invite/${t}/${round.abbr}/${round.name}/results`,
    ].filter(Boolean) as string[];
  }, 120_000);

  it("answers every public route without a server error", async () => {
    const failures: string[] = [];
    for (const path of paths) {
      const res = await handler(new Request(`https://x${path}`));
      if (res.status >= 500) failures.push(`${res.status} ${path}`);
    }
    expect(failures).toEqual([]);
  }, 120_000);
});
