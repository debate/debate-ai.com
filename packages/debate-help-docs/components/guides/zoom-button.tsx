"use client"
/**
 * @file zoom-button.tsx
 * @description The "Zoom level" button in the docs toolbar. It shows the
 * current level; a click zooms the page content in a step, Ctrl/Cmd+click zooms
 * out and Shift+click resets to 100%. While it is mounted, Ctrl/Cmd and +, -
 * or 0 do the same and replace the browser's own zoom on docs pages, except
 * while typing in a field. The levels, limits and storage are `lib/docs-zoom.ts`;
 * the level is applied as the `--debate-docs-zoom` variable on `<html>`, so it
 * carries across pages and reloads.
 */
import { useEffect, useState } from "react"
import { ZoomIn } from "lucide-react"
import { buttonVariants } from "../ui/button"
import {
  ZOOM_DEFAULT,
  ZOOM_TOOLTIP,
  applyZoomAction,
  readZoom,
  writeZoom,
  zoomActionForClick,
  zoomActionForKey,
} from "../../lib/docs-zoom"

const FIELDS = "input, textarea, select, [contenteditable]:not([contenteditable=false])"

export function DocsZoomButton() {
  const [level, setLevel] = useState(ZOOM_DEFAULT)

  useEffect(() => {
    const current = readZoom()
    setLevel(current)
    writeZoom(current)
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented) return
      const action = zoomActionForKey(event)
      if (!action) return
      if (event.target instanceof Element && event.target.closest(FIELDS)) return
      event.preventDefault()
      const next = applyZoomAction(readZoom(), action)
      writeZoom(next)
      setLevel(next)
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const onClick = (event: React.MouseEvent) => {
    const next = applyZoomAction(level, zoomActionForClick(event))
    writeZoom(next)
    setLevel(next)
  }

  return (
    <button
      type="button"
      aria-label={`Zoom level ${level}%`}
      title={ZOOM_TOOLTIP}
      className={buttonVariants({ size: "sm", className: "gap-2 [&_svg]:size-3.5 [&_svg]:text-fd-muted-foreground" })}
      onClick={onClick}
    >
      <ZoomIn aria-hidden />
      <span>{level}%</span>
    </button>
  )
}
