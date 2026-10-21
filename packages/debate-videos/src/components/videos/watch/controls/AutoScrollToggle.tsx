/**
 * @fileoverview The "Auto-scroll" checkbox in the watch page's side panels.
 *
 * Captions and timed speech documents follow playback by default; a reader
 * who wants to stay put while the video runs unticks this. The choice is
 * shared by every tab and remembered (see `WatchSidePanel`).
 * @module components/watch/AutoScrollToggle
 */

"use client"

interface AutoScrollToggleProps {
  checked: boolean
  onChange: (value: boolean) => void
}

export function AutoScrollToggle({ checked, onChange }: AutoScrollToggleProps) {
  return (
    <label
      className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer select-none hover:text-foreground"
      title="Follow the video as it plays"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3 w-3 cursor-pointer accent-primary"
      />
      Auto-scroll
    </label>
  )
}
