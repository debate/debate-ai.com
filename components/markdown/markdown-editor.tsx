/**
 * @fileoverview Primary markdown editor component built on Lexical.
 * Handles bidirectional markdown <-> HTML conversion, auto-save, unsaved-change
 * tracking, and multiple view modes including a structured quote-card view.
 */

"use client"

import { memo, useCallback, useEffect, useReducer, useRef, useState, type ReactNode } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { MarkdownShortcutPlugin } from "@lexical/react/LexicalMarkdownShortcutPlugin"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { ListItemNode, ListNode, INSERT_ORDERED_LIST_COMMAND, INSERT_UNORDERED_LIST_COMMAND, REMOVE_LIST_COMMAND } from "@lexical/list"
import { LinkNode } from "@lexical/link"
import { CodeHighlightNode, CodeNode } from "@lexical/code"
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html"
import {
  FORMAT_TEXT_COMMAND,
  REDO_COMMAND,
  UNDO_COMMAND,
  $getRoot,
  type LexicalEditor,
} from "lexical"
import { marked } from "marked"
import TurndownService from "turndown"
import { gfm } from "turndown-plugin-gfm"
import { TRANSFORMERS, $convertFromMarkdownString, $convertToMarkdownString } from "@lexical/markdown"
import { cn } from "@/lib/utils"
import { UnifiedMarkdown } from "./unified-markdown"
import { LexicalQuotesPlugin } from "./LexicalQuotesPlugin"
import { QuoteView } from "./QuoteView"
import { Bold, Italic, Underline, Strikethrough, Code, Undo2, Redo2, List, ListOrdered } from "lucide-react"

marked.setOptions({
  gfm: true,
  breaks: true,
})

const turndownService = new TurndownService({
  headingStyle: "atx",
  hr: "---",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
  blankReplacement: (content: string, node: any) => (node.isBlock ? "\n\n" : ""),
})
turndownService.use(gfm)

turndownService.addRule("emptyParagraph", {
  filter: (node: HTMLElement) =>
    node.nodeName === "P" && (!node.textContent || node.textContent.trim() === "") && !node.querySelector("img"),
  replacement: () => "\n\n",
})

turndownService.addRule("fencedCodeBlock", {
  filter: (node: HTMLElement) => {
    return node.nodeName === "PRE" && node.firstChild && node.firstChild.nodeName === "CODE"
  },
  replacement: (content: string, node: HTMLElement) => {
    const codeNode = node.firstChild as HTMLElement
    const className = codeNode.getAttribute("class") || ""
    const languageMatch = className.match(/language-(\w+)/)
    const language = languageMatch ? languageMatch[1] : ""
    const code = codeNode.textContent || ""
    return `\n\`\`\`${language}\n${code}\n\`\`\`\n`
  },
})

/** Imperative controls exposed to parent components via onEditorReady. */
export interface MarkdownEditorControls {
  /** Returns the current editor HTML as a string. */
  getHtml: () => string
  /** Triggers a manual save. */
  save: () => void
  /** Current persistence state of the editor. */
  saveState: "idle" | "saving" | "saved" | "error"
  /** Whether the editor content differs from the last saved version. */
  hasChanges: boolean
}

/** Props accepted by the MarkdownEditor component. */
interface MarkdownEditorProps {
  /** Current markdown content string. */
  content: string
  /** Baseline content used to compute unsaved-change status. */
  originalContent?: string
  /** Externally controlled unsaved-change flag. */
  hasUnsavedChanges?: boolean
  /** Called when the unsaved-change status changes. */
  onUnsavedChange?: (hasChanges: boolean) => void
  /** Called with the latest markdown on each debounced content change. */
  onChange: (content: string) => void
  /** Called when the user triggers a save action. */
  onSave?: () => void
  /** Called when the user discards unsaved changes. */
  onDiscard?: () => void
  /** Renders the editor in read-only mode when true. */
  readOnly?: boolean
  /** Additional CSS class names applied to the root element. */
  className?: string
  /** Placeholder text shown when the editor is empty. */
  placeholder?: string
  /** Whether to show the inline formatting toolbar. */
  showToolbar?: boolean
  /** File name used as the document identifier. */
  fileName?: string
  /** Hides save/discard action buttons from the toolbar. */
  hideToolbarActions?: boolean
  /** Called with imperative controls once the editor is ready, or null on unmount. */
  onEditorReady?: (controls: MarkdownEditorControls | null) => void
  /** Optional sandbox identifier forwarded to toolbar actions. */
  sandboxId?: string
  /** Milliseconds between onChange emissions (minimum 1000). */
  autoSaveInterval?: number
  /** localStorage key for persisting draft content between sessions. */
  localStorageKey?: string
  /** Current view mode controlling how content is rendered. */
  viewMode?: "read" | "highlighted" | "underlined" | "headings" | "quotes" | "h1-only" | "h2-only" | "h3-only" | "summaries-only"
}

/** Internal reducer state tracking the editor's synchronisation status. */
interface EditorSyncState {
  /** Latest serialised HTML from the Lexical editor. */
  currentHtml: string
  /** Latest serialised markdown pending emission. */
  pendingMarkdown: string
  /** Whether the current content differs from the saved baseline. */
  hasChanges: boolean
  /** Estimated total word count. */
  totalWords: number
  /** Count of words wrapped in bold tags. */
  boldWords: number
  /** Count of words wrapped in highlight/mark tags. */
  highlightedWords: number
}

/** Discriminated union of actions handled by editorSyncReducer. */
type EditorSyncAction =
  | {
    type: "sync_from_editor"
    html: string
    markdown: string
    hasChanges: boolean
  }
  | {
    type: "set_has_changes"
    hasChanges: boolean
  }

const initialEditorSyncState: EditorSyncState = {
  currentHtml: "",
  pendingMarkdown: "",
  hasChanges: false,
  totalWords: 0,
  boldWords: 0,
  highlightedWords: 0,
}

/**
 * Reducer for EditorSyncState that handles content synchronisation actions.
 * @param state - Current synchronisation state.
 * @param action - Action describing the state transition.
 * @returns Updated synchronisation state.
 */
function editorSyncReducer(state: EditorSyncState, action: EditorSyncAction): EditorSyncState {
  switch (action.type) {
    case "sync_from_editor":
      return {
        currentHtml: action.html,
        pendingMarkdown: action.markdown,
        hasChanges: action.hasChanges,
        totalWords: countWords(action.markdown),
        boldWords: countWordsInTag(action.html, "strong") + countWordsInTag(action.html, "b"),
        highlightedWords: countWordsInTag(action.html, "mark"),
      }
    case "set_has_changes":
      return {
        ...state,
        hasChanges: action.hasChanges,
      }
    default:
      return state
  }
}

/**
 * Counts the number of whitespace-separated words in a plain-text string.
 * @param text - Input string to count words in.
 * @returns Number of words found.
 */
function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

/**
 * Counts the words contained within a specific HTML tag throughout a document.
 * @param html - Raw HTML string to search.
 * @param tag - Tag name to match (e.g. "strong", "mark").
 * @returns Total word count across all matching tag instances.
 */
function countWordsInTag(html: string, tag: string): number {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "gi")
  const matches = html.match(regex) || []
  return countWords(matches.map((m) => m.replace(/<[^>]*>/g, "")).join(" "))
}

/**
 * Lexical plugin that exposes the editor instance to a parent component.
 * @param onReady - Callback invoked with the editor instance once mounted.
 */
function EditorRefPlugin({ onReady }: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    onReady(editor)
  }, [editor, onReady])

  return null
}

/**
 * Generic icon button used inside the inline Lexical toolbar.
 * @param onClick - Click handler for the button.
 * @param title - Tooltip / accessible title text.
 * @param children - Icon or other content rendered inside the button.
 */
function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        // Keep editor selection active so Lexical formatting commands apply to current range.
        e.preventDefault()
      }}
      onClick={onClick}
      title={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-background hover:bg-accent"
    >
      {children}
    </button>
  )
}

/** Inline formatting toolbar rendered within the Lexical composer context. */
function LexicalToolbar() {
  const [editor] = useLexicalComposerContext()

  return (
    <div className="border-b bg-muted/30  flex items-center flex-wrap">
      <ToolbarButton onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} title="Undo">
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} title="Redo">
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} title="Bold">
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} title="Italic">
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")} title="Underline">
        <Underline className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")} title="Strike">
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "code")} title="Inline code">
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined)} title="Bullet list">
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined)} title="Ordered list">
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined)} title="Remove list">
        <List className="h-4 w-4" />
      </ToolbarButton>
    </div>
  )
}

/**
 * Replaces the entire content of a Lexical editor with the provided HTML string.
 * @param editor - The Lexical editor instance to update.
 * @param html - HTML markup to parse and set as the new editor content.
 */
function setEditorHtml(editor: LexicalEditor, html: string) {
  editor.update(() => {
    const parser = new DOMParser()
    const dom = parser.parseFromString(html || "<p></p>", "text/html")
    const nodes = $generateNodesFromDOM(editor, dom)
    const root = $getRoot()
    root.clear()
    if (nodes.length > 0) {
      root.append(...nodes)
    }
  })
}

/**
 * Full-featured markdown editor built on Lexical with auto-save, unsaved-change
 * tracking, and multiple view modes. Memoised to prevent unnecessary re-renders.
 * @param content - Current markdown content.
 * @param originalContent - Baseline content for change detection.
 * @param hasUnsavedChanges - Externally controlled unsaved flag.
 * @param onUnsavedChange - Notified when unsaved status changes.
 * @param onChange - Emits the latest markdown on a debounced interval.
 * @param onSave - Triggered on explicit save.
 * @param onDiscard - Triggered when the user discards changes.
 * @param readOnly - Renders a static view when true.
 * @param className - Extra classes on the root element.
 * @param placeholder - Empty-state hint text.
 * @param showToolbar - Whether to mount the formatting toolbar.
 * @param fileName - Document identifier forwarded to plugins.
 * @param hideToolbarActions - Hides save/discard buttons.
 * @param onEditorReady - Receives imperative controls once the editor mounts.
 * @param sandboxId - Sandbox identifier forwarded to toolbar.
 * @param autoSaveInterval - Debounce delay for onChange in ms.
 * @param localStorageKey - localStorage key for draft persistence.
 * @param viewMode - Active rendering mode.
 */
export const MarkdownEditor = memo(function MarkdownEditor({
  content,
  originalContent,
  hasUnsavedChanges: externalHasUnsaved,
  onUnsavedChange,
  onChange,
  onSave,
  onDiscard,
  readOnly = false,
  className,
  placeholder = "Start writing...",
  showToolbar = true,
  fileName = "document.md",
  hideToolbarActions = false,
  onEditorReady,
  sandboxId,
  autoSaveInterval = 5000,
  localStorageKey,
  viewMode = "read",
}: MarkdownEditorProps) {
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle")
  const [editorInstance, setEditorInstance] = useState<LexicalEditor | null>(null)
  const [editorSyncState, dispatchEditorSync] = useReducer(editorSyncReducer, {
    ...initialEditorSyncState,
    pendingMarkdown: content,
  })

  const savedContent = useRef<string>(originalContent ?? content)
  const normalizedContent = useRef<string | null>(null)
  const lastSavedContent = useRef<string>(originalContent ?? content)
  const prevContentProp = useRef<string>(content)
  const isInitializing = useRef<boolean>(true)
  const suppressOnChangeRef = useRef(false)
  const currentHtmlRef = useRef("")
  const latestMarkdownRef = useRef<string>(content)
  const lastEmittedMarkdownRef = useRef<string>(content)

  /**
   * Converts an HTML string to markdown using TurndownService.
   * @param html - HTML markup to convert.
   * @returns Markdown string, or empty string on failure.
   */
  const htmlToMarkdown = useCallback((html: string): string => {
    try {
      return turndownService.turndown(html)
    } catch (e) {
      console.error("Failed to convert HTML to markdown:", e)
      return ""
    }
  }, [])

  useEffect(() => {
    if (originalContent !== undefined) {
      savedContent.current = originalContent
    }
  }, [originalContent])

  useEffect(() => {
    onUnsavedChange?.(editorSyncState.hasChanges)
  }, [editorSyncState.hasChanges, onUnsavedChange])

  /**
   * Persists the current editor content by invoking onSave and updating internal
   * saved-content references.
   */
  const handleSave = useCallback(async () => {
    if (!onSave || !editorInstance) return

    const markdown = latestMarkdownRef.current
    if (markdown === savedContent.current) return

    try {
      setSaveState("saving")
      await onSave()
      savedContent.current = markdown
      normalizedContent.current = markdown
      dispatchEditorSync({ type: "set_has_changes", hasChanges: false })
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    } catch (error) {
      console.error("Save error:", error)
      setSaveState("error")
      setTimeout(() => setSaveState("idle"), 3000)
    }
  }, [editorInstance, htmlToMarkdown, onSave])

  /**
   * Reverts the editor to the last saved content and notifies onChange and onDiscard.
   */
  const handleDiscard = useCallback(() => {
    if (!editorInstance) return

    const newHtml = marked.parse(savedContent.current || "", { async: false }) as string
    suppressOnChangeRef.current = true
    setEditorHtml(editorInstance, newHtml)
    currentHtmlRef.current = newHtml
    latestMarkdownRef.current = savedContent.current
    lastEmittedMarkdownRef.current = savedContent.current
    dispatchEditorSync({
      type: "sync_from_editor",
      html: newHtml,
      markdown: savedContent.current,
      hasChanges: false,
    })
    normalizedContent.current = htmlToMarkdown(newHtml)

    if (onChange) {
      onChange(savedContent.current)
    }
    onDiscard?.()

    queueMicrotask(() => {
      suppressOnChangeRef.current = false
    })
  }, [editorInstance, htmlToMarkdown, onChange, onDiscard])

  useEffect(() => {
    if (!onChange || readOnly) return

    const syncIntervalMs = Math.max(autoSaveInterval, 1000)
    const intervalId = window.setInterval(() => {
      const markdown = latestMarkdownRef.current
      if (markdown === lastEmittedMarkdownRef.current) return

      onChange(markdown)
      lastEmittedMarkdownRef.current = markdown

      if (localStorageKey) {
        localStorage.setItem(localStorageKey, markdown)
      }
    }, syncIntervalMs)

    return () => window.clearInterval(intervalId)
  }, [autoSaveInterval, localStorageKey, onChange, readOnly])

  useEffect(() => {
    if (!editorInstance) return

    const isNewDocument = content !== prevContentProp.current
    if (!isNewDocument) return

    prevContentProp.current = content

    // Parent prop can be an echo of our local interval sync; avoid re-hydrating editor in that case.
    if (content === latestMarkdownRef.current) {
      savedContent.current = content
      lastSavedContent.current = content
      dispatchEditorSync({ type: "set_has_changes", hasChanges: false })
      return
    }

    const newHtml = marked.parse(content || "", { async: false }) as string
    suppressOnChangeRef.current = true
    setEditorHtml(editorInstance, newHtml)
    currentHtmlRef.current = newHtml
    latestMarkdownRef.current = content
    lastEmittedMarkdownRef.current = content
    dispatchEditorSync({
      type: "sync_from_editor",
      html: newHtml,
      markdown: content,
      hasChanges: false,
    })
    savedContent.current = content
    lastSavedContent.current = content
    normalizedContent.current = null
    isInitializing.current = true

    queueMicrotask(() => {
      suppressOnChangeRef.current = false
    })
  }, [content, editorInstance])

  useEffect(() => {
    if (!onEditorReady) return

    if (editorInstance) {
      onEditorReady({
        getHtml: () => currentHtmlRef.current,
        save: handleSave,
        saveState,
        hasChanges: editorSyncState.hasChanges,
      })
      return
    }

    onEditorReady(null)
  }, [editorInstance, editorSyncState.hasChanges, handleSave, onEditorReady, saveState])

  useEffect(() => {
    if (!editorInstance) return

    const editorState = editorInstance.getEditorState()
    let html = ""
    let markdown = ""
    editorState.read(() => {
      html = $generateHtmlFromNodes(editorInstance, null)
      markdown = $convertToMarkdownString(TRANSFORMERS)
    })

    currentHtmlRef.current = html
    latestMarkdownRef.current = markdown
    dispatchEditorSync({
      type: "sync_from_editor",
      html,
      markdown,
      hasChanges: false,
    })
  }, [editorInstance])

  if (readOnly) {
    return (
      <div className={cn("flex flex-col h-full overflow-hidden bg-background", className)}>
        <div className="flex-1 overflow-auto p-6">
          <UnifiedMarkdown content={content} />
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex flex-col h-full", className)}>
      <LexicalComposer
        initialConfig={{
          namespace: "DebateMarkdownEditor",
          editable: !readOnly,
          onError: (error: Error) => console.error(error),
          nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode, CodeHighlightNode],
          editorState: () => {
            $convertFromMarkdownString(content || "", TRANSFORMERS)
          },
        }}
      >
        <EditorRefPlugin onReady={setEditorInstance} />
        {showToolbar && <LexicalToolbar />}
        <OnChangePlugin
          ignoreSelectionChange
          onChange={(editorState: any, editor: LexicalEditor) => {
            if (suppressOnChangeRef.current) return

            let html = ""
            let markdown = ""

            editorState.read(() => {
              html = $generateHtmlFromNodes(editor, null)
              markdown = $convertToMarkdownString(TRANSFORMERS)
            })

            currentHtmlRef.current = html
            latestMarkdownRef.current = markdown

            if (!isInitializing.current) {
              dispatchEditorSync({
                type: "sync_from_editor",
                html,
                markdown,
                hasChanges: markdown !== savedContent.current,
              })
            } else {
              isInitializing.current = false
              normalizedContent.current = markdown
              dispatchEditorSync({
                type: "sync_from_editor",
                html,
                markdown,
                hasChanges: false,
              })
            }
          }}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />

        <LexicalQuotesPlugin
          fileName={fileName}
          active={viewMode === "quotes"}
          viewMode={viewMode}
        />

        <div className="flex-1 overflow-auto" style={{ display: viewMode === "quotes" ? "none" : undefined }}>
          <div className={cn("mx-auto px-6 pb-12 max-w-4xl", `mode-${viewMode}`)}>
            {viewMode === "quotes" ? (
              <QuoteView html={editorSyncState.currentHtml} fileName={fileName} active={true} />
            ) : (
              <div
                className={cn(
                  "tiptap-editor editor pt-6 relative min-h-[300px]",
                  viewMode === "highlighted" && "highlighted",
                  viewMode === "underlined" && "underlined",
                  viewMode === "headings" && "headings",
                )}
              >
                <RichTextPlugin
                  contentEditable={
                    <ContentEditable
                      className={cn(
                        "min-h-[300px] outline-none prose prose-sm max-w-none focus:outline-none",
                        viewMode !== "read" && viewMode,
                      )}
                    />
                  }
                  placeholder={<div className="text-muted-foreground/50">{placeholder}</div>}
                  ErrorBoundary={LexicalErrorBoundary}
                />
              </div>
            )}
          </div>
        </div>
      </LexicalComposer>

      <div className="border-t bg-muted/30 px-4 py-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="tabular-nums">{editorSyncState.totalWords} words</span>
        <span className="tabular-nums">{editorSyncState.boldWords} bold</span>
        <span className="tabular-nums">{editorSyncState.highlightedWords} highlighted</span>
      </div>
    </div>
  )
})
