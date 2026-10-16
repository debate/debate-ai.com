import { describe, expect, it } from "vitest";
import { MAX_PRICE_CENTS, MIN_PRICE_CENTS, dollarsToCents, formatCents, parseSellRequest, validatePriceCents } from "../src/pricing";

describe("money", () => {
  it("formats cents as dollars", () => {
    expect(formatCents(1250)).toBe("$12.50");
    expect(formatCents(0)).toBe("$0.00");
    expect(formatCents(-500)).toBe("-$5.00");
  });

  it("reads typed dollar amounts", () => {
    expect(dollarsToCents("12")).toBe(1200);
    expect(dollarsToCents("$4.5")).toBe(450);
    expect(dollarsToCents("1,000.99")).toBe(100099);
    expect(dollarsToCents("4.999")).toBeNull();
    expect(dollarsToCents("abc")).toBeNull();
    expect(dollarsToCents("-3")).toBeNull();
  });
});

describe("validatePriceCents", () => {
  it("accepts whole cents within the limits", () => {
    expect(validatePriceCents(MIN_PRICE_CENTS)).toEqual({ ok: true, value: MIN_PRICE_CENTS });
    expect(validatePriceCents(MAX_PRICE_CENTS)).toEqual({ ok: true, value: MAX_PRICE_CENTS });
  });

  it("refuses fractions, strings and out-of-range prices", () => {
    expect(validatePriceCents(1.5).ok).toBe(false);
    expect(validatePriceCents("500").ok).toBe(false);
    expect(validatePriceCents(MIN_PRICE_CENTS - 1).ok).toBe(false);
    expect(validatePriceCents(MAX_PRICE_CENTS + 1).ok).toBe(false);
  });
});

describe("parseSellRequest", () => {
  it("needs a document and a price", () => {
    expect(parseSellRequest({ priceCents: 500 }).ok).toBe(false);
    expect(parseSellRequest({ documentId: 3, priceCents: 10 }).ok).toBe(false);
    expect(parseSellRequest({ documentId: 3, priceCents: 500 })).toEqual({ ok: true, value: { documentId: 3, priceCents: 500 } });
  });

  it("sanitizes a sent outline", () => {
    const parsed = parseSellRequest({ documentId: 3, priceCents: 500, outline: [{ level: 1, text: "A" }, { level: 9, text: "B" }] });
    expect(parsed).toEqual({ ok: true, value: { documentId: 3, priceCents: 500, outline: [{ level: 1, text: "A" }] } });
    expect(parseSellRequest({ documentId: 3, priceCents: 500, outline: "A" }).ok).toBe(false);
  });
});
