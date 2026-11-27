/**
 * @fileoverview The Open Public format: a view over Open Super Debates and the
 * UNT demo debates that leaves both source categories as they were.
 */

import { describe, expect, it } from "vitest";
import { buildVideoRows, type VideoRow, type VideoTuple } from "../src/data/video-rows";
import { computeLectureCategories, filterVideoRows } from "../src/data/video-query";
import {
  isOpenPublicKey,
  isOpenPublicRow,
  isUntDemoRow,
  namesUnt,
  OPEN_PUBLIC_CATEGORY_KEY,
  OPEN_PUBLIC_CATEGORY_LABEL,
  SUPER_DEBATE_CATEGORY_KEY,
} from "../src/data/open-public";
import { OPEN_SUPER_DEBATES_CATEGORY } from "../src/data/lecture-classifier";
import { normalizeCategoryKey } from "../src/data/video-rows";

const rounds = [
  ["sdRound0001", "Night 2: Rivera vs Okafor", "2026-03-02", "SuperDebate", 640, "", 2],
  ["pfRound0001", "TOC 2024 PF Finals - A vs B", "2024-04-28", "NSDA", 980, "", 2],
] as unknown as VideoTuple[];

const lectures = [
  ["untDemoCh01", "PF demo round: Should the UN be reformed?", "2025-04-01", "UNT Debate", 220, "", "Demo Debates"],
  ["untDemoTi01", "Policy Demo at UNT, finals", "2025-04-02", "Coach", 130, "", "Demo Debates"],
  ["untDemoLong", "Demo: University of North Texas Parli", "2025-04-03", "Coach", 90, "", "Demo Debates"],
  ["huntDemo001", "Demo debate at the hunt for unity", "2025-04-04", "Coach", 75, "", "Demo Debates"],
  ["northTexasPP", "Demo: Emory vs North Texas PP", "2025-04-04", "Coach", 75, "", "Demo Debates"],
  ["untKritik01", "Kritik lecture from UNT", "2025-04-05", "UNT Debate", 60, "", "Kritiks"],
  ["sdLecture01", "Welcome to our live show!", "2026-03-01", "SuperDebate", 300, "", "Documentaries & Culture"],
  ["plainDemo01", "Plain demo round", "2025-01-01", "Coach", 10, "", "Demo Debates"],
] as unknown as VideoTuple[];

const rows: VideoRow[] = buildVideoRows({ rounds: [{ data: rounds }], lectures: { data: lectures }, topPicks: { data: [] } });
const idsOf = (list: VideoRow[]) => list.map((row) => row.videoId).sort();

describe("Open Public membership", () => {
  it("names the route and category", () => {
    expect(OPEN_PUBLIC_CATEGORY_KEY).toBe("open_public");
    expect(normalizeCategoryKey(OPEN_PUBLIC_CATEGORY_LABEL)).toBe(OPEN_PUBLIC_CATEGORY_KEY);
    expect(SUPER_DEBATE_CATEGORY_KEY).toBe(normalizeCategoryKey(OPEN_SUPER_DEBATES_CATEGORY));
    expect(isOpenPublicKey("Open_Public")).toBe(true);
    expect(isOpenPublicKey("demo_debates")).toBe(false);
  });

  it("matches UNT as whole words, in the channel or the title", () => {
    expect(namesUnt("UNT Debate", "anything")).toBe(true);
    expect(namesUnt("Coach", "Policy Demo at UNT, finals")).toBe(true);
    expect(namesUnt("Coach", "University of North Texas Parli")).toBe(true);
    expect(namesUnt("Coach", "Demo debate at the hunt for unity")).toBe(false);
    expect(namesUnt("Coach", "Emory vs North Texas PP")).toBe(false);
    expect(namesUnt(null, null)).toBe(false);
  });

  it("holds the Super Debate videos and the UNT demos, nothing else", () => {
    expect(idsOf(filterVideoRows(rows, { categoryKey: "open_public" }))).toEqual([
      "sdLecture01",
      "sdRound0001",
      "untDemoCh01",
      "untDemoLong",
      "untDemoTi01",
    ]);
  });

  it("does not take a UNT lecture outside Demo Debates, or a UNT round", () => {
    const kritik = rows.find((row) => row.videoId === "untKritik01")!;
    expect(isUntDemoRow(kritik)).toBe(false);
    expect(isOpenPublicRow(kritik)).toBe(false);
  });
});

describe("Open Public leaves its source categories alone", () => {
  it("keeps the UNT demos in Demo Debates", () => {
    expect(idsOf(filterVideoRows(rows, { categoryKey: "demo_debates" }))).toEqual([
      "huntDemo001",
      "northTexasPP",
      "plainDemo01",
      "untDemoCh01",
      "untDemoLong",
      "untDemoTi01",
    ]);
  });

  it("keeps the Super Debate videos in Open Super Debates", () => {
    expect(idsOf(filterVideoRows(rows, { categoryKey: "open_super_debates" }))).toEqual(["sdLecture01", "sdRound0001"]);
  });

  it("adds an Open Public card counting both sources", () => {
    const cards = computeLectureCategories(rows);
    expect(cards.find((card) => card.key === "open_public")).toEqual({
      key: "open_public",
      label: "Open Public",
      count: 5,
      maxViews: 640,
    });
    expect(cards.find((card) => card.key === "demo_debates")?.count).toBe(6);
    expect(cards.find((card) => card.key === "open_super_debates")?.count).toBe(2);
  });

  it("shows no Open Public card when neither source has a video", () => {
    const plain = rows.filter((row) => row.videoId === "plainDemo01" || row.videoId === "pfRound0001");
    expect(computeLectureCategories(plain).some((card) => card.key === "open_public")).toBe(false);
  });
});
