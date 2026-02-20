import { type NextRequest, NextResponse } from "next/server"
import { ChatGroq } from "@langchain/groq"

const findFlawsPrompt = `
1. You are a debate research quote analyst in a student debate in the policy, public forum, LD, or other format.
2. Identify the main claim and summarize the key warrants (reasons/evidence) given to support it.
3. Present a concise summary of these warrants in 2-3 sentences.
4. Assign a support score from 0 to 10, where 0 means the warrants do not support the claim at all, 10 means full support, and flaws should reduce the score.
5. Identify and list any flaws or problems in the quote, such as outdated evidence, logical fallacies, unclear reasoning, or unsupported assumptions.
6. If parts of the card are missing (claim, warrants, evidence), note that in "flaws" and adjust the score accordingly.
7. Think of a good cross-x question to ask on the other side to get the team reading the card to admit the weakness of the article.
8. Output only the filled JSON object, without extra explanation. Use this JSON format:
{
  "summary": "<summarized main claim, 1 sentence>",
  "warrants": "<summary of warrants, 3 sentences max>",
  "score": <integer between 0 and 10>,
  "question": "<cross-x question, 1 sentence>"
  "flaws": [
    "<flaw 1>",
    "<flaw 2>",
    ...
  ]
}

Research Quote:

`

export async function POST(request: NextRequest) {
  try {
    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json(
        { error: "GROQ_API_KEY environment variable is not set. Please add it to your project settings." },
        { status: 400 },
      )
    }

    const { content, customPrompt } = await request.json()

    const model = new ChatGroq({
      apiKey: process.env.GROQ_API_KEY,
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
    })

    // Use custom prompt if provided, otherwise use the default flaw-finding prompt
    const prompt = customPrompt ? `${customPrompt}\n\nContent:\n${content}` : `${findFlawsPrompt}${content}`

    const response = await model.invoke(prompt)

    // Try to parse JSON response for structured analysis
    let result
    try {
      const parsed = parseAnalysisJson(response.content as string)
      result = parsed || response.content
    } catch {
      result = response.content
    }

    return NextResponse.json({ result })
  } catch (error) {
    console.error("[v0] Error in analyze route:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze content" },
      { status: 500 },
    )
  }
}

/**
 * Robustly parse AI JSON output for debate card analysis
 */
function parseAnalysisJson(raw: string): any {
  try {
    // Extract from code fences
    const fenceMatch = raw.match(/```json\s*([\s\S]*?)```/i) || raw.match(/```\s*([\s\S]*?)```/i)
    const candidate = fenceMatch ? fenceMatch[1] : raw

    // Find first {...} balanced
    const braceStart = candidate.indexOf("{")
    const braceEnd = candidate.lastIndexOf("}")
    if (braceStart !== -1 && braceEnd > braceStart) {
      const sliced = candidate.slice(braceStart, braceEnd + 1)
      try {
        return JSON.parse(sliced)
      } catch {}
    }

    // Cleanup
    let cleaned = candidate
      .replace(/^[\s\S]*?(\{)/, "$1")
      .replace(/(\})[\s\S]*$/, "$1")
      .trim()

    // Try direct parse
    try {
      return JSON.parse(cleaned)
    } catch {}

    // Remove trailing commas
    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1")
    try {
      return JSON.parse(cleaned)
    } catch {}

    // Reconstruct with regex
    const obj: any = {}
    const get = (re: RegExp) => {
      const m = cleaned.match(re)
      return m ? m[1].trim() : undefined
    }
    obj.summary = get(/"?summary"?\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i)
    obj.warrants = get(/"?warrants"?\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i)
    const scoreStr = get(/"?score"?\s*:\s*([0-9]{1,3})/i)
    obj.score = scoreStr ? Number(scoreStr) : undefined
    const flawsMatch = cleaned.match(/"?flaws"?\s*:\s*\[([\s\S]*?)\]/i)
    if (flawsMatch) {
      const parts = flawsMatch[1]
        .split(/\s*,\s*/)
        .map((s) => s.replace(/^"|"$/g, ""))
        .filter(Boolean)
      obj.flaws = parts
    }

    if (obj.summary || obj.warrants || obj.score !== undefined || obj.flaws) {
      return obj
    }
  } catch {}
  return null
}
