/**
 * @fileoverview Decodes a stored editor document row to the HTML a speech
 * doc holds.
 *
 * Rows from `documents` (`GET /api/doc/documents/:id`) and the public Topic
 * Starter library (`topic_starter_items`) both carry `content` plus a
 * `format`: `.cmir` rows are base64 CardMirror files, older rows are plain
 * HTML. The CardMirror engine is imported lazily so a page that never decodes
 * a `.cmir` never pulls it in.
 *
 * @module round/stored-document-html
 */

/** The fields of a stored document row this decoder reads. */
export type StoredDocument = { title?: string; content?: string | null; format?: string | null }

/** Decodes a stored row to HTML, handling both `.cmir` and legacy HTML rows. */
export async function storedDocumentHtml(doc: StoredDocument): Promise<string> {
  const content = doc.content ?? ""
  if (!content) return ""
  const engine = await import("@debate/editor/engine")
  const isCmir = doc.format === "cmir" || (doc.format !== "html" && engine.looksLikeCmirBase64(content))
  if (!isCmir) return content
  const { docToHtml } = await import("@debate/editor")
  return docToHtml(engine.parseNative(engine.base64ToCmir(content)).doc)
}
