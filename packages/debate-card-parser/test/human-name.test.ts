/**
 * @fileoverview Covers the author-name subsystem behind every cut card's cite:
 * splitting a byline into authors, telling a person from an institution, and
 * breaking a personal name into its parts.
 *
 * The three regression blocks at the bottom pin bugs that made the whole
 * subsystem misbehave in ways a debater would see on the card: an author
 * dictionary that never matched anything, a 92k-name dataset that was never
 * consulted, and a title that swallowed the rest of the name.
 */

import { describe, expect, it } from "vitest";

import { splitMultipleAuthors } from "../src/human-name/author-splitter";
import { isOrganization } from "../src/human-name/is-organization";
import {
  cleanProfessionalQualifications,
  extractHumanNameParts,
} from "../src/human-name/name-parser";
import { extractHumanName } from "../src/human-name/human-name-recognizer";
import {
  ORG_PATTERNS,
  PARSE_LISTS,
  PROFESSIONAL_PATTERNS,
  TERMS_ORG,
  TERMS_QUALIFICATIONS,
} from "../src/human-name/constants";

describe("splitMultipleAuthors", () => {
  it("returns a single-element list for one author", () => {
    expect(splitMultipleAuthors("John Doe")).toEqual(["John Doe"]);
  });

  it("returns nothing for an empty byline", () => {
    expect(splitMultipleAuthors("")).toEqual([]);
  });

  it('splits a two-author "and" byline', () => {
    expect(splitMultipleAuthors("John Doe and Jane Smith")).toEqual([
      "John Doe",
      "Jane Smith",
    ]);
  });

  it('splits a two-author "&" byline', () => {
    expect(splitMultipleAuthors("John Doe & Jane Smith")).toEqual([
      "John Doe",
      "Jane Smith",
    ]);
  });

  it("keeps inverted Last, First pairs together when joined by an ampersand", () => {
    expect(splitMultipleAuthors("Doe, John & Smith, Jane")).toEqual([
      "Doe, John",
      "Smith, Jane",
    ]);
  });

  it("splits an Oxford-comma series ending in and", () => {
    expect(
      splitMultipleAuthors("John Doe, Jane Smith, and Alex Jones"),
    ).toEqual(["John Doe", "Jane Smith", "Alex Jones"]);
  });

  it("drops a trailing et al. rather than treating it as an author", () => {
    expect(splitMultipleAuthors("John Doe et al.")).toEqual(["John Doe"]);
    expect(splitMultipleAuthors("John Doe et al")).toEqual(["John Doe"]);
  });

  it("splits on semicolons", () => {
    expect(splitMultipleAuthors("Alpha Beta; Gamma Delta")).toEqual([
      "Alpha Beta",
      "Gamma Delta",
    ]);
  });

  it("never emits blank entries from stray delimiters", () => {
    for (const byline of ["John Doe, , Jane Smith", " & John Doe & ", ";;"]) {
      expect(splitMultipleAuthors(byline).every((a) => a.trim())).toBe(true);
    }
  });
});

describe("isOrganization", () => {
  it("treats an empty string as neither", () => {
    expect(isOrganization("")).toBe(false);
  });

  it("recognizes a short all-caps acronym as an organization", () => {
    expect(isOrganization("NAACP")).toBe(true);
    expect(isOrganization("IPCC")).toBe(true);
  });

  it.each([
    "Reuters",
    "Brookings Institution",
    "Cato Institute",
    "RAND Corporation",
    "Associated Press",
    "The New York Times",
    "Harvard Law School",
    "World Health Organization",
    "United States Department of Defense",
    "Center for Strategic and International Studies",
  ])("recognizes %j as an organization", (name) => {
    expect(isOrganization(name)).toBe(true);
  });

  it.each(["Dow Jones", "Morgan Stanley", "Wells Fargo", "Goldman Sachs"])(
    "recognizes the firm name %j, whose words double as surnames",
    (name) => {
      expect(isOrganization(name)).toBe(true);
    },
  );

  it.each([
    "John Doe",
    "Alex Jones",
    "Jane Smith",
    "Maria Garcia",
    "Barack Obama",
    "John Quincy Adams",
  ])("does not mistake the person %j for an organization", (name) => {
    expect(isOrganization(name)).toBe(false);
  });

  it("lets a qualification term veto an organization guess", () => {
    expect(isOrganization("Professor John Smith")).toBe(false);
    expect(isOrganization("Senior Fellow Jane Roe")).toBe(false);
  });

  it("reads a Last, First inversion as a person", () => {
    expect(isOrganization("Doe, John")).toBe(false);
  });

  it("falls back to calling a long unrecognized string an organization", () => {
    expect(isOrganization("Zzyzx Qwerty Blorp Frobnitz Grault")).toBe(true);
  });
});

describe("cleanProfessionalQualifications", () => {
  it("returns an empty string for empty input", () => {
    expect(cleanProfessionalQualifications("")).toBe("");
  });

  it("strips a trailing degree", () => {
    expect(cleanProfessionalQualifications("John Smith, Ph.D.")).toBe(
      "John Smith",
    );
  });

  it("strips a leading title and a trailing degree together", () => {
    expect(cleanProfessionalQualifications("Dr. Jane Doe, MD")).toBe("Jane Doe");
  });

  it("leaves a bare name untouched", () => {
    expect(cleanProfessionalQualifications("John Smith")).toBe("John Smith");
  });

  it("never leaves dangling punctuation or double spaces behind", () => {
    const cleaned = cleanProfessionalQualifications("Prof.  John  Smith, PhD,");
    expect(cleaned).not.toMatch(/^[,;.\s]/);
    expect(cleaned).not.toMatch(/[,;.\s]$/);
    expect(cleaned).not.toMatch(/\s{2,}/);
  });
});

describe("extractHumanNameParts", () => {
  it("returns all-empty parts for empty input", () => {
    expect(extractHumanNameParts("")).toEqual({
      title: "",
      firstname: "",
      middle: "",
      lastname: "",
      honorific: "",
    });
  });

  it("splits a plain First Last name", () => {
    expect(extractHumanNameParts("Jane Doe")).toMatchObject({
      firstname: "Jane",
      lastname: "Doe",
      middle: "",
    });
  });

  it("puts extra given names in the middle slot", () => {
    expect(extractHumanNameParts("John Quincy Adams")).toMatchObject({
      firstname: "John",
      middle: "Quincy",
      lastname: "Adams",
    });
  });

  it("reads a Last, First Middle inversion", () => {
    expect(extractHumanNameParts("Smith, Jane Ann")).toMatchObject({
      firstname: "Jane",
      middle: "Ann",
      lastname: "Smith",
    });
  });

  it("keeps a family-name prefix attached to the surname", () => {
    expect(extractHumanNameParts("van der Berg, Johannes")).toMatchObject({
      firstname: "Johannes",
      lastname: "van der Berg",
    });
  });

  it("treats a mononym as a surname", () => {
    expect(extractHumanNameParts("Madonna")).toMatchObject({
      firstname: "",
      lastname: "Madonna",
    });
  });

  it.each([
    ['John "The Rocket" Doe', "quoted"],
    ["John (The Rocket) Doe", "parenthesized"],
    ["John [The Rocket] Doe", "bracketed"],
  ])("drops a %s alias", (input) => {
    expect(extractHumanNameParts(input)).toMatchObject({
      firstname: "John",
      lastname: "Doe",
    });
  });

  it("restores title case for an all-uppercase name", () => {
    expect(extractHumanNameParts("JOHN SMITH")).toMatchObject({
      firstname: "John",
      lastname: "Smith",
    });
  });

  it("restores title case for an all-lowercase name", () => {
    expect(extractHumanNameParts("john smith")).toMatchObject({
      firstname: "John",
      lastname: "Smith",
    });
  });

  it("leaves an already mixed-case name alone", () => {
    expect(extractHumanNameParts("JoAnn McDonald")).toMatchObject({
      firstname: "JoAnn",
      lastname: "McDonald",
    });
  });

  it("pulls a generational suffix into the honorific", () => {
    expect(extractHumanNameParts("John Smith Jr.")).toMatchObject({
      firstname: "John",
      lastname: "Smith",
      honorific: "Jr.",
    });
  });
});

describe("extractHumanName", () => {
  it.each([
    ["", "empty"],
    [null as unknown as string, "null"],
    [undefined as unknown as string, "undefined"],
  ])("returns an empty citation for %j input", (author) => {
    expect(extractHumanName(author)).toEqual({
      author_cite: "",
      author_short: "",
      author_type: 4,
    });
  });

  it("cites a single author last-name first", () => {
    expect(extractHumanName("John Doe")).toEqual({
      author_cite: "Doe, John",
      author_short: "Doe",
      author_type: 1,
    });
  });

  it('strips a leading "by:" marker', () => {
    expect(extractHumanName("by: John Doe")).toMatchObject({
      author_cite: "Doe, John",
    });
  });

  it("marks an institution with author type 4 and cites it verbatim", () => {
    expect(extractHumanName("Brookings Institution")).toEqual({
      author_cite: "Brookings Institution",
      author_short: "Brookings Institution",
      author_type: 4,
    });
  });

  it("truncates an absurdly long organization name at a word boundary", () => {
    const long = `${"Institute of ".repeat(12)}Advanced Study`;
    const { author_cite } = extractHumanName(long);
    expect(author_cite.length).toBeLessThanOrEqual(60);
    expect(author_cite).not.toMatch(/\s$/);
  });

  it("joins two authors with an ampersand and marks author type 2", () => {
    expect(extractHumanName("John Doe and Jane Roe")).toEqual({
      author_cite: "Doe, John & Roe, Jane",
      author_short: "Doe & Roe",
      author_type: 2,
    });
  });

  it("collapses three-plus authors to et al. by default", () => {
    const result = extractHumanName("John Doe, Jane Roe, Alex Poe");
    expect(result.author_type).toBe(3);
    expect(result.author_cite).toBe("Doe, John et al.");
    expect(result.author_short).toBe("Doe et al.");
  });

  it("spells out every author when maxAuthorsBeforeEtAl allows it", () => {
    const result = extractHumanName("John Doe, Jane Roe, Alex Poe", {
      maxAuthorsBeforeEtAl: 5,
    });
    expect(result.author_cite).toBe("Doe, John, Roe, Jane & Poe, Alex");
    expect(result.author_short).toBe("Doe et al.");
  });

  it("abbreviates forenames to initials when asked", () => {
    expect(
      extractHumanName("John Quincy Adams", { formatCiteShortenAuthor: true }),
    ).toEqual({
      author_cite: "Adams, J. Q.",
      author_short: "Adams",
      author_type: 1,
    });
  });

  it("drops a courtesy title from the cite", () => {
    // Titles are pruned as a professional qualification before the name is
    // parsed, so a cite reads the same whether or not the byline carried one.
    expect(extractHumanName("Dr. Jane Roe").author_cite).toBe("Roe, Jane");
    expect(extractHumanName("Dr. Jane Roe")).toEqual(
      extractHumanName("Jane Roe"),
    );
  });

  it("appends a generational suffix after the forename", () => {
    expect(extractHumanName("John Smith Jr.").author_cite).toBe(
      "Smith, John, Jr",
    );
  });

  it("never leaves a trailing comma on a cite", () => {
    for (const author of ["Madonna", "John Doe", "Dr. Jane Roe", "Reuters"]) {
      expect(extractHumanName(author).author_cite).not.toMatch(/,\s*$/);
    }
  });
});

describe("constants", () => {
  it("exposes the organization dictionary as whole words, not characters", () => {
    // Regression: the dictionary was built from a `+`-concatenated string whose
    // trailing `.split(",")` bound to the last literal only, so `new Set()`
    // received one long string and enumerated it a character at a time. Every
    // multi-character lookup missed, which silently disabled org detection.
    expect(TERMS_ORG.size).toBeGreaterThan(300);
    for (const term of ["reuters", "institution", "university", "department"]) {
      expect(TERMS_ORG.has(term)).toBe(true);
    }
    expect([...TERMS_ORG].every((term) => term.length > 1)).toBe(true);
    expect(TERMS_ORG.has(",")).toBe(false);
  });

  it("keeps the qualification and parse lists populated", () => {
    expect(TERMS_QUALIFICATIONS.has("professor")).toBe(true);
    expect(PARSE_LISTS.title.has("dr")).toBe(true);
    expect(PARSE_LISTS.honorific.has("phd")).toBe(true);
    expect(PARSE_LISTS.prefix.has("van")).toBe(true);
  });

  it("ships usable regex batteries", () => {
    expect(PROFESSIONAL_PATTERNS.length).toBeGreaterThan(0);
    expect(ORG_PATTERNS.length).toBeGreaterThan(0);
    expect(ORG_PATTERNS.some((p) => p.test("Acme Corporation"))).toBe(true);
  });
});

describe("regressions", () => {
  it("consults the 92k human-name dataset, which is keyed in lower case", () => {
    // Regression: lookups title-cased each word ("john") before indexing a
    // dataset keyed in lower case ("john"), so no word ever matched and any
    // three-word person fell through to the organization branch.
    expect(isOrganization("John Quincy Adams")).toBe(false);
    expect(extractHumanName("John Quincy Adams").author_type).toBe(1);
  });

  it("does not let one ambiguous dictionary word turn a person into an org", () => {
    // "doe" (Department of Energy) and "jones" (Dow Jones) are both in the
    // organization dictionary and both common surnames.
    expect(isOrganization("John Doe")).toBe(false);
    expect(isOrganization("Alex Jones")).toBe(false);
    expect(isOrganization("Dow Jones")).toBe(true);
  });

  it("extracts a title without swallowing the rest of the name", () => {
    // Regression: honorifics were extracted first and `splice(index)` took
    // everything to the end of the name. Because "Dr"/"Mr"/"Ms" sit in both the
    // title and honorific lists, "Dr. John Q. Public Jr." collapsed into a
    // single honorific field and left first/middle/last empty.
    expect(extractHumanNameParts("Dr. John Q. Public Jr.")).toEqual({
      title: "Dr.",
      firstname: "John",
      middle: "Q.",
      lastname: "Public",
      honorific: "Jr.",
    });
    expect(extractHumanNameParts("Ms. Jane Doe")).toMatchObject({
      title: "Ms.",
      firstname: "Jane",
      lastname: "Doe",
      honorific: "",
    });
  });
});
