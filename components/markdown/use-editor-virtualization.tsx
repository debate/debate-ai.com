/**
 * @fileoverview Hooks and utilities for virtualizing large Lexical editor documents.
 * Provides viewport-based rendering and content-chunking strategies to maintain
 * performance when editing very large files.
 */

import { useCallback, useEffect, useRef, useState } from "react"
import type { LexicalEditor } from "lexical"

/** Configuration options for editor virtualization. */
export interface VirtualizationConfig {
  /**
   * Enable viewport-based rendering optimizations.
   * @default false
   */
  enabled: boolean

  /**
   * Threshold for enabling virtualization (in characters).
   * Documents smaller than this won't use virtualization.
   * @default 50000
   */
  threshold: number

  /**
   * Size of content chunks for lazy loading (in characters).
   * @default 10000
   */
  chunkSize: number

  /**
   * Number of chunks to render above/below viewport.
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
 * Custom hook for virtualizing large documents in Lexical editor.
 *
 * This hook provides viewport-based rendering optimizations for large documents
 * by chunking content and only rendering visible portions. For documents under
 * the threshold, virtualization is skipped for optimal simple-case performance.
 * @param editor - The Lexical editor instance to observe, or null when not yet mounted.
 * @param config - Partial virtualization configuration merged with defaults.
 * @returns Object containing virtualization state and helper utilities.
 */
export function useEditorVirtualization(
  editor: LexicalEditor | null,
  config: Partial<VirtualizationConfig> = {},
) {
  const finalConfig = { ...DEFAULT_CONFIG, ...config }
  const [shouldVirtualize, setShouldVirtualize] = useState(false)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Infinity })
  const scrollContainerRef = useRef<HTMLDivElement | null>(null)

  /**
   * Check if document size exceeds virtualization threshold.
   */
  const checkDocumentSize = useCallback(() => {
    if (!editor || !finalConfig.enabled) {
      setShouldVirtualize(false)
      return
    }

    const editorState = editor.getEditorState()
    const docSize = JSON.stringify(editorState.toJSON()).length
    const shouldEnable = docSize > finalConfig.threshold

    setShouldVirtualize(shouldEnable)

    if (!shouldEnable) {
      setVisibleRange({ start: 0, end: Infinity })
    }
  }, [editor, finalConfig.enabled, finalConfig.threshold])

  /**
   * Calculate visible content range based on scroll position.
   */
  const updateVisibleRange = useCallback(() => {
    if (!editor || !shouldVirtualize || !scrollContainerRef.current) {
      return
    }

    const container = scrollContainerRef.current
    const scrollTop = container.scrollTop
    const containerHeight = container.clientHeight

    const editorState = editor.getEditorState()
    const docSize = JSON.stringify(editorState.toJSON()).length
    const scrollRatio = scrollTop / (container.scrollHeight - containerHeight)
    const centerPos = Math.floor(docSize * scrollRatio)

    const halfViewport = Math.floor((finalConfig.chunkSize * (finalConfig.overscan + 1)) / 2)
    const start = Math.max(0, centerPos - halfViewport)
    const end = Math.min(docSize, centerPos + halfViewport)

    setVisibleRange({ start, end })
  }, [editor, shouldVirtualize, finalConfig.chunkSize, finalConfig.overscan])

  /**
   * Set up scroll listener for viewport tracking.
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
   * Check document size on editor updates.
   */
  useEffect(() => {
    if (!editor) return

    checkDocumentSize()

    return editor.registerUpdateListener(() => {
      checkDocumentSize()
    })
  }, [editor, checkDocumentSize])

  /**
   * Returns the current visible character range.
   * @returns Object with start and end character positions.
   */
  const getVisibleRange = useCallback(() => {
    return visibleRange
  }, [visibleRange])

  /** Forces an immediate recalculation of the visible range. */
  const forceUpdate = useCallback(() => {
    updateVisibleRange()
  }, [updateVisibleRange])

  return {
    /** Whether virtualization is currently active for this document. */
    shouldVirtualize,
    /** Current visible character range within the document. */
    visibleRange,
    /** Returns the current visible range. */
    getVisibleRange,
    /** Ref to attach to the scroll container element. */
    scrollContainerRef,
    /** Forces an immediate visible-range recalculation. */
    forceUpdate,
    /** Resolved configuration in effect. */
    config: finalConfig,
  }
}

/**
 * Utility: Split document content into chunks for lazy loading.
 * Attempts to break at paragraph or line boundaries for cleaner splits.
 * @param content - Full document content string to split.
 * @param chunkSize - Maximum character length of each chunk.
 * @returns Array of content chunks.
 */
export function splitIntoChunks(content: string, chunkSize: number): string[] {
  if (content.length <= chunkSize) {
    return [content]
  }

  const chunks: string[] = []
  let start = 0

  while (start < content.length) {
    let end = Math.min(start + chunkSize, content.length)

    if (end < content.length) {
      const paragraphBreak = content.lastIndexOf("\n\n", end)
      if (paragraphBreak > start + chunkSize * 0.7) {
        end = paragraphBreak + 2
      } else {
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
 * Utility: Create multiple editor instances for chunk-based rendering.
 * Splits large content into separate chunks and tracks which chunk is active.
 * @param content - Full document content string.
 * @param config - Partial virtualization configuration.
 * @returns Object with chunks array, active index state setter, and metadata.
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
    /** Array of content chunks. */
    chunks,
    /** Index of the currently active/focused chunk. */
    activeChunkIndex,
    /** Setter for the active chunk index. */
    setActiveChunkIndex,
    /** Total number of chunks. */
    totalChunks: chunks.length,
    /** True when the content has been split into more than one chunk. */
    isChunked: chunks.length > 1,
  }
}
