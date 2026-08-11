/** @fileoverview Complete pipeline: DOCX → HTML → Cards */
import { convertDocxToHTML } from "./docx-to-html";
import { htmlToCards } from "./html-to-cards";
import type { ParseOptions, ParseResult } from "../types/types";

/**
 * Convert DOCX file directly to parsed debate cards
 * Combines DOCX conversion and HTML card parsing in one step
 *
 * @param docxBufferOrURL - DOCX file input (URL, File, Blob, ArrayBuffer, or Buffer)
 * @param fileName - Optional file name for metadata extraction
 * @param options - Parser profile and options
 * @returns Structured cards and metadata
 *
 * @example
 * // From file upload
 * const result = await docxToCards(file, file.name);
 * console.log(result.metadata.quotes, "cards found");
 *
 * @example
 * // From URL
 * const result = await docxToCards("https://example.com/cards.docx");
 * result.outline.forEach(item => {
 *   if ('cite' in item) console.log(item.summary, item.cite);
 * });
 *
 * @example
 * // With custom profile
 * const result = await docxToCards(buffer, "debate.docx", {
 *   profile: "verbatim",
 *   minBlankLinesForBoundary: 2
 * });
 */
export async function docxToCards(
  docxBufferOrURL: string | File | Blob | ArrayBuffer | Buffer,
  fileName?: string,
  options: ParseOptions = {},
): Promise<ParseResult> {
  // Step 1: Convert DOCX to HTML with formatting preserved
  const html = await convertDocxToHTML(docxBufferOrURL, {
    plainTextOnly: false,
    useDocxPreview: true,
  });

  // Step 2: Parse HTML into cards using standard card parser
  const result = htmlToCards(html, fileName, options);

  return result;
}

/**
 * Convert DOCX to plain HTML without parsing into cards
 * Useful when you just need the HTML output
 *
 * @param docxBufferOrURL - DOCX file input
 * @param options - Conversion options
 * @returns HTML string
 *
 * @example
 * const html = await docxToHtml(file);
 * // Use HTML directly in editor or other component
 */
export async function docxToHtml(
  docxBufferOrURL: string | File | Blob | ArrayBuffer | Buffer,
  options: { plainTextOnly?: boolean; useDocxPreview?: boolean } = {},
): Promise<string> {
  return convertDocxToHTML(docxBufferOrURL, options);
}
