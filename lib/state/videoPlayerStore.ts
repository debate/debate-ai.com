"use client"

import { create } from "zustand"

interface VideoPlayerStore {
  activeVideoId: string | null
  activeVideoTitle: string | null
  isMinimized: boolean
  setActiveVideo: (videoId: string, title: string) => void
  clearActiveVideo: () => void
  setMinimized: (minimized: boolean) => void
}

export const useVideoPlayerStore = create<VideoPlayerStore>((set) => ({
  activeVideoId: null,
  activeVideoTitle: null,
  isMinimized: false,
  setActiveVideo: (videoId, title) => set({ activeVideoId: videoId, activeVideoTitle: title, isMinimized: false }),
  clearActiveVideo: () => set({ activeVideoId: null, activeVideoTitle: null, isMinimized: false }),
  setMinimized: (minimized) => set({ isMinimized: minimized }),
}))
