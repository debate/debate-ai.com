/**
 * @fileoverview Builds YouTube embed URLs for the in-app players.
 *
 * With `enablejsapi=1` YouTube verifies who is embedding the player and
 * answers "Video player configuration error" (error 153) when it cannot tell.
 * The document Picture-in-Picture window is the common way to hit that: moving
 * the iframe into the PiP document reloads it from an `about:blank` document,
 * and a frame inside `about:blank` sends no Referer at all, which `origin`
 * alone does not make up for. So inside PiP the players load the site's own
 * `/youtube-player` route (`pipEmbedUrl`), whose real https address is the
 * referrer YouTube sees; the wrapper relays the JS API messages both ways.
 *
 * The browser extension's bundled app runs on a `chrome-extension://` page,
 * which YouTube won't accept as an embedder either, so there every player
 * loads the hosted site's `/youtube-player` route (`playerRouteUrl`).
 */

/** Path of the app route that hosts the YouTube iframe (apps/debate-web/app/youtube-player). */
export const PLAYER_ROUTE = "/youtube-player"

/** The hosted site that serves `PLAYER_ROUTE` to the extension's pages. */
export const HOSTED_SITE_ORIGIN = "https://debate-ai.com"

/** Whether this page is the browser extension's (Chrome or Firefox). */
export function isExtensionPage(): boolean {
  if (typeof window === "undefined") return false
  return /^(chrome|moz)-extension:\/\//.test(window.location.origin)
}

/** Human-readable messages for the error codes the IFrame API reports. */
const PLAYER_ERROR_MESSAGES: Record<number, string> = {
  2: "This video link is invalid.",
  5: "This video can't be played in the current browser.",
  100: "This video is private or has been removed.",
  101: "The owner doesn't allow this video to be played outside YouTube.",
  150: "The owner doesn't allow this video to be played outside YouTube.",
  153: "YouTube blocked this embed. Reload the page or watch it on YouTube.",
}

/** Describe a YouTube IFrame API error code for display. */
export function describePlayerError(code: number): string {
  return PLAYER_ERROR_MESSAGES[code] ?? `The video player reported error ${code}.`
}

/** The page origin YouTube should attribute the embed to, when in a browser. */
export function embedOrigin(): string | null {
  if (typeof window === "undefined") return null
  const { origin } = window.location
  // A document PiP / sandboxed document can report "null" — unusable as an origin.
  return origin && origin !== "null" ? origin : null
}

interface EmbedOptions {
  /** Start playback automatically. */
  autoplay?: boolean
  /** Show the native player controls. */
  controls?: boolean
  /** Seconds to start playback from. */
  startSeconds?: number
  /** Explicit origin to use (e.g. when iframe is in a PiP window). */
  origin?: string
}

/** Build the embed URL for `videoId`, always enabling the JS API. */
export function buildEmbedUrl(videoId: string, options: EmbedOptions = {}): string {
  const { autoplay = false, controls = true, startSeconds = 0, origin } = options

  const params = new URLSearchParams({
    enablejsapi: "1",
    rel: "0",
    controls: controls ? "1" : "0",
  })
  if (autoplay) params.set("autoplay", "1")
  if (startSeconds > 0) params.set("start", String(Math.floor(startSeconds)))

  const effectiveOrigin = origin ?? embedOrigin()
  if (effectiveOrigin) {
    params.set("origin", effectiveOrigin)
    params.set("widget_referrer", effectiveOrigin)
  }

  // An extension page can't embed YouTube itself; the hosted route can.
  if (isExtensionPage()) {
    return playerRouteUrl(HOSTED_SITE_ORIGIN, videoId, { autoplay, controls, startSeconds })
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * URL of the `/youtube-player` route on `site` for `videoId`. The route hosts
 * the YouTube iframe on that site's own https page and names itself as the
 * embed's origin, so YouTube sees a real referrer.
 */
export function playerRouteUrl(
  site: string,
  videoId: string,
  options: Omit<EmbedOptions, "origin"> = {},
): string {
  const { autoplay = false, controls = true, startSeconds = 0 } = options
  const params = new URLSearchParams({ vid: videoId })
  if (autoplay) params.set("autoplay", "1")
  if (!controls) params.set("controls", "0")
  if (startSeconds > 0) params.set("start", String(Math.floor(startSeconds)))
  return `${site}${PLAYER_ROUTE}?${params.toString()}`
}

/**
 * Embed URL for a player inside the document PiP window: the same-origin
 * `/youtube-player` route, which hosts the YouTube iframe itself so the embed
 * request carries this site as its referrer. From the extension, whose pages
 * have no such route, it is the hosted site's.
 */
export function pipEmbedUrl(videoId: string, options: Omit<EmbedOptions, "controls"> = {}): string {
  const { autoplay = false, startSeconds = 0 } = options
  const origin = options.origin ?? embedOrigin()
  const site = !origin || isExtensionPage() ? HOSTED_SITE_ORIGIN : origin
  return playerRouteUrl(site, videoId, { autoplay, startSeconds })
}

/** The origin an embed's messages come from and commands go to: its `src`'s. */
export function playerOrigin(iframe: HTMLIFrameElement | null | undefined): string {
  try {
    if (iframe?.src) return new URL(iframe.src).origin
  } catch {}
  return "https://www.youtube.com"
}

/**
 * Whether the embed's document has left `about:blank` for `target`, so a
 * message posted to `target` can be delivered.
 *
 * Posting before then doesn't throw: Chrome logs "Failed to execute
 * 'postMessage' on 'DOMWindow': The target origin provided does not match the
 * recipient window's origin" and drops it, once per try of the handshake
 * retry loop. Reading the frame's location succeeds only while it is
 * same-origin with this page (still `about:blank`, or the same-origin
 * `/youtube-player` wrapper); once it throws, the cross-origin player has loaded.
 */
export function embedReady(iframe: HTMLIFrameElement, target: string = playerOrigin(iframe)): boolean {
  const win = iframe.contentWindow
  if (!win) return false
  try {
    const href = win.location.href
    return href !== "about:blank" && new URL(href).origin === target
  } catch {
    return true
  }
}

/**
 * Whether `event` is a player message from `iframe`: straight from YouTube,
 * or relayed by the `/youtube-player` wrapper the iframe has loaded.
 */
export function isPlayerMessage(event: MessageEvent, iframe: HTMLIFrameElement | null | undefined): boolean {
  if (event.origin === "https://www.youtube.com") return true
  return Boolean(iframe?.contentWindow) && event.source === iframe?.contentWindow && event.origin === playerOrigin(iframe)
}

/** Watch URL used by the "watch on YouTube" fallbacks. */
export function watchUrl(videoId: string, startSeconds = 0): string {
  const start = startSeconds > 0 ? `&t=${Math.floor(startSeconds)}` : ""
  return `https://www.youtube.com/watch?v=${videoId}${start}`
}

/**
 * Ask an embed to start posting player events to this window.
 *
 * YouTube only sends `onStateChange` / `onError` messages to a parent that has
 * completed this handshake, so without it an embed that fails renders its own
 * error screen and the app never learns about it.
 */
export function startListening(iframe: HTMLIFrameElement | null) {
  if (!iframe?.contentWindow) return
  const target = playerOrigin(iframe)
  if (!embedReady(iframe, target)) return
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "listening", id: iframe.id || "debate-video-player", channel: "widget" }),
      target,
    )
  } catch {}
}
