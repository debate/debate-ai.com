// @vitest-environment jsdom
/**
 * @fileoverview The mini player window: its address, how it opens in the
 * desktop app versus a browser, the remembered always-on-top choice, and the
 * speech strip's previous/next jumps.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import {
  MINI_PLAYER_ON_TOP_KEY,
  MINI_PLAYER_WINDOW_NAME,
  DESKTOP_BRIDGE_PORT,
  canUseDesktopBridge,
  isDesktopApp,
  openInDesktopApp,
  miniPlayerHref,
  openMiniPlayerWindow,
  parseMiniPlayerStart,
  readMiniPlayerOnTop,
  returnToFullPage,
  setMiniPlayerOnTop,
} from "../src/lib/mini-player-window"
import { adjacentTimedSpeech } from "../src/panels/watch/VideoMiniPlayer"
import type { RoundSpeech } from "../src/lib/round-speeches"

type TauriWindow = Window & { __TAURI__?: unknown }

function installTauri(invoke = vi.fn(async () => undefined)) {
  ;(window as TauriWindow).__TAURI__ = { core: { invoke } }
  return invoke
}

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  delete (window as TauriWindow).__TAURI__
  vi.restoreAllMocks()
})

describe("miniPlayerHref", () => {
  it("addresses the video by id and carries a whole-second start", () => {
    expect(miniPlayerHref("OXdffJy8HIs")).toBe("/videos/mini/OXdffJy8HIs")
    expect(miniPlayerHref("OXdffJy8HIs", 125.8)).toBe("/videos/mini/OXdffJy8HIs?t=125")
  })

  it("round-trips through parseMiniPlayerStart, which ignores junk", () => {
    expect(parseMiniPlayerStart("125")).toBe(125)
    expect(parseMiniPlayerStart(null)).toBe(0)
    expect(parseMiniPlayerStart("-4")).toBe(0)
    expect(parseMiniPlayerStart("1e9")).toBe(0)
  })
})

describe("desktop bridge", () => {
  const desktop = { protocol: "https:", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)", inApp: false }

  it("is tried only from a secure page in a desktop browser outside the app", () => {
    expect(canUseDesktopBridge(desktop)).toBe(true)
    expect(canUseDesktopBridge({ ...desktop, inApp: true })).toBe(false)
    expect(canUseDesktopBridge({ ...desktop, protocol: "http:" })).toBe(false)
    expect(canUseDesktopBridge({ ...desktop, userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0)" })).toBe(false)
    expect(canUseDesktopBridge({ ...desktop, userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile" })).toBe(false)
  })

  it("posts the page's path and the on-top choice to the app on the loopback port", async () => {
    const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    localStorage.setItem(MINI_PLAYER_ON_TOP_KEY, "0")

    await expect(openInDesktopApp("/videos/mini/abc?t=5")).resolves.toBe(true)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(`http://127.0.0.1:${DESKTOP_BRIDGE_PORT}/mini-player`)
    expect(init.method).toBe("POST")
    expect(init.headers).toEqual({ "Content-Type": "text/plain" })
    expect(JSON.parse(init.body as string)).toEqual({ path: "/videos/mini/abc?t=5", alwaysOnTop: false })
    vi.unstubAllGlobals()
  })

  it("reports no app when nothing answers or the app refuses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new TypeError("Failed to fetch"))))
    await expect(openInDesktopApp("/videos/mini/abc")).resolves.toBe(false)
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })))
    await expect(openInDesktopApp("/videos/mini/abc")).resolves.toBe(false)
    vi.unstubAllGlobals()
  })
})

describe("openMiniPlayerWindow", () => {
  it("asks the desktop app for its window, with the remembered on-top choice", async () => {
    const invoke = installTauri()
    localStorage.setItem(MINI_PLAYER_ON_TOP_KEY, "0")

    expect(isDesktopApp()).toBe(true)
    await expect(openMiniPlayerWindow("/videos/mini/abc?t=5")).resolves.toBe(true)
    expect(invoke).toHaveBeenCalledWith("open_mini_player", {
      url: new URL("/videos/mini/abc?t=5", window.location.href).toString(),
      alwaysOnTop: false,
    })
  })

  it("reports a refusal from the desktop app as not opened", async () => {
    installTauri(vi.fn(async () => Promise.reject(new Error("only same-site pages"))))
    await expect(openMiniPlayerWindow("/videos/mini/abc")).resolves.toBe(false)
  })

  it("opens a named popup in a browser, so a second pop-out reuses it", async () => {
    const focus = vi.fn()
    const open = vi.spyOn(window, "open").mockReturnValue({ focus } as unknown as Window)

    expect(isDesktopApp()).toBe(false)
    await expect(openMiniPlayerWindow("/videos/mini/abc")).resolves.toBe(true)
    expect(open).toHaveBeenCalledWith("/videos/mini/abc", MINI_PLAYER_WINDOW_NAME, expect.stringContaining("popup"))
    expect(focus).toHaveBeenCalled()
  })

  it("reports a blocked popup", async () => {
    vi.spyOn(window, "open").mockReturnValue(null)
    await expect(openMiniPlayerWindow("/videos/mini/abc")).resolves.toBe(false)
  })
})

describe("always on top", () => {
  it("defaults to on", () => {
    expect(readMiniPlayerOnTop()).toBe(true)
  })

  it("pins the calling window in the desktop app and remembers the choice", async () => {
    const invoke = installTauri()
    await expect(setMiniPlayerOnTop(false)).resolves.toBe(true)
    expect(invoke).toHaveBeenCalledWith("set_always_on_top", { enabled: false })
    expect(readMiniPlayerOnTop()).toBe(false)
  })

  it("only remembers the choice in a browser, which can't pin a window", async () => {
    await expect(setMiniPlayerOnTop(false)).resolves.toBe(false)
    expect(readMiniPlayerOnTop()).toBe(false)
  })
})

describe("returnToFullPage", () => {
  it("hands the full page to the desktop app's main window", async () => {
    const invoke = installTauri()
    await returnToFullPage("/videos/21-22/ndt/finals/a-vs-b")
    expect(invoke).toHaveBeenCalledWith("restore_from_mini_player", {
      url: new URL("/videos/21-22/ndt/finals/a-vs-b", window.location.href).toString(),
    })
  })

  it("opens a tab in a browser when no opener is left", async () => {
    const open = vi.spyOn(window, "open").mockReturnValue(null)
    await returnToFullPage("/videos/x")
    expect(open).toHaveBeenCalledWith("/videos/x", "_blank", "noopener")
  })
})

describe("adjacentTimedSpeech", () => {
  const speech = (label: string, startSeconds: number | null): RoundSpeech => ({
    key: label,
    label,
    heading: label,
    side: "neutral",
    isSpeech: true,
    startSeconds,
    parts: {},
  })
  const round = [speech("1AC", 60), speech("CX", 600), speech("1NC", null), speech("2AC", 900)]

  it("skips untimed speeches going forward", () => {
    expect(adjacentTimedSpeech(round, 700, 1)?.label).toBe("2AC")
    expect(adjacentTimedSpeech(round, 950, 1)).toBeNull()
  })

  it("restarts the playing speech a few seconds in, and steps back near its start", () => {
    expect(adjacentTimedSpeech(round, 700, -1)?.label).toBe("CX")
    expect(adjacentTimedSpeech(round, 601, -1)?.label).toBe("1AC")
    expect(adjacentTimedSpeech(round, 30, -1)).toBeNull()
  })

  it("has nowhere to go with no timed speeches", () => {
    expect(adjacentTimedSpeech([speech("1AC", null)], 0, 1)).toBeNull()
  })
})
