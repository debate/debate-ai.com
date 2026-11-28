// @vitest-environment jsdom
/**
 * @fileoverview The winning team's gold border and the judges' decision stay
 * hidden on a video card until "Reveal decision" is clicked, and revealing
 * one video doesn't reveal another.
 */

import { act } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mount, type Mounted } from "./helpers/mount";
import { VideoCard } from "../src/components/videos/card/VideoCard";
import { resetRevealedDecisions, revealDecision } from "../src/hooks/useDecisionReveal";
import { resetRoundJudges } from "../src/hooks/useRoundJudges";
import { judgeVotes } from "../src/components/videos/watch/JudgeVotes";
import type { VideoType } from "../src/types/videos";

let view: Mounted | null = null;

afterEach(async () => {
  await view?.unmount();
  view = null;
  resetRevealedDecisions();
  resetRoundJudges();
  vi.unstubAllGlobals();
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
  [...root.querySelectorAll("span, a")].filter((el) => el.className.includes("rgba(251,191,36")).length;

describe("video card decision reveal", () => {
  it("hides the winner's gold border and the decision until revealed", async () => {
    const root = await mountCard(round("vid-a"));
    expect(goldBorders(root)).toBe(0);
    expect(root.textContent).not.toContain("Aff  3-0");

    const button = [...root.querySelectorAll("button")].find((b) => b.textContent?.includes("Reveal decision"));
    expect(button).toBeTruthy();
    await act(async () => button!.click());

    expect(goldBorders(root)).toBe(1);
    expect(root.textContent).toContain("Aff  3-0");
    expect(root.textContent).not.toContain("Reveal decision");
  });

  it("offers the reveal for a win/loss with no decision text", async () => {
    const wlOnly = [
      "vid-wl", "NDT Finals", "2025-03-30", "Channel", 100, "", 1, "NDT", "Finals", "Harker LL", "Damien AS", false, null,
    ] as unknown as VideoType;
    const root = await mountCard(wlOnly);
    expect(goldBorders(root)).toBe(0);
    expect(root.textContent).not.toContain("Neg");

    const button = [...root.querySelectorAll("button")].find((b) => b.textContent?.includes("Reveal decision"));
    expect(button).toBeTruthy();
    await act(async () => button!.click());

    expect(goldBorders(root)).toBe(1);
    expect(root.textContent).toContain("Neg");
  });

  it("follows a reveal made elsewhere (the watch page) for the same video only", async () => {
    const root = await mountCard(round("vid-b"));
    await act(async () => revealDecision("vid-other"));
    expect(goldBorders(root)).toBe(0);
    await act(async () => revealDecision("vid-b"));
    expect(goldBorders(root)).toBe(1);
  });
});

describe("revealed judges", () => {
  it("fetches the judges only on reveal and colors each by their vote", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).startsWith("/api/videos/judges")
        ? new Response(JSON.stringify({ judges: "Ann Aff, Bo Neg, Cy Aff", squirrels: "Bo Neg" }), { status: 200 })
        : new Response("{}", { status: 200 }),
    );
    const judgeCalls = () => fetchMock.mock.calls.filter(([url]) => String(url).startsWith("/api/videos/judges"));
    vi.stubGlobal("fetch", fetchMock);
    const root = await mountCard(round("vid-j"));
    expect(judgeCalls()).toEqual([]);

    const button = [...root.querySelectorAll("button")].find((b) => b.textContent?.includes("Reveal decision"));
    await act(async () => button!.click());
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(judgeCalls()).toEqual([["/api/videos/judges?id=vid-j"]]);
    const votes = root.querySelector('[data-testid="judge-votes"]')!;
    expect(votes.textContent).toBe("Judges: Ann Aff, Bo Neg*, Cy Aff");
    expect([...votes.querySelectorAll("[data-side]")].map((el) => el.getAttribute("data-side"))).toEqual(["aff", "neg", "aff"]);
  });
});

describe("judgeVotes", () => {
  it("reads stars or a squirrels list, and leaves sides unknown without a winner", () => {
    expect(judgeVotes("A, B*, C", null, false)).toEqual([
      { name: "A", squirreled: false, side: "neg" },
      { name: "B", squirreled: true, side: "aff" },
      { name: "C", squirreled: false, side: "neg" },
    ]);
    expect(judgeVotes("A, B", "b", true).map((v) => v.side)).toEqual(["aff", "neg"]);
    expect(judgeVotes("A", "", null)).toEqual([{ name: "A", squirreled: false, side: null }]);
    expect(judgeVotes(null, null, true)).toEqual([]);
  });
});
