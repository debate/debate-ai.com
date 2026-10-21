// @vitest-environment jsdom
/**
 * @fileoverview The winning team's gold border and the judges' decision stay
 * hidden on a video card until "Reveal decision" is clicked, and revealing
 * one video doesn't reveal another.
 */

import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type Mounted } from "./helpers/mount";
import { VideoCard } from "../src/components/video-card/VideoCard";
import { resetRevealedDecisions, revealDecision } from "../src/hooks/useDecisionReveal";
import type { VideoType } from "../src/types/videos";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.unmount();
  view = null;
  resetRevealedDecisions();
});

const round = (id: string): VideoType =>
  [id, "NDT Finals", "2025-03-30", "Channel", 100, "", 1, "NDT", "Finals", "Harker LL", "Damien AS", true, "3-0 Aff"] as unknown as VideoType;

const noop = () => {};

async function mountCard(video: VideoType): Promise<HTMLElement> {
  view = await mount(
    <VideoCard
      video={video}
      showThumbnails
      isFavorite={false}
      onToggleFavorite={noop}
      onBadgeClick={noop}
      onHideVideo={noop}
      onUnhideVideo={noop}
      isHidden={false}
      isTopPick={false}
    />,
  );
  return view.container;
}

/** Team badges ringed in the winner's gold glow (the round-level badge is amber too, without it). */
const goldBorders = (root: HTMLElement) =>
  [...root.querySelectorAll("span")].filter((el) => el.className.includes("rgba(251,191,36")).length;

describe("video card decision reveal", () => {
  it("hides the winner's gold border and the decision until revealed", async () => {
    const root = await mountCard(round("vid-a"));
    expect(goldBorders(root)).toBe(0);
    expect(root.textContent).not.toContain("3-0 Aff");

    const button = [...root.querySelectorAll("button")].find((b) => b.textContent?.includes("Reveal decision"));
    expect(button).toBeTruthy();
    await act(async () => button!.click());

    expect(goldBorders(root)).toBe(1);
    expect(root.textContent).toContain("3-0 Aff");
    expect(root.textContent).not.toContain("Reveal decision");
  });

  it("follows a reveal made elsewhere (the watch page) for the same video only", async () => {
    const root = await mountCard(round("vid-b"));
    await act(async () => revealDecision("vid-other"));
    expect(goldBorders(root)).toBe(0);
    await act(async () => revealDecision("vid-b"));
    expect(goldBorders(root)).toBe(1);
  });
});
