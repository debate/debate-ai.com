/**
 * Parse HTML content into debate cards
 * Extracts quote cards from HTML with proper structure
 * @param {string} htmlContent - HTML string to parse
 * @returns {{quotes: Array, blocks: Array, outline: Array}} Parsed cards and structure
 */
export function htmlToCards(htmlContent) {
  console.log('[htmlToCards] ===== STARTING PARSE =====');
  console.log('[htmlToCards] Input HTML length:', htmlContent?.length || 0);

  if (!htmlContent) {
    console.log('[htmlToCards] No HTML content provided');
    return { quotes: [], blocks: [], outline: [] };
  }

  // Create a temporary DOM element to parse HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');

  const cards = [];
  const outline = [];
  let currentCard = null;
  let emptyBlockCount = 0;

  // Get all paragraphs and headings
  const elements = doc.body.querySelectorAll('p, h1, h2, h3, h4, h5, h6, blockquote');

  console.log('[htmlToCards] Found', elements.length, 'elements to process');

  elements.forEach((element, index) => {
    const tagName = element.tagName.toLowerCase();
    const text = element.textContent?.trim() || '';
    const html = element.innerHTML?.trim() || '';

    // Handle empty paragraphs
    if (!text) {
      emptyBlockCount++;
      console.log('[htmlToCards] Empty paragraph, emptyBlockCount:', emptyBlockCount);
      return;
    }

    // Check if this is a heading (potential card tag)
    if (tagName.match(/^h[1-6]$/) || tagName === 'blockquote' || isHeadingParagraph(element)) {
      const headingLevel = tagName.match(/^h([1-6])$/) ? parseInt(RegExp.$1) : 6;

      console.log(`[htmlToCards] Opening heading <${tagName}> (type ${headingLevel})`);

      // Finalize previous card if exists
      if (currentCard) {
        console.log('[htmlToCards] Finalizing previous card before new heading');
        finalizeCard(currentCard, cards, outline);
      }

      // Create new card from heading
      currentCard = {
        tag: text,
        cite: '',
        html: '',
        level: headingLevel,
        tagElement: element
      };

      console.log(`[htmlToCards] ✓ Created new card from heading: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      console.log(`[htmlToCards] Closing heading <${tagName}> (type ${headingLevel}): "${text.substring(0, 100)}..."`);

    } else if (tagName === 'p' && currentCard) {
      // This is content for the current card
      const hasStrongOrBold = element.querySelector('strong, b');

      // If paragraph has bold/strong text, it might be a cite
      if (hasStrongOrBold && !currentCard.cite) {
        currentCard.cite = html;
        console.log(`[htmlToCards] Added cite to card: ${text.substring(0, 50)}...`);
      } else {
        // Add to card body/html
        currentCard.html += (currentCard.html ? '\n' : '') + html;
        console.log(`[htmlToCards] Added content to card body`);
      }

      console.log(`[htmlToCards] Closing <p>: "${text.substring(0, 30)}..."`);
    } else {
      // Content outside of any card - add to outline
      outline.push({
        type: 'text',
        content: html,
        text: text
      });
    }
  });

  // Finalize the last card
  if (currentCard) {
    console.log('[htmlToCards] Parsing complete, processing final card...');
    console.log(`[htmlToCards] Finalizing final card: ${currentCard.tag?.substring(0, 100)}`);
    finalizeCard(currentCard, cards, outline);
  }

  console.log('[htmlToCards] Total cards found:', cards.length);
  console.log('[htmlToCards] Total outline items:', outline.length);

  // Attempt to repair cards if needed
  const repairedCards = cards.length === 0 && outline.length > 0
    ? attemptCardRepair(outline)
    : cards;

  console.log('[htmlToCards] Cards after repair:', repairedCards.length);
  console.log('[htmlToCards] ===== PARSE COMPLETE =====');
  console.log('[htmlToCards] Final result - quotes:', repairedCards.length);
  console.log('[htmlToCards] Final result - blocks:', repairedCards.length);
  console.log('[htmlToCards] Final result - outline items:', outline.length);

  return {
    quotes: repairedCards,
    blocks: repairedCards,
    outline: outline
  };
}

/**
 * Check if a paragraph element should be treated as a heading
 * (based on styling or content patterns)
 */
function isHeadingParagraph(element) {
  const text = element.textContent?.trim() || '';

  // Check for heading-like styling
  const style = window.getComputedStyle(element);
  const fontSize = parseFloat(style.fontSize);
  const fontWeight = style.fontWeight;

  // Large font size or bold might indicate a heading
  const isLargeFont = fontSize > 16;
  const isBold = fontWeight === 'bold' || parseInt(fontWeight) >= 600;

  // Check for heading-like patterns (short text, ends with colon, etc.)
  const isShortish = text.length > 10 && text.length < 200;
  const endsWithColon = text.endsWith(':');

  return (isLargeFont || isBold) || (isShortish && endsWithColon);
}

/**
 * Finalize a card and add it to either cards or outline
 */
function finalizeCard(card, cards, outline) {
  // A valid card must have either a cite or html content
  // The tag alone is not enough
  if (!card.cite && !card.html) {
    console.log('[htmlToCards] ✗ Previous card missing cite or html, adding as text item');
    console.log('[htmlToCards]   cite:', card.cite);
    console.log('[htmlToCards]   html length:', card.html?.length || 0);

    // Add to outline instead
    outline.push({
      type: 'text',
      content: card.tag,
      text: card.tag
    });
    return;
  }

  // Valid card - add to cards array
  const finalCard = {
    tag: card.tag,
    cite: card.cite || '',
    html: card.html || '',
    summary: card.tag,
    level: card.level || 4
  };

  console.log('[htmlToCards] ✓ Finalized valid card:', finalCard.tag?.substring(0, 50));
  cards.push(finalCard);
}

/**
 * Attempt to repair cards from outline items
 * Sometimes content is all in outline but should be cards
 */
function attemptCardRepair(outline) {
  console.log('[htmlToCards] Attempting to repair cards from outline...');
  const repairedCards = [];

  let currentRepairCard = null;

  outline.forEach((item, index) => {
    const text = item.text || '';

    // Look for potential card tags (longer text, appears to be a claim/summary)
    if (text.length > 50 && text.length < 500) {
      // Start a new card
      if (currentRepairCard) {
        if (currentRepairCard.html) {
          repairedCards.push(currentRepairCard);
        }
      }

      currentRepairCard = {
        tag: text,
        cite: '',
        html: '',
        summary: text,
        level: 4
      };
    } else if (currentRepairCard && text.length > 20) {
      // Add as card content
      currentRepairCard.html += (currentRepairCard.html ? '\n' : '') + item.content;
    }
  });

  // Add last repaired card
  if (currentRepairCard && currentRepairCard.html) {
    repairedCards.push(currentRepairCard);
  }

  console.log('[htmlToCards] Repair found', repairedCards.length, 'potential cards');
  return repairedCards;
}
