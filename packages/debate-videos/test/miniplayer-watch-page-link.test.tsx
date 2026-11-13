import { describe, expect, it } from "vitest"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { watchPageHref } from "../src/state/videoPlayerStore"
import { PlayerControls } from "../src/components/videos/player/PlayerControls"

const noop = () => {}

function controls(watchHref?: string) {
  return renderToStaticMarkup(
    createElement(PlayerControls, {
      isPlaying: true,
      isMinimized: false,
      queue: [],
      isPipSupported: false,
      isPipActive: false,
      isSubtitlesOpen: false,
      showSubtitles: false,
      watchHref,
      onPlayPause: noop,
      onPlayNext: noop,
      onToggleMinimize: noop,
      onTogglePip: noop,
      onToggleSubtitles: noop,
      onClose: noop,
    }),
  )
}

describe("miniplayer back-to-video-page link", () => {
  it("returns to the watch page the video was last on", () => {
    const page = { videoId: "OXdffJy8HIs", path: "/videos/21-22/cpd/ndt/finals/a-vs-b/2ar" }
    expect(watchPageHref("OXdffJy8HIs", page)).toBe(page.path)
  })

  it("falls back to the id address, which redirects to the canonical page", () => {
    expect(watchPageHref("OXdffJy8HIs", null)).toBe("/videos/watch/OXdffJy8HIs")
    expect(watchPageHref("OXdffJy8HIs", { videoId: "other123456", path: "/videos/x" })).toBe(
      "/videos/watch/OXdffJy8HIs",
    )
  })

  it("shows the link in the toolbar only when there is a page to go to", () => {
    expect(controls("/videos/watch/OXdffJy8HIs")).toMatch(
      /<a[^>]*aria-label="Go to video page"[^>]*href="\/videos\/watch\/OXdffJy8HIs"/,
    )
    expect(controls()).not.toContain("Go to video page")
  })
})
