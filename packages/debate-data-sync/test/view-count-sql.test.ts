import { describe, expect, it } from "vitest";
import {
  buildViewCountUpdateStatements,
  ROUND_QUEUE_VIEW_COUNT_TARGET,
  VIDEOS_VIEW_COUNT_TARGET,
} from "../src/videos/view-count-sql";

describe("buildViewCountUpdateStatements", () => {
  it("writes one CASE arm and one IN entry per video", () => {
    const [statement, ...rest] = buildViewCountUpdateStatements(
      [
        { videoId: "aaa", viewCount: 10 },
        { videoId: "bbb", viewCount: 20 },
      ],
      VIDEOS_VIEW_COUNT_TARGET,
    );

    expect(rest).toEqual([]);
    expect(statement).toContain('UPDATE "videos" SET');
    expect(statement).toContain('"view_count" = CASE "video_id"');
    expect(statement).toContain("WHEN 'aaa' THEN 10");
    expect(statement).toContain("WHEN 'bbb' THEN 20");
    expect(statement).toContain(`WHERE "video_id" IN ('aaa', 'bbb')`);
    expect(statement).toContain('"updated_at" = unixepoch()');
  });

  it("targets the admin queue's own column names", () => {
    const [statement] = buildViewCountUpdateStatements(
      [{ videoId: "aaa", viewCount: 7 }],
      ROUND_QUEUE_VIEW_COUNT_TARGET,
    );

    expect(statement).toContain('UPDATE "youtube_round_videos" SET');
    expect(statement).toContain('"views" = CASE "id"');
    expect(statement).toContain(`WHERE "id" IN ('aaa')`);
  });

  it("returns nothing when there is nothing to write", () => {
    expect(buildViewCountUpdateStatements([], VIDEOS_VIEW_COUNT_TARGET)).toEqual([]);
  });

  it("drops counts that are missing, negative or not finite", () => {
    expect(
      buildViewCountUpdateStatements(
        [
          { videoId: "aaa", viewCount: Number.NaN },
          { videoId: "bbb", viewCount: -1 },
          { videoId: "", viewCount: 5 },
          { videoId: "ccc", viewCount: undefined as unknown as number },
        ],
        VIDEOS_VIEW_COUNT_TARGET,
      ),
    ).toEqual([]);
  });

  it("truncates a fractional count rather than emitting a float", () => {
    const [statement] = buildViewCountUpdateStatements(
      [{ videoId: "aaa", viewCount: 12.9 }],
      VIDEOS_VIEW_COUNT_TARGET,
    );

    expect(statement).toContain("WHEN 'aaa' THEN 12");
  });

  it("keeps the last count for a repeated id, so CASE never has two arms for one key", () => {
    const [statement] = buildViewCountUpdateStatements(
      [
        { videoId: "aaa", viewCount: 10 },
        { videoId: "aaa", viewCount: 99 },
      ],
      VIDEOS_VIEW_COUNT_TARGET,
    );

    expect(statement).toContain("WHEN 'aaa' THEN 99");
    expect(statement).not.toContain("THEN 10");
    expect(statement.match(/WHEN /g)).toHaveLength(1);
  });

  it("escapes a quote in an id instead of ending the literal", () => {
    const [statement] = buildViewCountUpdateStatements(
      [{ videoId: "a'; DROP TABLE videos; --", viewCount: 1 }],
      VIDEOS_VIEW_COUNT_TARGET,
    );

    expect(statement).toContain("'a''; DROP TABLE videos; --'");
    expect(statement).not.toContain("'a'; DROP");
  });

  it("splits into batches once the row cap is reached", () => {
    const updates = Array.from({ length: 5 }, (_, i) => ({
      videoId: `id${i}`,
      viewCount: i,
    }));

    const statements = buildViewCountUpdateStatements(updates, VIDEOS_VIEW_COUNT_TARGET, {
      maxRows: 2,
    });

    expect(statements).toHaveLength(3);
    expect(statements[0]).toContain("WHEN 'id0' THEN 0");
    expect(statements[0]).toContain("WHEN 'id1' THEN 1");
    expect(statements[2]).toContain("WHEN 'id4' THEN 4");
    expect(statements.flatMap((s) => s.match(/WHEN /g) ?? [])).toHaveLength(5);
  });

  it("splits on the byte budget too, and never drops an oversized entry", () => {
    const updates = Array.from({ length: 3 }, (_, i) => ({
      videoId: `${"x".repeat(200)}${i}`,
      viewCount: i,
    }));

    const statements = buildViewCountUpdateStatements(updates, VIDEOS_VIEW_COUNT_TARGET, {
      maxBytes: 1,
    });

    expect(statements).toHaveLength(3);
    for (const statement of statements) expect(statement.match(/WHEN /g)).toHaveLength(1);
  });
});
