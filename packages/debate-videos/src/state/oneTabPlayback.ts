/**
 * @fileoverview Only one browser tab plays a video at a time.
 *
 * With several d.ebate.app tabs open, each one mounts its own floating player
 * (restored from the same `localStorage` snapshot) and its own watch page
 * embed. Without coordination every new tab picked up the video and started
 * playing it over the one already going.
 *
 * The rule:
 *
 * - **The tab that is playing keeps playing.** It records itself as the
 *   playing tab in `localStorage` (refreshed every few seconds while it
 *   plays, cleared when it pauses or closes).
 * - **A newly opened tab does not autoplay** while another tab is recorded
 *   as playing — the floating player is restored paused and the watch page
 *   embed loads paused. Once the reader has interacted with the tab
 *   (`navigator.userActivation`), picking a video autoplays as usual.
 * - **Pressing play in a tab pauses every other tab.** The moment a tab's
 *   player starts it announces itself on a `BroadcastChannel`; the others
 *   pause their embed.
 *
 * The desktop app's windows share the same storage and channel, so the
 * pop-out mini player window follows the same rule.
 * @module state/oneTabPlayback
 */

"use client"

import { useEffect, useRef } from "react"

const CHANNEL_NAME = "debate-video-playback"
const OWNER_KEY = "video-playback-owner"
/** How often a playing tab refreshes its claim. */
const HEARTBEAT_MS = 2_000
/** A claim older than this is from a tab that crashed or was frozen; ignore it. */
const STALE_MS = 6_000

interface PlaybackOwner {
  tabId: string
  at: number
}

interface PlayingMessage {
  type: "playing"
  tabId: string
}

/** This document's id. Unique per tab (and per window in the desktop app). */
let playbackTabId: string | null = null
export function getPlaybackTabId(): string {
  if (playbackTabId) return playbackTabId
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    playbackTabId = crypto.randomUUID()
  } else {
    playbackTabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  }
  return playbackTabId
}
// Computed lazily so importing this module has no side effects (required for SSR/Workers).

function readOwner(): PlaybackOwner | null {
  try {
    const raw = localStorage.getItem(OWNER_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PlaybackOwner>
    if (typeof parsed.tabId !== "string" || typeof parsed.at !== "number") return null
    return { tabId: parsed.tabId, at: parsed.at }
  } catch {
    return null
  }
}

function writeOwner(): void {
  try {
    const owner: PlaybackOwner = { tabId: getPlaybackTabId(), at: Date.now() }
    localStorage.setItem(OWNER_KEY, JSON.stringify(owner))
  } catch {
    // storage blocked: the channel alone still pauses the other tabs
  }
}

/** Whether some other tab has a video playing right now. */
export function anotherTabIsPlaying(now: number = Date.now()): boolean {
  const owner = readOwner()
  if (!owner || owner.tabId === getPlaybackTabId()) return false
  return now - owner.at < STALE_MS
}

/**
 * Whether a video that this tab loads on its own (a restored floating player,
 * or a watch page opened in a new tab) may start playing by itself.
 *
 * Once the reader has clicked or typed in this tab, a video they pick is an
 * explicit choice and plays — taking over from the other tab.
 */
export function mayAutoplayInThisTab(): boolean {
  if (typeof window === "undefined") return true
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation
  if (activation?.hasBeenActive) return true
  return !anotherTabIsPlaying()
}

let channel: BroadcastChannel | null | undefined
function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) return channel
  channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME)
  return channel
}

/** Record this tab as the playing one and tell every other tab to pause. */
export function claimPlayback(): void {
  writeOwner()
  const message: PlayingMessage = { type: "playing", tabId: getPlaybackTabId() }
  getChannel()?.postMessage(message)
}

/** Clear this tab's claim, if it still holds it. */
export function releasePlayback(): void {
  try {
    if (readOwner()?.tabId === getPlaybackTabId()) localStorage.removeItem(OWNER_KEY)
  } catch {
    // ignore
  }
}

/** Call `onPlaying` whenever another tab starts playing. Returns an unsubscribe. */
export function onOtherTabPlaying(onPlaying: () => void): () => void {
  const ch = getChannel()
  if (!ch) return () => {}
  const handle = (event: MessageEvent) => {
    const data = event.data as Partial<PlayingMessage> | null
    if (data?.type === "playing" && data.tabId !== getPlaybackTabId()) onPlaying()
  }
  ch.addEventListener("message", handle)
  return () => ch.removeEventListener("message", handle)
}

/**
 * Wire a player into the one-tab rule: claim playback while `isPlaying`, and
 * call `pause` when another tab starts. `isPlaying` should follow the embed's
 * own state reports, so a tab only claims once its video is really playing.
 */
export function useOneTabPlayback(isPlaying: boolean, pause: () => void): void {
  const pauseRef = useRef(pause)
  pauseRef.current = pause

  useEffect(() => onOtherTabPlaying(() => pauseRef.current()), [])

  useEffect(() => {
    if (!isPlaying) {
      releasePlayback()
      return
    }
    claimPlayback()
    const interval = setInterval(writeOwner, HEARTBEAT_MS)
    const release = () => releasePlayback()
    window.addEventListener("pagehide", release)
    return () => {
      clearInterval(interval)
      window.removeEventListener("pagehide", release)
    }
  }, [isPlaying])
}
