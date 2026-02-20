"use client"

import { memo, useMemo } from "react"
import { EditorContent, useEditor, type Editor as TiptapEditor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import { cn } from "@/lib/utils"
import { useEditorVirtualization, type VirtualizationConfig } from "./use-editor-virtualization"

/**
 * VirtualizedEditor - An optimized Tiptap editor wrapper with virtualization support
 *
 * This component demonstrates best practices for handling large documents:
 * - Automatic virtualization for documents > threshold
 * - Viewport-based rendering optimization
 * - Minimal re-renders through React.memo
 * - Tiptap 2.5+ performance features
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

interface VirtualizedEditorProps {
  /**
   * Document content (markdown or HTML)
   */
  content: string

  /**
   * Callback when content changes
   */
  onChange?: (content: string) => void

  /**
   * Whether editor is read-only
   */
  readOnly?: boolean

  /**
   * Custom class name
   */
  className?: string

  /**
   * Placeholder text
   */
  placeholder?: string

  /**
   * Virtualization configuration
   */
  virtualization?: Partial<VirtualizationConfig>

  /**
   * Custom Tiptap extensions (will be merged with defaults)
   */
  extensions?: any[]
}

export const VirtualizedEditor = memo(function VirtualizedEditor({
  content,
  onChange,
  readOnly = false,
  className,
  placeholder = "Start writing...",
  virtualization,
  extensions: customExtensions = [],
}: VirtualizedEditorProps) {
  // Prepare Tiptap extensions
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        // Use default history settings
      }) as any,
      ...customExtensions,
    ],
    [customExtensions],
  )

  // Create editor instance with performance optimizations
  const editor = useEditor({
    extensions,
    content,
    editable: !readOnly,
    // Tiptap 2.5+ performance features
    immediatelyRender: false, // Skip initial render, load on mount
    shouldRerenderOnTransaction: false, // Prevent re-render on every keystroke
    editorProps: {
      attributes: {
        class: "prose prose-sm max-w-none focus:outline-none min-h-full",
        spellCheck: "true",
      },
    },
    onUpdate: ({ editor }) => {
      if (onChange) {
        const html = editor.getHTML()
        onChange(html)
      }
    },
  })

  // Set up virtualization for large documents
  const { shouldVirtualize, scrollContainerRef, visibleRange } = useEditorVirtualization(
    editor,
    virtualization,
  )

  return (
    <div className={cn("flex flex-col h-full overflow-hidden", className)}>
      {/* Performance indicator (dev mode only) */}
      {process.env.NODE_ENV === "development" && shouldVirtualize && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-4 py-1 text-xs text-blue-600 dark:text-blue-400">
          ⚡ Virtualization active (range: {visibleRange.start}-{visibleRange.end})
        </div>
      )}

      {/* Editor container with scroll tracking */}
      <div ref={scrollContainerRef} className="flex-1 overflow-auto">
        <div className="mx-auto px-6 py-8 max-w-4xl">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
})

/**
 * ChunkedEditor - Alternative approach using multiple editor instances
 *
 * This component demonstrates the pagination/chunking strategy for extremely
 * large documents (e.g., books) where content is split into separate editor
 * instances. This provides better performance than a single massive document.
 *
 * @example
 * ```tsx
 * <ChunkedEditor
 *   content={bookContent}
 *   chunkSize={15000}
 *   readOnly
 * />
 * ```
 */

interface ChunkedEditorProps {
  /**
   * Full document content
   */
  content: string

  /**
   * Size of each chunk in characters
   */
  chunkSize?: number

  /**
   * Whether editors are read-only
   */
  readOnly?: boolean

  /**
   * Custom class name
   */
  className?: string

  /**
   * Callback when any chunk changes
   */
  onChange?: (fullContent: string) => void
}

export const ChunkedEditor = memo(function ChunkedEditor({
  content,
  chunkSize = 15000,
  readOnly = true,
  className,
  onChange,
}: ChunkedEditorProps) {
  // Split content into chunks at paragraph boundaries
  const chunks = useMemo(() => {
    if (content.length <= chunkSize) {
      return [content]
    }

    const parts: string[] = []
    let start = 0

    while (start < content.length) {
      let end = Math.min(start + chunkSize, content.length)

      // Find paragraph boundary
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
        <section
          key={index}
          className="border-b last:border-0 pb-8 last:pb-0"
          data-chunk-index={index}
        >
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
