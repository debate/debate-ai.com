/**
 * @fileoverview Pins stacked playlists in the results: the collapsing rule
 * that turns a page of videos into the slots rendered, and the `<` / `>`
 * control the two layouts put on a stacked slot.
 *
 * The rule matters more than it looks. A stack's members can both be in the
 * loaded page (a round and its analysis, when nothing filters the analysis
 * out) or only one of them can be, and either way the results must show the
 * group exactly once, in the place the feed put the first member — otherwise
 * folding two rows together either loses a video or silently reorders the
 * grid.
 */

import { describe, it, expect, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import type { VideoType } from "../src/types/videos";
import { buildVideoSlots, collectStackKeys, stackKeyOf } from "../src/components/video-grid/video-stacks";

vi.mock("next/navigation", () => ({
  useParams: () => ({}),
  usePathname: () => "/videos",
}));

const { VideoListRows } = await import("../src/components/video-grid/VideoListRows");

/** Builds a video tuple carrying a stack key at index 18. */
function video(id: string, title: string, stackKey?: string, position = 0): VideoType {
  return [
    id, title, "2026-02-14", "d3v", 100, "", 4, "NDT", "Finals", "Aff Team", "Neg Team",
    true, "3-0", null, null, false, null, 2026,
    stackKey ?? null,
    stackKey ? position : null,
  ] as VideoType;
}

const round = video("T77G1CdZx9E", "NDT 2026 Finals", "T77G1CdZx9E", 0);
const analysis = video("DfG4qeHIU9M", "NDT 2026 Finals — Round Analysis", "T77G1CdZx9E", 1);
const standalone = video("zoKowWVQ1wE", "2015 NDT Finals");
const stacks = { T77G1CdZx9E: [round, analysis] };

describe("stack keys", () => {
  it("reads the key off the tuple and collects each one once", () => {
    expect(stackKeyOf(round)).toBe("T77G1CdZx9E");
    expect(stackKeyOf(standalone)).toBeNull();
    expect(collectStackKeys([round, analysis, standalone])).toEqual(["T77G1CdZx9E"]);
  });
});

describe("buildVideoSlots", () => {
  it("folds both members into the slot the first of them occupies", () => {
    const slots = buildVideoSlots([standalone, round, analysis], stacks);

    expect(slots).toHaveLength(2);
    expect(slots[0].videos.map((v) => v[0])).toEqual(["zoKowWVQ1wE"]);
    expect(slots[1].videos.map((v) => v[0])).toEqual(["T77G1CdZx9E", "DfG4qeHIU9M"]);
  });

  it("opens on the member the feed returned", () => {
    // A lecture category lists the analysis and not the round: the slot still
    // holds both, but it opens on the video the user searched their way to.
    const slots = buildVideoSlots([analysis], stacks);

    expect(slots[0].videos).toHaveLength(2);
    expect(slots[0].initialIndex).toBe(1);
  });

  it("leaves a video alone while its stack is still loading", () => {
    const slots = buildVideoSlots([round, analysis], null);

    expect(slots.map((slot) => slot.videos.map((v) => v[0]))).toEqual([
      ["T77G1CdZx9E"],
      ["DfG4qeHIU9M"],
    ]);
  });

  it("gives every video its own slot when stacking is switched off", () => {
    const slots = buildVideoSlots([round, analysis], stacks, false);

    expect(slots).toHaveLength(2);
    expect(slots.every((slot) => slot.videos.length === 1)).toBe(true);
  });
});

describe("the row list", () => {
  const props = {
    videoContainerRef: { current: null },
    favorites: new Set<string>(),
    onToggleFavorite: () => {},
    onHideVideo: () => {},
    onUnhideVideo: () => {},
    hiddenVideos: new Set<string>(),
  };

  it("renders a stack as one row with a flip control", () => {
    const markup = renderToStaticMarkup(
      createElement(VideoListRows, { ...props, videos: [round, analysis], stacks }),
    );

    expect(markup.match(/Next video in this stacked playlist/g)).toHaveLength(1);
    expect(markup).toContain("1/2");
    // The round is what the row shows; the analysis is behind the arrows. The
    // row layout identifies a round by its tournament and teams rather than
    // its title, so the video ids in the links are what says which is which.
    expect(markup).toContain("T77G1CdZx9E");
    expect(markup).not.toContain("DfG4qeHIU9M");
  });

  it("renders both videos as their own rows once stacking is off", () => {
    const markup = renderToStaticMarkup(
      createElement(VideoListRows, {
        ...props,
        videos: [round, analysis],
        stacks,
        stacksEnabled: false,
      }),
    );

    expect(markup).not.toContain("stacked playlist");
    expect(markup).toContain("T77G1CdZx9E");
    expect(markup).toContain("DfG4qeHIU9M");
  });
});
