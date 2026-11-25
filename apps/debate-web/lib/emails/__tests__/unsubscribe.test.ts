import { describe, expect, it } from "vitest";
import {
  applyUnsubscribeUrl,
  normalizeEmail,
  signUnsubscribeToken,
  UNSUBSCRIBE_URL_PLACEHOLDER,
  verifyUnsubscribeToken,
} from "../unsubscribe";

describe("email unsubscribe tokens", () => {
  it("normalizes addresses", () => {
    expect(normalizeEmail("  Alex@Example.com ")).toBe("alex@example.com");
    expect(normalizeEmail("nope")).toBeNull();
  });

  it("round-trips a signed token", () => {
    const token = signUnsubscribeToken("Alex@Example.com");
    expect(verifyUnsubscribeToken(token)).toBe("alex@example.com");
  });

  it("rejects a forged or expired token", () => {
    const token = signUnsubscribeToken("a@b.co");
    expect(verifyUnsubscribeToken(token + "x")).toBeNull();
    expect(verifyUnsubscribeToken("a@b.co.1.notasignature")).toBeNull();
    const expired = signUnsubscribeToken("a@b.co", Date.now() - 100 * 24 * 60 * 60 * 1000);
    // Token exp is now+90d from the past clock → still valid relative to "then";
    // verify with a far-future now instead.
    expect(verifyUnsubscribeToken(expired, Date.now() + 200 * 24 * 60 * 60 * 1000)).toBeNull();
  });

  it("swaps the footer placeholder", () => {
    const html = `<a href="${UNSUBSCRIBE_URL_PLACEHOLDER}">Unsubscribe</a>`;
    expect(applyUnsubscribeUrl(html, "https://d.ebate.app/unsubscribe?t=x")).toBe(
      '<a href="https://d.ebate.app/unsubscribe?t=x">Unsubscribe</a>',
    );
  });
});
