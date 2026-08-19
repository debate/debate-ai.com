/**
 * @fileoverview Document-upload text extraction for a `CoachMaterial`'s
 * `text` field — the "document" half of follow-up (a) named in
 * `team-coach-materials.ts`'s file doc-comment for idea #8
 * ("Video-Lecture-Training Coach AI") in TODO.md: "transcription/parsing
 * that turns an uploaded recording or document into a `CoachMaterial`'s
 * `text`." Handles plain-text documents (.txt/.md) directly and Word
 * documents (.docx) through `debate-card-parser`'s existing
 * `convertDocxToHTML`, reusing that Verbatim-parsing pipeline rather than
 * reimplementing OOXML parsing. Recording (audio/video) transcription is
 * the still-open other half of the same follow-up — no transcription
 * service exists in this repo.
 *
 * `convertDocxToHTML`'s default renderer (`docx-preview`) needs a browser
 * `DOMParser`, so it only works client-side — this module's caller,
 * `panels/CoachMaterialsPanel.tsx`, is a `"use client"` component, so a real
 * upload works. The `convertDocx` option lets a test substitute a stub
 * instead of needing a DOM environment (this package's Vitest config runs
 * under Node, matching `debate-card-parser`'s own).
 *
 * @module coach/document-material-extraction
 */

import { convertDocxToHTML } from "debate-card-parser/src/parsers/docx-to-html";

/** File extensions this module knows how to turn into plain text. */
export type SupportedDocumentKind = "text" | "docx";

export interface ExtractMaterialTextFromDocumentInput {
  /** The uploaded file's name, used only to detect its kind by extension. */
  fileName: string;
  /** The uploaded file's raw content — a string or Blob/File for text, a Blob/File/ArrayBuffer for DOCX. */
  content: string | ArrayBuffer | Blob;
}

export interface ExtractMaterialTextFromDocumentOptions {
  /** Override for `convertDocxToHTML` (e.g. a stub in tests without a DOM environment). Defaults to the real converter. */
  convertDocx?: typeof convertDocxToHTML;
}

const TEXT_EXTENSIONS = new Set(["txt", "md", "markdown"]);
const DOCX_EXTENSIONS = new Set(["docx"]);

function getExtension(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  return dotIndex === -1 ? "" : fileName.slice(dotIndex + 1).toLowerCase();
}

/** Detects which extraction path `fileName` needs by its extension, or `null` when it isn't a supported document type. */
export function detectDocumentKind(fileName: string): SupportedDocumentKind | null {
  const extension = getExtension(fileName);
  if (TEXT_EXTENSIONS.has(extension)) return "text";
  if (DOCX_EXTENSIONS.has(extension)) return "docx";
  return null;
}

function normalizeExtractedText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

async function readTextContent(content: string | ArrayBuffer | Blob): Promise<string> {
  if (typeof content === "string") return content;
  if (content instanceof Blob) return content.text();
  return new TextDecoder().decode(content);
}

/**
 * Turns an uploaded plain-text (.txt/.md) or Word (.docx) document into
 * plain text suitable for a `CoachMaterial`'s `text` field, collapsing
 * whitespace the same way `docx-preview`'s own plain-text output is already
 * normalized. Throws a plain `Error` with a readable message for an
 * unsupported extension or a document that yields no readable text (an
 * empty upload, or a `.docx` with no text content).
 */
export async function extractMaterialTextFromDocument(
  input: ExtractMaterialTextFromDocumentInput,
  options: ExtractMaterialTextFromDocumentOptions = {},
): Promise<string> {
  const { fileName, content } = input;
  const kind = detectDocumentKind(fileName);
  if (kind === null) {
    throw new Error(`Unsupported file type: "${fileName}". Upload a .docx, .txt, or .md file.`);
  }

  const convertDocx = options.convertDocx ?? convertDocxToHTML;
  const raw =
    kind === "text" ? await readTextContent(content) : await convertDocx(content, { plainTextOnly: true });

  const text = normalizeExtractedText(raw);
  if (text.length === 0) {
    throw new Error(`No readable text found in "${fileName}".`);
  }
  return text;
}
