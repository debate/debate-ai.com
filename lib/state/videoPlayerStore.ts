"use client"

import { create } from "zustand"

export interface QueueItem {
  videoId: string
  title: string
}

interface VideoPlayerStore {
  activeVideoId: string | null
  activeVideoTitle: string | null
  isMinimized: boolean
  isPlaying: boolean
  queue: QueueItem[]
  setActiveVideo: (videoId: string, title: string) => void
  clearActiveVideo: () => void
  setMinimized: (minimized: boolean) => void
  setIsPlaying: (playing: boolean) => void
  addToQueue: (videoId: string, title: string) => void
  removeFromQueue: (videoId: string) => void
  playNextInQueue: () => void
  clearQueue: () => void
}

export const useVideoPlayerStore = create<VideoPlayerStore>((set, get) => ({
  activeVideoId: null,
  activeVideoTitle: null,
  isMinimized: false,
  isPlaying: false,
  queue: [],
  setActiveVideo: (videoId, title) => set({ activeVideoId: videoId, activeVideoTitle: title, isMinimized: false, isPlaying: true }),
  clearActiveVideo: () => {
    const { queue } = get()
    if (queue.length > 0) {
      get().playNextInQueue()
    } else {
      set({ activeVideoId: null, activeVideoTitle: null, isMinimized: false, isPlaying: false })
    }
  },
  setMinimized: (minimized) => set({ isMinimized: minimized }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  addToQueue: (videoId, title) =>
    set((state) => ({
      queue: state.queue.some((q) => q.videoId === videoId)
        ? state.queue
        : [...state.queue, { videoId, title }],
    })),
  removeFromQueue: (videoId) =>
    set((state) => ({ queue: state.queue.filter((q) => q.videoId !== videoId) })),
  playNextInQueue: () =>
    set((state) => {
      if (state.queue.length === 0) return { activeVideoId: null, activeVideoTitle: null, isPlaying: false }
      const [next, ...rest] = state.queue
      return { activeVideoId: next.videoId, activeVideoTitle: next.title, queue: rest, isMinimized: false, isPlaying: true }
    }),
  clearQueue: () => set({ queue: [] }),
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
