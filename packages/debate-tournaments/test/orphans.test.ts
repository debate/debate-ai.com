import { describe, expect, it } from "vitest";
import { orphanCheckStatements } from "../src/db/orphans";
import { applySqlFile, createSqliteD1, pkgPath } from "./helpers/sqlite-d1";

describe("orphan check", () => {
  const d1 = createSqliteD1();
  applySqlFile(d1, pkgPath("migrations/0001_tabroom_schema.sql"));
  const orphans = () => orphanCheckStatements().flatMap((sql) => d1.raw.prepare(sql).all());

  it("runs over every reference column and finds nothing in a consistent database", () => {
    expect(orphanCheckStatements().length).toBeGreaterThan(1);
    d1.raw.exec("INSERT INTO tourn (id, name, webname, tz) VALUES (1, 'Open', 'open', 'UTC')");
    d1.raw.exec("INSERT INTO event (id, name, abbr, type, tourn) VALUES (1, 'LD', 'LD', 'ld', 1)");
    expect(orphans()).toEqual([]);
  });

  it("counts ids their table does not have, but not NULLs", () => {
    d1.raw.exec("INSERT INTO entry (id, tourn, event, school) VALUES (1, 1, 99, NULL), (2, 1, 99, NULL)");
    expect(orphans()).toEqual([{ table: "entry", column: "event", target: "event", orphans: 2 }]);
  });
});
