import { NextResponse } from "next/server"
import { and, eq } from "drizzle-orm"
import {
  FIND_FLAWS_AND_EXTENSIONS_PROMPT,
  MAX_ANALYSIS_CONTENT_CHARS,
  normalizeForHash,
  sha256Hex,
} from "debate-research-evidence"
import { getDBFromContext } from "@/lib/database/context"
import { cardAiAnalyses } from "@/lib/database/schema"
import { getSession } from "@/lib/auth/session"
import { getEnv } from "@/lib/env"
import { isMissingTableError } from "@/lib/contacts/server"

/**
 * Saved AI analyses for the evidence search's "AI Analysis" sidebar
 * (packages/debate-search-evidence, `useAiAnalysis`).
 *
 * POST { content, prompt, tag? } → `{ result, cached }`. Answers from
 * `card_ai_analyses` when this card text has already been analyzed with this
 * prompt; otherwise asks the model once, saves the answer, and returns it, so
 * every card ends up with a saved analysis that later readers reuse.
 *
 * Anyone may read a saved analysis and anyone may generate the default
 * find-flaws-and-extensions one (it is generated at most once per card and
 * then shared by everyone). A custom prompt costs a model call per new
 * prompt, so generating one requires a session.
 */

const ANTHROPIC_MODEL = "claude-sonnet-4-6"
const ANTHROPIC_VERSION = "2023-06-01"
const MAX_TOKENS = 1500
const MAX_PROMPT_CHARS = 4_000

interface AnalysisRequestBody {
  content?: unknown
  prompt?: unknown
  tag?: unknown
}

const error = (message: string, status: number) => NextResponse.json({ error: message }, { status })

export async function POST(request: Request) {
  let body: AnalysisRequestBody
  try {
    body = await request.json()
  } catch {
    return error("Invalid JSON body.", 400)
  }

  const content = typeof body.content === "string" ? body.content.slice(0, MAX_ANALYSIS_CONTENT_CHARS).trim() : ""
  const prompt =
    typeof body.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : FIND_FLAWS_AND_EXTENSIONS_PROMPT
  const tag = typeof body.tag === "string" ? body.tag.slice(0, 500) : null
  if (!content) return error("`content` must be the card text.", 400)
  if (prompt.length > MAX_PROMPT_CHARS) return error("Prompt is too long.", 413)

  const [cardHash, promptHash] = await Promise.all([sha256Hex(content), sha256Hex(prompt)])
  const db = await getDBFromContext()

  try {
    const [saved] = await db
      .select({ result: cardAiAnalyses.result })
      .from(cardAiAnalyses)
      .where(and(eq(cardAiAnalyses.cardHash, cardHash), eq(cardAiAnalyses.promptHash, promptHash)))
      .limit(1)
    if (saved) return NextResponse.json({ result: saved.result, cached: true })
  } catch (e) {
    // Before the migration lands, fall through to generating without saving.
    if (!isMissingTableError(e)) throw e
  }

  const isDefaultPrompt = normalizeForHash(prompt) === normalizeForHash(FIND_FLAWS_AND_EXTENSIONS_PROMPT)
  const session = await getSession()
  if (!isDefaultPrompt && !session) {
    return error("Sign in to run a custom AI prompt.", 401)
  }

  const apiKey = getEnv("ANTHROPIC_API_KEY")
  if (!apiKey) return error("AI features are not configured on this server.", 503)

  let res: Response
  try {
    res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: MAX_TOKENS,
        system: prompt,
        messages: [{ role: "user", content: `Evidence card:\n\n${content}` }],
      }),
    })
  } catch (e) {
    return error(`Network error contacting Anthropic: ${e instanceof Error ? e.message : String(e)}`, 502)
  }
  if (!res.ok) return error(`Anthropic API returned ${res.status}.`, 502)

  const json = (await res.json()) as { content?: Array<{ type?: string; text?: string }> }
  const result = (json.content ?? [])
    .filter((c) => c.type === "text")
    .map((c) => c.text ?? "")
    .join("")
    .trim()
  if (!result) return error("Anthropic returned an empty response.", 502)

  try {
    await db
      .insert(cardAiAnalyses)
      .values({ cardHash, promptHash, cardTag: tag, result, model: ANTHROPIC_MODEL, userId: session?.user.id ?? null })
      .onConflictDoNothing()
  } catch (e) {
    if (!isMissingTableError(e)) console.error("card-ai-analysis: failed to save analysis", e)
  }

  return NextResponse.json({ result, cached: false })
}
