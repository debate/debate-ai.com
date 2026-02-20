/**
 * @fileoverview Main HTML to debate cards parser.
 * Parses HTML documents into structured debate card objects with citations,
 * summaries, and highlighted evidence text.
 * @module card-parser/html-to-cards
 */

import { Parser } from "htmlparser2";
import { FORMAT_PROFILES } from "./format-profiles.js";
import { extractCiteInfo, cleanUrl } from "./citation-extractor.js";
import { finalizeCard, repairCards } from "./card-utils.js";
import { parseFileNameParts } from "./file-name-parser.js";

/**
 * @typedef {Object} Card
 * @property {string} summary - Card tag/summary line
 * @property {string|null} author - Author last name
 * @property {string|null} author_type - Type of author (person, organization, etc.)
 * @property {string|null} cite - Full citation text
 * @property {number|string|null} year - Publication year or "ND"
 * @property {string|null} url - Source URL
 * @property {string} html - Card body HTML content
 * @property {string} marked - Extracted highlighted text
 * @property {number} words - Total word count
 * @property {number} wordsMarked - Word count of highlighted text
 * @property {string[]} [error] - Array of validation error codes
 */

/**
 * @typedef {Object} OutlineItem
 * @property {number} type - Item type (1=section, 2=subsection, 3=block, 4=card, 5=text)
 * @property {string} text - Item text content
 */

/**
 * @typedef {Object} ParseResult
 * @property {Object} metadata - Document metadata
 * @property {string|null} metadata.category - Document category
 * @property {string|null} metadata.title - Document title/topic
 * @property {string|null} metadata.organization - Organization name
 * @property {number|null} metadata.year - Document year
 * @property {number} metadata.quotes - Number of cards found
 * @property {number} metadata.blocks - Number of blocks found
 * @property {(OutlineItem|Card)[]} outline - Document outline with cards
 */

/**
 * @typedef {Object} ParseOptions
 * @property {string} [profile="standard"] - Format profile name to use
 * @property {string[]} [headingTags] - Override heading tags
 * @property {string[]} [cardStartHeadings] - Override card start headings
 * @property {number} [minBlankLinesForBoundary] - Override blank line threshold
 * @property {boolean} [trustParagraphTags] - Override paragraph trust setting
 * @property {RegExp[]} [summaryPatterns] - Override summary patterns
 */

/**
 * Parses an HTML string into structured debate cards.
 * Extracts cards with citations, summaries, and evidence text from HTML documents.
 *
 * @param {string} htmlString - HTML content to parse
 * @param {string} [fileName] - Optional file name for metadata extraction
 * @param {ParseOptions} [options={}] - Parsing options
 * @returns {ParseResult} Parsed result with metadata and card outline
 *
 * @example
 * const html = `
 *   <h1>Affirmative</h1>
 *   <h4>Impact Card</h4>
 *   <p><b>Smith 2023</b> - Climate scientist at MIT</p>
 *   <p>Evidence text with <mark>highlighted portions</mark>.</p>
 * `;
 * const result = htmlToCards(html, "Aff - Climate - Michigan 2023.docx");
 * // Returns structured cards with metadata
 */
export function htmlToCards(htmlString, fileName, options = {}) {
  const profileName = options.profile || "standard";
  const profile = { ...FORMAT_PROFILES[profileName], ...options };

  console.log("[htmlToCards] ===== STARTING PARSE =====");
  console.log("[htmlToCards] Profile:", profileName);
  console.log("[htmlToCards] Input HTML length:", htmlString?.length || 0);
  console.log("[htmlToCards] Input HTML:", htmlString?.substring(0, 500));

  const normalizedHtml = normalizeHtmlForCards(htmlString);
  console.log(
    "[htmlToCards] Normalized HTML length:",
    normalizedHtml?.length || 0,
  );
  console.log(
    "[htmlToCards] Normalized HTML:",
    normalizedHtml?.substring(0, 500),
  );

  const outline = [];
  const cards = [];

  // Parser state
  let currentSection = null;
  let currentSubsection = null;
  let currentBlock = null;
  let currentCard = null;
  let currentElement = null;
  let textBuffer = "";
  let isInHeading = false;
  let headingtype = 0;
  let isInParagraph = false;
  let isInBold = false;
  let boldText = "";
  const elementStack = [];

  let emptyBlockCount = 0;
  let cardState = "OUTSIDE_CARD";

  const parser = new Parser(
    {
      /**
       * Handles opening tags during parsing.
       * @param {string} name - Tag name
       * @param {Object} attributes - Tag attributes
       */
      onopentag(name, attributes) {
        elementStack.push(name);
        currentElement = name;

        if (name === "p") {
          isInParagraph = true;
          textBuffer = "";
        } else if (profile.headingTags.includes(name)) {
          isInHeading = true;
          headingtype =
            name === "h1"
              ? 1
              : name === "h2"
                ? 2
                : name === "h3"
                  ? 3
                  : name === "h4"
                    ? 4
                    : name === "h5"
                      ? 5
                      : 6;
          textBuffer = "";
          console.log(
            `[htmlToCards] Opening heading <${name}> (type ${headingtype})`,
          );
        }

        if (name === "b" || name === "strong") {
          isInBold = true;
          boldText = "";
        }

        if (currentCard && isInParagraph) {
          if (!currentCard.htmlBuffer) {
            currentCard.htmlBuffer = "";
          }
          currentCard.htmlBuffer += `<${name}>`;
        }
      },

      /**
       * Handles text content during parsing.
       * @param {string} text - Text content
       */
      ontext(text) {
        if (isInHeading || isInParagraph) {
          textBuffer += text;
        }

        if (isInBold) {
          boldText += text;
        }

        if (currentCard && isInParagraph) {
          currentCard.htmlBuffer += text;
        }
      },

      /**
       * Handles closing tags during parsing.
       * @param {string} name - Tag name
       */
      onclosetag(name) {
        elementStack.pop();

        if (
          currentCard &&
          isInParagraph &&
          name !== "p" &&
          currentCard.htmlBuffer
        ) {
          currentCard.htmlBuffer += `</${name}>`;
        }

        // Handle heading close
        if (profile.headingTags.includes(name) && isInHeading) {
          const headingText = textBuffer.trim();
          console.log(
            `[htmlToCards] Closing heading <${name}> (type ${headingtype}): "${headingText}"`,
          );

          switch (headingtype) {
            case 1:
              currentSection = headingText;
              currentSubsection = null;
              currentBlock = null;
              outline.push({ type: 1, text: currentSection });
              emptyBlockCount = 0;
              break;

            case 2:
              currentSubsection = headingText;
              currentBlock = null;
              outline.push({ type: 2, text: headingText });
              emptyBlockCount = 0;
              break;

            case 3:
              currentBlock = headingText;
              outline.push({ type: 3, text: currentBlock });
              emptyBlockCount = 0;
              break;

            case 4:
            case 5:
            case 6:
              // Finalize previous card if exists
              if (currentCard) {
                console.log(
                  "[htmlToCards] Finalizing previous card before new heading",
                );
                finalizeCard(currentCard);

                if (currentCard.cite && currentCard.html) {
                  console.log(
                    "[htmlToCards] ✓ Previous card has cite and html, adding to cards",
                  );
                  cards.push(currentCard);
                  outline.push(currentCard);
                } else {
                  console.log(
                    "[htmlToCards] ✗ Previous card missing cite or html, adding as text item",
                  );
                  outline.push({ type: 5, text: currentCard.summary });
                }
              }

              // Create new card
              currentCard = {
                summary: headingText,
                author: null,
                author_type: null,
                cite: null,
                body: [],
                year: null,
                url: null,
                htmlBuffer: "",
              };
              console.log(
                "[htmlToCards] ✓ Created new card from heading:",
                headingText,
              );
              cardState = "SEEN_SUMMARY_LINE";
              emptyBlockCount = 0;
              break;
          }

          isInHeading = false;
          textBuffer = "";
        }

        // Handle paragraph close
        if (name === "p" && isInParagraph) {
          const paragraphText = textBuffer.trim();
          console.log(
            `[htmlToCards] Closing <p>: "${paragraphText.substring(0, 100)}..."`,
          );

          if (!paragraphText || paragraphText.length === 0) {
            emptyBlockCount++;
            console.log(
              "[htmlToCards] Empty paragraph, emptyBlockCount:",
              emptyBlockCount,
            );

            // Check if we should end current card
            if (
              emptyBlockCount >= profile.minBlankLinesForBoundary &&
              currentCard &&
              (currentCard.cite || currentCard.body.length > 0)
            ) {
              finalizeCard(currentCard);

              if (currentCard.cite && currentCard.html) {
                cards.push(currentCard);
                outline.push(currentCard);
              } else if (currentCard.summary) {
                outline.push({ type: 5, text: currentCard.summary });
              }

              currentCard = null;
              cardState = "OUTSIDE_CARD";
            }
          } else {
            emptyBlockCount = 0;

            // Check if paragraph starts a new card
            if (!currentCard && cardState === "OUTSIDE_CARD") {
              const matchesSummaryPattern = profile.summaryPatterns.some(
                (pattern) => pattern.test(paragraphText),
              );
              console.log(
                "[htmlToCards] Not in card, checking if paragraph starts card...",
              );
              console.log(
                "[htmlToCards]   matchesSummaryPattern:",
                matchesSummaryPattern,
              );
              console.log(
                "[htmlToCards]   boldText:",
                boldText?.substring(0, 50),
              );
              console.log(
                "[htmlToCards]   paragraphText.length:",
                paragraphText.length,
              );

              if (
                matchesSummaryPattern ||
                (boldText && paragraphText.length < 200)
              ) {
                currentCard = {
                  summary: paragraphText,
                  author: null,
                  author_type: null,
                  cite: null,
                  body: [],
                  year: null,
                  url: null,
                  htmlBuffer: "",
                };
                console.log(
                  "[htmlToCards] ✓ Created new card from paragraph:",
                  paragraphText.substring(0, 100),
                );
                cardState = "SEEN_SUMMARY_LINE";
                isInParagraph = false;
                textBuffer = "";
                return;
              } else {
                console.log("[htmlToCards] ✗ Paragraph does not start a card");
              }
            }

            // Add paragraph to current card
            if (currentCard) {
              currentCard.htmlBuffer += `</${name}>`;
              const paragraphHtml = currentCard.htmlBuffer;

              if (boldText && !currentCard.cite) {
                console.log(
                  "[htmlToCards] Found bold text, extracting citation info...",
                );
                const citeInfo = extractCiteInfo(paragraphText, boldText);
                console.log(
                  "[htmlToCards]   Extracted citation info:",
                  citeInfo,
                );
                currentCard.year = citeInfo.year;
                currentCard.author = citeInfo.author;
                currentCard.author_type = citeInfo.author_type;

                currentCard.cite = paragraphText.replace(/'+$/, "");
                const urlMatch = paragraphText.match(/https?:\/\/[^\s<>]+/);
                if (urlMatch) {
                  currentCard.url = cleanUrl(urlMatch[0]);
                }
                console.log(
                  "[htmlToCards] ✓ Set cite for card:",
                  currentCard.cite.substring(0, 100),
                );
                cardState = "IN_CARD";
              } else if (paragraphText) {
                console.log(
                  "[htmlToCards] Adding paragraph to card body (length:",
                  paragraphHtml.length,
                  ")",
                );
                currentCard.body.push(paragraphHtml);
                cardState = "IN_CARD";
              }

              currentCard.htmlBuffer = "";
            }
          }

          isInParagraph = false;
          textBuffer = "";
        }

        if (name === "b" || name === "strong") {
          isInBold = false;
        }
      },
    },
    {
      decodeEntities: true,
      lowerCaseTags: true,
    },
  );

  parser.write(normalizedHtml);
  parser.end();

  // Finalize last card
  console.log("[htmlToCards] Parsing complete, processing final card...");
  if (currentCard) {
    console.log(
      "[htmlToCards] Finalizing final card:",
      currentCard.summary?.substring(0, 100),
    );
    finalizeCard(currentCard);

    if (currentCard.cite && currentCard.html) {
      console.log(
        "[htmlToCards] ✓ Final card has cite and html, adding to cards",
      );
      cards.push(currentCard);
      outline.push(currentCard);
    } else {
      console.log(
        "[htmlToCards] ✗ Final card missing cite or html, adding as text item",
      );
      console.log("[htmlToCards]   cite:", currentCard.cite?.substring(0, 100));
      console.log(
        "[htmlToCards]   html length:",
        currentCard.html?.length || 0,
      );
      outline.push({ type: 5, text: currentCard.summary });
    }
  }

  console.log("[htmlToCards] Total cards found:", cards.length);
  console.log("[htmlToCards] Total outline items:", outline.length);

  const repairedCards = repairCards(cards, profile);
  console.log("[htmlToCards] Cards after repair:", repairedCards.length);

  // Extract metadata from filename
  const parsed = fileName ? parseFileNameParts(fileName) : {};

  const finalResult = {
    metadata: {
      category: parsed.category || null,
      title: parsed.topic || null,
      organization: parsed.organization || null,
      year: parsed.year || null,
      quotes: repairedCards.length,
      blocks: outline.filter((s) => s.type === 3).length,
    },
    outline: outline.map((item) => {
      if (item.summary) {
        const repairedCard = repairedCards.find(
          (c) => c.summary === item.summary,
        );
        return repairedCard || item;
      }
      return item;
    }),
  };

  console.log("[htmlToCards] ===== PARSE COMPLETE =====");
  console.log(
    "[htmlToCards] Final result - quotes:",
    finalResult.metadata.quotes,
  );
  console.log(
    "[htmlToCards] Final result - blocks:",
    finalResult.metadata.blocks,
  );
  console.log(
    "[htmlToCards] Final result - outline items:",
    finalResult.outline.length,
  );

  if (repairedCards.length === 0) {
    console.warn("[htmlToCards] ⚠️ NO CARDS DETECTED!");
    console.warn(
      "[htmlToCards] Check if input has headings (h1-h6) or paragraphs with bold text",
    );
    console.warn("[htmlToCards] Profile used:", profileName);
  }

  return finalResult;
}

/**
 * Normalizes HTML string for card parsing.
 * Converts various line break formats to paragraph tags,
 * removes excessive whitespace, and ensures proper tag structure.
 *
 * @param {string} htmlString - Raw HTML string to normalize
 * @returns {string} Normalized HTML string with consistent structure
 *
 * @example
 * const normalized = normalizeHtmlForCards('<p>Text</p>\n\n<p>More text</p>');
 * // Returns HTML with consistent paragraph structure
 */
export function normalizeHtmlForCards(htmlString) {
  if (!htmlString) return "";

  let normalized = htmlString;

  // Convert multiple newlines to paragraph breaks
  normalized = normalized.replace(/\n{4,}/g, "</p><p></p><p></p><p>");
  normalized = normalized.replace(/\n{3}/g, "</p><p></p><p>");
  normalized = normalized.replace(/\n\n/g, "</p><p>");

  // Convert multiple br tags to paragraph breaks
  normalized = normalized.replace(
    /(<br\s*\/?>){4,}/gi,
    "</p><p></p><p></p><p>",
  );
  normalized = normalized.replace(/(<br\s*\/?>){3}/gi, "</p><p></p><p>");
  normalized = normalized.replace(/(<br\s*\/?>){2}/gi, "</p><p>");
  normalized = normalized.replace(/<br\s*\/?>\s*\n\s*\n/gi, "</p><p>");

  // Normalize whitespace
  normalized = normalized.replace(/[ \t]+/g, " ");

  // Clean up heading tags
  normalized = normalized.replace(/<(h[1-6])\s*>/gi, "<$1>");
  normalized = normalized.replace(/<\/(h[1-6])>\s+/gi, "</$1>");

  // Remove empty container tags
  normalized = normalized.replace(/<(p|div|span)\s*>\s*<\/\1>/gi, "");

  // Convert remaining br tags to spaces
  normalized = normalized.replace(/<br\s*\/?>/gi, " ");

  // Handle bold text at start of line (likely a new paragraph)
  normalized = normalized.replace(/(\S)<(b|strong)>/gi, "$1</p><p><$2>");

  // Ensure HTML starts and ends with tags
  if (!normalized.startsWith("<")) {
    normalized = "<p>" + normalized;
  }
  if (!normalized.endsWith(">")) {
    normalized = normalized + "</p>";
  }

  return normalized;
}
