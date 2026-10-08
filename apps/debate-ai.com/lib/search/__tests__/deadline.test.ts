import { describe, expect, it, vi } from "vitest";
import { TIMED_OUT, withinDeadline } from "../deadline";

describe("withinDeadline", () => {
  it("passes a value through when the work finishes first", async () => {
    await expect(withinDeadline(Promise.resolve(3), 1_000)).resolves.toBe(3);
  });

  it("answers TIMED_OUT when the work is slower than the deadline", async () => {
    vi.useFakeTimers();
    const slow = new Promise((resolve) => setTimeout(() => resolve("late"), 5_000));
    const result = withinDeadline(slow, 100);
    await vi.advanceTimersByTimeAsync(100);
    await expect(result).resolves.toBe(TIMED_OUT);
    vi.useRealTimers();
  });

  it("still rejects when the work fails inside the deadline", async () => {
    await expect(withinDeadline(Promise.reject(new Error("boom")), 1_000)).rejects.toThrow("boom");
  });
});
