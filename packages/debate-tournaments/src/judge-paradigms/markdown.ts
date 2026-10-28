/**
 * @fileoverview Renders a paradigm written in the editor's Markdown to HTML.
 *
 * Raw HTML in the Markdown is escaped rather than passed through, so the
 * editor's preview is safe on its own; the server still runs the result
 * through `sanitizeParadigmHtml` before storing it, the same as Tabroom's.
 *
 * @module debate-tournaments/judge-paradigms/markdown
 */

import { Marked } from "marked";

const escapeHtml = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

const paradigmMarked = new Marked({
  gfm: true,
  breaks: true,
  renderer: {
    html: (token) => escapeHtml(token.text),
  },
});

/** The paradigm's Markdown as HTML, raw HTML escaped. */
export function renderParadigmMarkdown(markdown: string): string {
  return (paradigmMarked.parse(markdown, { async: false }) as string).trim();
}
