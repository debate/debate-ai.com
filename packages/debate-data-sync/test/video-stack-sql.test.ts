import { describe, expect, it } from "vitest";
import { buildVideoStackUpdateStatements } from "../src/videos/video-stack-sql";

describe("buildVideoStackUpdateStatements", () => {
  it("writes both CASE columns and one IN entry per video", () => {
    const [statement, ...rest] = buildVideoStackUpdateStatements([
      { videoId: "aaa", stackKey: "aaa", stackPosition: 0 },
      { videoId: "bbb", stackKey: "aaa", stackPosition: 1 },
    ]);

    expect(rest).toEqual([]);
    expect(statement).toContain('UPDATE "videos" SET');
    expect(statement).toContain('"stack_key" = CASE "video_id"');
    expect(statement).toContain('"stack_position" = CASE "video_id"');
    expect(statement).toContain("WHEN 'aaa' THEN 'aaa'");
    expect(statement).toContain("WHEN 'aaa' THEN 0");
    expect(statement).toContain("WHEN 'bbb' THEN 'aaa'");
    expect(statement).toContain("WHEN 'bbb' THEN 1");
    expect(statement).toContain(`WHERE "video_id" IN ('aaa', 'bbb')`);
  });

  it("writes a NULL stack_key for an unstacked video", () => {
    const [statement] = buildVideoStackUpdateStatements([
      { videoId: "aaa", stackKey: null, stackPosition: 0 },
    ]);

    expect(statement).toContain("WHEN 'aaa' THEN NULL");
  });

  it("returns nothing when there is nothing to write", () => {
    expect(buildVideoStackUpdateStatements([])).toEqual([]);
  });

  it("drops an entry with no video id", () => {
    expect(
      buildVideoStackUpdateStatements([{ videoId: "", stackKey: "aaa", stackPosition: 0 }]),
    ).toEqual([]);
  });

  it("keeps the last placement for a repeated id, so CASE never has two arms for one key", () => {
    const [statement] = buildVideoStackUpdateStatements([
      { videoId: "aaa", stackKey: "aaa", stackPosition: 0 },
      { videoId: "aaa", stackKey: "zzz", stackPosition: 3 },
    ]);

    expect(statement).toContain("WHEN 'aaa' THEN 'zzz'");
    expect(statement).toContain("WHEN 'aaa' THEN 3");
    expect(statement.match(/WHEN /g)).toHaveLength(2);
  });

  it("escapes a quote in a stack key instead of ending the literal", () => {
    const [statement] = buildVideoStackUpdateStatements([
      { videoId: "aaa", stackKey: "a'; DROP TABLE videos; --", stackPosition: 0 },
    ]);

    expect(statement).toContain("'a''; DROP TABLE videos; --'");
    expect(statement).not.toContain("'a'; DROP");
  });

  it("splits into batches once the row cap is reached", () => {
    const updates = Array.from({ length: 5 }, (_, i) => ({
      videoId: `id${i}`,
      stackKey: "id0",
      stackPosition: i,
    }));

    const statements = buildVideoStackUpdateStatements(updates, { maxRows: 2 });

    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain("WHEN 'id0' THEN 0");
    expect(statements[0]).toContain("WHEN 'id1' THEN 1");
    expect(statements[2]).toContain("WHEN 'id4' THEN 4");
    expect(statements.flatMap((s) => s.match(/"video_id" IN/g) ?? [])).toHaveLength(3);
  });

  it("splits on the byte budget too, and never drops an oversized entry", () => {
    const updates = Array.from({ length: 3 }, (_, i) => ({
      videoId: `${"x".repeat(200)}${i}`,
      stackKey: null,
      stackPosition: 0,
    }));

    const statements = buildVideoStackUpdateStatements(updates, { maxBytes: 1 });

    expect(statements).toHaveLength(3);
  });
});
