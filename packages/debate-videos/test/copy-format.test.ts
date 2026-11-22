// @vitest-environment jsdom
/**
 * @fileoverview The watch page's copy formats: URL, URL + title, and the
 * Chicago citation. The remembered choice is covered in
 * `watch-preferences.test.ts`.
 */

import { describe, expect, it } from "vitest";
import {
  chicagoVideoCitation,
  citationDate,
  citationRunningTime,
  formatVideoCopy,
} from "../src/lib/copy-format";

const video = {
  url: "https://debate-ai.com/videos/25-26/cpd/harvard/quarters/iowa-vs-emory",
  title: "2026 Harvard Quarters: Iowa vs Emory",
  publishedAt: "2026-02-15T12:00:00Z",
};


describe("formatVideoCopy", () => {
  it("copies the URL alone", () => {
    expect(formatVideoCopy("url", video)).toBe(video.url);
  });

  it("puts the title above the URL", () => {
    expect(formatVideoCopy("url-title", video)).toBe(`${video.title}\n${video.url}`);
  });

  it("cites the video Chicago-style, credited to the Debate AI Institute", () => {
    expect(formatVideoCopy("citation", video)).toBe(
      `Debate AI Institute. “2026 Harvard Quarters: Iowa vs Emory.” February 15, 2026. Video. ${video.url}.`,
    );
  });
});

describe("Chicago notes-and-bibliography video entry", () => {
  const michigan = {
    url: "https://d.ebate.app/videos/26-27/vcx/michigan/semifinals/walter-payton-br-whitney-young-mb",
    title: "2026 Michigan HS Policy Semis: Walter Payton #1 Bendre & Rout vs Whitney Young #3 Boss & Mohan",
  };

  it("matches the year-only form: Author. “Title.” Year. Video. URL.", () => {
    expect(chicagoVideoCitation({ ...michigan, publishedAt: "2026" })).toBe(
      `Debate AI Institute. “${michigan.title}.” 2026. Video. ${michigan.url}.`,
    );
  });

  it("uses the full posting date and the running time when known", () => {
    expect(
      chicagoVideoCitation({ ...michigan, publishedAt: "2026-03-07", durationSeconds: 6127 }),
    ).toBe(`Debate AI Institute. “${michigan.title}.” March 7, 2026. Video, 1:42:07. ${michigan.url}.`);
  });
});

describe("citationDate", () => {
  it("writes Month D, YYYY without shifting a date-only value", () => {
    expect(citationDate("2026-01-01")).toBe("January 1, 2026");
    expect(citationDate("2026-02-15T12:00:00Z")).toBe("February 15, 2026");
  });

  it("keeps a bare year and rejects missing or unreadable dates", () => {
    expect(citationDate("2025")).toBe("2025");
    expect(citationDate(null)).toBeNull();
    expect(citationDate("")).toBeNull();
    expect(citationDate("not a date")).toBeNull();
  });
});

describe("citationRunningTime", () => {
  it("writes h:mm:ss, or m:ss under an hour", () => {
    expect(citationRunningTime(6127)).toBe("1:42:07");
    expect(citationRunningTime(3600)).toBe("1:00:00");
    expect(citationRunningTime(3483.4)).toBe("58:03");
    expect(citationRunningTime(45)).toBe("0:45");
  });

  it("is null for an unknown length", () => {
    expect(citationRunningTime(null)).toBeNull();
    expect(citationRunningTime(0)).toBeNull();
    expect(citationRunningTime(Number.NaN)).toBeNull();
  });
});

describe("chicagoVideoCitation", () => {
  it("keeps a title's own closing punctuation", () => {
    expect(chicagoVideoCitation({ ...video, title: "Who wins?" })).toContain("“Who wins?” February");
  });

  it("writes n.d. when the date is missing or unreadable", () => {
    expect(chicagoVideoCitation({ ...video, publishedAt: null })).toContain("” n.d. Video.");
    expect(chicagoVideoCitation({ ...video, publishedAt: "not a date" })).toContain("” n.d. Video.");
  });
});
