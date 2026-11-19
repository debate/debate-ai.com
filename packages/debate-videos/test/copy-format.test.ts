// @vitest-environment jsdom
/**
 * @fileoverview The watch page's copy formats: URL, URL + title, and the
 * Chicago citation, plus the remembered choice.
 */

import { afterEach, describe, expect, it } from "vitest";
import {
  COPY_FORMAT_STORAGE_KEY,
  chicagoVideoCitation,
  formatVideoCopy,
  readCopyFormat,
  writeCopyFormat,
} from "../src/lib/copy-format";

const video = {
  url: "https://debate-ai.com/videos/25-26/cpd/harvard/quarters/iowa-vs-emory",
  title: "2026 Harvard Quarters: Iowa vs Emory",
  publishedAt: "2026-02-15T12:00:00Z",
};

afterEach(() => window.localStorage.clear());

describe("formatVideoCopy", () => {
  it("copies the URL alone", () => {
    expect(formatVideoCopy("url", video)).toBe(video.url);
  });

  it("puts the title above the URL", () => {
    expect(formatVideoCopy("url-title", video)).toBe(`${video.title}\n${video.url}`);
  });

  it("cites the video Chicago-style, credited to the Debate AI Institute", () => {
    expect(formatVideoCopy("citation", video)).toBe(
      `Debate AI Institute. “2026 Harvard Quarters: Iowa vs Emory.” Debate video, 2026. ${video.url}.`,
    );
  });
});

describe("chicagoVideoCitation", () => {
  it("keeps a title's own closing punctuation", () => {
    expect(chicagoVideoCitation({ ...video, title: "Who wins?" })).toContain("“Who wins?” Debate video");
  });

  it("writes n.d. when the date is missing or unreadable", () => {
    expect(chicagoVideoCitation({ ...video, publishedAt: null })).toContain("Debate video, n.d.");
    expect(chicagoVideoCitation({ ...video, publishedAt: "not a date" })).toContain("Debate video, n.d.");
  });
});

describe("remembered copy format", () => {
  it("defaults to the URL", () => {
    expect(readCopyFormat()).toBe("url");
  });

  it("returns the saved format", () => {
    writeCopyFormat("citation");
    expect(window.localStorage.getItem(COPY_FORMAT_STORAGE_KEY)).toBe("citation");
    expect(readCopyFormat()).toBe("citation");
  });

  it("ignores an unknown stored value", () => {
    window.localStorage.setItem(COPY_FORMAT_STORAGE_KEY, "bogus");
    expect(readCopyFormat()).toBe("url");
  });
});
