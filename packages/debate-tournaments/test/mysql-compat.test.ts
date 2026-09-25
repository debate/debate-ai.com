import { describe, expect, it } from "vitest";
import { translateMysqlToSqlite } from "../src/db/mysql-compat";

describe("translateMysqlToSqlite", () => {
  it("rewrites MySQL date functions", () => {
    expect(translateMysqlToSqlite("select NOW()")).toBe("select datetime('now')");
    expect(translateMysqlToSqlite("where t.end > DATE_SUB(NOW(), INTERVAL 7 DAY)")).toBe(
      "where t.end > datetime(datetime('now'), '-' || (7) || ' days')",
    );
    expect(translateMysqlToSqlite("CONVERT_TZ(tourn.start, '+00:00', tourn.tz)")).toBe("tourn.start");
  });

  it("rewrites bare ± INTERVAL date arithmetic", () => {
    // upstream's upcoming-tournaments scope; only NODE_ENV=test swaps it for a literal
    expect(translateMysqlToSqlite("tourn.end > DATE(NOW() - INTERVAL 2 DAY)")).toBe(
      "tourn.end > date(datetime(datetime('now'), '-' || (2) || ' days'))",
    );
    expect(translateMysqlToSqlite("ts.start + INTERVAL 1 HOUR")).toBe(
      "datetime(ts.start, '+' || (1) || ' hours')",
    );
    expect(translateMysqlToSqlite("select 'a - INTERVAL 2 DAY'")).toBe("select 'a - INTERVAL 2 DAY'");
  });

  it("rewrites string and aggregate functions", () => {
    expect(translateMysqlToSqlite("CONCAT(a.id, '-', b.id)")).toBe("((a.id) || ('-') || (b.id))");
    expect(translateMysqlToSqlite("GROUP_CONCAT(x.name SEPARATOR ', ')")).toBe("group_concat(x.name, ', ')");
    expect(translateMysqlToSqlite("GROUP_CONCAT(distinct(x.abbr) SEPARATOR ', ')")).toBe(
      "replace(group_concat(distinct(x.abbr)), ',', ', ')",
    );
    expect(translateMysqlToSqlite("JSON_OBJECTAGG(tag, value)")).toBe("json_group_object(tag, value)");
    expect(translateMysqlToSqlite("IF(a > 1, 'y', 'n')")).toBe("(CASE WHEN a > 1 THEN 'y' ELSE 'n' END)");
    expect(translateMysqlToSqlite("order by RAND()")).toBe("order by random()");
  });

  it("leaves string literals, quoted identifiers and method-like names alone", () => {
    expect(translateMysqlToSqlite("select 'NOW()' as x, `now` from t")).toBe("select 'NOW()' as x, `now` from t");
    expect(translateMysqlToSqlite('select "event"."date" from "event"')).toBe('select "event"."date" from "event"');
    expect(translateMysqlToSqlite("select t.date(1)")).toBe("select t.date(1)");
  });

  it("re-quotes MySQL double-quoted strings when asked", () => {
    expect(translateMysqlToSqlite('where tag = "closed_entry"', { doubleQuotedStrings: true })).toBe(
      "where tag = 'closed_entry'",
    );
    expect(translateMysqlToSqlite(`x = "it's"`, { doubleQuotedStrings: true })).toBe("x = 'it''s'");
  });

  it("computes ISO weeks for WEEK(x, 3)", () => {
    expect(translateMysqlToSqlite("WEEK(t.end, 3)")).toContain("'weekday 4'");
  });
});
