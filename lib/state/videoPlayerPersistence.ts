import type { VideoMeta, QueueItem } from "./videoPlayerStore"

const STORAGE_KEY = "persistent-video-player"
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export interface PersistedPlayerState {
  videoId: string
  title: string
  meta: VideoMeta | null
  isMinimized: boolean
  isSlowMode: boolean
  queue: QueueItem[]
  savedTime: number // seconds into the video
  savedAt: number // unix ms timestamp
}

export function savePlayerState(state: Omit<PersistedPlayerState, "savedAt">): void {
  try {
    const toSave: PersistedPlayerState = { ...state, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    // ignore quota errors
  }
}

export function loadPlayerState(): PersistedPlayerState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const state = JSON.parse(raw) as PersistedPlayerState
    if (!state.videoId || Date.now() - state.savedAt > MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return state
  } catch {
    return null
  }
}

export function clearSavedPlayerState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
