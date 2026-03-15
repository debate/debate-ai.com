"use client"

import { create } from "zustand"

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
  setActiveVideo: (videoId: string, title: string, meta?: VideoMeta) => void
  clearActiveVideo: () => void
  setMinimized: (minimized: boolean) => void
  setIsPlaying: (playing: boolean) => void
  setSlowMode: (slow: boolean) => void
  addToQueue: (videoId: string, title: string, meta?: VideoMeta) => void
  removeFromQueue: (videoId: string) => void
  playNextInQueue: () => void
  clearQueue: () => void
}

export const useVideoPlayerStore = create<VideoPlayerStore>((set, get) => ({
  activeVideoId: null,
  activeVideoTitle: null,
  activeVideoMeta: null,
  isMinimized: false,
  isPlaying: false,
  isSlowMode: false,
  queue: [],
  setActiveVideo: (videoId, title, meta) => set({ activeVideoId: videoId, activeVideoTitle: title, activeVideoMeta: meta ?? null, isMinimized: false, isPlaying: true }),
  clearActiveVideo: () => {
    set({ activeVideoId: null, activeVideoTitle: null, activeVideoMeta: null, isMinimized: false, isPlaying: false })
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
      if (state.queue.length === 0) return { activeVideoId: null, activeVideoTitle: null, activeVideoMeta: null, isPlaying: false }
      const [next, ...rest] = state.queue
      return { activeVideoId: next.videoId, activeVideoTitle: next.title, activeVideoMeta: next.meta ?? null, queue: rest, isMinimized: false, isPlaying: true }
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
