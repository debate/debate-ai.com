/**
 * @fileoverview Shared types/helpers for rendering a synced video transcript.
 */

export interface TranscriptSnippet {
  text: string
  start: number
  duration: number
}

export function formatTime(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const mm = h > 0 ? m.toString().padStart(2, "0") : m.toString()
  const ss = s.toString().padStart(2, "0")
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}
