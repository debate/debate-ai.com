/**
 * @fileoverview Drag-to-resize state for a table's columns. Tracks a pixel
 * width per column key and lets a resize handle's mousedown drive it via
 * document-level mousemove/mouseup listeners (the drag can leave the handle).
 */

import { useCallback, useEffect, useRef, useState } from "react"

const MIN_COLUMN_WIDTH = 60
const MAX_COLUMN_WIDTH = 700

export function useResizableColumns<K extends string>(defaultWidths: Record<K, number>) {
  const [widths, setWidths] = useState<Record<K, number>>(defaultWidths)
  const resizingKeyRef = useRef<K | null>(null)
  const resizeStartRef = useRef({ x: 0, width: 0 })

  const startResize = useCallback(
    (key: K, clientX: number) => {
      resizingKeyRef.current = key
      resizeStartRef.current = { x: clientX, width: widths[key] }
      document.body.classList.add("cursor-col-resize", "select-none")
    },
    [widths],
  )

  useEffect(() => {
    const applyResize = (clientX: number) => {
      const key = resizingKeyRef.current
      if (!key) return
      const { x: startX, width: startWidth } = resizeStartRef.current
      const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, startWidth + (clientX - startX)))
      setWidths((prev) => (prev[key] === nextWidth ? prev : { ...prev, [key]: nextWidth }))
    }
    const stopResize = () => {
      if (!resizingKeyRef.current) return
      resizingKeyRef.current = null
      document.body.classList.remove("cursor-col-resize", "select-none")
    }
    const handleMouseMove = (e: MouseEvent) => applyResize(e.clientX)
    const handleTouchMove = (e: TouchEvent) => {
      if (!resizingKeyRef.current) return
      applyResize(e.touches[0].clientX)
      e.preventDefault()
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", stopResize)
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", stopResize)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", stopResize)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", stopResize)
    }
  }, [])

  return { widths, startResize }
}
