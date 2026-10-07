/**
 * @fileoverview Batch LLM analysis helpers for card quality/warrant scoring.
 *
 * Browser-safe: this module is re-exported from the package entry, which the
 * web app's client bundle imports, so it must not touch `node:*` modules.
 * Reading an outline from disk or writing the result back lives in
 * `analyze-quotes.node.ts`, which is deliberately *not* re-exported.
 */
import * as ResearchAgent from "qwksearch-api-client"
import { log } from "grab-url"
import { findFlawsPrompt } from "../prompts/quote-to-find-flaws"

type Analysis = {
  summary?: string
  warrants?: string
  score?: number
  flaws?: string[]
}

type OutlineEntry = Record<string, unknown> & {
  html?: string
  summary?: string
  analysis?: Analysis | null
}

export type OutlineData = {
  outline?: OutlineEntry[]
  [key: string]: unknown
}

export type AnalyzeQuotesOptions = {
  limit?: number
  maxChars?: number
}

/**
 * Provider + model the flaw finder asks for, in qwksearch's
 * `ModelWithProvider` shape (`providerId` names the LIP, `key` the model).
 * Groq's Llama 4 Maverick is fast and cheap enough to run over a whole
 * outline; the endpoint falls back to the user's configured chat model if
 * this provider has no key.
 */
const FLAW_FINDER_MODEL = {
  providerId: "groq",
  key: "meta-llama/llama-4-maverick-17b-128e-instruct",
} as const

/**
 * Runs LLM-based analysis over parsed card entries that include HTML content.
 *
 * @param outlineData - Already-loaded outline object (mutated in place).
 * @param options - Processing limits.
 * @returns Outline data with per-card analysis attached.
 */
export async function analyzeQuotes(
  outlineData: OutlineData,
  options: AnalyzeQuotesOptions = {},
): Promise<OutlineData> {
  const { limit = 10, maxChars = 4000 } = options

  const outline = Array.isArray(outlineData.outline) ? outlineData.outline : []
  let processed = 0
  const totalCards = outline.filter((t) => Boolean(t?.html)).length

  console.log(`Found ${totalCards} cards with HTML content`)
  console.log(`Processing ${Math.min(limit, totalCards)} cards...`)

  for (const t of outline) {
    if (!t?.html) continue
    if (processed >= limit) break

    try {
      console.log(`Processing card ${processed + 1}/${Math.min(limit, totalCards)}...`)
      delete t.summary
      const htmlSnippet = String(JSON.stringify(t)).slice(0, maxChars)
      // The card is the `article` and the rubric is the `question`: articleQA
      // prompts the model with the article first, so the instructions land
      // last and are what the model is actually answering.
      const response = await ResearchAgent.articleQa({
        body: {
          article: htmlSnippet,
          question: findFlawsPrompt,
          chatModel: FLAW_FINDER_MODEL,
        },
      })
      // Model responses may contain fenced or malformed JSON; parse defensively.
      t.analysis = parseAnalysisJson(response?.data?.content || "")
      log(t.analysis ?? undefined)
      processed++
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Error processing card ${processed + 1}:`, message)
      log(message)
    }
  }

  console.log(`\nCompleted! Processed ${processed} cards.`)

  return outlineData
}

/** Safely parses model output into an analysis object from raw/fenced JSON text. */
function parseAnalysisJson(raw: string): Analysis | null {
  try {
    // Prefer fenced JSON payloads when the model includes markdown formatting.
    const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i)
    const candidate = fenceMatch ? fenceMatch[1] : raw

    const braceStart = candidate.indexOf("{")
    const braceEnd = candidate.lastIndexOf("}")
    if (braceStart !== -1 && braceEnd > braceStart) {
      const sliced = candidate.slice(braceStart, braceEnd + 1)
      try {
        return JSON.parse(sliced) as Analysis
      } catch {
        // continue
      }
    }

    let cleaned = candidate.replace(/^.*?(\{)/s, "$1").replace(/(\})[^}]*$/s, "$1").trim()

    try {
      return JSON.parse(cleaned) as Analysis
    } catch {
      // continue
    }

    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1")
    try {
      return JSON.parse(cleaned) as Analysis
    } catch {
      // continue
    }

    // Last-resort field extraction keeps partial value even when JSON is invalid.
    const obj: Analysis = {}
    const get = (re: RegExp) => {
      const m = cleaned.match(re)
      return m ? m[1].trim() : undefined
    }

    obj.summary = get(/"?summary"?\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i)
    obj.warrants = get(/"?warrants"?\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i)

    const scoreStr = get(/"?score"?\s*:\s*([0-9]{1,3})/i)
    obj.score = scoreStr ? Number(scoreStr) : undefined

    const flawsMatch = cleaned.match(/"?flaws"?\s*:\s*\[(.*?)\]/is)
    if (flawsMatch) {
      obj.flaws = flawsMatch[1]
        .split(/\s*,\s*/)
        .map((s: string) => s.replace(/^"|"$/g, ""))
        .filter(Boolean)
    }

    if (obj.summary || obj.warrants || obj.score !== undefined || obj.flaws) return obj
  } catch {
    // ignore
  }

  return null
}
