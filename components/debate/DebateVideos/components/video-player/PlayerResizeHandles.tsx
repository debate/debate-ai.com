import type { ResizeEdge } from "./useDragResize"

interface PlayerResizeHandlesProps {
  isResizing: boolean
  startResize: (clientX: number, clientY: number, edge: ResizeEdge) => void
}

export function PlayerResizeHandles({ isResizing, startResize }: PlayerResizeHandlesProps) {
  return (
    <>
      {isResizing && <div className="absolute inset-0 z-10" />}

      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/20 transition-colors"
        onMouseDown={(e) => { e.preventDefault(); startResize(e.clientX, e.clientY, "left") }}
        onTouchStart={(e) => startResize(e.touches[0].clientX, e.touches[0].clientY, "left")}
      />
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/20 transition-colors"
        onMouseDown={(e) => { e.preventDefault(); startResize(e.clientX, e.clientY, "right") }}
        onTouchStart={(e) => startResize(e.touches[0].clientX, e.touches[0].clientY, "right")}
      />
      <div
        className="absolute left-0 bottom-0 w-3 h-3 cursor-nesw-resize hover:bg-primary/20 transition-colors z-[1]"
        onMouseDown={(e) => { e.preventDefault(); startResize(e.clientX, e.clientY, "bottom-left") }}
        onTouchStart={(e) => startResize(e.touches[0].clientX, e.touches[0].clientY, "bottom-left")}
      />
      <div
        className="absolute right-0 bottom-0 w-3 h-3 cursor-nwse-resize hover:bg-primary/20 transition-colors z-[1]"
        onMouseDown={(e) => { e.preventDefault(); startResize(e.clientX, e.clientY, "bottom-right") }}
        onTouchStart={(e) => startResize(e.touches[0].clientX, e.touches[0].clientY, "bottom-right")}
      />
    </>
  )
}
