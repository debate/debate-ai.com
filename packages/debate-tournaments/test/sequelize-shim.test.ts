import { beforeAll, describe, expect, it } from "vitest";
import { bindReplacements, createSequelizeShim, QueryTypes } from "../src/db/sequelize-shim";
import { createSqliteD1 } from "./helpers/sqlite-d1";

describe("bindReplacements", () => {
  it("binds named replacements, expanding arrays and skipping literals", () => {
    const { sql, params } = bindReplacements("select ':nope' where a = :a and b in (:ids) and c::text = 'x'", {
      a: 1,
      ids: [2, 3],
      nope: 9,
    });
    expect(sql).toBe("select ':nope' where a = ? and b in (?, ?) and c::text = 'x'");
    expect(params).toEqual([1, 2, 3]);
  });

  it("binds positional replacements and converts dates and booleans", () => {
    const when = new Date(Date.UTC(2030, 0, 2, 3, 4, 5));
    const { sql, params } = bindReplacements("a = ? and b = ?", [when, true]);
    expect(sql).toBe("a = ? and b = ?");
    expect(params).toEqual(["2030-01-02 03:04:05", 1]);
  });
});

describe("createSequelizeShim", () => {
  const d1 = createSqliteD1();
  const db: any = createSequelizeShim(() => d1);

  beforeAll(() => {
    d1.raw.exec("create table tiebreak (id integer primary key, protocol integer, name text, created_at text)");
    d1.raw.exec("insert into tiebreak values (1, 5, 'wins', '2030-01-01 00:00:00'), (2, 5, 'ranks', null), (3, 6, 'opp', null)");
  });

  it("runs raw MySQL selects", async () => {
    const rows = await db.sequelize.query(`select name from tiebreak where protocol = :p and name != "opp" order by id`, {
      replacements: { p: 5 },
      type: QueryTypes.SELECT,
    });
    expect(rows).toEqual([{ name: "wins" }, { name: "ranks" }]);
  });

  it("returns datetimes as Dates", async () => {
    const row = await db.sequelize.query("select created_at from tiebreak where id = 1", { plain: true });
    expect(row.created_at).toEqual(new Date("2030-01-01T00:00:00Z"));
  });

  it("exposes tables as models with findAll/findOne", async () => {
    expect((await db.tiebreak.findAll({ where: { protocol: 6 } })).map((r: any) => r.id)).toEqual([3]);
    expect((await db.tiebreak.findOne({ where: { id: 2 } })).name).toBe("ranks");
    expect(await db.tiebreak.findByPk(99)).toBeNull();
  });
});
