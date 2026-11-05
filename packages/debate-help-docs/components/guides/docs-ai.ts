/**
 * @file docs-ai.ts
 * @description The model behind "Suggest questions" and reading mode's Ask on
 * the Synergy Slayer pages. It calls the AI endpoint of whatever site is
 * hosting the docs, with a relative URL, so it is never tied to Debate AI's
 * own API or account: on debate-ai.com that is `/api/reason-ai`, which serves
 * these free requests to signed-out visitors too (metered per IP). A site that
 * mounts the docs somewhere else points it at its own prompt or quick-search
 * endpoint with `configureDocsAi`, or the `<meta name="docs-ai-endpoint">` tag.
 * The prompts are shared with the browser extension's reading mode through
 * `@debate-ai/reading-mode`.
 */
import type { Generate } from "@debate-ai/reading-mode/questions"
import { collectVoiceBlocks } from "./voice-read-text"

/** The hosting site's AI endpoint when nothing else is configured. */
export const DEFAULT_DOCS_AI_ENDPOINT = "/api/reason-ai"
/** A `<meta>` tag a hosting site can set to name its own endpoint. */
export const DOCS_AI_ENDPOINT_META = "docs-ai-endpoint"

let configuredEndpoint: string | null = null

/**
 * Points Suggest questions and Ask at the hosting site's own AI endpoint
 * (a same-origin path such as `/api/ask`). `null` restores the default.
 */
export function configureDocsAi(options: { endpoint: string | null }): void {
  configuredEndpoint = options.endpoint?.trim() || null
}

/** The endpoint requests go to: configured, then the page's meta tag, then the default. */
export function docsAiEndpoint(): string {
  if (configuredEndpoint) return configuredEndpoint
  if (typeof document !== "undefined") {
    const meta = document.querySelector<HTMLMetaElement>(`meta[name="${DOCS_AI_ENDPOINT_META}"]`)?.content?.trim()
    if (meta) return meta
  }
  return DEFAULT_DOCS_AI_ENDPOINT
}

/** Thrown when the hosting site's endpoint needs the reader to sign in first. */
export class SignInRequiredError extends Error {
  constructor() {
    super("Sign in to this site to get suggested questions and answers.")
    this.name = "SignInRequiredError"
  }
}

/**
 * The answer text in an endpoint's reply. `/api/reason-ai` answers
 * `{ text }`; other sites' prompt and search endpoints commonly use `answer`,
 * `content`, `response` or `message`, or reply with plain text.
 */
export function replyText(payload: unknown): string {
  if (typeof payload === "string") return payload
  if (!payload || typeof payload !== "object") return ""
  const record = payload as Record<string, unknown>
  for (const field of ["text", "answer", "content", "response", "message", "output"]) {
    const value = record[field]
    if (typeof value === "string") return value
  }
  return ""
}

/**
 * Runs one prompt through the hosting site's AI endpoint. The body carries
 * both the chat shape `/api/reason-ai` reads (`system`, `messages`) and a
 * plain `prompt`/`query` for simpler endpoints, and `allowGuest` so a
 * signed-out reader is answered on the free models instead of being sent to
 * sign in (signed-in readers keep their plan's model).
 */
export const generateWithSite: Generate = async ({ system, prompt, maxTokens, signal }) => {
  const response = await fetch(docsAiEndpoint(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      system,
      messages: [{ role: "user", content: prompt }],
      prompt,
      query: prompt,
      maxTokens,
      allowGuest: true,
    }),
    signal,
  })
  if (response.status === 401) throw new SignInRequiredError()
  const raw = await response.text().catch(() => "")
  let payload: unknown = raw
  try {
    payload = JSON.parse(raw)
  } catch {
    // A plain-text reply: use it as is.
  }
  if (!response.ok) {
    const error = payload && typeof payload === "object" ? (payload as { error?: unknown }).error : undefined
    throw new Error(typeof error === "string" ? error : `The AI request failed (${response.status}).`)
  }
  return replyText(payload)
}

/** The readable text under `root` (figures skipped), one passage per paragraph. */
export function readableText(root: Element | null): string {
  if (!root) return ""
  return collectVoiceBlocks(root)
    .map((block) => block.text)
    .join("\n\n")
}
