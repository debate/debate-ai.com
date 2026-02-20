"use client"

import { useEffect, useState } from "react"
import { EditorContent, useEditor } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import StarterKit from "@tiptap/starter-kit"
import Underline from "@tiptap/extension-underline"
import { TextStyle } from "@tiptap/extension-text-style"
import { Color } from "@tiptap/extension-color"
import Highlight from "@tiptap/extension-highlight"
import Strike from "@tiptap/extension-strike"
import Document from "@tiptap/extension-document"
import Paragraph from "@tiptap/extension-paragraph"
import Text from "@tiptap/extension-text"
import { MarkdownToolbar } from "./markdown-toolbar"
import { Button } from "@/components/ui/button"
import { Edit, Eye, ChevronDown, ChevronRight } from "lucide-react"
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

  const editor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      StarterKit.configure({
        document: false,
        paragraph: false,
        text: false,
        heading: false,
        strike: false,
      }) as any,
      Underline,
      Strike,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: html,
    editable: isEditing,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (onUpdate && isEditing) {
        const newHtml = editor.getHTML()
        onUpdate(cardId, newHtml)
      }
    },
  })

  const summaryEditor = useEditor({
    extensions: [
      Document,
      Paragraph,
      Text,
      StarterKit.configure({
        document: false,
        paragraph: false,
        text: false,
        heading: false,
        strike: false,
      }) as any,
      Underline,
      Strike,
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
    ],
    content: summary,
    editable: isEditing,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      if (isEditing) {
        setSummaryText(editor.getText())
      }
    },
  })

  useEffect(() => {
    if (editor) {
      editor.setEditable(isEditing)
    }
    if (summaryEditor) {
      summaryEditor.setEditable(isEditing)
    }
  }, [isEditing, editor, summaryEditor])

  function handleToggleEdit() {
    setIsEditing(!isEditing)
  }

  function handleToggleKeyPoints() {
    setShowKeyPoints(!showKeyPoints)
  }

  function handleToggleCollapse() {
    setIsCollapsed(!isCollapsed)
  }

  async function handleCopyCard() {
    const body = editor?.getHTML() || html
    const textParts: string[] = []
    if (summary) textParts.push(summary)
    if (body) {
      // Strip HTML tags for plain text copy
      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = body
      textParts.push(tempDiv.textContent || "")
    }

    const text = textParts.join("\n\n").trim()

    try {
      await navigator.clipboard.writeText(text)
    } catch (e) {
      console.error("Copy failed", e)
      alert("Failed to copy to clipboard. Please try again.")
    }
  }

  function handleAiAnalyze() {
    const payload = {
      summary,
      author,
      year,
      cite,
      url,
      html: editor?.getHTML() || html,
      words,
    }
    console.log("AI analyze card requested:", payload)
  }

  return (
    <section className={cn("quote-card", showKeyPoints && "key-points-mode")} data-quote-id={cardId}>
      <div className="quote-card-toolbar">
        <button
          type="button"
          onClick={handleToggleEdit}
          className="quote-card-btn toggle-edit-btn"
          title={isEditing ? "View mode" : "Edit mode"}
        >
          {isEditing ? <><Eye className="h-3 w-3" /> View</> : <><Edit className="h-3 w-3" /> Edit</>}
        </button>
        <button
          type="button"
          onClick={handleToggleKeyPoints}
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
        className="tiptap-fancy-blockquote"
        data-type="custom-blockquote"
        data-summary={summary}
        data-author={author || ""}
        data-year={year || ""}
        data-cite={cite || ""}
        data-url={url || ""}
        data-words={words}
        data-bold-words={boldWords}
        data-highlighted-words={highlightedWords}
      >
        <header className="quote-card-header">
          {summaryEditor && isEditing && (
            <BubbleMenu
              editor={summaryEditor}
              shouldShow={({ editor, view, state }) => {
                const { selection } = state
                return selection && !selection.empty && selection.from !== selection.to
              }}
            >
              <div className="flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg p-1">
                <MarkdownToolbar
                  editor={summaryEditor}
                  saveState="idle"
                  hideActions={true}
                  isBubbleMenu={true}
                />
              </div>
            </BubbleMenu>
          )}
          <div className="flex items-start gap-2">
            <button
              type="button"
              onClick={handleToggleCollapse}
              className="quote-collapse-btn"
              title={isCollapsed ? "Expand card" : "Collapse card"}
            >
              {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
            <div className="flex-1">
              <h4 className={cn(
                "quote-summary",
                isEditing && "editable-quote-summary",
                viewMode !== "read" && viewMode
              )}>
                {isEditing && summaryEditor ? (
                  <EditorContent editor={summaryEditor} />
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
            <div className={cn(
              "quote-body",
              isEditing && "editable-quote-body",
              viewMode !== "read" && viewMode
            )}>
              {editor && isEditing && (
                <BubbleMenu
                  editor={editor}
                  shouldShow={({ editor, view, state }) => {
                    const { selection } = state
                    return selection && !selection.empty && selection.from !== selection.to
                  }}
                >
                  <div className="flex items-center gap-1 bg-background border border-border rounded-lg shadow-lg p-1">
                    <MarkdownToolbar
                      editor={editor}
                      saveState="idle"
                      hideActions={true}
                      isBubbleMenu={true}
                    />
                  </div>
                </BubbleMenu>
              )}

              {editor ? (
                <EditorContent editor={editor} />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: html }} />
              )}
            </div>

            <footer className={cn(
              "quote-footer",
              viewMode !== "read" && viewMode
            )}>
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
