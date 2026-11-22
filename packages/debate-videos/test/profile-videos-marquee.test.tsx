// @vitest-environment jsdom
/**
 * @fileoverview A school page's videos marquee shows each round as the
 * Videos page's card: both teams, the round, the year and what each side ran, not just the
 * upload's title.
 */

import { afterEach, describe, expect, it } from "vitest";
import { mount, type Mounted } from "./helpers/mount";
import { ProfileVideosMarqueeRow } from "../src/panels/ProfileVideosMarquee";
import type { VideoType } from "../src/types/videos";

let view: Mounted | null = null;
afterEach(async () => {
  await view?.unmount();
  view = null;
});

const round = (id: string): VideoType =>
  [id, "upload title", "2025-03-30", "Channel", 100, "", 1, "NDT", "Finals", "Harker LL", "Damien AS", true, "3-0 Aff", "Space", "Cap K"] as unknown as VideoType;

describe("ProfileVideosMarqueeRow", () => {
  it("renders the formatted round cards, twice for the loop, the copy inert", async () => {
    view = await mount(<ProfileVideosMarqueeRow videos={[round("a1"), round("b2")]} label="Harker" />);
    const lists = view.container.querySelectorAll("ul");
    expect(lists).toHaveLength(2);
    expect(lists[1].hasAttribute("inert")).toBe(true);
    const first = lists[0].textContent ?? "";
    expect(first).toContain("Harker");
    expect(first).toContain("Damien");
    // The year as the card shows it, and what each side ran.
    expect(first).toContain("'25");
    expect(first).toContain("Space");
    expect(first).toContain("Cap K");
  });

  it("renders nothing without videos", async () => {
    view = await mount(<ProfileVideosMarqueeRow videos={[]} label="Harker" />);
    expect(view.container.querySelector("[data-profile-videos-marquee]")).toBeNull();
  });
});
