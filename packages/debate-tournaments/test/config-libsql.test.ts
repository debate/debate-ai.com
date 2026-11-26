import { afterEach, describe, expect, it } from "vitest";
import { configureTabroom, tabroomConfig } from "../src/config";
import { d1FromLibsql, type LibsqlClientLike } from "../src/db/libsql-d1";

describe("configureTabroom", () => {
  const original = structuredClone(tabroomConfig);
  afterEach(() => {
    for (const key of Object.keys(tabroomConfig)) delete tabroomConfig[key];
    Object.assign(tabroomConfig, structuredClone(original));
  });

  it("deep-merges nested overrides, keeping sibling keys", () => {
    const result = configureTabroom({ aws: { s3: { bucket: "files" } }, logging: { level: "debug" } });
    expect(result).toBe(tabroomConfig);
    expect(tabroomConfig.aws.s3).toEqual({ bucket: "files", region: "", url: "https://s3.amazonaws.com/tabroom-files" });
    expect(tabroomConfig.logging).toEqual({ level: "debug", slowQueryLimit: 1000 });
  });

  it("replaces arrays and scalars outright, and adds unknown keys", () => {
    tabroomConfig.csrf.trusted_origins = ["https://a.example"];
    configureTabroom({ csrf: { trusted_origins: ["https://b.example"] }, MODE: "development", extra: { nested: 1 } });
    expect(tabroomConfig.csrf.trusted_origins).toEqual(["https://b.example"]);
    expect(tabroomConfig.MODE).toBe("development");
    expect(tabroomConfig.extra).toEqual({ nested: 1 });
  });

  it("replaces a plain object with a scalar and a scalar with an object", () => {
    configureTabroom({ cookie: "none" as never, shared_secret: { v: 1 } as never });
    expect(tabroomConfig.cookie).toBe("none");
    expect(tabroomConfig.shared_secret).toEqual({ v: 1 });
  });
});

describe("d1FromLibsql", () => {
  function client(result: Awaited<ReturnType<LibsqlClientLike["execute"]>>) {
    const calls: Array<{ sql: string; args: unknown[] }> = [];
    return { calls, execute: async (stmt: { sql: string; args: unknown[] }) => (calls.push(stmt), result) } satisfies LibsqlClientLike & { calls: unknown[] };
  }

  it("runs the statement with its bound values and maps rows by column name", async () => {
    const c = client({ columns: ["id", "name"], rows: [[1, "a"], [2, "b"]], rowsAffected: 0 });
    const out = await d1FromLibsql(c).prepare("SELECT id, name FROM t WHERE x = ? AND y = ?").bind(7, "z").all<{ id: number; name: string }>();
    expect(c.calls).toEqual([{ sql: "SELECT id, name FROM t WHERE x = ? AND y = ?", args: [7, "z"] }]);
    expect(out.results).toEqual([{ id: 1, name: "a" }, { id: 2, name: "b" }]);
    expect(out.success).toBe(true);
    expect(out.meta).toEqual({ changes: 0, last_row_id: undefined });
  });

  it("converts bigint values and the last inserted row id to numbers", async () => {
    const c = client({ columns: ["n"], rows: [[9007199254740n]], rowsAffected: 1, lastInsertRowid: 12n });
    const out = await d1FromLibsql(c).prepare("INSERT INTO t VALUES (1)").all<{ n: number }>();
    expect(c.calls[0].args).toEqual([]);
    expect(out.results).toEqual([{ n: 9007199254740 }]);
    expect(out.meta).toEqual({ changes: 1, last_row_id: 12 });
  });

  it("keeps a numeric last row id and does not mutate the original statement when binding", async () => {
    const c = client({ columns: [], rows: [], rowsAffected: 2, lastInsertRowid: 5 });
    const stmt = d1FromLibsql(c).prepare("UPDATE t SET a = ?");
    const bound = stmt.bind(1);
    expect(bound).not.toBe(stmt);
    expect((await bound.all()).meta).toEqual({ changes: 2, last_row_id: 5 });
    await stmt.all();
    expect(c.calls.map((x) => x.args)).toEqual([[1], []]);
  });
});
