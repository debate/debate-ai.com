"use client"

import { useCallback, useEffect, useState } from "react"
import { LexicalComposer } from "@lexical/react/LexicalComposer"
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin"
import { ContentEditable } from "@lexical/react/LexicalContentEditable"
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin"
import { ListPlugin } from "@lexical/react/LexicalListPlugin"
import { LinkPlugin } from "@lexical/react/LexicalLinkPlugin"
import { OnChangePlugin } from "@lexical/react/LexicalOnChangePlugin"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { LexicalErrorBoundary } from "@lexical/react/LexicalErrorBoundary"
import { HeadingNode, QuoteNode } from "@lexical/rich-text"
import { ListItemNode, ListNode } from "@lexical/list"
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
import { Edit, Eye, ChevronDown, ChevronRight, Bold, Italic, Underline, Strikethrough, Undo2, Redo2 } from "lucide-react"
import { cn } from "@/lib/utils"

interface EditableQuoteCardProps {
  cardId: string
  summary: string
  author: string | null
  year: string | null
  cite: string | null
  url: string | null
  html: string
  words: number
  boldWords: number
  highlightedWords: number
  onUpdate?: (cardId: string, html: string) => void
  viewMode?: "read" | "highlighted" | "underlined" | "headings" | "h1-only" | "h2-only" | "h3-only" | "summaries-only"
}

function HtmlInitializerPlugin({ html }: { html: string }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
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
  }, [editor, html])

  return null
}

function EditablePlugin({ editable }: { editable: boolean }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    editor.setEditable(editable)
  }, [editor, editable])

  return null
}

function CardToolbar({ editor }: { editor: LexicalEditor }) {
  return (
    <div className="flex items-center gap-1 mb-2 flex-wrap">
      <button type="button" className="quote-card-btn" onClick={() => editor.dispatchCommand(UNDO_COMMAND, undefined)} title="Undo">
        <Undo2 className="h-3 w-3" />
      </button>
      <button type="button" className="quote-card-btn" onClick={() => editor.dispatchCommand(REDO_COMMAND, undefined)} title="Redo">
        <Redo2 className="h-3 w-3" />
      </button>
      <button type="button" className="quote-card-btn" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "bold")} title="Bold">
        <Bold className="h-3 w-3" />
      </button>
      <button type="button" className="quote-card-btn" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "italic")} title="Italic">
        <Italic className="h-3 w-3" />
      </button>
      <button type="button" className="quote-card-btn" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "underline")} title="Underline">
        <Underline className="h-3 w-3" />
      </button>
      <button type="button" className="quote-card-btn" onClick={() => editor.dispatchCommand(FORMAT_TEXT_COMMAND, "strikethrough")} title="Strike">
        <Strikethrough className="h-3 w-3" />
      </button>
    </div>
  )
}

function QuoteBodyEditor({
  html,
  editable,
  className,
  onChange,
}: {
  html: string
  editable: boolean
  className?: string
  onChange?: (nextHtml: string) => void
}) {
  const [editorRef, setEditorRef] = useState<LexicalEditor | null>(null)

  return (
    <LexicalComposer
      initialConfig={{
        namespace: "QuoteCardEditor",
        editable,
        onError: (error) => console.error(error),
        nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, LinkNode, CodeNode, CodeHighlightNode],
      }}
    >
      <EditorRefPlugin onReady={setEditorRef} />
      <HtmlInitializerPlugin html={html} />
      <EditablePlugin editable={editable} />
      {editable && editorRef && <CardToolbar editor={editorRef} />}
      <RichTextPlugin
        contentEditable={<ContentEditable className={cn("min-h-[120px] outline-none", className)} />}
        placeholder={<div className="text-muted-foreground/50">Quote body...</div>}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <HistoryPlugin />
      <ListPlugin />
      <LinkPlugin />
      <OnChangePlugin
        ignoreSelectionChange
        onChange={(editorState: any, editor: LexicalEditor) => {
          if (!editable || !onChange) return
          let nextHtml = ""
          editorState.read(() => {
            nextHtml = $generateHtmlFromNodes(editor, null)
          })
          onChange(nextHtml)
        }}
      />
    </LexicalComposer>
  )
}

function EditorRefPlugin({ onReady }: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext()

  useEffect(() => {
    onReady(editor)
  }, [editor, onReady])

  return null
}

export function EditableQuoteCard({
  cardId,
  summary,
  author,
  year,
  cite,
  url,
  html,
  words,
  boldWords,
  highlightedWords,
  onUpdate,
  viewMode = "read",
}: EditableQuoteCardProps) {
  const [isEditing, setIsEditing] = useState(true)
  const [showKeyPoints, setShowKeyPoints] = useState(false)
  const [summaryText, setSummaryText] = useState(summary)
  const [isCollapsed, setIsCollapsed] = useState(true)

  const handleCopyCard = useCallback(async () => {
    const textParts: string[] = []
    if (summaryText) textParts.push(summaryText)

    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = html
    textParts.push(tempDiv.textContent || "")

    const text = textParts.join("\n\n").trim()

    try {
      await navigator.clipboard.writeText(text)
    } catch (e) {
      console.error("Copy failed", e)
      alert("Failed to copy to clipboard. Please try again.")
    }
  }, [summaryText, html])

  function handleAiAnalyze() {
    const payload = {
      summary: summaryText,
      author,
      year,
      cite,
      url,
      html,
      words,
    }
    console.log("AI analyze card requested:", payload)
  }

  return (
    <section className={cn("quote-card", showKeyPoints && "key-points-mode")} data-quote-id={cardId}>
      <div className="quote-card-toolbar">
        <button
          type="button"
          onClick={() => setIsEditing((v) => !v)}
          className="quote-card-btn toggle-edit-btn"
          title={isEditing ? "View mode" : "Edit mode"}
        >
          {isEditing ? (
            <>
              <Eye className="h-3 w-3" /> View
            </>
          ) : (
            <>
              <Edit className="h-3 w-3" /> Edit
            </>
          )}
        </button>
        <button
          type="button"
          onClick={() => setShowKeyPoints((v) => !v)}
          className="quote-card-btn toggle-key-points-btn"
          title="Show only bold and highlighted text"
        >
          {showKeyPoints ? "📄 Full View" : "⚡ Key Points"}
        </button>
        <button type="button" onClick={handleCopyCard} className="quote-card-btn copy-btn" title="Copy card to clipboard">
          📋 Copy
        </button>
        <button type="button" onClick={handleAiAnalyze} className="quote-card-btn ai-btn" title="Analyze with AI">
          🤖 AI analyze
        </button>
      </div>

      <blockquote
        className="lexical-fancy-blockquote"
        data-type="custom-blockquote"
        data-summary={summaryText}
        data-author={author || ""}
        data-year={year || ""}
        data-cite={cite || ""}
        data-url={url || ""}
        data-words={words}
        data-bold-words={boldWords}
        data-highlighted-words={highlightedWords}
      >
        <header className="quote-card-header">
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={() => setIsCollapsed((v) => !v)}
              className="quote-collapse-btn"
              title={isCollapsed ? "Expand card" : "Collapse card"}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div className="flex-1">
              <h4 className={cn("quote-summary", isEditing && "editable-quote-summary", viewMode !== "read" && viewMode)}>
                {isEditing ? (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    className="outline-none"
                    onInput={(e) => setSummaryText(e.currentTarget.textContent || "")}
                  >
                    {summaryText}
                  </div>
                ) : (
                  summaryText
                )}
              </h4>
              {(author || year) && (
                <div className="quote-meta">
                  {author && <span className="quote-author">{author}</span>}
                  {year && <span className="quote-year">{year}</span>}
                  {!isCollapsed && cite && cite !== author && <span className="quote-cite">{cite}</span>}
                </div>
              )}
            </div>
          </div>
        </header>

        {!isCollapsed && (
          <>
            <div className={cn("quote-body", isEditing && "editable-quote-body", viewMode !== "read" && viewMode)}>
              <QuoteBodyEditor
                html={html}
                editable={isEditing}
                onChange={(nextHtml) => onUpdate?.(cardId, nextHtml)}
                className={cn("quote-body-editor", viewMode !== "read" && viewMode)}
              />
            </div>

            <footer className={cn("quote-footer", viewMode !== "read" && viewMode)}>
              <div className="quote-stats">
                <span className="quote-stat-item">{words} read</span>
                <span className="quote-stat-separator">•</span>
                <span className="quote-stat-item">{highlightedWords} highlighted</span>
                <span className="quote-stat-separator">•</span>
                <span className="quote-stat-item">{boldWords} bold</span>
              </div>
              {url && (
                <a href={url} target="_blank" rel="noopener noreferrer" className="quote-link">
                  🔗 Source
                </a>
              )}
            </footer>
          </>
        )}
      </blockquote>
    </section>
  )
}
