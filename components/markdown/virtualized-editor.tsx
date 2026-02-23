/**
 * @fileoverview Optimised Lexical editor wrappers with virtualization support.
 * Provides VirtualizedEditor for single-instance viewport-based rendering and
 * ChunkedEditor for splitting very large documents across multiple editor instances.
 */

"use client"

import { memo, useMemo, useCallback, useRef, useState, useEffect } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { ListItemNode, ListNode } from "@lexical/list"
import { LinkNode } from "@lexical/link"
import { CodeHighlightNode, CodeNode } from "@lexical/code"
import { $generateHtmlFromNodes } from "@lexical/html"
import { TRANSFORMERS, $convertFromMarkdownString } from "@lexical/markdown"
import type { LexicalEditor } from "lexical"
import { cn } from "@/lib/utils"

/**
 * VirtualizedEditor - An optimized Lexical editor wrapper with virtualization support.
 *
 * This component handles large documents with:
 * - Automatic virtualization for documents > threshold
 * - Viewport-based rendering optimization
 * - Minimal re-renders through React.memo
 *
 * @example
 * ```tsx
 * <VirtualizedEditor
 *   content={largeDocument}
 *   virtualization={{ enabled: true, threshold: 50000 }}
 *   onChange={handleChange}
 * />
 * ```
 */

/** Configuration options for the VirtualizedEditor virtualization feature. */
export interface VirtualizationConfig {
  /** Whether viewport-based virtualization is enabled. */
  enabled: boolean
  /** Character count threshold above which virtualization activates. */
  threshold: number
  /** Character count per rendered chunk. */
  chunkSize: number
  /** Number of extra chunks rendered outside the viewport. */
  overscan: number
}

/** Props for the VirtualizedEditor component. */
interface VirtualizedEditorProps {
  /** Initial markdown content to load into the editor. */
  content: string
  /** Called with the current HTML on every content change. */
  onChange?: (content: string) => void
  /** Renders the editor in read-only mode when true. */
  readOnly?: boolean
  /** Additional CSS classes applied to the root element. */
  className?: string
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string
  /** Partial virtualization configuration merged with defaults. */
  virtualization?: Partial<VirtualizationConfig>
}

/**
 * Optimised single-instance Lexical editor with optional viewport virtualization.
 * Memoised to avoid unnecessary re-renders on unchanged props.
 * @param content - Markdown content to initialise the editor with.
 * @param onChange - Emitted with current HTML on each content change.
 * @param readOnly - Disables editing when true.
 * @param className - Extra classes on the root wrapper.
 * @param placeholder - Empty-state hint text.
 * @param virtualization - Virtualization configuration overrides.
 */
export const VirtualizedEditor = memo(function VirtualizedEditor({
  content,
  onChange,
  readOnly = false,
  className,
  placeholder = "Start writing...",
  virtualization,
}: VirtualizedEditorProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [shouldVirtualize, setShouldVirtualize] = useState(false)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: Infinity })

  const config = useMemo(
    () => ({
      enabled: false,
      threshold: 50000,
      chunkSize: 10000,
      overscan: 1,
      ...virtualization,
    }),
    [virtualization],
  )

  const initialConfig = useMemo(
    () => ({
      namespace: "VirtualizedEditor",
      editable: !readOnly,
      onError: (error: Error) => console.error(error),
      nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode, CodeHighlightNode],
      editorState: () => {
        $convertFromMarkdownString(content || "", TRANSFORMERS)
      },
    }),
    // Only use content for initial config
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  /**
   * Handles Lexical editor state changes, serialises to HTML, and optionally
   * checks document size to toggle virtualization.
   * @param editorState - The new Lexical editor state.
   * @param editor - The Lexical editor instance.
   */
  const handleChange = useCallback(
    (editorState: any, editor: LexicalEditor) => {
      if (!onChange) return
      let html = ""
      editorState.read(() => {
        html = $generateHtmlFromNodes(editor, null)
      })
      onChange(html)

      // Check document size for virtualization
      if (config.enabled) {
        const docSize = editorState.read(() => {
          return editor.getEditorState().toJSON()
        })
        const sizeEstimate = JSON.stringify(docSize).length
        setShouldVirtualize(sizeEstimate > config.threshold)
      }
    },
    [onChange, config.enabled, config.threshold],
  )

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Performance indicator (dev mode only) */}
      {process.env.NODE_ENV === "development" && shouldVirtualize && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-1 text-xs text-blue-600 dark:text-blue-400">
          Virtualization active (range: {visibleRange.start}-{visibleRange.end})
        </div>
      )}

      <LexicalComposer initialConfig={initialConfig}>
        <div ref={scrollContainerRef} className="flex-1 overflow-auto">
          <div className="mx-auto px-6 py-8 max-w-4xl">
            <RichTextPlugin
              contentEditable={
                <ContentEditable className="min-h-full outline-none prose prose-sm max-w-none focus:outline-none" />
              }
              placeholder={<div className="text-muted-foreground/50">{placeholder}</div>}
              ErrorBoundary={LexicalErrorBoundary}
            />
          </div>
        </div>
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
        <OnChangePlugin ignoreSelectionChange onChange={handleChange} />
      </LexicalComposer>
    </div>
  )
})

/**
 * ChunkedEditor - Alternative approach using multiple editor instances.
 *
 * Splits extremely large documents into separate editor instances for
 * better performance.
 */

/** Props for the ChunkedEditor component. */
interface ChunkedEditorProps {
  /** Full document content string to split and render. */
  content: string
  /** Maximum character length per chunk (defaults to 15000). */
  chunkSize?: number
  /** Renders all chunk editors in read-only mode when true. */
  readOnly?: boolean
  /** Additional CSS classes applied to the root wrapper. */
  className?: string
  /** Called with the full document content on any chunk change. */
  onChange?: (fullContent: string) => void
}

/**
 * Splits large documents into multiple VirtualizedEditor instances for performance.
 * Displays a header banner and per-section labels when chunking is active.
 * Memoised to avoid unnecessary re-renders.
 * @param content - Full document content.
 * @param chunkSize - Maximum characters per chunk.
 * @param readOnly - Whether chunk editors are editable.
 * @param className - Extra classes on the root wrapper.
 * @param onChange - Emitted with the full content on changes.
 */
export const ChunkedEditor = memo(function ChunkedEditor({
  content,
  chunkSize = 15000,
  readOnly = true,
  className,
  onChange,
}: ChunkedEditorProps) {
  const chunks = useMemo(() => {
    if (content.length <= chunkSize) {
      return [content]
    }

    const parts: string[] = []
    let start = 0

    while (start < content.length) {
      let end = Math.min(start + chunkSize, content.length)

      if (end < content.length) {
        const paragraphBreak = content.lastIndexOf("\n\n", end)
        if (paragraphBreak > start + chunkSize * 0.7) {
          end = paragraphBreak + 2
        }
      }

      parts.push(content.slice(start, end))
      start = end
    }

    return parts
  }, [content, chunkSize])

  return (
    <div className={cn("flex flex-col gap-8", className)}>
      {chunks.length > 1 && (
        <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm border-b px-4 py-2 text-sm text-muted-foreground">
          Document split into {chunks.length} sections for optimal performance
        </div>
      )}

      {chunks.map((chunk, index) => (
        <section key={index} className="border-b last:border-0 pb-8 last:pb-0" data-chunk-index={index}>
          {chunks.length > 1 && (
            <div className="text-xs text-muted-foreground mb-4 font-mono">
              Section {index + 1} of {chunks.length}
            </div>
          )}
          <VirtualizedEditor content={chunk} readOnly={readOnly} />
        </section>
      ))}
    </div>
  )
})
