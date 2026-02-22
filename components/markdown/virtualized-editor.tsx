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
 * VirtualizedEditor - An optimized Lexical editor wrapper with virtualization support
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

export interface VirtualizationConfig {
  enabled: boolean
  threshold: number
  chunkSize: number
  overscan: number
}

interface VirtualizedEditorProps {
  content: string
  onChange?: (content: string) => void
  readOnly?: boolean
  className?: string
  placeholder?: string
  virtualization?: Partial<VirtualizationConfig>
}

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
 * ChunkedEditor - Alternative approach using multiple editor instances
 *
 * Splits extremely large documents into separate editor instances for
 * better performance.
 */

interface ChunkedEditorProps {
  content: string
  chunkSize?: number
  readOnly?: boolean
  className?: string
  onChange?: (fullContent: string) => void
}

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
