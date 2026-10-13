import { describe, expect, it } from "vitest";
import { auditStatements } from "../src/db/audit";
import { applySqlFile, createSqliteD1, pkgPath } from "./helpers/sqlite-d1";

describe("schema audit", () => {
  const d1 = createSqliteD1();
  applySqlFile(d1, pkgPath("migrations/0001_tabroom_schema.sql"));
  const findings = () => auditStatements().flatMap((sql) => d1.raw.prepare(sql).all() as any[]);
  const exec = (sql: string) => d1.raw.exec(sql);

  it("runs every check and finds nothing in a consistent database", () => {
    expect(auditStatements().length).toBeGreaterThan(1);
    exec("INSERT INTO tourn (id, name, webname, tz) VALUES (1, 'A', 'a', 'UTC'), (2, 'B', 'b', 'UTC')");
    exec("INSERT INTO event (id, name, abbr, type, tourn) VALUES (1, 'LD', 'LD', 'ld', 1), (2, 'PF', 'PF', 'pf', 2)");
    exec("INSERT INTO school (id, name, tourn) VALUES (1, 'High', 1)");
    exec("INSERT INTO entry (id, tourn, event, school) VALUES (1, 1, 1, 1)");
    expect(findings()).toEqual([]);
  });

  it("reports orphans, tournament mismatches, duplicate memberships and NULL-unique duplicates", () => {
    exec("INSERT INTO entry (id, tourn, event, school) VALUES (2, 1, 99, NULL), (3, 1, 2, 1)");
    exec("INSERT INTO jpool (id, name, category, site) VALUES (1, 'Pool', NULL, 0)");
    exec("INSERT INTO jpool_judge (jpool, judge) VALUES (1, 5), (1, 5)");
    exec("INSERT INTO judge (id, first, last) VALUES (5, 'J', 'Udge')");
    exec("INSERT INTO judge_setting (judge, tag, value) VALUES (5, 'paradigm', 'a'), (5, 'paradigm', 'b')");
    const got = findings().map((f) => `${f.kind} ${f.table}.${f.columns} ${f.count}`);
    expect(got).toEqual(
      expect.arrayContaining([
        "orphan entry.event 1",
        "ownership entry.event.tourn 1",
        "duplicate-membership jpool_judge.jpool, judge 1",
        "nullable-unique judge_setting.judge, tag, conditional 1",
      ]),
    );
  });
});
