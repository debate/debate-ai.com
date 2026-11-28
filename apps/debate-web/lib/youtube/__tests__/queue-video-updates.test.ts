/**
 * @fileoverview `queueVideoUpdates`, the translation from the admin queue
 * edit dialog's PATCH body into `youtube_round_videos` column writes. The
 * contract that matters: only keys the body carries are written, required
 * columns can never be blanked, optional ones can be cleared, and both the
 * dialog's and the library form's field names are understood.
 */

import { describe, expect, it } from "vitest";

import { queueVideoUpdates } from "@/lib/youtube/queue-video-updates";

describe("queueVideoUpdates", () => {
  it("writes nothing for an empty body, so a partial edit never blanks other fields", () => {
    expect(queueVideoUpdates({})).toEqual({});
    expect(queueVideoUpdates({ unrelated: "x" })).toEqual({});
  });

  it("trims text, and never blanks a required column", () => {
    expect(queueVideoUpdates({ title: "  New title  ", channel: " Chan ", publishedAt: " 2025-01-02 " })).toEqual({
      title: "New title",
      channel: "Chan",
      publishedAt: "2025-01-02",
    });
    for (const blank of ["", "   ", null, 5, undefined]) {
      expect(queueVideoUpdates({ title: blank, channel: blank, publishedAt: blank })).toEqual({});
    }
  });

  it("clears an optional text column when sent blank or null, and ignores a non-text value", () => {
    expect(queueVideoUpdates({ tournament: "", roundLevel: null, judgeDecision: "   ", category: "" })).toEqual({
      tournament: null,
      roundLevel: null,
      judgeDecision: null,
      category: null,
    });
    expect(queueVideoUpdates({ tournament: 12, roundLevel: { a: 1 }, judgeDecision: false })).toEqual({});
  });

  it("treats the `none` category as no category", () => {
    expect(queueVideoUpdates({ category: "none" })).toEqual({ category: null });
    expect(queueVideoUpdates({ category: " Lectures " })).toEqual({ category: "Lectures" });
  });

  it("understands both the dialog's and the library form's team names, preferring the dialog's", () => {
    expect(queueVideoUpdates({ aff: "Harker AB", neg: "Lex CD" })).toEqual({ aff: "Harker AB", neg: "Lex CD" });
    expect(queueVideoUpdates({ affTeam: "Harker AB", negTeam: "Lex CD" })).toEqual({ aff: "Harker AB", neg: "Lex CD" });
    expect(queueVideoUpdates({ aff: "Dialog", affTeam: "Library" })).toEqual({ aff: "Dialog" });
    expect(queueVideoUpdates({ aff: "", affTeam: "Library" })).toEqual({ aff: null });
  });

  it.each([
    [true, true],
    ["true", true],
    [false, false],
    ["false", false],
    [null, null],
    ["", null],
    ["unknown", null],
  ])("reads the winner %j as %j", (value, expected) => {
    expect(queueVideoUpdates({ winner: value })).toEqual({ winner: expected });
    expect(queueVideoUpdates({ affWin: value })).toEqual({ winner: expected });
  });

  it("ignores a winner it cannot interpret", () => {
    expect(queueVideoUpdates({ winner: "maybe" })).toEqual({});
    expect(queueVideoUpdates({ winner: 1 })).toEqual({});
  });

  it.each([
    [3, 3],
    ["3", 3],
    [0, 0],
    [null, null],
    ["none", null],
    ["", null],
  ])("reads the style %j as %j", (value, expected) => {
    expect(queueVideoUpdates({ style: value })).toEqual({ style: expected });
  });

  it("ignores a style that is not a whole number", () => {
    expect(queueVideoUpdates({ style: "abc" })).toEqual({});
    expect(queueVideoUpdates({ style: 2.5 })).toEqual({});
  });

  it("trims a description and lets it be emptied, but ignores a non-text one", () => {
    expect(queueVideoUpdates({ description: "  About the round  " })).toEqual({ description: "About the round" });
    expect(queueVideoUpdates({ description: "" })).toEqual({ description: "" });
    expect(queueVideoUpdates({ description: null })).toEqual({ description: "" });
    expect(queueVideoUpdates({ description: 7 })).toEqual({});
  });
});
