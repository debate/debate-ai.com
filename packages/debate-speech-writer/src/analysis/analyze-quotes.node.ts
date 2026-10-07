/**
 * @fileoverview Node-only file wrapper around {@link analyzeQuotes}.
 *
 * Kept out of the package entry (`src/index.ts`) so `node:fs` never reaches
 * the browser bundle; import it by path from scripts and tooling.
 */
import fs from "node:fs"
import { analyzeQuotes, type AnalyzeQuotesOptions, type OutlineData } from "./analyze-quotes"

type AnalyzeQuotesFileOptions = AnalyzeQuotesOptions & {
  outputPath?: string | null
}

/**
 * Runs {@link analyzeQuotes} over an outline read from disk (or passed in) and
 * optionally writes the analyzed outline back out as JSON.
 *
 * @param input - Outline JSON path or already-loaded outline object.
 * @param options - Processing limits and optional output path.
 * @returns Outline data with per-card analysis attached.
 */
export async function analyzeQuotesFile(
  input: string | OutlineData,
  options: AnalyzeQuotesFileOptions = {},
): Promise<OutlineData> {
  const { outputPath = null, ...limits } = options
  const outlineData: OutlineData =
    typeof input === "string" ? (JSON.parse(fs.readFileSync(input, "utf8")) as OutlineData) : input

  await analyzeQuotes(outlineData, limits)

  if (outputPath) {
    fs.writeFileSync(outputPath, JSON.stringify(outlineData, null, 2), "utf8")
    console.log(`Analysis saved to: ${outputPath}`)
  }
  return outlineData
}
