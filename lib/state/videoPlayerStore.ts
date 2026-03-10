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
  queue: QueueItem[]
  setActiveVideo: (videoId: string, title: string) => void
  clearActiveVideo: () => void
  setMinimized: (minimized: boolean) => void
  addToQueue: (videoId: string, title: string) => void
  removeFromQueue: (videoId: string) => void
  playNextInQueue: () => void
  clearQueue: () => void
}

export const useVideoPlayerStore = create<VideoPlayerStore>((set, get) => ({
  activeVideoId: null,
  activeVideoTitle: null,
  isMinimized: false,
  queue: [],
  setActiveVideo: (videoId, title) => set({ activeVideoId: videoId, activeVideoTitle: title, isMinimized: false }),
  clearActiveVideo: () => {
    const { queue } = get()
    if (queue.length > 0) {
      get().playNextInQueue()
    } else {
      set({ activeVideoId: null, activeVideoTitle: null, isMinimized: false })
    }
  },
  setMinimized: (minimized) => set({ isMinimized: minimized }),
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
      if (state.queue.length === 0) return { activeVideoId: null, activeVideoTitle: null }
      const [next, ...rest] = state.queue
      return { activeVideoId: next.videoId, activeVideoTitle: next.title, queue: rest, isMinimized: false }
    }),
  clearQueue: () => set({ queue: [] }),
}))
