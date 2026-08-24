/**
 * Headless .docx style cleaner for Verbatim-standard formatting — a faithful
 * TypeScript port of the scouting-assistant `style_cleaner.py`, running over the
 * python-docx-equivalent shim (`ooxml-doc.ts`). Pipeline (`cleanDocumentBytes`):
 *   normalize required style names → inject missing canonical styles →
 *   remap legacy styles → normalize aliases → formatting→styles conversion →
 *   rename/remove style defs → save → fix dangling refs.
 *
 * Behavior is matched to python-docx 1.1.0 as the scouting tool relies on it
 * (see ooxml-doc.ts fidelity notes). The one knowingly-reproduced quirk: in the
 * number-sequence branch of process_entirely_bold the citation set is built from
 * a fresh `paragraph.runs` call, so by object identity it matches nothing and
 * every run is cleared — identical to the Python.
 */

import { Docx } from '../docx.js';
import { CANONICAL_STYLES_XML } from '../styles.js';
import { OoxmlDoc, type Paragraph, type Run } from './ooxml-doc.js';
import { COMBINED_STYLE_MAP } from './template-styles.js';
import { fixDanglingStyleRefs } from './style-fixup.js';
import { remapLegacyStyles } from './legacy-remap.js';

/** Style groups the cleaner requires (matched by name). When a document lacks
 *  any of them it can't classify formatting, so we inject the canonical
 *  Verbatim styles first instead of failing. */
const REQUIRED_STYLE_GROUPS: string[][] = [
  ['Style13ptBold', 'Style 13 pt Bold'],
  ['StyleUnderline', 'Style Underline'],
  ['Emphasis'],
];

function requiredStylesMissing(doc: OoxmlDoc): boolean {
  return REQUIRED_STYLE_GROUPS.some((variants) => !variants.some((v) => doc.styles.has(v)));
}

/** Yield to the event loop so the UI can repaint progress between chunks of
 *  the otherwise-synchronous conversion pass. */
const yieldToUi = (): Promise<void> => new Promise((resolve) => setTimeout(resolve));

// ── normalize_style_definitions ──────────────────────────────────────

function normalizeStyleDefinitions(doc: OoxmlDoc): void {
  const targetNames: Record<string, string[]> = {
    Style13ptBold: ['Style 13 pt Bold', 'Cite', 'Old Cite'],
    StyleUnderline: ['Style Underline', 'Underline'],
    Emphasis: ['Emphasis'],
  };
  for (const style of doc.styles.all()) {
    const name = style.name;
    if (name === null) continue;
    const aliasStr = style.getAlias();
    if (!aliasStr) continue;
    const aliases = aliasStr.split(',').map((a) => a.trim());
    for (const [target, acceptable] of Object.entries(targetNames)) {
      if (acceptable.includes(name) && aliases.includes(target)) {
        style.name = target;
        const newAliases = aliases.filter((a) => a !== target);
        newAliases.push(name);
        style.setAlias(newAliases.join(','));
        break;
      }
    }
  }
}

// ── verify_style_availability / _get_style_variation ─────────────────

function verifyStyleAvailability(doc: OoxmlDoc): void {
  const groups: Record<string, string[]> = {
    citation: ['Style13ptBold', 'Style 13 pt Bold'],
    underline: ['StyleUnderline', 'Style Underline'],
    emphasis: ['Emphasis'],
  };
  const missing = Object.entries(groups)
    .filter(([, vars]) => !vars.some((v) => doc.styles.has(v)))
    .map(([purpose]) => purpose);
  if (missing.length) {
    throw new Error(
      `Document missing required style types: ${missing.join(', ')}. ` +
        'Please ensure document has appropriate styles for: ' +
        'citation, underlining, and emphasis formatting.',
    );
  }
}

const VARIATIONS: Record<string, string[]> = {
  Style13ptBold: ['Style13ptBold', 'Style 13 pt Bold'],
  StyleUnderline: ['StyleUnderline', 'Style Underline'],
  Emphasis: ['Emphasis'],
};

function getStyleVariation(doc: OoxmlDoc, base: string): string {
  const vars = VARIATIONS[base];
  if (!vars) return base;
  for (const v of vars) if (doc.styles.has(v)) return v;
  return base;
}

/** Repair a required style that's present under the canonical styleId but a name
 *  the cleaner doesn't recognize — e.g. a Verbatim "!!Style Underline". Without
 *  this it fails the name-based availability check even though the style is right
 *  there, and injection can't help because the styleId is already taken. Only
 *  fires when the name isn't already an accepted variant, so well-named docs are
 *  untouched. */
function normalizeRequiredStyleNames(doc: OoxmlDoc): void {
  for (const [id, variants] of Object.entries(VARIATIONS)) {
    const style = doc.styles.byId(id);
    if (!style) continue;
    const name = style.name;
    if (name !== null && variants.includes(name)) continue; // already recognized
    const canonical = COMBINED_STYLE_MAP[id]?.name;
    if (canonical) style.name = canonical;
  }
}

// ── run / paragraph analysis helpers ─────────────────────────────────

function checkEntirelyBold(paragraph: Paragraph): Run[] | null {
  const allRuns = paragraph.runs.filter((r) => r.text.trim() !== '');
  if (!allRuns.length) return null;
  return allRuns.every((r) => r.realBold()) ? allRuns : null;
}

function paragraphHasText(paragraph: Paragraph): boolean {
  return paragraph.runs.some((r) => r.text.trim() !== '');
}

/** `_find_font_size_variation` — the runs larger than the most common size. */
function findFontSizeVariation(runs: Run[]): Run[] | null {
  const sizeData: [Run, number][] = [];
  for (const run of runs) {
    const sp = run.font.sizePt;
    if (sp !== null && sp >= 6 && sp <= 72) sizeData.push([run, sp]);
  }
  if (!sizeData.length) return null;
  const counts = new Map<number, number>();
  for (const [, size] of sizeData) {
    const rounded = Math.round(size * 2) / 2;
    counts.set(rounded, (counts.get(rounded) ?? 0) + 1);
  }
  // sort by (-count, size); base = most frequent (ties → smaller size).
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0]);
  const baseSize = sorted[0]![0];
  const larger = sizeData.filter(([, s]) => s > baseSize + 0.5).map(([r]) => r);
  return larger.length ? larger : null;
}

function findHighlightedRuns(runs: Run[]): Run[] | null {
  const hl = runs.filter((r) => r.font.highlightColor !== null);
  return hl.length ? hl : null;
}

function findNumberSequence(paragraph: Paragraph): Run[] | null {
  const acc: Run[] = [];
  for (const run of paragraph.runs) {
    acc.push(run);
    if (/\d/.test(run.text)) return acc;
  }
  return null;
}

// ── process_document_styles ──────────────────────────────────────────

function processDocumentStyles(doc: OoxmlDoc, protectedIds: Set<string>): void {
  const toRemove: ReturnType<OoxmlDoc['styles']['all']> = [];
  for (const style of doc.styles.all()) {
    const sid = style.styleId;
    const name = style.name;
    if (sid === null || name === null) continue;
    if (Object.prototype.hasOwnProperty.call(COMBINED_STYLE_MAP, sid)) {
      const target = COMBINED_STYLE_MAP[sid]!;
      if (name !== target.name) style.name = target.name;
      if (target.alias) style.setAlias(target.alias);
      else if (style.getAlias() !== null) style.removeAlias();
    } else if (protectedIds.has(sid)) {
      // Protected style (or a dependency of one) — keep its definition as-is.
    } else {
      toRemove.push(style);
    }
  }
  for (const style of toRemove) style.remove();
}

// ── attempt_text_conversion ──────────────────────────────────────────

async function attemptTextConversion(
  doc: OoxmlDoc,
  convertAnalytics: boolean,
  protectedNamesLower: Set<string>,
  protectedIds: Set<string>,
  progressCallback?: (current: number, total: number) => void,
): Promise<void> {
  verifyStyleAvailability(doc);

  // A paragraph/run carrying a protected style is left alone (its style isn't
  // reassigned); the style itself is also exempt from removal below.
  const isProtected = (name: string | null): boolean =>
    name !== null && protectedNamesLower.has(name.toLowerCase());

  const citationStyle = getStyleVariation(doc, 'Style13ptBold');
  const underlineStyle = getStyleVariation(doc, 'StyleUnderline');
  const emphasisStyle = getStyleVariation(doc, 'Emphasis');

  const processEntirelyBoldParagraph = (paragraph: Paragraph): boolean => {
    const boldRuns = checkEntirelyBold(paragraph);
    if (!boldRuns) return false;
    const cs = getStyleVariation(doc, 'Style13ptBold');

    const paraText = paragraph.text.trim();
    if (paraText.length <= 60) {
      for (const r of boldRuns) {
        r.style = doc.styles.get(cs);
        r.clearFormatting('always');
      }
      return true;
    }

    const larger = findFontSizeVariation(boldRuns);
    if (larger) {
      const set = new Set(larger);
      for (const r of boldRuns) {
        r.style = set.has(r) ? doc.styles.get(cs) : null;
        r.clearFormatting('always');
      }
      return true;
    }

    const highlighted = findHighlightedRuns(boldRuns);
    if (highlighted) {
      const set = new Set(highlighted);
      for (const r of boldRuns) {
        r.style = set.has(r) ? doc.styles.get(cs) : null;
        r.clearFormatting('always');
      }
      return true;
    }

    // Fresh `paragraph.runs` → no identity overlap with boldRuns (faithful
    // to the Python: every run ends up cleared with no citation style).
    const numberRuns = findNumberSequence(paragraph);
    if (numberRuns) {
      const set = new Set(numberRuns);
      for (const r of boldRuns) {
        r.style = set.has(r) ? doc.styles.get(cs) : null;
        r.clearFormatting('always');
      }
      return true;
    }

    for (const r of boldRuns) {
      r.style = doc.styles.get(cs);
      r.clearFormatting('always');
    }
    return true;
  };

  // ----- First pass: header detection -----
  // Local divergences from the original (deliberate improvements):
  //  - outline level + the Tag bold check are resolved through the style's
  //    basedOn chain (`effectiveOutlineLevel` / `effectivelyBold`), so a
  //    paragraph that is a heading/tag only via its style (e.g. based on
  //    Heading 4) is still caught — the original saw only direct formatting.
  //  - the Analytic name match is case-insensitive, so "analytic real",
  //    "analytics", etc. convert too (the original matched capital-A only).
  const isAnalyticName = (nm: string | null): boolean =>
    convertAnalytics && nm !== null && nm.toLowerCase().includes('analytic');
  // Reassigning a paragraph to a canonical heading needs that style present. It
  // usually is (injected when the required styles are missing, or already in the
  // doc), but a doc that HAS the required styles can still lack a specific
  // HeadingN — python-docx treats built-in headings as always-available; our
  // shim doesn't. Inject the canonical set on demand (idempotent) so the lookup
  // can't throw and the reassigned paragraph gets a real style definition.
  const ensureHeadingStyle = (id: string) => {
    try {
      return doc.styles.get(id);
    } catch {
      doc.injectMissingStyles(CANONICAL_STYLES_XML);
      return doc.styles.get(id);
    }
  };
  for (const paragraph of doc.paragraphs) {
    if (isProtected(paragraph.style.name)) continue; // protected paragraph style — don't reassign
    const outline = paragraph.effectiveOutlineLevel();
    if (outline === 0 && paragraph.runs.some((r) => r.bold === true && r.font.sizePt === 26)) {
      paragraph.style = ensureHeadingStyle('Heading1');
    } else if (outline === 1 && paragraph.runs.some((r) => r.bold === true && r.font.sizePt === 22)) {
      paragraph.style = ensureHeadingStyle('Heading2');
    } else if (
      outline === 2 &&
      paragraph.runs.some((r) => r.bold === true && r.underline === true && r.font.sizePt === 16)
    ) {
      paragraph.style = ensureHeadingStyle('Heading3');
    } else if (outline === 3) {
      if (isAnalyticName(paragraph.style.name)) {
        try {
          paragraph.style = doc.styles.get('Analytic');
        } catch {
          paragraph.style = ensureHeadingStyle('Heading4');
        }
      } else if (paragraph.effectivelyBold()) {
        // Effective bold (direct, or inherited from the style chain) → Tag.
        paragraph.style = ensureHeadingStyle('Heading4');
      }
    } else if (isAnalyticName(paragraph.style.name)) {
      try {
        paragraph.style = doc.styles.get('Analytic');
      } catch {
        paragraph.style = ensureHeadingStyle('Heading4');
      }
    }
  }

  // ----- Remove unapproved (type==2 / character) styles not in the map -----
  const paraStylesToRemove = doc.styles.all().filter((style) => {
    if (style.type !== 2) return false;
    const sid = style.styleId;
    if (sid !== null && protectedIds.has(sid)) return false; // protected — keep
    return sid === null || !Object.prototype.hasOwnProperty.call(COMBINED_STYLE_MAP, sid);
  });
  for (const style of paraStylesToRemove) style.remove();

  // ----- Second pass: run-level processing -----
  let currentSectionHasUnderline = false;
  let afterHeadingSeekingText = false;
  let canProcessCitations = false;

  let totalRuns = 0;
  if (progressCallback) for (const p of doc.paragraphs) totalRuns += p.runs.length;
  let runsProcessed = 0;

  for (const paragraph of doc.paragraphs) {
    const styleName = paragraph.style.name ?? '';
    const isHeading = styleName.startsWith('Heading') || styleName.startsWith('Analytic');
    if (isHeading) {
      currentSectionHasUnderline = false;
      afterHeadingSeekingText = true;
      canProcessCitations = false;
      continue;
    }

    if (!isHeading && afterHeadingSeekingText) {
      const hasText = paragraphHasText(paragraph);
      const isUndertag = styleName.startsWith('Undertag');
      if (hasText && !isUndertag) {
        canProcessCitations = true;
        afterHeadingSeekingText = false;
      } else {
        continue;
      }
    } else {
      canProcessCitations = false;
    }

    for (const run of paragraph.runs) {
      if (run.realUnderline() && !run.realBold()) {
        currentSectionHasUnderline = true;
        break;
      }
    }

    let entirelyBoldDone = false;
    for (const run of paragraph.runs) {
      if (progressCallback) {
        runsProcessed++;
        if (runsProcessed % 200 === 0 || runsProcessed === totalRuns) {
          progressCallback(runsProcessed, totalRuns);
          await yieldToUi();
        }
      }

      // A run carrying a protected character style is left untouched.
      if (isProtected(run.style.name)) continue;

      // Calibri Light / Title style → Underline
      const sn = run.style.name;
      if (!canProcessCitations && sn !== null && sn.includes('Title')) {
        run.style = doc.styles.get(underlineStyle);
        run.clearFormatting('conditional');
        continue;
      }

      // Borders → Emphasis
      if (run.hasBorder() || run.style.hasBorder()) {
        run.style = doc.styles.get(emphasisStyle);
        run.removeBorders();
        run.clearFormatting('skip');
        continue;
      }

      // Citation style used in the wrong place
      if (run.style.name === citationStyle) {
        if (!canProcessCitations && !run.realUnderline()) {
          if (run.font.highlightColor !== null) run.style = doc.styles.get(underlineStyle);
          else run.style = null;
          run.clearFormatting('conditional');
          continue;
        }
      }

      // Bold-off override drops a stale citation style
      if (
        (run.style.name === citationStyle || run.style.name === 'Style 13 pt Bold') &&
        run.isBoldOff()
      ) {
        run.style = null;
      }

      const isUnderlined = run.realUnderline();
      const isBold = run.realBold();

      if (canProcessCitations) {
        if (!entirelyBoldDone) {
          if (processEntirelyBoldParagraph(paragraph)) {
            entirelyBoldDone = true;
            break;
          }
        }
        if (isBold && !(run.style.name === underlineStyle || run.style.name === emphasisStyle)) {
          run.style = doc.styles.get(citationStyle);
          run.clearFormatting('always');
          continue;
        }
      }

      if (
        isUnderlined &&
        !isBold &&
        !(run.style.name === emphasisStyle || run.style.name === citationStyle)
      ) {
        run.style = doc.styles.get(underlineStyle);
      } else if (isBold && isUnderlined) {
        run.style = currentSectionHasUnderline
          ? doc.styles.get(emphasisStyle)
          : doc.styles.get(underlineStyle);
      }

      run.clearFormatting('conditional');
    }
  }

  // ----- Concluding sweep 1: highlighted Normal/unstyled → Underline -----
  for (const paragraph of doc.paragraphs) {
    for (const run of paragraph.runs) {
      if (run.font.highlightColor !== null) {
        const nm = run.style.name;
        if (nm === null || nm === 'Normal' || nm === 'Default Paragraph Font') {
          run.style = doc.styles.get(underlineStyle);
        }
      }
    }
  }

  // ----- Concluding sweep 2: clear <=7pt size from non-Normal styled runs ---
  for (const paragraph of doc.paragraphs) {
    for (const run of paragraph.runs) {
      const nm = run.style.name;
      if (nm !== null && nm !== 'Normal' && nm !== 'Default Paragraph Font') {
        const sp = run.font.sizePt;
        if (sp !== null && sp <= 7) run.clearSize();
      }
    }
  }

  // ----- Final cleanup: clear font name + remove paragraph spacing/ind/jc ---
  for (const paragraph of doc.paragraphs) {
    for (const run of paragraph.runs) run.clearName();
    paragraph.removeParagraphFormatting();
  }

  // ----- Remove hyperlinks (unwrap, keeping their runs) -----
  for (const hl of doc.hyperlinks()) {
    const parent = hl.parentNode;
    if (!parent) continue;
    while (hl.firstChild) parent.insertBefore(hl.firstChild, hl);
    parent.removeChild(hl);
  }
}

// ── Public API: clean_document_bytes ─────────────────────────────────

export interface CleanOptions {
  /** Style names (matched case-insensitively) that must never be removed or
   *  reassigned away from. Their basedOn/linked dependencies are kept too.
   *  Paragraphs/runs that carry one are left as-is. */
  protectedStyleNames?: string[];
  /** Called with (runsProcessed, totalRuns) during the conversion pass. */
  progressCallback?: (current: number, total: number) => void;
}

/** The set of style ids that are protected: the styles whose name matches
 *  `protectedNamesLower`, plus their basedOn/linked dependency closure. */
function computeProtectedClosure(doc: OoxmlDoc, protectedNamesLower: Set<string>): Set<string> {
  const closure = new Set<string>();
  if (protectedNamesLower.size === 0) return closure;
  const queue: string[] = [];
  for (const style of doc.styles.all()) {
    const sid = style.styleId;
    const nm = style.name;
    if (sid !== null && nm !== null && protectedNamesLower.has(nm.toLowerCase()) && !closure.has(sid)) {
      closure.add(sid);
      queue.push(sid);
    }
  }
  while (queue.length) {
    const style = doc.styles.byId(queue.pop()!);
    if (!style) continue;
    for (const dep of [style.basedOnId(), style.linkId()]) {
      if (dep && !closure.has(dep)) {
        closure.add(dep);
        queue.push(dep);
      }
    }
  }
  return closure;
}

export async function cleanDocumentBytes(
  fileBytes: Uint8Array,
  options: CleanOptions = {},
): Promise<Uint8Array> {
  const protectedNamesLower = new Set((options.protectedStyleNames ?? []).map((n) => n.toLowerCase()));

  const docx = await Docx.load(fileBytes);
  const doc = await OoxmlDoc.fromDocx(docx);

  // Repair required styles present under the canonical styleId but an
  // unrecognized name (e.g. a Verbatim "!!"-marked name) before any of the
  // name-based checks below — otherwise they look "missing" and injection can't
  // fix them (the styleId is already taken).
  normalizeRequiredStyleNames(doc);

  // If the document is missing the required Verbatim styles, inject the
  // canonical definitions so the cleaner can classify formatting instead of
  // failing. Only fires when a required style is actually absent, so
  // documents that already have them are untouched. Capture the result before
  // injecting — it also decides the legacy-remap mode below.
  const missingRequired = requiredStylesMissing(doc);
  if (missingRequired) {
    doc.injectMissingStyles(CANONICAL_STYLES_XML);
  }

  // Remap legacy debate styles (Tags/Cards/Cites/Block Headings/Author-Date/…)
  // to canonical Verbatim styles when the document actually uses them, so
  // pre-Verbatim and partially-migrated files clean correctly instead of
  // collapsing to Normal. A doc that already has the Verbatim styles is treated
  // as "mixed" — its legacy headings keep their own outline level; a pure
  // pre-Verbatim doc has its hierarchy depth inferred.
  remapLegacyStyles(doc, { mixedMode: !missingRequired, protectedNamesLower });

  const protectedIds = computeProtectedClosure(doc, protectedNamesLower);

  normalizeStyleDefinitions(doc);
  await attemptTextConversion(doc, true, protectedNamesLower, protectedIds, options.progressCallback);
  processDocumentStyles(doc, protectedIds);

  // processDocumentStyles already reduces to the canonical (+protected) style
  // set, so there's nothing to prune; just repair any now-dangling references.
  return (await fixDanglingStyleRefs(await doc.save())).bytes;
}
