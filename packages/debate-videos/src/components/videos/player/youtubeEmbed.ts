/**
 * @fileoverview Builds YouTube embed URLs for the in-app players.
 *
 * With `enablejsapi=1` YouTube verifies who is embedding the player and
 * answers "Video player configuration error" (error 153) when it cannot tell.
 * The document Picture-in-Picture window is the common way to hit that: moving
 * the iframe into the PiP document reloads it from an `about:blank` document,
 * and a frame inside `about:blank` sends no Referer at all, which `origin`
 * alone does not make up for. So inside PiP the players load the site's own
 * `/youtube-player.html` wrapper (`pipEmbedUrl`), whose real https address is
 * the referrer YouTube sees; the wrapper relays the JS API messages both ways.
 */

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

  // If running in extension context, prefer using hosted wrapper to ensure proper referrer
  if (typeof window !== "undefined" && window.location.origin.startsWith("chrome-extension://")) {
    const extParams = new URLSearchParams(params)
    return `https://debate-ai.com/youtube-player?vid=${videoId}&${extParams.toString()}`
  }

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`
}

/**
 * Embed URL for a player inside the document PiP window: the same-origin
 * wrapper page, which hosts the YouTube iframe itself so the embed request
 * carries this site as its referrer.
 */
export function pipEmbedUrl(videoId: string, options: Omit<EmbedOptions, "controls"> = {}): string {
  const { autoplay = false, startSeconds = 0 } = options
  const origin = options.origin ?? embedOrigin() ?? ""
  const params = new URLSearchParams({ vid: videoId })
  if (autoplay) params.set("autoplay", "1")
  if (startSeconds > 0) params.set("start", String(Math.floor(startSeconds)))
  if (origin) params.set("origin", origin)
  return `${origin}/youtube-player.html?${params.toString()}`
}

/** The origin an embed's messages come from and commands go to: its `src`'s. */
export function playerOrigin(iframe: HTMLIFrameElement | null | undefined): string {
  try {
    if (iframe?.src) return new URL(iframe.src).origin
  } catch {}
  return "https://www.youtube.com"
}

/**
 * Whether `event` is a player message from `iframe`: straight from YouTube,
 * or relayed by the `/youtube-player.html` wrapper the iframe has loaded.
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
  try {
    iframe.contentWindow.postMessage(
      JSON.stringify({ event: "listening", id: iframe.id || "debate-video-player", channel: "widget" }),
      target,
    )
  } catch {}
}
