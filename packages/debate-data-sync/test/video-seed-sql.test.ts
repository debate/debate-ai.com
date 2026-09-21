import { describe, expect, it } from "vitest";
import { tupleToVideoRow, type VideoRow } from "../src/videos/video-rows";
import {
  buildVideoSeedStatements,
  sqlLiteral,
  videoSeedValues,
  VIDEO_SEED_COLUMNS,
} from "../src/videos/video-seed-sql";

const row = (id: string, extra: Partial<VideoRow> = {}): VideoRow => ({
  ...tupleToVideoRow([id, `Title ${id}`, "2025-09-01", "Channel", 10, "", 1], "round")!,
  ...extra,
});

describe("sqlLiteral", () => {
  it("renders nulls, numbers and booleans", () => {
    expect(sqlLiteral(null)).toBe("NULL");
    expect(sqlLiteral(undefined)).toBe("NULL");
    expect(sqlLiteral(42)).toBe("42");
    expect(sqlLiteral(true)).toBe("1");
    expect(sqlLiteral(false)).toBe("0");
  });

  it("doubles single quotes so a title with an apostrophe survives", () => {
    expect(sqlLiteral("Kritik's finest")).toBe("'Kritik''s finest'");
    expect(sqlLiteral("'; DROP TABLE videos; --")).toBe("'''; DROP TABLE videos; --'");
  });

  it("keeps newlines and non-ascii text intact", () => {
    expect(sqlLiteral("line one\nline two — ✓")).toBe("'line one\nline two — ✓'");
  });

  it("never emits a non-finite number", () => {
    expect(sqlLiteral(Number.NaN)).toBe("0");
    expect(sqlLiteral(Number.POSITIVE_INFINITY)).toBe("0");
  });
});

describe("videoSeedValues", () => {
  it("returns one value per column, in column order", () => {
    const values = videoSeedValues(row("abc"));
    expect(values).toHaveLength(VIDEO_SEED_COLUMNS.length);
    expect(values[0]).toBe("abc");
    expect(values[VIDEO_SEED_COLUMNS.indexOf("search_text")]).toContain("title abc");
  });
});

describe("buildVideoSeedStatements", () => {
  const rows = [row("a"), row("b"), row("c")];

  it("batches the upserts and ends with the prune", () => {
    const statements = buildVideoSeedStatements(rows, 1_700_000_000, { maxRows: 2 });
    expect(statements).toHaveLength(3); // two insert batches + prune
    expect(statements[0]).toContain('INSERT INTO "videos"');
    expect(statements.at(-1)).toBe('DELETE FROM "videos" WHERE "updated_at" < 1700000000');
  });

  it("upserts on conflict so a re-run updates instead of failing", () => {
    const [insert] = buildVideoSeedStatements(rows, 1, { maxRows: 50 });
    expect(insert).toContain('ON CONFLICT("video_id") DO UPDATE SET');
    expect(insert).toContain('"updated_at" = unixepoch()');
    expect(insert).not.toContain('"video_id" = excluded."video_id"');
  });

  it("guards every seeded column so an admin-edited row keeps its own values", () => {
    const [insert] = buildVideoSeedStatements(rows, 1, { maxRows: 50 });
    expect(insert).toContain(
      '"title" = CASE WHEN "admin_edited" = 1 THEN "title" ELSE excluded."title" END',
    );
    // `admin_edited` itself is never an assignment target in the SET list —
    // upsert leaves it untouched so a flag set by an admin edit survives a
    // re-seed. (It appears only as the CASE condition, `"admin_edited" = 1`.)
    const assignedColumns = [...insert.matchAll(/"(\w+)" = (?:excluded\.|CASE)/g)].map(
      (m) => m[1],
    );
    expect(assignedColumns).not.toContain("admin_edited");
    // `updated_at` must stay unconditional: an admin-edited row still needs
    // to look fresh, or the trailing prune (below `seededAt`) deletes it.
    expect(insert).toContain('"updated_at" = unixepoch()');
    expect(insert).not.toMatch(/CASE WHEN "admin_edited" = 1 THEN "updated_at"/);
  });

  it("emits every row exactly once across the batches", () => {
    const statements = buildVideoSeedStatements(rows, 1, { maxRows: 2 });
    const sql = statements.join("\n");
    for (const r of rows) expect(sql.split(`'${r.videoId}'`).length - 1).toBe(1);
  });

  it("guards against a zero or negative batch size", () => {
    expect(buildVideoSeedStatements(rows, 1, { maxRows: 0 })).toHaveLength(rows.length + 1);
  });

  it("splits on bytes, so a wide row cannot push a statement over D1's limit", () => {
    const wide = [
      row("w1", { description: "x".repeat(4000) }),
      row("w2", { description: "y".repeat(4000) }),
      row("w3", { description: "z".repeat(4000) }),
    ];
    const statements = buildVideoSeedStatements(wide, 1, { maxRows: 100, maxBytes: 5000 });
    expect(statements).toHaveLength(4); // one per row, plus the prune
    for (const statement of statements) expect(statement.length).toBeLessThan(100_000);
  });

  it("still places a row that on its own exceeds the byte budget", () => {
    const huge = [row("huge", { description: "q".repeat(9000) })];
    const statements = buildVideoSeedStatements(huge, 1, { maxBytes: 100 });
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain("'huge'");
  });

  it("still emits the prune for an empty asset set", () => {
    expect(buildVideoSeedStatements([], 5)).toEqual([
      'DELETE FROM "videos" WHERE "updated_at" < 5',
    ]);
  });
});
