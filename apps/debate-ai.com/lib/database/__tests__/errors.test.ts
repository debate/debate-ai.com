import { describe, expect, it } from "vitest";
import { describeError } from "../errors";

/**
 * A stand-in for Drizzle's `DrizzleQueryError`: its own message names only the
 * SQL, and the driver's real complaint hangs off `cause`. This is the shape
 * that made a production 500 unreadable — the Workers log showed the wrapper's
 * message and a stack, and nothing about the missing table underneath.
 */
function drizzleQueryError(query: string, cause: unknown): Error {
  return new Error(`Failed query: ${query}\nparams: `, { cause });
}

describe("describeError", () => {
  it("keeps the driver's message that Drizzle's wrapper hides", () => {
    const error = drizzleQueryError(
      'select "video_id" from "youtube_video_exclusions"',
      new Error("D1_ERROR: no such table: youtube_video_exclusions: SQLITE_ERROR"),
    );

    const described = describeError(error);

    expect(described).toContain("youtube_video_exclusions");
    expect(described).toContain("no such table");
    expect(described).toContain("Failed query");
  });

  it("folds newlines so a log line and an admin toast stay on one line", () => {
    expect(describeError(new Error("first\n  second"))).toBe("first second");
  });

  it("walks a nested cause chain", () => {
    const error = new Error("outer", { cause: new Error("middle", { cause: new Error("inner") }) });

    expect(describeError(error)).toBe("outer | middle | inner");
  });

  it("does not repeat a cause that restates its wrapper", () => {
    const error = new Error("same", { cause: new Error("same") });

    expect(describeError(error)).toBe("same");
  });

  it("stops rather than looping on a circular cause chain", () => {
    const error = new Error("looping") as Error & { cause?: unknown };
    error.cause = error;

    expect(describeError(error)).toBe("looping");
  });

  it("handles values that were thrown but are not Errors", () => {
    expect(describeError("plain string")).toBe("plain string");
    expect(describeError({ message: "object with a message" })).toBe("object with a message");
    expect(describeError(null)).toBe("Unknown error");
    expect(describeError(undefined)).toBe("Unknown error");
  });
});
