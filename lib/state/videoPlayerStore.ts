"use client"

import { create } from "zustand"
import { savePlayerState, loadVideoTimestamp } from "./videoPlayerPersistence"

export interface VideoMeta {
  style?: number
  tournament?: string | null
  year?: number
  affTeam?: string | null
  negTeam?: string | null
}

export interface QueueItem {
  videoId: string
  title: string
  meta?: VideoMeta
}

interface VideoPlayerStore {
  activeVideoId: string | null
  activeVideoTitle: string | null
  activeVideoMeta: VideoMeta | null
  isMinimized: boolean
  isPlaying: boolean
  isSlowMode: boolean
  queue: QueueItem[]
  /** Seconds to start the video from (for YouTube &start= param). Reset to 0 after each new video. */
  startTime: number
  searchHandler: ((searchTerm: string) => void) | null
  /** Store the current playback time getter function */
  getCurrentTimeRef: (() => number) | null
  setActiveVideo: (videoId: string, title: string, meta?: VideoMeta) => void
  clearActiveVideo: () => void
  setMinimized: (minimized: boolean) => void
  setIsPlaying: (playing: boolean) => void
  setSlowMode: (slow: boolean) => void
  addToQueue: (videoId: string, title: string, meta?: VideoMeta) => void
  removeFromQueue: (videoId: string) => void
  playNextInQueue: () => void
  clearQueue: () => void
  setSearchHandler: (handler: ((searchTerm: string) => void) | null) => void
  setGetCurrentTimeRef: (getter: (() => number) | null) => void
  /** Restore all player state from a persisted snapshot (does not reset startTime). */
  restoreVideo: (
    videoId: string,
    title: string,
    meta: VideoMeta | null,
    opts: { isMinimized: boolean; isSlowMode: boolean; queue: QueueItem[]; savedTime: number }
  ) => void
}

export const useVideoPlayerStore = create<VideoPlayerStore>((set, get) => ({
  activeVideoId: null,
  activeVideoTitle: null,
  activeVideoMeta: null,
  isMinimized: false,
  isPlaying: false,
  isSlowMode: false,
  queue: [],
  startTime: 0,
  searchHandler: null,
  getCurrentTimeRef: null,
  setActiveVideo: (videoId, title, meta) => {
    const state = get()
    // If switching from one video to another, preserve the current timestamp
    if (state.activeVideoId && state.activeVideoId !== videoId && state.getCurrentTimeRef) {
      const currentTime = state.getCurrentTimeRef()
      // Save the current video state before switching
      if (currentTime > 0) {
        savePlayerState({
          videoId: state.activeVideoId,
          title: state.activeVideoTitle ?? "",
          meta: state.activeVideoMeta,
          isMinimized: state.isMinimized,
          isSlowMode: state.isSlowMode,
          queue: state.queue,
          savedTime: currentTime,
        })
      }
    }

    // Check if the new video has a saved timestamp
    const savedTime = loadVideoTimestamp(videoId) ?? 0

    set({ activeVideoId: videoId, activeVideoTitle: title, activeVideoMeta: meta ?? null, isMinimized: false, isPlaying: true, startTime: savedTime })
  },
  clearActiveVideo: () => {
    set({ activeVideoId: null, activeVideoTitle: null, activeVideoMeta: null, isMinimized: false, isPlaying: false, startTime: 0 })
  },
  setMinimized: (minimized) => set({ isMinimized: minimized }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setSlowMode: (slow) => set({ isSlowMode: slow }),
  addToQueue: (videoId, title, meta) =>
    set((state) => ({
      queue: state.queue.some((q) => q.videoId === videoId)
        ? state.queue
        : [...state.queue, { videoId, title, meta }],
    })),
  removeFromQueue: (videoId) =>
    set((state) => ({ queue: state.queue.filter((q) => q.videoId !== videoId) })),
  playNextInQueue: () =>
    set((state) => {
      if (state.queue.length === 0) return { activeVideoId: null, activeVideoTitle: null, activeVideoMeta: null, isPlaying: false, startTime: 0 }
      const [next, ...rest] = state.queue
      return { activeVideoId: next.videoId, activeVideoTitle: next.title, activeVideoMeta: next.meta ?? null, queue: rest, isMinimized: false, isPlaying: true, startTime: 0 }
    }),
  clearQueue: () => set({ queue: [] }),
  setSearchHandler: (handler) => set({ searchHandler: handler }),
  setGetCurrentTimeRef: (getter) => set({ getCurrentTimeRef: getter }),
  restoreVideo: (videoId, title, meta, opts) =>
    set({
      activeVideoId: videoId,
      activeVideoTitle: title,
      activeVideoMeta: meta,
      isMinimized: opts.isMinimized,
      isSlowMode: opts.isSlowMode,
      queue: opts.queue,
      startTime: opts.savedTime,
      isPlaying: true,
    }),
}))

/** Module-level ref so any component can send commands to the YouTube iframe */
export const videoPlayerIframeRef: { current: HTMLIFrameElement | null } = { current: null }

/** Send a command to the YouTube iframe via postMessage */
export function sendYouTubeCommand(func: "playVideo" | "pauseVideo" | "setPlaybackRate", args: unknown[] = []) {
  const iframe = videoPlayerIframeRef.current
  if (!iframe?.contentWindow) return
  iframe.contentWindow.postMessage(
    JSON.stringify({ event: "command", func, args }),
    "https://www.youtube.com",
  )
}
