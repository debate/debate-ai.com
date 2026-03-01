/** @fileoverview Batch LLM analysis helpers for card quality/warrant scoring. */
import fs from "node:fs"
import * as ResearchAgent from "qwksearch-api-client"
import { log } from "grab-url"

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

type OutlineData = {
  outline?: OutlineEntry[]
  [key: string]: unknown
}

type AnalyzeQuotesOptions = {
  limit?: number
  maxChars?: number
  outputPath?: string | null
}

const findFlawsPrompt = `

1. Read the debate research quote carefully.
2. Identify the main claim and summarize the key warrants (reasons/evidence) given to support it.
3. Present a concise summary of these warrants in 2-3 sentences.
4. Assign a support score from 0 to 10, where 0 means the warrants do not support the claim at all, 10 means full support, and flaws should reduce the score.
5. Identify and list any flaws or problems in the quote, such as outdated evidence, logical fallacies, unclear reasoning, or unsupported assumptions.
6. If parts of the card are missing (claim, warrants, evidence), note that in "flaws" and adjust the score accordingly.
7. Output only the filled JSON object, without extra explanation. Use this JSON format:
{
  "summary": "<summarized main claim, 1 sentence>",
  "warrants": "<summary of warrants, 3 sentences max>",
  "score": <interger between 0 and 10>,
  "flaws": [
    "<flaw 1>",
    "<flaw 2>",
    "<flaw 3>"
  ]
}

Research Quote:

`

/**
 * Runs LLM-based analysis over parsed card entries that include HTML content.
 *
 * @param input - Outline JSON path or already-loaded outline object.
 * @param options - Processing limits and optional output path.
 * @returns Outline data with per-card analysis attached.
 */
export async function analyzeQuotes(
  input: string | OutlineData,
  options: AnalyzeQuotesOptions = {},
): Promise<OutlineData> {
  const { limit = 10, maxChars = 4000, outputPath = null } = options

  const outlineData: OutlineData =
    typeof input === "string" ? (JSON.parse(fs.readFileSync(input, "utf8")) as OutlineData) : input

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
      const response = await (ResearchAgent as any).writeLanguage({
        body: {
          agent: "question",
          article: findFlawsPrompt + htmlSnippet,
          provider: "groq",
          model: "meta-llama/llama-4-maverick-17b-128e-instruct",
          html: true,
          temperature: 0.7,
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

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(outlineData, null, 2), "utf8")
    console.log(`\nCompleted! Processed ${processed} cards.`)
    console.log(`Analysis saved to: ${outputPath}`)
  } else {
    console.log(`\nCompleted! Processed ${processed} cards.`)
  }

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
