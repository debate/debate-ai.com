/**
 * Debate Quote Analysis Module
 *
 * Analyzes debate research quotes for warrants and flaws using AI.
 * Can be used as an importable function or as a CLI tool.
 *
 * Usage examples:
 *   import { analyzeQuotes } from './analyze-quotes.js';
 *   await analyzeQuotes('cards.json', { limit: 10 });
 */

import * as ResearchAgent from "qwksearch-api-client";
import { grab, log } from "grab-url";

// AI prompt for finding flaws in debate quotes
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

`;

/**
 * Analyzes debate quotes for warrants and flaws using AI.
 * @param {string|Object} input - File path (string) or data object
 * @param {Object} options - Configuration options
 * @param {number} [options.limit=7] - Number of cards to process
 * @param {number} [options.maxChars=4000] - Max chars per request
 * @param {string} [options.outputPath] - Optional: output file path
 * @returns {Promise<Object>} Analysis results
 */
export async function analyzeQuotes(input, options = {}) {
  const {
    limit = 10,
    maxChars = 4000,
    outputPath = null,
  } = options;

  // Support loading from file path (parse JSON), or object directly
  const outlineData =
    typeof input === "string"
      ? JSON.parse(fs.readFileSync(input, "utf8"))
      : input;

  const outline = Array.isArray(outlineData.outline) ? outlineData.outline : [];
  let processed = 0;
  const totalCards = outline.filter((t) => t && t.html).length;

  console.log(`Found ${totalCards} cards with HTML content`);
  console.log(`Processing ${Math.min(limit, totalCards)} cards...`);

  for (const t of outline) {
    if (!t || !t.html) continue;
    if (processed >= limit) break;

    try {
      console.log(`Processing card ${processed + 1}/${Math.min(limit, totalCards)}...`);
      delete t.summary;
      const htmlSnippet = String(JSON.stringify(t)).slice(0, maxChars);
      const response = await ResearchAgent.writeLanguage({
        body: {
          agent: "question",
          article: findFlawsPrompt + htmlSnippet,
          provider: "groq",
          model: "meta-llama/llama-4-maverick-17b-128e-instruct",
          html: true,
          temperature: 0.7,
        },
      });
      t.analysis = parseAnalysisJson(response.data?.content || "");
      log(t.analysis);
      processed++;
    } catch (err) {
      console.error(
        `Error processing card ${processed + 1}:`,
        err && err.message ? err.message : err
      );
      log(err);
    }
  }

  // Save results if output path provided
  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(outlineData, null, 2), "utf8");
    console.log(`\nCompleted! Processed ${processed} cards.`);
    console.log(`Analysis saved to: ${outputPath}`);
  } else {
    console.log(`\nCompleted! Processed ${processed} cards.`);
  }

  return outlineData;
}

/**
 * Try to robustly parse AI JSON output for the debate card analysis.
 * Handles code fences, partial JSON, trailing commas, and reconstructs as needed.
 */
function parseAnalysisJson(raw) {
  try {
    // Try to extract between ```json ... ``` or ``` ... ```
    const fenceMatch =
      raw.match(/```json\s*([\s\S]*?)```/i) ||
      raw.match(/```\s*([\s\S]*?)```/i);
    const candidate = fenceMatch ? fenceMatch[1] : raw;

    // Try to find: the first {...} balanced
    const braceStart = candidate.indexOf("{");
    const braceEnd = candidate.lastIndexOf("}");
    if (braceStart !== -1 && braceEnd > braceStart) {
      const sliced = candidate.slice(braceStart, braceEnd + 1);
      try {
        return JSON.parse(sliced);
      } catch { }
    }

    // Cleanup: remove non-JSON, normalize
    let cleaned = candidate
      .replace(/^.*?(\{)/s, "$1")
      .replace(/(\})[^}]*$/s, "$1")
      .trim();

    // Try JSON directly
    try {
      return JSON.parse(cleaned);
    } catch { }

    // Remove trailing commas and try again
    cleaned = cleaned.replace(/,\s*([}\]])/g, "$1");
    try {
      return JSON.parse(cleaned);
    } catch { }

    // Reconstruct: extract with regex if all else fails
    const obj = {};
    const get = (re) => {
      const m = cleaned.match(re);
      return m ? m[1].trim() : undefined;
    };
    obj.summary = get(/"?summary"?\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i);
    obj.warrants = get(/"?warrants"?\s*:\s*"([\s\S]*?)"\s*(?:,|\})/i);
    const scoreStr = get(/"?score"?\s*:\s*([0-9]{1,3})/i);
    obj.score = scoreStr ? Number(scoreStr) : undefined;
    const flawsMatch = cleaned.match(/"?flaws"?\s*:\s*\[(.*?)\]/is);
    if (flawsMatch) {
      const parts = flawsMatch[1]
        .split(/\s*,\s*/)
        .map((s) => s.replace(/^"|"$/g, ""))
        .filter(Boolean);
      obj.flaws = parts;
    }

    if (
      obj.summary ||
      obj.warrants ||
      obj.score !== undefined ||
      obj.flaws
    ) {
      return obj;
    }
  } catch { }
  return null;
}
