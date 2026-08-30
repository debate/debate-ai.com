/**
 * Paste-source detection for smart paste conversion.
 *
 * Decides which converter — if any — should handle an incoming
 * text/html clipboard flavor. STRONG signatures only: anything
 * unrecognized returns null and takes the default ProseMirror paste
 * path, so ordinary web / plain-text pastes are never converted.
 * (And a converter that finds no debate structure falls back to the
 * default path anyway — detection is the first gate, not the only
 * one.)
 *
 * Order matters:
 *
 *  1. CardMirror's own clipboard (pmd-* classes) → null. The schema's
 *     parse rules already understand it.
 *  2. Google Docs (docs-internal-guid) → null. Debaters cut in Docs
 *     too, and its inline-styled output superficially resembles
 *     haku's; explicit excluder until a Docs dialect exists.
 *  3. Word: Word writes a full HTML *document* to the clipboard —
 *     `<meta name=Generator content="Microsoft Word …">`,
 *     `<meta name=ProgId content=Word.Document>`, and the
 *     `xmlns:w="urn:schemas-microsoft-com:office:word"` namespace
 *     shell. Browsers serialize only the selected fragment when
 *     copying from a web page, so page metas cannot ride along on a
 *     web copy: the shell means Word itself wrote the clipboard.
 *     Deliberately NOT matched: bare `mso-*` inline properties or
 *     `class=Mso*` — CMS-laundered Word remnants on blogs and haku's
 *     Word-targeted spans both carry those.
 *  4. haku.cards: no classes at all — a structural fingerprint of its
 *     copy builders, verified against the production bundles
 *     (2026-07-15): a Calibri font-stack wrapper `<div>`, a 13pt bold
 *     `<h4>` tag, run `<span>`s with inline pt font sizes and literal
 *     `<u>` underlines, and highlight spans carrying
 *     `mso-highlight:<named>` plus `box-decoration-break:clone`
 *     (practically a haku watermark — sites don't inline that).
 *     Scored, so an un-highlighted card still clears the bar while a
 *     random Calibri-and-underlines page does not.
 */

export type PasteDialect = 'word' | 'haku';

export function detectPasteDialect(html: string | null | undefined): PasteDialect | null {
  if (!html || !/\S/.test(html)) return null;
  if (isCardMirrorHtml(html)) return null;
  if (isGoogleDocsHtml(html)) return null;
  if (isWordShellHtml(html)) return 'word';
  if (isHakuHtml(html)) return 'haku';
  return null;
}

/** Our own clipboard: any pmd-* structural class. */
function isCardMirrorHtml(html: string): boolean {
  return /\bpmd-(pocket|hat|block|tag|cite|underline|emphasis|card|analytic|undertag|zone)/.test(
    html,
  );
}

/** Google Docs wraps every copy in <b id="docs-internal-guid-…">. */
function isGoogleDocsHtml(html: string): boolean {
  return /\bid=["']?docs-internal-guid-/i.test(html);
}

/** The Word document shell — written only by Word itself (desktop
 *  Mac/Windows and Word for the web all emit at least one of these). */
function isWordShellHtml(html: string): boolean {
  return (
    /<meta[^>]+content=["']?Microsoft Word/i.test(html) ||
    /<meta[^>]+content=["']?Word\.Document/i.test(html) ||
    /xmlns:w=["']urn:schemas-microsoft-com:office:word["']/i.test(html)
  );
}

/**
 * haku fingerprint, scored. Weights: the two near-watermarks
 * (box-decoration-break:clone inline, mso-highlight without a Word
 * shell — the caller checks Word first) count double; the structural
 * markers count one each. Threshold 3 = an un-highlighted haku card
 * (Calibri div + 13pt h4 + pt-sized underlined runs) passes, while
 * generic rich text sharing any single trait does not.
 */
function isHakuHtml(html: string): boolean {
  let score = 0;
  if (/box-decoration-break:\s*clone/i.test(html)) score += 2;
  if (/mso-highlight:/i.test(html)) score += 2;
  if (/<h4[^>]+style=["'][^"']*font-size:\s*13(\.0+)?pt/i.test(html)) score += 1;
  if (/<div[^>]+style=["'][^"']*font-family:\s*Calibri/i.test(html)) score += 1;
  if (/<u>/i.test(html) && /font-size:\s*\d+(\.\d+)?pt/i.test(html)) score += 1;
  // Case exports: 26pt <h1> pockets / 22pt <h2> hats.
  if (
    /<h1[^>]+style=["'][^"']*font-size:\s*26(\.0+)?pt/i.test(html) ||
    /<h2[^>]+style=["'][^"']*font-size:\s*22(\.0+)?pt/i.test(html)
  ) {
    score += 1;
  }
  return score >= 3;
}
