import { describe, expect, it } from "vitest";
import {
  MAX_STUDENTS,
  formatSubscriptionPrice,
  parseFileMetadata,
  parsePublisherRequest,
  parseStudentList,
  publisherHref,
  publisherSlug,
  readStudents,
  subscriptionEnd,
  validateSubscriptionPrice,
} from "../src/publishers";

describe("publisher names and links", () => {
  it("makes a URL slug from a name", () => {
    expect(publisherSlug("Westwood Research Lab")).toBe("westwood-research-lab");
    expect(publisherSlug("  Café — Débat!! ")).toBe("cafe-debat");
    expect(publisherSlug("!!!")).toBe("publisher");
    expect(publisherSlug("a".repeat(100))).toHaveLength(60);
  });

  it("links to the publisher page", () => {
    expect(publisherHref("westwood")).toBe("/research/publishers/westwood");
  });
});

describe("student lists", () => {
  it("splits typed names on lines, commas and semicolons, dropping repeats", () => {
    expect(parseStudentList("Ana Ruiz, Ben Lee\nana ruiz;  Cam   Ng ")).toEqual(["Ana Ruiz", "Ben Lee", "Cam Ng"]);
  });

  it("caps the list", () => {
    const names = Array.from({ length: MAX_STUDENTS + 5 }, (_, i) => `Student ${i}`).join("\n");
    expect(parseStudentList(names)).toHaveLength(MAX_STUDENTS);
  });

  it("reads a stored list and tolerates junk", () => {
    expect(readStudents('["Ana", 3, "Ben"]')).toEqual(["Ana", "Ben"]);
    expect(readStudents("not json")).toEqual([]);
    expect(readStudents(null)).toEqual([]);
    expect(readStudents('{"a":1}')).toEqual([]);
  });
});

describe("subscription prices", () => {
  it("allows free and the market's price range", () => {
    expect(validateSubscriptionPrice(0)).toEqual({ ok: true, value: 0 });
    expect(validateSubscriptionPrice(500)).toEqual({ ok: true, value: 500 });
    expect(validateSubscriptionPrice(10).ok).toBe(false);
    expect(validateSubscriptionPrice(-1).ok).toBe(false);
    expect(validateSubscriptionPrice(1.5).ok).toBe(false);
    expect(validateSubscriptionPrice(10_000_000).ok).toBe(false);
  });

  it("formats a price per month", () => {
    expect(formatSubscriptionPrice(0)).toBe("Free");
    expect(formatSubscriptionPrice(500)).toBe("$5.00 / month");
  });

  it("runs a month of 30 days", () => {
    const from = new Date("2026-01-01T00:00:00Z");
    expect(subscriptionEnd(from).toISOString()).toBe("2026-01-31T00:00:00.000Z");
  });
});

describe("parsePublisherRequest", () => {
  it("needs a name and cleans the rest", () => {
    expect(parsePublisherRequest({ name: " " }).ok).toBe(false);
    const parsed = parsePublisherRequest({
      name: " Lab ",
      students: ["Ana", "", "Ana", 4],
      priceCents: 500,
      website: "https://lab.example",
    });
    expect(parsed).toEqual({
      ok: true,
      value: {
        name: "Lab",
        description: "",
        researchGroup: "",
        students: ["Ana"],
        years: "",
        website: "https://lab.example",
        priceCents: 500,
      },
    });
  });

  it("refuses a website that isn't http(s) and a bad price", () => {
    expect(parsePublisherRequest({ name: "Lab", website: "javascript:alert(1)" }).ok).toBe(false);
    expect(parsePublisherRequest({ name: "Lab", priceCents: 5 }).ok).toBe(false);
  });
});

describe("parseFileMetadata", () => {
  it("accepts the details and a full date", () => {
    expect(
      parseFileMetadata({ author: "Ana", publisherId: "p1", students: ["Ana", "Ben"], years: "2025–2026", publishedOn: "2026-03-14" }),
    ).toEqual({
      ok: true,
      value: {
        author: "Ana",
        publisherId: "p1",
        researchGroup: "",
        students: ["Ana", "Ben"],
        years: "2025–2026",
        publishedOn: "2026-03-14",
        summary: "",
      },
    });
  });

  it("refuses an impossible date or a non-string publisher", () => {
    expect(parseFileMetadata({ publishedOn: "2026-02-30" }).ok).toBe(false);
    expect(parseFileMetadata({ publishedOn: "March" }).ok).toBe(false);
    expect(parseFileMetadata({ publisherId: 4 }).ok).toBe(false);
    expect(parseFileMetadata({ publisherId: null })).toMatchObject({ ok: true, value: { publisherId: null } });
  });
});
