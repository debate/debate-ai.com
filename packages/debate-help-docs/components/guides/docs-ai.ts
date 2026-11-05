/**
 * @file docs-ai.ts
 * @description The model behind "Suggest questions" and reading mode's Ask on
 * the Synergy Slayer pages: the site's `/api/reason-ai` (signed-in users,
 * metered by plan). The prompts are shared with the browser extension's
 * reading mode through `@debate-ai/reading-mode`.
 */
import type { Generate } from "@debate-ai/reading-mode/questions"
import { collectVoiceBlocks } from "./voice-read-text"

/** Thrown when the reader has to sign in before the AI can answer. */
export class SignInRequiredError extends Error {
  constructor() {
    super("Sign in to Debate AI to get suggested questions and answers.")
    this.name = "SignInRequiredError"
  }
}

/** Runs one prompt through `/api/reason-ai`. */
export const generateWithSite: Generate = async ({ system, prompt, maxTokens, signal }) => {
  const response = await fetch("/api/reason-ai", {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ system, messages: [{ role: "user", content: prompt }], maxTokens }),
    signal,
  })
  if (response.status === 401) throw new SignInRequiredError()
  const payload = (await response.json().catch(() => ({}))) as { text?: unknown; error?: unknown }
  if (!response.ok) {
    throw new Error(typeof payload.error === "string" ? payload.error : `The AI request failed (${response.status}).`)
  }
  return typeof payload.text === "string" ? payload.text : ""
}

/** The readable text under `root` (figures skipped), one passage per paragraph. */
export function readableText(root: Element | null): string {
  if (!root) return ""
  return collectVoiceBlocks(root)
    .map((block) => block.text)
    .join("\n\n")
}
