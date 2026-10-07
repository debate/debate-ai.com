import { describe, expect, it } from "vitest";
import { formatVideoDuration } from "../src/state/videoDurations";

describe("formatVideoDuration", () => {
  it("shows hours and zero-padded minutes for long videos", () => {
    expect(formatVideoDuration(3600 + 5 * 60 + 12)).toBe("1h 05m");
    expect(formatVideoDuration(2 * 3600 + 45 * 60)).toBe("2h 45m");
  });

  it("shows minutes alone under an hour", () => {
    expect(formatVideoDuration(42 * 60 + 30)).toBe("42m");
  });

  it("shows seconds for clips under a minute", () => {
    expect(formatVideoDuration(45)).toBe("0:45");
    expect(formatVideoDuration(7)).toBe("0:07");
  });
});
