// @vitest-environment jsdom
/**
 * @fileoverview The watch page's control strip.
 *
 * The point of the strip is that it is the *same* strip as the floating
 * popout player's — same icons, same accessible names, same conditional
 * controls — so a control never means two different things in the two places
 * a video can be watched. These tests pin the names both toolbars render, so
 * a rename in one surfaces as a failure rather than as drift.
 */

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { PlayerControls } from "../src/components/video-player/PlayerControls";
import { WatchToolbar } from "../src/components/watch/WatchToolbar";
import type { QueueItem } from "../src/state/videoPlayerStore";

const noop = () => {};

/** Accessible names of every control in a rendered toolbar, in order. */
function labels(markup: string): string[] {
  return Array.from(markup.matchAll(/aria-label="([^"]+)"/g)).map((match) => match[1]);
}

function renderWatchToolbar(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(WatchToolbar, {
      isPlaying: false,
      queue: [] as QueueItem[],
      isPipSupported: true,
      isPipActive: false,
      isFullscreen: false,
      isTranscriptOpen: true,
      hasTranscript: true,
      isFavorite: false,
      isInQueue: false,
      isLinkCopied: false,
      canCopyLink: true,
      youtubeUrl: "https://www.youtube.com/watch?v=OXdffJy8HIs",
      onPlayPause: noop,
      onPlayNext: noop,
      onTogglePip: noop,
      onToggleFullscreen: noop,
      onToggleTranscript: noop,
      onToggleFavorite: noop,
      onAddToQueue: noop,
      onCopyLink: noop,
      onPopOut: noop,
      onClose: noop,
      ...overrides,
    } as never),
  );
}

function renderPlayerControls(overrides: Record<string, unknown> = {}) {
  return renderToStaticMarkup(
    createElement(PlayerControls, {
      isPlaying: false,
      isMinimized: false,
      queue: [] as QueueItem[],
      isPipSupported: true,
      isPipActive: false,
      isSubtitlesOpen: false,
      showSubtitles: true,
      onPlayPause: noop,
      onPlayNext: noop,
      onToggleMinimize: noop,
      onTogglePip: noop,
      onToggleSubtitles: noop,
      onClose: noop,
      ...overrides,
    } as never),
  );
}

describe("WatchToolbar", () => {
  it("offers the popout player's controls, under the same names", () => {
    const watch = labels(renderWatchToolbar());
    const popout = labels(renderPlayerControls());

    // Play/pause, picture-in-picture and close mean the same thing in both.
    for (const shared of ["Play video", "Pop out picture-in-picture", "Close video"]) {
      expect(popout).toContain(shared);
      expect(watch).toContain(shared);
    }
    // Only a page can offer these three.
    expect(watch).toContain("Copy link to this video");
    expect(watch).toContain("Watch on YouTube");
    expect(watch).toContain("Fullscreen");
    expect(popout).not.toContain("Fullscreen");
  });

  it("hides the captions control for a video with no transcript", () => {
    expect(labels(renderWatchToolbar())).toContain("Hide transcript");
    expect(labels(renderWatchToolbar({ hasTranscript: false }))).not.toContain("Hide transcript");
  });

  it("shows the queue control, with its length, only when something is queued", () => {
    expect(labels(renderWatchToolbar())).not.toContain("Play next in queue");

    const queued = renderWatchToolbar({
      queue: [
        { videoId: "a", title: "Round 4" },
        { videoId: "b", title: "Round 5" },
      ],
    });
    expect(labels(queued)).toContain("Play next in queue");
    expect(queued).toContain(">2<");
  });

  it("marks the state-carrying controls as pressed when they are on", () => {
    const markup = renderWatchToolbar({ isPipActive: true, isFavorite: true, isFullscreen: true });
    expect(markup).toContain('aria-label="Exit picture-in-picture" aria-pressed="true"');
    expect(markup).toContain('aria-label="Exit fullscreen" aria-pressed="true"');
    expect(markup).toContain('aria-label="Remove from My Favorites" aria-pressed="true"');
  });

  it("drops the permalink control when the browser exposes no clipboard", () => {
    expect(labels(renderWatchToolbar({ canCopyLink: false }))).not.toContain(
      "Copy link to this video",
    );
  });

  it("disables adding to the queue when the video is already in it", () => {
    const markup = renderWatchToolbar({ isInQueue: true });
    const queueButton = markup.match(/<button aria-label="In queue"[^>]*>/)?.[0] ?? "";
    expect(queueButton).toContain("disabled");
  });
});

describe("PlayerControls", () => {
  it("keeps the popout player's own controls", () => {
    const popout = labels(renderPlayerControls());
    expect(popout).toContain("Minimize player");
    expect(popout).toContain("Show subtitles");
    expect(labels(renderPlayerControls({ showSubtitles: false }))).not.toContain("Show subtitles");
    expect(labels(renderPlayerControls({ isPipSupported: false }))).not.toContain(
      "Pop out picture-in-picture",
    );
  });
});
