/**
 * @fileoverview Demo debates: lectures in the "Demo Debates" category that
 * take the round watch page once they know their format.
 *
 * The format is the admin's pick (`videos.demo_style`) or, failing that, a
 * guess from the title. It has to travel through the tuple, the client index,
 * the in-memory query (style filter, facets) and the list grouping, and it
 * has to switch on the round page's speech list.
 */

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  asDebateStyle,
  DEMO_STYLE_TUPLE_SLOT,
  demoStyleGroupLabel,
  demoStyleOfTuple,
  guessDemoStyle,
  isDemoCategory,
  isDemoTuple,
  resolveDemoStyle,
} from "../src/data/demo-style";
import { tupleToVideoRow, videoRowToTuple, type VideoRow } from "../src/data/video-rows";
import { VIDEO_INDEX_FORMAT_VERSION, VIDEO_INDEX_SOURCE_SLOT } from "../src/data/video-index";
import { computeVideoFacets, filterVideoRows } from "../src/data/video-query";
import { resolveRoundSpeeches } from "../src/lib/round-formats";
import { FormatBadge, videoFormat } from "../src/components/videos/grid/FormatBadge";
import { videoCategoryLabel } from "../src/components/videos/grid/video-tree";
import type { VideoType } from "../src/types/videos";

/** A lecture tuple; `demoStyle` fills slot 21 when given. */
function lecture(title: string, category: string | number, demoStyle?: number | null): VideoType {
  const tuple: unknown[] = [
    `id-${title}`,
    title,
    "2025-10-02",
    "Channel",
    10,
    "",
    category,
    null,
    null,
    null,
    null,
    false,
    null,
    null,
    null,
    false,
    null,
    2026,
    null,
    null,
    null,
    demoStyle ?? null,
  ];
  return tuple as unknown as VideoType;
}

function demoRow(title: string, demoStyle?: number | null): VideoRow {
  return tupleToVideoRow(lecture(title, "Demo Debates", demoStyle), "lecture")!;
}

describe("guessDemoStyle", () => {
  it.each([
    ["PF demo: Cross-ex basics", 2],
    ["Public Forum demo round", 2],
    ["Policy demo - 1AC to 2AR", 1],
    ["CX demonstration", 1],
    ["LD demo (value debate)", 3],
    ["Lincoln Douglas demo", 3],
    ["NDT demo semifinal", 4],
    ["College policy demo", 4],
    ["Parli demo with POIs", 8],
    ["WSD demo", 5],
    ["Student Congress demo", 9],
  ])("reads %s as style %s", (title, style) => {
    expect(guessDemoStyle(title)).toBe(style);
  });

  it("matches whole words, not fragments", () => {
    expect(guessDemoStyle("Pfeiffer on topicality")).toBeNull();
    expect(guessDemoStyle("Old demo round")).toBeNull();
    expect(guessDemoStyle("A demo")).toBeNull();
    expect(guessDemoStyle("")).toBeNull();
    expect(guessDemoStyle(null)).toBeNull();
  });
});

describe("resolveDemoStyle", () => {
  it("prefers the admin's pick over the title's guess", () => {
    expect(resolveDemoStyle({ category: "Demo Debates", title: "PF demo", demoStyle: 3 })).toBe(3);
  });

  it("falls back to the guess, and to nothing when the title is silent", () => {
    expect(resolveDemoStyle({ category: "Demo Debates", title: "PF demo" })).toBe(2);
    expect(resolveDemoStyle({ category: "Demo Debates", title: "Mystery" })).toBeNull();
  });

  it("ignores unknown stored values", () => {
    expect(asDebateStyle(99)).toBeNull();
    expect(asDebateStyle("2")).toBeNull();
    expect(resolveDemoStyle({ category: "Demo Debates", title: "Mystery", demoStyle: 99 })).toBeNull();
  });

  it("leaves rounds and other lectures alone", () => {
    expect(resolveDemoStyle({ style: 2, category: null, title: "PF demo" })).toBeNull();
    expect(resolveDemoStyle({ category: "Theory", title: "PF demo", demoStyle: 2 })).toBeNull();
  });

  it("accepts the category as a label or a slug", () => {
    expect(isDemoCategory("Demo Debates")).toBe(true);
    expect(isDemoCategory("demo_debates")).toBe(true);
    expect(isDemoCategory("Theory")).toBe(false);
    expect(isDemoCategory(null)).toBe(false);
  });

  it("names the group a demo shelves under", () => {
    expect(demoStyleGroupLabel(2)).toBe("PF demos");
    expect(demoStyleGroupLabel(1)).toBe("Policy demos");
  });
});

describe("demo tuples", () => {
  it("resolves the format from the tuple's slot, then the title", () => {
    expect(demoStyleOfTuple(lecture("Mystery", "Demo Debates", 3))).toBe(3);
    expect(demoStyleOfTuple(lecture("PF demo", "Demo Debates"))).toBe(2);
    expect(demoStyleOfTuple(lecture("PF demo", "Theory"))).toBeNull();
    expect(demoStyleOfTuple(lecture("PF demo", 2))).toBeNull();
    expect(isDemoTuple(lecture("x", "Demo Debates"))).toBe(true);
    expect(isDemoTuple(lecture("x", 1))).toBe(false);
  });

  it("round-trips the resolved format through a row", () => {
    expect(demoRow("Mystery", 3).demoStyle).toBe(3);
    expect(demoRow("PF demo").demoStyle).toBe(2);
    const tuple = videoRowToTuple(demoRow("Mystery", 3));
    expect(tuple[DEMO_STYLE_TUPLE_SLOT]).toBe(3);
    expect(tupleToVideoRow(tuple, "lecture")?.demoStyle).toBe(3);
  });

  it("sends no format for a round or an ordinary lecture", () => {
    const other = tupleToVideoRow(lecture("PF demo", "Theory", 2), "lecture")!;
    expect(other.demoStyle).toBeNull();
    expect(videoRowToTuple(other)[DEMO_STYLE_TUPLE_SLOT]).toBeFalsy();
  });

  it("keeps the client index's source slot after the demo slot", () => {
    expect(VIDEO_INDEX_SOURCE_SLOT).toBeGreaterThan(DEMO_STYLE_TUPLE_SLOT);
    expect(VIDEO_INDEX_FORMAT_VERSION).toBeGreaterThanOrEqual(3);
  });
});

describe("demo style in the in-memory query", () => {
  const rows = [
    demoRow("PF demo one"),
    demoRow("PF demo two", 2),
    demoRow("Policy demo", 1),
    demoRow("Mystery demo"),
    tupleToVideoRow(lecture("PF theory talk", "Theory"), "lecture")!,
  ];
  const ids = (list: VideoRow[]) => list.map((r) => r.title).sort();

  it("filters the demo category by format", () => {
    expect(ids(filterVideoRows(rows, { categoryKey: "demo_debates", style: 2 }))).toEqual([
      "PF demo one",
      "PF demo two",
    ]);
    expect(ids(filterVideoRows(rows, { categoryKey: "demo_debates", styles: [1, 2] }))).toHaveLength(3);
  });

  it("does not read a style into other lectures", () => {
    expect(filterVideoRows(rows, { categoryKey: "theory", style: 2 })).toEqual([]);
  });

  it("counts the demo category's formats", () => {
    const facets = computeVideoFacets(rows, { categoryKey: "demo_debates" });
    expect(facets.styleCounts).toEqual({ 1: 1, 2: 2 });
    expect(computeVideoFacets(rows, { categoryKey: "demo_debates", style: 2 }).yearCounts["2026"]).toBe(2);
  });
});

describe("demo style in the UI helpers", () => {
  it("labels a demo like a round and files it under its format", () => {
    const pf = lecture("PF demo", "Demo Debates");
    expect(videoFormat(pf)).toBe(2);
    expect(videoFormat(lecture("Mystery", "Demo Debates"))).toBeUndefined();
    expect(videoCategoryLabel(pf)).toBe("PF demos");
    expect(videoCategoryLabel(lecture("Mystery", "Demo Debates"))).toBe("Demo Debates");
    expect(renderToStaticMarkup(<FormatBadge style={videoFormat(pf)} />)).toContain("PF");
  });
});

describe("round speeches for a demo", () => {
  it("has a standard speech order only once a numeric format is known", () => {
    expect(resolveRoundSpeeches([], "Demo Debates")).toEqual([]);
    expect(resolveRoundSpeeches([], demoStyleOfTuple(lecture("PF demo", "Demo Debates")))).not.toHaveLength(0);
  });
});
