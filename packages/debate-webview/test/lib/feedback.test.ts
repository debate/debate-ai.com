import { describe, expect, it } from "vitest";
import {
  describeFeedbackWait,
  MAX_FEEDBACK_LENGTH,
  parseFeedback,
} from "../../src/lib/feedback/feedback";

describe("parseFeedback", () => {
  it("trims and lowercases the email and keeps a same-site page", () => {
    expect(parseFeedback({ email: " A@B.co ", message: " hi ", page: "/settings" })).toEqual({
      ok: true,
      value: { email: "a@b.co", message: "hi", page: "/settings" },
    });
  });

  it("drops an off-site page", () => {
    const parsed = parseFeedback({ email: "a@b.co", message: "hi", page: "//evil.example" });
    expect(parsed.ok && parsed.value.page).toBeNull();
  });

  it("rejects a missing email, an empty message and an oversized one", () => {
    expect(parseFeedback({ message: "hi" }).ok).toBe(false);
    expect(parseFeedback({ email: "a@b.co", message: "" }).ok).toBe(false);
    expect(parseFeedback({ email: "a@b.co", message: "x".repeat(MAX_FEEDBACK_LENGTH + 1) }).ok).toBe(false);
    expect(parseFeedback({ email: "a@b.co", message: "x".repeat(MAX_FEEDBACK_LENGTH) }).ok).toBe(true);
  });
});

describe("describeFeedbackWait", () => {
  it("rounds up to minutes", () => {
    expect(describeFeedbackWait(3600)).toBe("in 1 hour");
    expect(describeFeedbackWait(30)).toBe("in a minute");
    expect(describeFeedbackWait(601)).toBe("in 11 minutes");
  });
});
