"use client"

import { useEffect, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $generateHtmlFromNodes } from "@lexical/html"
import { QuoteView } from "./QuoteView"

interface LexicalQuotesPluginProps {
  fileName?: string
  active?: boolean
  viewMode?: "read" | "highlighted" | "underlined" | "headings" | "h1-only" | "h2-only" | "h3-only" | "summaries-only"
}

/**
 * LexicalQuotesPlugin - A Lexical plugin that renders editor content as quote cards.
 *
 * When active, this plugin reads the current editor content, converts it to HTML,
 * and renders it through the QuoteView component which parses the HTML into
 * structured quote cards with metadata (author, year, citation, etc.).
 *
 * Usage:
 * ```tsx
 * <LexicalComposer initialConfig={config}>
 *   <RichTextPlugin ... />
 *   <LexicalQuotesPlugin fileName="evidence.md" active={showQuotes} />
 * </LexicalComposer>
 * ```
 */
export function LexicalQuotesPlugin({
  fileName,
  active = true,
  viewMode = "read",
}: LexicalQuotesPluginProps) {
  const [editor] = useLexicalComposerContext()
  const [html, setHtml] = useState("")

  useEffect(() => {
    if (!active) return

    // Get initial HTML
    const editorState = editor.getEditorState()
    editorState.read(() => {
      setHtml($generateHtmlFromNodes(editor, null))
    })

    // Subscribe to updates
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        setHtml($generateHtmlFromNodes(editor, null))
      })
    })
  }, [editor, active])

  if (!active) return null

  return <QuoteView html={html} fileName={fileName} active={active} viewMode={viewMode} />
}
