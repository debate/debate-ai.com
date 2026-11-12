// @vitest-environment jsdom
/**
 * @fileoverview A round's YouTube description can name the winner, so on a
 * video card it stays behind a placeholder until the decision is revealed;
 * clicking the placeholder reveals both. Videos with no decision show their
 * description as before.
 */

import { act } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { mount, type Mounted } from "./helpers/mount";
import { VideoCard } from "../src/components/videos/card/VideoCard";
import { HIDDEN_DESCRIPTION_TEXT } from "../src/components/videos/card/HiddenDescription";
import { resetRevealedDecisions } from "../src/hooks/useDecisionReveal";
import type { VideoType } from "../src/types/videos";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.unmount();
  view = null;
  resetRevealedDecisions();
});

const SPOILER = "Harker LL wins on a 3-0";

const video = (id: string, affWin: boolean | null, decision: string | null): VideoType =>
  [id, "NDT Finals", "2025-03-30", "Channel", 100, SPOILER, 1, "NDT", "Finals", "Harker LL", "Damien AS", affWin, decision] as unknown as VideoType;

const noop = () => {};

async function mountCard(v: VideoType): Promise<HTMLElement> {
  view = await mount(
    <VideoCard
      video={v}
      showThumbnails
      showDescription
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

describe("video card description reveal", () => {
  it("hides the description until the placeholder is clicked, which reveals the decision too", async () => {
    const root = await mountCard(video("desc-a", true, "3-0 Aff"));
    expect(root.textContent).not.toContain(SPOILER);
    expect(root.textContent).toContain(HIDDEN_DESCRIPTION_TEXT);

    const placeholder = [...root.querySelectorAll("button")].find((b) => b.textContent === HIDDEN_DESCRIPTION_TEXT);
    await act(async () => placeholder!.click());

    expect(root.textContent).toContain(SPOILER);
    expect(root.textContent).toContain("Aff won 3-0");
    expect(root.textContent).not.toContain(HIDDEN_DESCRIPTION_TEXT);
  });

  it("shows the description of a video with no decision", async () => {
    const root = await mountCard(video("desc-b", null, null));
    expect(root.textContent).toContain(SPOILER);
    expect(root.textContent).not.toContain(HIDDEN_DESCRIPTION_TEXT);
  });
});
