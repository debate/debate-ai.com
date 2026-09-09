"use client"

/**
 * @fileoverview Keeps the video player store in step across the documents of
 * one app window.
 *
 * The app shell runs each dock destination in a same-origin `<iframe>` so the
 * dock stays responsive while a page loads (see the web app's
 * `AppFrameProvider`). That puts the video *grid* — the thing that picks a
 * video — in the frame's document, while the persistent player that plays it
 * lives in the top document. Zustand stores are per-document, so without this
 * bridge clicking a video in the frame would set a store nothing is listening
 * to and the player would never start.
 *
 * The bridge mirrors the store's serialisable slice over `postMessage`,
 * scoped to this document tree (parent ↔ its frames, same origin only) rather
 * than a `BroadcastChannel`, so two browser tabs of the app still play
 * independently. Callbacks in the store (`searchHandler`, `getCurrentTimeRef`)
 * are document-local by nature and are never sent.
 */

import { useEffect } from "react"

import { useVideoPlayerStore } from "./videoPlayerStore"

const MESSAGE_TYPE = "debate-video-player-state"

/** The part of the store that means the same thing in any document. */
const SHARED_KEYS = [
  "activeVideoId",
  "activeVideoTitle",
  "activeVideoMeta",
  "isMinimized",
  "isPlaying",
  "isSlowMode",
  "queue",
  "startTime",
] as const

type SharedKey = (typeof SHARED_KEYS)[number]
type SharedState = Pick<ReturnType<typeof useVideoPlayerStore.getState>, SharedKey>

function readShared(state: ReturnType<typeof useVideoPlayerStore.getState>): SharedState {
  return SHARED_KEYS.reduce((slice, key) => {
    ;(slice as any)[key] = state[key]
    return slice
  }, {} as SharedState)
}

function sameShared(a: SharedState, b: SharedState): boolean {
  return SHARED_KEYS.every((key) =>
    key === "queue"
      ? JSON.stringify(a.queue) === JSON.stringify(b.queue)
      : a[key] === b[key],
  )
}

/** Every same-origin document in this window that isn't the sender. */
function peerWindows(): Window[] {
  const peers: Window[] = []
  if (window.parent && window.parent !== window) peers.push(window.parent)
  for (let i = 0; i < window.frames.length; i += 1) {
    const frame = window.frames[i]
    if (frame && frame !== window) peers.push(frame as unknown as Window)
  }
  return peers
}

/**
 * Mirrors player state between this document and the rest of the app window.
 * Mount once per document, above anything that reads the store.
 */
export function VideoPlayerFrameBridge() {
  useEffect(() => {
    if (typeof window === "undefined") return

    // Set while a remote snapshot is being applied, so the store subscription
    // below doesn't bounce it straight back and start a ping-pong.
    let applying = false
    let lastSent = readShared(useVideoPlayerStore.getState())

    const broadcast = (state: SharedState) => {
      for (const peer of peerWindows()) {
        try {
          peer.postMessage({ type: MESSAGE_TYPE, state }, window.location.origin)
        } catch {
          // A cross-origin frame we can't talk to — not ours to sync.
        }
      }
    }

    const unsubscribe = useVideoPlayerStore.subscribe((state) => {
      if (applying) return
      const shared = readShared(state)
      if (sameShared(shared, lastSent)) return
      lastSent = shared
      broadcast(shared)
    })

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as { type?: string; state?: SharedState } | null
      if (data?.type !== MESSAGE_TYPE || !data.state) return

      const incoming = data.state
      if (sameShared(incoming, readShared(useVideoPlayerStore.getState()))) return

      applying = true
      lastSent = incoming
      try {
        useVideoPlayerStore.setState(incoming as any)
      } finally {
        applying = false
      }
      // Pass it on to this document's own peers, so a frame's change reaches
      // the other frames and not just the parent.
      for (const peer of peerWindows()) {
        if (peer === event.source) continue
        try {
          peer.postMessage({ type: MESSAGE_TYPE, state: incoming }, window.location.origin)
        } catch {
          // As above.
        }
      }
    }

    window.addEventListener("message", onMessage)
    return () => {
      unsubscribe()
      window.removeEventListener("message", onMessage)
    }
  }, [])

  return null
}
