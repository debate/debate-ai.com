import type { VideoMeta, QueueItem } from "./videoPlayerStore"

const STORAGE_KEY = "persistent-video-player"
const VIDEOS_STORAGE_KEY = "video-timestamps"
const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours
const MAX_STORED_VIDEOS = 50 // Maximum number of video timestamps to keep

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

interface VideoTimestamp {
  videoId: string
  savedTime: number
  savedAt: number
}

export function savePlayerState(state: Omit<PersistedPlayerState, "savedAt">): void {
  try {
    const toSave: PersistedPlayerState = { ...state, savedAt: Date.now() }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave))

    // Also save individual video timestamp
    saveVideoTimestamp(state.videoId, state.savedTime)
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

/** Save timestamp for a specific video */
export function saveVideoTimestamp(videoId: string, savedTime: number): void {
  try {
    const raw = localStorage.getItem(VIDEOS_STORAGE_KEY)
    let timestamps: Record<string, VideoTimestamp> = {}

    if (raw) {
      timestamps = JSON.parse(raw)
    }

    // Add or update the timestamp for this video
    timestamps[videoId] = {
      videoId,
      savedTime,
      savedAt: Date.now()
    }

    // Prune old entries if we exceed the limit
    const entries = Object.values(timestamps)
    if (entries.length > MAX_STORED_VIDEOS) {
      // Sort by savedAt descending and keep only the most recent MAX_STORED_VIDEOS
      const sorted = entries.sort((a, b) => b.savedAt - a.savedAt).slice(0, MAX_STORED_VIDEOS)
      timestamps = Object.fromEntries(sorted.map(t => [t.videoId, t]))
    }

    localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(timestamps))
  } catch {
    // ignore quota errors
  }
}

/** Load timestamp for a specific video */
export function loadVideoTimestamp(videoId: string): number | null {
  try {
    const raw = localStorage.getItem(VIDEOS_STORAGE_KEY)
    if (!raw) return null

    const timestamps: Record<string, VideoTimestamp> = JSON.parse(raw)
    const timestamp = timestamps[videoId]

    if (!timestamp) return null

    // Check if the timestamp is too old
    if (Date.now() - timestamp.savedAt > MAX_AGE_MS) {
      // Clean up old timestamp
      delete timestamps[videoId]
      localStorage.setItem(VIDEOS_STORAGE_KEY, JSON.stringify(timestamps))
      return null
    }

    return timestamp.savedTime
  } catch {
    return null
  }
}
