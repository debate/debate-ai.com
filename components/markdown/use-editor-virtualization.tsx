import { useCallback, useEffect, useRef, useState } from "react"
import type { Editor } from "@tiptap/react"

/**
 * Configuration options for editor virtualization
 */
export interface VirtualizationConfig {
  /**
   * Enable viewport-based rendering optimizations
   * @default false
   */
  enabled: boolean

  /**
   * Threshold for enabling virtualization (in characters)
   * Documents smaller than this won't use virtualization
   * @default 50000
   */
  threshold: number

  /**
   * Size of content chunks for lazy loading (in characters)
   * @default 10000
   */
  chunkSize: number

  /**
   * Number of chunks to render above/below viewport
   * @default 1
   */
  overscan: number
}

const DEFAULT_CONFIG: VirtualizationConfig = {
  enabled: false,
  threshold: 50000,
  chunkSize: 10000,
  overscan: 1,
}

/**
 * Custom hook for virtualizing large documents in Tiptap editor
 *
 * This hook provides viewport-based rendering optimizations for large documents
 * by chunking content and only rendering visible portions. For documents under
 * the threshold, virtualization is skipped for optimal simple-case performance.
 *
 * @example
 * ```tsx
 * const { shouldVirtualize, getVisibleRange } = useEditorVirtualization(editor, {
 *   enabled: true,
 *   threshold: 50000,
 *   chunkSize: 10000,
 * })
 * ```
 */
export function useEditorVirtualization(
  editor: Editor | null,
  config: Partial<VirtualizationConfig> = {},
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const [shouldVirtualize, setShouldVirtualize] = useState(false)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Infinity })
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  /**
   * Check if document size exceeds virtualization threshold
   */
  const checkDocumentSize = useCallback(() => {
    if (!editor || !finalConfig.enabled) {
      setShouldVirtualize(false)
      return
    }

    const docSize = editor.state.doc.content.size
    const shouldEnable = docSize > finalConfig.threshold

    setShouldVirtualize(shouldEnable)

    if (!shouldEnable) {
      // Reset to full document rendering
      setVisibleRange({ start: 0, end: Infinity })
    }
  }, [editor, finalConfig.enabled, finalConfig.threshold])

  /**
   * Calculate visible content range based on scroll position
   */
  const updateVisibleRange = useCallback(() => {
    if (!editor || !shouldVirtualize || !scrollContainerRef.current) {
      return
    }

    const container = scrollContainerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight

    // Calculate approximate character position based on scroll
    // This is a simplified heuristic - real implementation would need
    // to map DOM positions to ProseMirror document positions
    const docSize = editor.state.doc.content.size
    const scrollRatio = scrollTop / (container.scrollHeight - containerHeight)
    const centerPos = Math.floor(docSize * scrollRatio)

    // Calculate visible range with overscan
    const halfViewport = Math.floor((finalConfig.chunkSize * (finalConfig.overscan + 1)) / 2)
    const start = Math.max(0, centerPos - halfViewport)
    const end = Math.min(docSize, centerPos + halfViewport)

    setVisibleRange({ start, end })
  }, [editor, shouldVirtualize, finalConfig.chunkSize, finalConfig.overscan])

  /**
   * Set up scroll listener for viewport tracking
   */
  useEffect(() => {
    const container = scrollContainerRef.current
    if (!container || !shouldVirtualize) {
      return
    }

    let rafId: number | null = null
    const handleScroll = () => {
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
      rafId = requestAnimationFrame(updateVisibleRange)
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => {
      container.removeEventListener("scroll", handleScroll)
      if (rafId) {
        cancelAnimationFrame(rafId)
      }
    }
  }, [shouldVirtualize, updateVisibleRange])

  /**
   * Check document size on editor updates
   */
  useEffect(() => {
    if (!editor) return

    // Check size on initial load
    checkDocumentSize()

    // Subscribe to transaction updates to detect size changes
    editor.on("update", checkDocumentSize)
    return () => {
      editor.off("update", checkDocumentSize)
    }
  }, [editor, checkDocumentSize])

  /**
   * Get the current visible range for rendering optimization
   */
  const getVisibleRange = useCallback(() => {
    return visibleRange
  }, [visibleRange])

  /**
   * Manually trigger a viewport update (useful after programmatic scrolls)
   */
  const forceUpdate = useCallback(() => {
    updateVisibleRange()
  }, [updateVisibleRange])

  return {
    /**
     * Whether virtualization is currently active
     */
    shouldVirtualize,

    /**
     * Current visible range { start, end } in document positions
     */
    visibleRange,

    /**
     * Get the current visible range
     */
    getVisibleRange,

    /**
     * Ref to attach to scroll container for viewport tracking
     */
    scrollContainerRef,

    /**
     * Force an update of the visible range
     */
    forceUpdate,

    /**
     * Current virtualization configuration
     */
    config: finalConfig,
  }
}

/**
 * Utility: Split document content into chunks for lazy loading
 *
 * @param content - Full document content (markdown string)
 * @param chunkSize - Size of each chunk in characters
 * @returns Array of content chunks
 *
 * @example
 * ```tsx
 * const chunks = splitIntoChunks(largeContent, 10000)
 * const visibleChunk = chunks[currentChunkIndex]
 * ```
 */
export function splitIntoChunks(content: string, chunkSize: number): string[] {
  if (content.length <= chunkSize) {
    return [content]
  }

  const chunks: string[] = []
  let start = 0

  while (start < content.length) {
    // Try to find a good break point (paragraph or section boundary)
    let end = Math.min(start + chunkSize, content.length)

    if (end < content.length) {
      // Look for paragraph break
      const paragraphBreak = content.lastIndexOf("\n\n", end)
      if (paragraphBreak > start + chunkSize * 0.7) {
        end = paragraphBreak + 2
      } else {
        // Look for line break
        const lineBreak = content.lastIndexOf("\n", end)
        if (lineBreak > start + chunkSize * 0.8) {
          end = lineBreak + 1
        }
      }
    }

    chunks.push(content.slice(start, end))
    start = end
  }

  return chunks
}

/**
 * Utility: Create multiple editor instances for chunk-based rendering
 * This is useful for implementing pagination-style rendering where each
 * "page" or section is a separate editor instance.
 *
 * Note: This approach is recommended for books or very long documents
 * where you want clear section boundaries.
 *
 * @example
 * ```tsx
 * const chunks = splitIntoChunks(bookContent, 15000)
 * return chunks.map((chunk, index) => (
 *   <MarkdownEditor key={index} content={chunk} readOnly />
 * ))
 * ```
 */
export function useChunkedEditors(
  content: string,
  config: Partial<VirtualizationConfig> = {},
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const [chunks, setChunks] = useState<string[]>([])
  const [activeChunkIndex, setActiveChunkIndex] = useState(0)

  useEffect(() => {
    if (!finalConfig.enabled || content.length < finalConfig.threshold) {
      setChunks([content])
      return
    }

    const newChunks = splitIntoChunks(content, finalConfig.chunkSize)
    setChunks(newChunks)
  }, [content, finalConfig.enabled, finalConfig.threshold, finalConfig.chunkSize])

  return {
    /**
     * Array of content chunks
     */
    chunks,

    /**
     * Currently active chunk index
     */
    activeChunkIndex,

    /**
     * Set the active chunk (for navigation)
     */
    setActiveChunkIndex,

    /**
     * Total number of chunks
     */
    totalChunks: chunks.length,

    /**
     * Whether content is chunked
     */
    isChunked: chunks.length > 1,
  }
}
