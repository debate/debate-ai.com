import { useRef, useState, useCallback, useEffect } from "react"

export type ResizeEdge = "left" | "right" | "bottom-left" | "bottom-right"

const MIN_WIDTH = 256
const MAX_WIDTH = 800

export function useDragResize(containerRef: React.RefObject<HTMLDivElement | null>) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const isDraggingRef = useRef(false)
  const dragOffsetRef = useRef({ x: 0, y: 0 })

  const [playerWidth, setPlayerWidth] = useState<number | null>(null)
  const [isResizing, setIsResizing] = useState(false)
  const isResizingRef = useRef(false)
  const resizeEdgeRef = useRef<ResizeEdge | null>(null)
  const resizeStartRef = useRef({ x: 0, y: 0, width: 0, posX: 0 })

  const startDrag = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    dragOffsetRef.current = { x: clientX - rect.left, y: clientY - rect.top }
    setPosition({ x: rect.left, y: rect.top })
    isDraggingRef.current = true
    setIsDragging(true)
  }, [containerRef])

  const startResize = useCallback((clientX: number, clientY: number, edge: ResizeEdge) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (!position) {
      setPosition({ x: rect.left, y: rect.top })
    }
    resizeStartRef.current = { x: clientX, y: clientY, width: el.offsetWidth, posX: rect.left }
    resizeEdgeRef.current = edge
    isResizingRef.current = true
    setIsResizing(true)
  }, [containerRef, position])

  const clampPosition = useCallback((x: number, y: number) => {
    const el = containerRef.current
    if (!el) return { x, y }
    return {
      x: Math.max(0, Math.min(window.innerWidth - el.offsetWidth, x)),
      y: Math.max(0, Math.min(window.innerHeight - el.offsetHeight, y)),
    }
  }, [containerRef])

  useEffect(() => {
    const applyResize = (clientX: number) => {
      const edge = resizeEdgeRef.current
      const { x: startX, width: startWidth, posX: startPosX } = resizeStartRef.current
      const dx = clientX - startX
      const isLeft = edge === "left" || edge === "bottom-left"
      const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + (isLeft ? -dx : dx)))
      setPlayerWidth(newWidth)
      if (isLeft) {
        setPosition((prev) => prev ? { x: startPosX + (startWidth - newWidth), y: prev.y } : prev)
      }
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (isResizingRef.current) { applyResize(e.clientX); return }
      if (!isDraggingRef.current) return
      setPosition(clampPosition(e.clientX - dragOffsetRef.current.x, e.clientY - dragOffsetRef.current.y))
    }
    const handleMouseUp = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        resizeEdgeRef.current = null
        setIsResizing(false)
        return
      }
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
    }
    const handleTouchMove = (e: TouchEvent) => {
      if (isResizingRef.current) { applyResize(e.touches[0].clientX); e.preventDefault(); return }
      if (!isDraggingRef.current) return
      const touch = e.touches[0]
      setPosition(clampPosition(touch.clientX - dragOffsetRef.current.x, touch.clientY - dragOffsetRef.current.y))
      e.preventDefault()
    }
    const handleTouchEnd = () => {
      if (isResizingRef.current) {
        isResizingRef.current = false
        resizeEdgeRef.current = null
        setIsResizing(false)
        return
      }
      if (!isDraggingRef.current) return
      isDraggingRef.current = false
      setIsDragging(false)
    }

    document.addEventListener("mousemove", handleMouseMove)
    document.addEventListener("mouseup", handleMouseUp)
    document.addEventListener("touchmove", handleTouchMove, { passive: false })
    document.addEventListener("touchend", handleTouchEnd)
    return () => {
      document.removeEventListener("mousemove", handleMouseMove)
      document.removeEventListener("mouseup", handleMouseUp)
      document.removeEventListener("touchmove", handleTouchMove)
      document.removeEventListener("touchend", handleTouchEnd)
    }
  }, [clampPosition])

  return { position, isDragging, isResizing, playerWidth, startDrag, startResize }
}
