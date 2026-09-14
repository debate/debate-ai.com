/**
 * @fileoverview Covers stacked playlists: which videos the library folds into
 * one grid slot, in what order, and — as importantly — which it refuses to.
 *
 * The links come from the descriptions the channels already write ("Full
 * Debate: https://www.youtube.com/watch?v=…"), so the cases here are the ones
 * the real assets produce: a round-analysis video pointing at its round, a
 * lecture series cross-linking itself, and a description that dumps a channel
 * index and must not chain the library together through it.
 */
import { describe, expect, it } from "vitest";

import { buildVideoRows, type VideoRow } from "../src/videos/video-rows";
import {
  assignVideoStacks,
  buildVideoStacks,
  extractLinkedVideoIds,
  MAX_LINKS_PER_DESCRIPTION,
} from "../src/videos/video-stacks";

/** Builds a row with only the fields stacking reads. */
function row(overrides: Partial<VideoRow> & { videoId: string }): VideoRow {
  return {
    source: "lecture",
    title: overrides.videoId,
    publishedAt: "2026-01-01",
    publishedMs: Date.parse("2026-01-01"),
    channel: "",
    viewCount: 0,
    description: "",
    style: null,
    category: null,
    categoryKey: null,
    tournament: null,
    roundLevel: null,
    affTeam: null,
    negTeam: null,
    affWin: null,
    judgeDecision: null,
    arg1ac: null,
    arg2nr: null,
    isTopPick: false,
    speechDocsUrl: null,
    seasonYear: 2026,
    stackKey: null,
    stackPosition: 0,
    searchText: "",
    ...overrides,
  } as VideoRow;
}

describe("extractLinkedVideoIds", () => {
  it("reads every link form the descriptions use, once each", () => {
    const ids = extractLinkedVideoIds(
      "Full Debate: https://www.youtube.com/watch?v=T77G1CdZx9E\n" +
        "Mirror: https://youtu.be/T77G1CdZx9E\n" +
        "Embed: https://www.youtube.com/embed/qx7Xx_6exzk\n" +
        "With params: https://www.youtube.com/watch?list=PL123&v=zoKowWVQ1wE",
    );
    expect(ids).toEqual(["T77G1CdZx9E", "qx7Xx_6exzk", "zoKowWVQ1wE"]);
  });

  it("does not truncate a longer id into a valid-looking one", () => {
    expect(extractLinkedVideoIds("https://youtu.be/T77G1CdZx9EEXTRA")).toEqual([]);
  });

  it("returns nothing for a description without links", () => {
    expect(extractLinkedVideoIds("Like us on Facebook")).toEqual([]);
    expect(extractLinkedVideoIds(null)).toEqual([]);
  });
});

describe("buildVideoStacks", () => {
  it("pairs a round-analysis video with the round it links to, round first", () => {
    const stacks = buildVideoStacks([
      row({ videoId: "roundvideo1", source: "round", publishedMs: Date.parse("2026-06-01") }),
      row({
        videoId: "analysisvid1",
        description: "Full Debate: https://www.youtube.com/watch?v=roundvideo1",
        publishedMs: Date.parse("2026-08-03"),
      }),
    ]);

    expect(stacks).toEqual([{ key: "roundvideo1", memberIds: ["roundvideo1", "analysisvid1"] }]);
  });

  it("joins a series through one-sided links and orders it by publish date", () => {
    const stacks = buildVideoStacks([
      row({ videoId: "part1aaaaaa", publishedMs: 3 }),
      row({
        videoId: "part2aaaaaa",
        publishedMs: 1,
        description: "https://youtu.be/part1aaaaaa and https://youtu.be/part3aaaaaa",
      }),
      row({ videoId: "part3aaaaaa", publishedMs: 2 }),
    ]);

    expect(stacks).toHaveLength(1);
    expect(stacks[0].memberIds).toEqual(["part2aaaaaa", "part3aaaaaa", "part1aaaaaa"]);
  });

  it("ignores links to videos the library does not hold, and to itself", () => {
    const stacks = buildVideoStacks([
      row({
        videoId: "lonelyvideo1",
        description:
          "https://youtu.be/lonelyvideo1 and https://www.youtube.com/watch?v=notinlibrary",
      }),
    ]);

    expect(stacks).toEqual([]);
  });

  it("skips a description that dumps a channel index rather than a companion", () => {
    const catalogue = Array.from({ length: MAX_LINKS_PER_DESCRIPTION + 1 }, (_, i) =>
      row({ videoId: `catalogue${String(i).padStart(2, "0")}` }),
    );
    const dump = row({
      videoId: "indexvideo01",
      description: catalogue.map((r) => `https://youtu.be/${r.videoId}`).join("\n"),
    });

    expect(buildVideoStacks([dump, ...catalogue])).toEqual([]);
  });
});

describe("assignVideoStacks", () => {
  it("stamps members with the key and their position, and clears the rest", () => {
    const rows = [
      row({ videoId: "roundvideo1", source: "round" }),
      row({ videoId: "analysisvid1", description: "Full Round: https://youtu.be/roundvideo1" }),
      row({ videoId: "unrelatedvid" }),
    ];

    assignVideoStacks(rows);

    expect(rows.map((r) => [r.videoId, r.stackKey, r.stackPosition])).toEqual([
      ["roundvideo1", "roundvideo1", 0],
      ["analysisvid1", "roundvideo1", 1],
      ["unrelatedvid", null, 0],
    ]);
  });
});

describe("buildVideoRows", () => {
  it("resolves stacks across assets — an analysis lecture onto a college round", () => {
    const rows = buildVideoRows({
      rounds: [
        {
          data: [["roundvideo1", "NDT 2026 Finals", "2026-06-01", "NDT", 10, "", 4]],
        },
      ],
      lectures: {
        data: [
          [
            "analysisvid1",
            "2026 NDT Finals - Round Analysis",
            "2026-08-03",
            "d3v",
            78,
            "Full Debate: https://www.youtube.com/watch?v=roundvideo1",
            "Round Analysis",
          ],
        ],
      },
      topPicks: { data: [] },
    });

    expect(rows.map((r) => [r.videoId, r.stackKey, r.stackPosition])).toEqual([
      ["roundvideo1", "roundvideo1", 0],
      ["analysisvid1", "roundvideo1", 1],
    ]);
  });
});
