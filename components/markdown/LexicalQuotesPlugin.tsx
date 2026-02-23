/**
 * @fileoverview Lexical plugin that mirrors the current editor HTML into the
 * QuoteView card renderer whenever the plugin is active.
 */

"use client"

import { useEffect, useState } from "react"
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext"
import { $generateHtmlFromNodes } from "@lexical/html"
import { QuoteView } from "./QuoteView"

/** Props for the LexicalQuotesPlugin component. */
interface LexicalQuotesPluginProps {
  /** Optional file name passed through to QuoteView for display purposes. */
  fileName?: string
  /** When false the plugin renders nothing and stops listening for updates. */
  active?: boolean
  /** Display mode forwarded to QuoteView for card rendering. */
  viewMode?: ViewMode
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
 * @param fileName - Optional file name shown inside QuoteView.
 * @param active - Whether the plugin is rendering quote cards.
 * @param viewMode - Card display mode forwarded to QuoteView.
 * @returns The QuoteView element when active, otherwise null.
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
