/**
 * @fileoverview Pins the whole-library index's wire format.
 *
 * The index is the only place a video tuple travels with its *source* — the
 * one field the UI tuple drops and the client cannot derive. A lectures asset
 * carries styled videos too, so "has a numeric style" is a different question
 * from "came from the lectures asset", and a client that guessed would serve
 * the wrong library to a rounds grid without anything looking broken. These
 * cases exist to stop that field going missing again.
 */

import { describe, expect, it } from "vitest";
import {
  VIDEO_INDEX_SOURCE_SLOT,
  indexTupleToVideoRow,
  indexTupleToVideoTuple,
  videoRowToIndexTuple,
} from "../src/videos/video-index";
import { buildVideoRows, videoRowToTuple } from "../src/videos/video-rows";

const ASSETS = {
  rounds: [
    {
      data: [
        [
          "round-1",
          "TOC FINALS - GBN CR vs MBA HL",
          "2026-04-14",
          "LASA Debate",
          3657,
          "Elimination round. Analysis: https://www.youtube.com/watch?v=round-2",
          1,
          "2026 TOC",
          "Finals",
          "GBN CR",
          "MBA HL",
          false,
          null,
          "Cap K",
          "Framework",
          true,
          "https://example.com/docs",
        ],
        [
          "round-2",
          "Breaking down the TOC final",
          "2026-04-20",
          "LASA Debate",
          900,
          "Analysis of https://www.youtube.com/watch?v=round-1",
          1,
          "2026 TOC",
          "Finals",
          "GBN CR",
          "MBA HL",
        ],
      ],
    },
  ],
  lectures: {
    data: [
      // A lecture with a numeric style: the case that makes "source" a
      // separate question from "has a style".
      ["lecture-1", "Kritik basics", "2025-09-02", "Debate Camp", 120, "Lecture", 3],
      ["lecture-2", "Flowing drills", "2025-09-03", "Debate Camp", 90, "Lecture", "Drills"],
    ],
  },
} as any;

const rows = buildVideoRows(ASSETS);
const rowFor = (id: string) => rows.find((row) => row.videoId === id)!;

describe("video index tuples", () => {
  it("round-trips every field the grid filters on", () => {
    for (const row of rows) {
      const restored = indexTupleToVideoRow(videoRowToIndexTuple(row));
      expect(restored, row.videoId).not.toBeNull();
      expect(restored).toMatchObject({
        videoId: row.videoId,
        source: row.source,
        style: row.style,
        categoryKey: row.categoryKey,
        seasonYear: row.seasonYear,
        isTopPick: row.isTopPick,
        stackKey: row.stackKey,
        stackPosition: row.stackPosition,
        searchText: row.searchText,
      });
    }
  });

  it("carries the source of a lecture that has a debate style", () => {
    const tuple = videoRowToIndexTuple(rowFor("lecture-1"));

    expect(tuple[VIDEO_INDEX_SOURCE_SLOT]).toBe(1);
    expect(indexTupleToVideoRow(tuple)?.source).toBe("lecture");
    expect(indexTupleToVideoRow(tuple)?.style).toBe(3);
  });

  it("keeps a stacked round's key and position", () => {
    // Stacks are assigned across the whole library rather than read off one
    // row, so the index is the only thing that carries them to a client that
    // queries locally — without them the grid loses its flip arrows.
    const stacked = { ...rowFor("round-2"), stackKey: "round-1", stackPosition: 1 };

    const restored = indexTupleToVideoRow(videoRowToIndexTuple(stacked));
    expect(restored?.stackKey).toBe("round-1");
    expect(restored?.stackPosition).toBe(1);
  });

  it("puts the source at a fixed slot whatever the row's width", () => {
    // The UI tuple trims trailing nulls, so a sparse lecture row is much
    // shorter than a full round; the reader is an index lookup either way.
    for (const row of rows) {
      expect(videoRowToIndexTuple(row)).toHaveLength(VIDEO_INDEX_SOURCE_SLOT + 1);
    }
  });

  it("strips back to exactly the tuple the API serves", () => {
    for (const row of rows) {
      expect(indexTupleToVideoTuple(videoRowToIndexTuple(row))).toEqual(videoRowToTuple(row));
    }
  });

  it("rejects a tuple with no video id rather than inventing a row", () => {
    expect(indexTupleToVideoRow([])).toBeNull();
    expect(indexTupleToVideoRow([""])).toBeNull();
  });
});
