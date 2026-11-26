import { describe, expect, it } from "vitest";
import {
  CLOUDFLARE_BATCH_SIZE,
  RESEND_BATCH_SIZE,
  batchSizeFor,
  chunk,
  isEmailProvider,
  isValidResendKey,
  keyTail,
  maskApiKey,
  tallyResults,
} from "../bulk";

describe("chunk", () => {
  it("splits into consecutive groups with a short last one", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns nothing for an empty list and one group when it fits", () => {
    expect(chunk([], 100)).toEqual([]);
    expect(chunk(["a", "b"], 100)).toEqual([["a", "b"]]);
  });

  it("splits 250 addresses into Resend-sized batches", () => {
    const emails = Array.from({ length: 250 }, (_, i) => `u${i}@x.com`);
    expect(chunk(emails, RESEND_BATCH_SIZE).map((group) => group.length)).toEqual([100, 100, 50]);
  });

  it("rejects a batch size that would never advance", () => {
    expect(() => chunk([1], 0)).toThrow(RangeError);
    expect(() => chunk([1], 1.5)).toThrow(RangeError);
  });
});

describe("providers", () => {
  it("knows the two transports and their batch sizes", () => {
    expect(isEmailProvider("resend")).toBe(true);
    expect(isEmailProvider("cloudflare")).toBe(true);
    expect(isEmailProvider("smtp")).toBe(false);
    expect(batchSizeFor("resend")).toBe(RESEND_BATCH_SIZE);
    expect(batchSizeFor("cloudflare")).toBe(CLOUDFLARE_BATCH_SIZE);
  });

  it("tallies sent, failed and skipped", () => {
    expect(
      tallyResults([
        { email: "a@x.com", status: "sent" },
        { email: "b@x.com", status: "failed", error: "bounced" },
        { email: "c@x.com", status: "skipped", error: "unsubscribed" },
        { email: "d@x.com", status: "sent" },
      ]),
    ).toEqual({ sent: 2, failed: 1, skipped: 1 });
  });
});

describe("Resend key masking", () => {
  const key = "re_AbCdEfGh1234567890wxyz";

  it("shows only the last four characters", () => {
    expect(keyTail(key)).toBe("wxyz");
    const masked = maskApiKey(key);
    expect(masked).toBe("re_••••••••wxyz");
    expect(masked).not.toContain("AbCdEfGh");
  });

  it("trims before taking the tail", () => {
    expect(keyTail(`  ${key}\n`)).toBe("wxyz");
  });

  it("reveals nothing of a key too short to hide behind its tail", () => {
    expect(keyTail("re_abc")).toBe("");
    expect(maskApiKey("short")).toBe("••••••••");
  });

  it("accepts Resend-shaped keys only", () => {
    expect(isValidResendKey(key)).toBe(true);
    expect(isValidResendKey("sk-123456789012")).toBe(false);
    expect(isValidResendKey("re_ has space 1234")).toBe(false);
    expect(isValidResendKey("re_short")).toBe(false);
    expect(isValidResendKey("")).toBe(false);
  });
});
