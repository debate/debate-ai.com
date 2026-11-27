/**
 * @fileoverview Reading a round's short address back: which first segments are
 * a video topic code, and which paths under one are a round rather than a
 * Topic Starter in the Debate Editor.
 */

import { describe, expect, it } from "vitest";
import {
  isVideoRoundPath,
  isVideoTopicCode,
  parseVideoRoundPath,
  parseVideoTopicCode,
} from "../src/lib/video-topic-path";

describe("parseVideoTopicCode", () => {
  it("reads the format, the topic letter and the year the season ends in", () => {
    expect(parseVideoTopicCode("cpd27")).toEqual({ code: "cpd27", format: "cpd", letter: null, seasonEnd: 2027 });
    expect(parseVideoTopicCode("vcx24")).toEqual({ code: "vcx24", format: "vcx", letter: null, seasonEnd: 2024 });
    expect(parseVideoTopicCode("ldb23")).toEqual({ code: "ldb23", format: "ld", letter: "b", seasonEnd: 2023 });
    expect(parseVideoTopicCode("PFA27")).toEqual({ code: "pfa27", format: "pf", letter: "a", seasonEnd: 2027 });
  });

  it("refuses anything that is not a video topic code", () => {
    for (const segment of ["cpd", "cpd2027", "cpd7", "ndt27", "bq27", "ldg23", "ld23", "ld23b", "pfk27", "vcx27x", "videos", "", null, undefined]) {
      expect(isVideoTopicCode(segment), String(segment)).toBe(false);
      expect(parseVideoTopicCode(segment), String(segment)).toBeNull();
    }
  });
});

describe("parseVideoRoundPath", () => {
  it("reads a round's address into its code and segments", () => {
    expect(parseVideoRoundPath("/cpd27/shirley/octofinals/kansas-ss-harvard-ab/1nc/llm")).toEqual({
      code: "cpd27",
      rest: ["shirley", "octofinals", "kansas-ss-harvard-ab", "1nc", "llm"],
    });
    expect(parseVideoRoundPath("/LDB23/ndt/finals/a-b?x=1#y")?.code).toBe("ldb23");
    expect(isVideoRoundPath("/vcx24/shirley/finals/a-b/")).toBe(true);
  });

  it("leaves Topic Starters in the editor", () => {
    for (const path of ["/vcx27", "/vcx27/aff", "/vcx27/aff/aff-k/k-aff-answers", "/ldb23/neg/cp/x/y", "/pfa27/pro/case/one", "/pfa27/CON/case/one"]) {
      expect(isVideoRoundPath(path), path).toBe(false);
    }
  });

  it("needs a tournament, a round and teams, and at most a variant, speech and view more", () => {
    expect(isVideoRoundPath("/cpd27/shirley")).toBe(false);
    expect(isVideoRoundPath("/cpd27/shirley/finals")).toBe(false);
    expect(isVideoRoundPath("/cpd27/a/b/c/d/e/f")).toBe(true);
    expect(isVideoRoundPath("/cpd27/a/b/c/d/e/f/g")).toBe(false);
    expect(isVideoRoundPath("/cpd27/a//c")).toBe(false);
  });

  it("is not any other path", () => {
    for (const path of ["/", "/videos/26-27/cpd/shirley/finals/a-b", "/ndt27/a/b/c", "/alexgul/aff/k", null, undefined, "cpd27/a/b/c"]) {
      expect(isVideoRoundPath(path), String(path)).toBe(false);
    }
  });
});
