import { describe, expect, it } from "vitest";
import {
  formatSeedVideosResult,
  formatSeedVideosStatus,
} from "../../../src/lib/videos/format-seed-videos-result";

describe("formatSeedVideosStatus", () => {
  it("reports an unseeded table", () => {
    expect(
      formatSeedVideosStatus({ rows: 0, lastSeededAt: null, servingFrom: "json" }),
    ).toBe("Not seeded yet — the public feed is serving from the JSON fallback.");
  });

  it("reports a seeded table serving from SQL", () => {
    expect(
      formatSeedVideosStatus({
        rows: 12345,
        lastSeededAt: "2026-01-15T08:00:00.000Z",
        servingFrom: "sql",
      }),
    ).toBe("12,345 videos seeded (serving from SQL) — last touched 2026-01-15.");
  });

  it("reports rows present but still serving from JSON (e.g. a read error)", () => {
    expect(
      formatSeedVideosStatus({
        rows: 500,
        lastSeededAt: "2026-01-15T08:00:00.000Z",
        servingFrom: "json",
      }),
    ).toBe("500 videos seeded (serving from the JSON fallback) — last touched 2026-01-15.");
  });

  it("falls back to 'unknown' for a missing lastSeededAt despite nonzero rows", () => {
    expect(
      formatSeedVideosStatus({ rows: 10, lastSeededAt: null, servingFrom: "sql" }),
    ).toBe("10 videos seeded (serving from SQL) — last touched unknown.");
  });

  it("falls back to 'unknown' for an unparseable lastSeededAt", () => {
    expect(
      formatSeedVideosStatus({ rows: 10, lastSeededAt: "not-a-date", servingFrom: "sql" }),
    ).toBe("10 videos seeded (serving from SQL) — last touched unknown.");
  });
});

describe("formatSeedVideosResult", () => {
  it("reports the run's counts and duration", () => {
    expect(
      formatSeedVideosResult({ rows: 812, statements: 12, durationMs: 3456 }),
    ).toBe("Seeded 812 videos in 3.5s (12 statements).");
  });

  it("uses singular 'statement' for exactly one", () => {
    expect(formatSeedVideosResult({ rows: 5, statements: 1, durationMs: 100 })).toBe(
      "Seeded 5 videos in 0.1s (1 statement).",
    );
  });

  it("formats large counts with thousands separators", () => {
    expect(
      formatSeedVideosResult({ rows: 12000, statements: 200, durationMs: 45000 }),
    ).toBe("Seeded 12,000 videos in 45.0s (200 statements).");
  });

  it("handles a fast, tiny run", () => {
    expect(formatSeedVideosResult({ rows: 0, statements: 1, durationMs: 5 })).toBe(
      "Seeded 0 videos in 0.0s (1 statement).",
    );
  });
});
