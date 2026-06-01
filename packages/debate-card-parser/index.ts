/** @fileoverview Public export surface for the card parser module. */
export { htmlToCards } from "./parsers/html-to-cards";
export { FORMAT_PROFILES } from "./utils/format-profiles";
export {
  extractCiteInfo,
  recalculateAuthor,
  cleanUrl,
} from "./extractors/citation-extractor";
export { extractMarked, extractUnderlined } from "./extractors/text-extractor";
export { finalizeCard, repairCards } from "./utils/card-utils";
export { parseFileNameParts } from "./extractors/file-name-parser";

export type {
  Card,
  CitationInfo,
  FileNameParts,
  FormatProfile,
  OutlineItem,
  ParseMetadata,
  ParseOptions,
  ParseResult,
} from "./types/types";
