/**
 * @fileoverview The link rules behind the frame → shell navigation handoff.
 *
 * These decide, for every anchor clicked inside a framed page, whether the
 * shell is asked to route (so the sidebar around the link stays mounted) or
 * the browser is left alone. Getting either side wrong is visible: too eager
 * and a new-tab click is swallowed, too shy and the tab reloads to follow a
 * sidebar link.
 */

import { describe, it, expect } from "vitest"

import { dockNavRootFor } from "../../nav/dock-nav-paths"
import {
  FRAME_NAV_ACK,
  FRAME_NAV_REQUEST,
  isFrameNavAck,
  isFrameNavRequest,
  opensElsewhere,
  topNavigationTarget,
} from "../frame-navigation"

const ORIGIN = "https://debate-ai.com"

/** The frame this document is running in, for every case but the one that
 *  says otherwise: the dock's Videos destination. */
const IN_VIDEOS_FRAME = "/videos"

const plainClick = {
  metaKey: false,
  ctrlKey: false,
  shiftKey: false,
  altKey: false,
  button: 0,
}

/** As the DOM reports it: `href` on an anchor resolves against the document. */
function anchor(path: string, extra: { target?: string; download?: boolean } = {}) {
  return { href: new URL(path, ORIGIN).href, ...extra }
}

describe("opensElsewhere", () => {
  it("leaves a plain primary click to be intercepted", () => {
    expect(opensElsewhere(plainClick)).toBe(false)
  })

  it("hands every modified click and middle-click back to the browser", () => {
    expect(opensElsewhere({ ...plainClick, metaKey: true })).toBe(true)
    expect(opensElsewhere({ ...plainClick, ctrlKey: true })).toBe(true)
    expect(opensElsewhere({ ...plainClick, shiftKey: true })).toBe(true)
    expect(opensElsewhere({ ...plainClick, altKey: true })).toBe(true)
    expect(opensElsewhere({ ...plainClick, button: 1 })).toBe(true)
  })
})

describe("topNavigationTarget", () => {
  it("hands up every tool the sidebar links to", () => {
    // The whole point: these are the rows a framed /videos page's own sidebar
    // renders, and each one used to reload the tab.
    for (const path of [
      "/coach",
      "/coaching-programs",
      "/research",
      "/cards/library",
      "/practice-round",
      "/judges",
      "/annotations",
      "/features",
    ]) {
      expect(topNavigationTarget(anchor(path), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor)).toBe(path)
    }
  })

  it("keeps the query and hash", () => {
    expect(topNavigationTarget(anchor("/rank?year=2026#top"), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor)).toBe(
      "/rank?year=2026#top",
    )
  })

  it("leaves this frame's own subtree to the frame", () => {
    // The destination it is showing, and anything under it: that is the frame
    // navigating within itself, which is what the frame is for.
    expect(
      topNavigationTarget(anchor("/videos"), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor),
    ).toBeNull()
    expect(
      topNavigationTarget(anchor("/videos/lectures"), ORIGIN, "/videos/pf", dockNavRootFor),
    ).toBeNull()
  })

  it("hands up another destination's subtree", () => {
    // Loading `/cards/library` inside the `/videos` frame renders it with no
    // sidebar while the top document's URL still reads `/videos`.
    expect(
      topNavigationTarget(anchor("/cards"), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor),
    ).toBe("/cards")
    expect(
      topNavigationTarget(anchor("/cards/library"), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor),
    ).toBe("/cards/library")
  })

  it("leaves the help docs to a real navigation", () => {
    // `/docs` is the statically exported help site under `public/docs`; the
    // client router has no route for it, so handing it up would route to a
    // 404 instead of loading the page.
    expect(topNavigationTarget(anchor("/docs"), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor)).toBeNull()
    expect(
      topNavigationTarget(anchor("/docs/features/flowing"), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor),
    ).toBeNull()
    expect(topNavigationTarget(anchor("/api/api-docs"), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor)).toBeNull()
  })

  it("leaves another origin, a new tab and a download alone", () => {
    expect(
      topNavigationTarget(anchor("/coach", { target: "_blank" }), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor),
    ).toBeNull()
    expect(
      topNavigationTarget(anchor("/coach", { download: true }), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor),
    ).toBeNull()
    expect(
      topNavigationTarget({ href: "https://www.tabroom.com/" }, ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor),
    ).toBeNull()
    expect(topNavigationTarget({ href: null }, ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor)).toBeNull()
  })

  it("treats an explicit target=_self as a plain in-tab link", () => {
    expect(
      topNavigationTarget(anchor("/drills", { target: "_self" }), ORIGIN, IN_VIDEOS_FRAME, dockNavRootFor),
    ).toBe("/drills")
  })
})

describe("message guards", () => {
  it("accepts only its own well-formed messages", () => {
    expect(isFrameNavRequest({ type: FRAME_NAV_REQUEST, path: "/coach" })).toBe(true)
    expect(isFrameNavAck({ type: FRAME_NAV_ACK, path: "/coach" })).toBe(true)

    // Anything else on the window's message channel — including the video
    // player bridge, which shares it.
    expect(isFrameNavRequest({ type: "debate-video-player-state" })).toBe(false)
    expect(isFrameNavRequest({ type: FRAME_NAV_REQUEST })).toBe(false)
    expect(isFrameNavRequest({ type: FRAME_NAV_REQUEST, path: 12 })).toBe(false)
    expect(isFrameNavRequest(null)).toBe(false)
    expect(isFrameNavRequest("debate-frame-navigate")).toBe(false)
    expect(isFrameNavAck({ type: FRAME_NAV_REQUEST, path: "/coach" })).toBe(false)
  })
})
