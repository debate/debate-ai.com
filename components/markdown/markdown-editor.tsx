"use client"

import { memo, useCallback, useEffect, useRef, useState, type ReactNode } from "react"
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

export interface MarkdownEditorControls {
  getHtml: () => string
  save: () => void
  saveState: "idle" | "saving" | "saved" | "error"
  hasChanges: boolean
}

interface MarkdownEditorProps {
  content: string
  originalContent?: string
  hasUnsavedChanges?: boolean
  onUnsavedChange?: (hasChanges: boolean) => void
  onChange: (content: string) => void
  onSave?: () => void
  onDiscard?: () => void
  readOnly?: boolean
  className?: string
  placeholder?: string
  showToolbar?: boolean
  fileName?: string
  hideToolbarActions?: boolean
  onEditorReady?: (controls: MarkdownEditorControls | null) => void
  sandboxId?: string
  autoSaveInterval?: number
  localStorageKey?: string
  viewMode?: "read" | "highlighted" | "underlined" | "headings" | "quotes" | "h1-only" | "h2-only" | "h3-only" | "summaries-only"
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length
}

function countWordsInTag(html: string, tag: string): number {
  const regex = new RegExp(`<${tag}[^>]*>(.*?)<\/${tag}>`, "gi")
  const matches = html.match(regex) || []
  return countWords(matches.map((m) => m.replace(/<[^>]*>/g, "")).join(" "))
}

function EditorRefPlugin({ onReady }: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    onReady(editor)
  }, [editor, onReady])

  return null
}

function ToolbarButton({ onClick, title, children }: { onClick: () => void; title: string; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="inline-flex h-8 w-8 items-center justify-center rounded border border-border bg-background hover:bg-accent"
    >
      {children}
    </button>
  )
}

function LexicalToolbar() {
  const [editor] = useLexicalComposerContext()

  return (
    <div className="border-b bg-muted/30 px-3 py-2 flex items-center gap-2 flex-wrap">
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
  const [hasChanges, setHasChanges] = useState(false)
  const [currentHtml, setCurrentHtml] = useState<string>("")
  const [totalWords, setTotalWords] = useState(0)
  const [boldWords, setBoldWords] = useState(0)
  const [highlightedWords, setHighlightedWords] = useState(0)

  const savedContent = useRef<string>(originalContent ?? content)
  const normalizedContent = useRef<string | null>(null)
  const lastSavedContent = useRef<string>(originalContent ?? content)
  const prevContentProp = useRef<string>(content)
  const isInitializing = useRef<boolean>(true)
  const suppressOnChangeRef = useRef(false)
  const currentHtmlRef = useRef("")

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
    onUnsavedChange?.(hasChanges)
  }, [hasChanges, onUnsavedChange])

  const handleSave = useCallback(async () => {
    if (!onSave || !editorInstance) return

    const markdown = htmlToMarkdown(currentHtmlRef.current)
    if (markdown === savedContent.current) return

    try {
      setSaveState("saving")
      await onSave()
      savedContent.current = markdown
      normalizedContent.current = markdown
      setHasChanges(false)
      setSaveState("saved")
      setTimeout(() => setSaveState("idle"), 2000)
    } catch (error) {
      console.error("Save error:", error)
      setSaveState("error")
      setTimeout(() => setSaveState("idle"), 3000)
    }
  }, [editorInstance, htmlToMarkdown, onSave])

  const handleDiscard = useCallback(() => {
    if (!editorInstance) return

    const newHtml = marked.parse(savedContent.current || "", { async: false }) as string
    suppressOnChangeRef.current = true
    setEditorHtml(editorInstance, newHtml)
    currentHtmlRef.current = newHtml
    setCurrentHtml(newHtml)
    normalizedContent.current = htmlToMarkdown(newHtml)
    setHasChanges(false)

    if (onChange) {
      onChange(savedContent.current)
    }
    onDiscard?.()

    queueMicrotask(() => {
      suppressOnChangeRef.current = false
    })
  }, [editorInstance, htmlToMarkdown, onChange, onDiscard])

  useEffect(() => {
    if (!hasChanges || readOnly || !editorInstance) return

    const saveImmediately = async () => {
      const markdown = htmlToMarkdown(currentHtmlRef.current)
      if (markdown === lastSavedContent.current) return

      try {
        if (localStorageKey) {
          localStorage.setItem(localStorageKey, markdown)
        }

        if (onSave) {
          await onSave()
        }

        lastSavedContent.current = markdown
        savedContent.current = markdown
        normalizedContent.current = markdown
        setHasChanges(false)
      } catch (error) {
        console.error("Save error:", error)
        setSaveState("error")
        setTimeout(() => setSaveState("idle"), 3000)
      }
    }

    saveImmediately()
  }, [editorInstance, hasChanges, htmlToMarkdown, localStorageKey, onSave, readOnly])

  useEffect(() => {
    if (!editorInstance) return

    const isNewDocument = content !== prevContentProp.current
    if (!isNewDocument) return

    const newHtml = marked.parse(content || "", { async: false }) as string
    suppressOnChangeRef.current = true
    setEditorHtml(editorInstance, newHtml)
    currentHtmlRef.current = newHtml
    setCurrentHtml(newHtml)
    setHasChanges(false)
    savedContent.current = content
    lastSavedContent.current = content
    prevContentProp.current = content
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
        hasChanges,
      })
      return
    }

    onEditorReady(null)
  }, [editorInstance, handleSave, hasChanges, onEditorReady, saveState])

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
    setCurrentHtml(html)
    setTotalWords(countWords(markdown))
    setBoldWords(countWordsInTag(html, "strong") + countWordsInTag(html, "b"))
    setHighlightedWords(countWordsInTag(html, "mark"))
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
            setCurrentHtml(html)
            onChange(markdown)

            if (!isInitializing.current) {
              setHasChanges(markdown !== savedContent.current)
            } else {
              isInitializing.current = false
              normalizedContent.current = markdown
            }

            setTotalWords(countWords(markdown))
            setBoldWords(countWordsInTag(html, "strong") + countWordsInTag(html, "b"))
            setHighlightedWords(countWordsInTag(html, "mark"))
          }}
        />
        <HistoryPlugin />
        <ListPlugin />
        <LinkPlugin />
        <MarkdownShortcutPlugin transformers={TRANSFORMERS} />

        <div className="flex-1 overflow-auto">
          <div className={cn("mx-auto px-6 pb-12 max-w-4xl", `mode-${viewMode}`)}>
            {viewMode === "quotes" ? (
              <QuoteView html={currentHtml} fileName={fileName} active={true} />
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
        <span className="tabular-nums">{totalWords} words</span>
        <span className="tabular-nums">{boldWords} bold</span>
        <span className="tabular-nums">{highlightedWords} highlighted</span>
      </div>
    </div>
  )
})
