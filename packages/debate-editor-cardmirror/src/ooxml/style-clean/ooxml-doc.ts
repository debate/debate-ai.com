/**
 * A small python-docx-equivalent shim over the OOXML DOM (word/document.xml +
 * word/styles.xml), exposing exactly the slice the style cleaner needs so the
 * cleaner can be translated 1:1 from `style_cleaner.py`.
 *
 * Fidelity notes (these match python-docx 1.1.0 behavior, which the scouting
 * cleaner relies on):
 *   - `run.bold` / `run.underline` read the run's DIRECT rPr toggle as a
 *     tri-state (true / false / null), with CT_OnOff value parsing.
 *   - `style.name` is the UI name (BabelFish translates builtin internal names
 *     like "heading 1" → "Heading 1"); the setter stores the internal form.
 *   - `style.type` is an int: paragraph=1, character=2, table=3, numbering=4.
 *   - `run.style` defaults to the default character style ("Default Paragraph
 *     Font") when the run has no rStyle (so it is never null).
 *   - `font.color` is always present in python-docx, so callers treat it as
 *     truthy — replicated where used.
 * Runs in the renderer (DOMParser / XMLSerializer available).
 */

import { Docx } from '../docx.js';
import { serializeXmlDoc } from './style-fixup.js';

export const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

// ── DOM helpers ──────────────────────────────────────────────────────

export function getAttr(el: Element, local: string): string | null {
  return el.getAttributeNS(W, local) ?? el.getAttribute(`w:${local}`);
}
function setAttr(el: Element, local: string, val: string): void {
  el.setAttributeNS(W, `w:${local}`, val);
}
function createW(doc: Document, local: string): Element {
  return doc.createElementNS(W, `w:${local}`);
}
function directChild(parent: Element, local: string): Element | null {
  for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    if (c.namespaceURI === W && c.localName === local) return c;
  }
  return null;
}
function directChildren(parent: Element, local: string): Element[] {
  const out: Element[] = [];
  for (let c = parent.firstElementChild; c; c = c.nextElementSibling) {
    if (c.namespaceURI === W && c.localName === local) out.push(c);
  }
  return out;
}
function descendants(el: Element, local: string): Element[] {
  return Array.from(el.getElementsByTagNameNS(W, local));
}
/** Get-or-create a direct child, inserting it as the FIRST element child
 *  (correct schema position for rStyle/pStyle within rPr/pPr, and for
 *  rPr/pPr within r/p). */
function ensureFirstChild(parent: Element, local: string): Element {
  const existing = directChild(parent, local);
  if (existing) return existing;
  const el = createW(parent.ownerDocument, local);
  parent.insertBefore(el, parent.firstChild);
  return el;
}
function removeChildEl(parent: Element, local: string): void {
  for (const c of directChildren(parent, local)) parent.removeChild(c);
}

/** CT_OnOff value → tri-state. Absent attr (val===null) means "on" (true). */
function onOff(val: string | null): boolean {
  if (val === null) return true;
  return !['0', 'false', 'off'].includes(val.toLowerCase());
}

// ── BabelFish: builtin internal name ↔ UI name ───────────────────────
const STYLE_ALIASES: [string, string][] = [
  ['Caption', 'caption'],
  ['Footer', 'footer'],
  ['Header', 'header'],
  ['Heading 1', 'heading 1'],
  ['Heading 2', 'heading 2'],
  ['Heading 3', 'heading 3'],
  ['Heading 4', 'heading 4'],
  ['Heading 5', 'heading 5'],
  ['Heading 6', 'heading 6'],
  ['Heading 7', 'heading 7'],
  ['Heading 8', 'heading 8'],
  ['Heading 9', 'heading 9'],
];
const INTERNAL_TO_UI = new Map(STYLE_ALIASES.map(([ui, internal]) => [internal, ui]));
const UI_TO_INTERNAL = new Map(STYLE_ALIASES.map(([ui, internal]) => [ui, internal]));

const STYLE_TYPE_INT: Record<string, number> = {
  paragraph: 1,
  character: 2,
  table: 3,
  numbering: 4,
};

// rPr toggle/format children cleared by _clear_formatting (excluding sz, which
// is conditional, and highlight, which is preserved).
const CLEAR_TAGS = [
  'b', 'i', 'u', 'strike', 'caps', 'cs', 'vanish', 'kern', 'rFonts', 'noProof',
  'outline', 'shadow', 'smallCaps', 'snapToGrid', 'specVanish', 'vertAlign', 'webHidden',
];

// ── Font ─────────────────────────────────────────────────────────────

export class Font {
  constructor(private r: Element) {}
  private rPrOrNull(): Element | null {
    return directChild(this.r, 'rPr');
  }
  /** Direct rPr size in points (w:sz is half-points), or null. */
  get sizePt(): number | null {
    const rPr = this.rPrOrNull();
    if (!rPr) return null;
    const sz = directChild(rPr, 'sz');
    if (!sz) return null;
    const v = getAttr(sz, 'val');
    if (v === null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n / 2 : null;
  }
  /** Truthy highlight value, or null (treats absent / "none" as null). */
  get highlightColor(): string | null {
    const rPr = this.rPrOrNull();
    if (!rPr) return null;
    const h = directChild(rPr, 'highlight');
    if (!h) return null;
    const v = getAttr(h, 'val');
    return v && v !== 'none' ? v : null;
  }
}

// ── Run ──────────────────────────────────────────────────────────────

export class Run {
  readonly font: Font;
  constructor(public readonly el: Element, private doc: OoxmlDoc) {
    this.font = new Font(el);
  }
  get text(): string {
    let s = '';
    for (const t of descendants(this.el, 't')) s += t.textContent ?? '';
    return s;
  }
  getOrAddRPr(): Element {
    return ensureFirstChild(this.el, 'rPr');
  }
  private rPrOrNull(): Element | null {
    return directChild(this.el, 'rPr');
  }
  /** python-docx run.bold: direct rPr <w:b> tri-state. */
  get bold(): boolean | null {
    const rPr = this.rPrOrNull();
    if (!rPr) return null;
    const b = directChild(rPr, 'b');
    if (!b) return null;
    return onOff(getAttr(b, 'val'));
  }
  /** python-docx run.underline truthiness: w:u present and val != "none". */
  get underline(): boolean | null {
    const rPr = this.rPrOrNull();
    if (!rPr) return null;
    const u = directChild(rPr, 'u');
    if (!u) return null;
    return getAttr(u, 'val') !== 'none';
  }
  /** run.style — resolves rStyle, defaulting to the default character style
   *  (never null), matching python-docx. */
  get style(): Style {
    const rPr = this.rPrOrNull();
    const rStyle = rPr ? directChild(rPr, 'rStyle') : null;
    const id = rStyle ? getAttr(rStyle, 'val') : null;
    if (id) {
      const s = this.doc.styles.byId(id);
      if (s) return s;
    }
    return this.doc.styles.defaultCharacterStyle();
  }
  set style(style: Style | null) {
    if (style === null) {
      const rPr = this.rPrOrNull();
      if (rPr) removeChildEl(rPr, 'rStyle');
      return;
    }
    const rPr = this.getOrAddRPr();
    const rStyle = ensureFirstChild(rPr, 'rStyle');
    setAttr(rStyle, 'val', style.styleId ?? '');
  }
  /** `_has_bold_in_xml`: direct rPr <w:b> (val null or != "0"), else the
   *  run's style's bold. The get-or-add of rPr mirrors python's side effect. */
  boldInXml(): boolean {
    const rPr = this.getOrAddRPr();
    const b = directChild(rPr, 'b');
    if (b) {
      const val = getAttr(b, 'val');
      return val === null || val !== '0';
    }
    return this.style.hasBold();
  }
  /** `_has_underline_in_xml`: direct rPr <w:u> (!= "none"), else style's. */
  underlineInXml(): boolean {
    const rPr = this.getOrAddRPr();
    const u = directChild(rPr, 'u');
    if (u) return getAttr(u, 'val') !== 'none';
    return this.style.hasUnderline();
  }
  /** `_check_real_bold` / `_check_real_underline`. */
  realBold(): boolean {
    return this.boldInXml() || this.bold === true;
  }
  realUnderline(): boolean {
    return this.underlineInXml() || this.underline === true;
  }
  /** Direct rPr <w:b w:val="0"> — an explicit bold-off override. */
  isBoldOff(): boolean {
    const rPr = this.getOrAddRPr();
    const b = directChild(rPr, 'b');
    return b !== null && getAttr(b, 'val') === '0';
  }

  /** Equivalent of python-docx font.bold/underline/size=None etc. clears. */
  clearFormatting(sizeMode: 'conditional' | 'always' | 'skip'): void {
    const rPr = this.rPrOrNull();
    if (!rPr) return;
    for (const tag of CLEAR_TAGS) removeChildEl(rPr, tag);
    if (sizeMode === 'always') {
      removeChildEl(rPr, 'sz');
    } else if (sizeMode === 'conditional') {
      // _clear_formatting: clear size unless it's present and <= 8pt.
      const sz = this.font.sizePt;
      if (sz === null || sz > 8) removeChildEl(rPr, 'sz');
    }
  }
  clearName(): void {
    const rPr = this.rPrOrNull();
    if (rPr) removeChildEl(rPr, 'rFonts');
  }
  clearSize(): void {
    const rPr = this.rPrOrNull();
    if (rPr) removeChildEl(rPr, 'sz');
  }
  removeBorders(): void {
    const rPr = this.rPrOrNull();
    if (!rPr) return;
    removeChildEl(rPr, 'bdr');
    removeChildEl(rPr, 'shd');
  }
  hasBorder(): boolean {
    const rPr = this.rPrOrNull();
    return (rPr && directChild(rPr, 'bdr') !== null) || descendants(this.el, 'bdr').length > 0;
  }
}

// ── Paragraph ────────────────────────────────────────────────────────

export class Paragraph {
  constructor(public readonly el: Element, private doc: OoxmlDoc) {}
  get runs(): Run[] {
    return directChildren(this.el, 'r').map((r) => new Run(r, this.doc));
  }
  get text(): string {
    return this.runs.map((r) => r.text).join('');
  }
  private pPrOrNull(): Element | null {
    return directChild(this.el, 'pPr');
  }
  getOrAddPPr(): Element {
    return ensureFirstChild(this.el, 'pPr');
  }
  /** Outline level int from pPr/outlineLvl, or null. */
  get outlineLevel(): number | null {
    const pPr = this.pPrOrNull();
    if (!pPr) return null;
    const o = directChild(pPr, 'outlineLvl');
    if (!o) return null;
    const v = getAttr(o, 'val');
    if (v === null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  /** Outline level resolved through the paragraph style's basedOn chain —
   *  direct paragraph outlineLvl wins, else the level inherited from its
   *  style (e.g. a style based on Heading 4 inherits outline level 3). */
  effectiveOutlineLevel(): number | null {
    const direct = this.outlineLevel;
    if (direct !== null) return direct;
    return this.doc.styles.effectiveStyleFormat(this.style.styleId).outlineLevel;
  }
  /** Whether the paragraph's text is effectively bold — direct run bold,
   *  else the run's character style, else the paragraph style (each resolved
   *  through its basedOn chain). A direct bold-off on a run wins for that run. */
  effectivelyBold(): boolean {
    const pStyleBold = this.doc.styles.effectiveStyleFormat(this.style.styleId).bold;
    for (const run of this.runs) {
      const direct = run.bold;
      if (direct === true) return true;
      if (direct === false) continue;
      const charBold = this.doc.styles.effectiveStyleFormat(run.style.styleId).bold;
      if (charBold || pStyleBold) return true;
    }
    return false;
  }
  /** paragraph.style — resolves pStyle, defaulting to the default paragraph
   *  style (never null), matching python-docx. */
  get style(): Style {
    const pPr = this.pPrOrNull();
    const pStyle = pPr ? directChild(pPr, 'pStyle') : null;
    const id = pStyle ? getAttr(pStyle, 'val') : null;
    if (id) {
      const s = this.doc.styles.byId(id);
      if (s) return s;
    }
    return this.doc.styles.defaultParagraphStyle();
  }
  set style(style: Style) {
    const pPr = this.getOrAddPPr();
    const pStyle = ensureFirstChild(pPr, 'pStyle');
    setAttr(pStyle, 'val', style.styleId ?? '');
  }
  /** Remove pPr/spacing, pPr/ind, pPr/jc (final cleanup). */
  removeParagraphFormatting(): void {
    const pPr = this.pPrOrNull();
    if (!pPr) return;
    for (const tag of ['spacing', 'ind', 'jc']) removeChildEl(pPr, tag);
  }
}

// ── Style ────────────────────────────────────────────────────────────

export class Style {
  /** `owner` is the Styles collection that cached this Style; mutations that
   *  change the id/name index invalidate its cache. */
  constructor(public readonly el: Element, private owner?: Styles) {}
  get styleId(): string | null {
    return getAttr(this.el, 'styleId');
  }
  /** UI name (BabelFish-translated from the stored internal name). */
  get name(): string | null {
    const nameEl = directChild(this.el, 'name');
    if (!nameEl) return null;
    const internal = getAttr(nameEl, 'val');
    if (internal === null) return null;
    return INTERNAL_TO_UI.get(internal) ?? internal;
  }
  set name(uiName: string) {
    const internal = UI_TO_INTERNAL.get(uiName) ?? uiName;
    const nameEl = directChild(this.el, 'name') ?? (() => {
      const e = createW(this.el.ownerDocument, 'name');
      this.el.insertBefore(e, this.el.firstChild);
      return e;
    })();
    setAttr(nameEl, 'val', internal);
    this.owner?.invalidate();
  }
  /** python-docx WD_STYLE_TYPE int: paragraph=1, character=2, table=3,
   *  numbering=4. Null if no w:type. */
  get type(): number | null {
    const t = getAttr(this.el, 'type');
    if (t === null) return null;
    return STYLE_TYPE_INT[t] ?? null;
  }
  get isDefault(): boolean {
    return getAttr(this.el, 'default') === '1';
  }
  /** `_style_has_underline`: this style's rPr/u present and not "none". */
  hasUnderline(): boolean {
    const rPr = directChild(this.el, 'rPr');
    if (!rPr) return false;
    const u = directChild(rPr, 'u');
    return u !== null && getAttr(u, 'val') !== 'none';
  }
  /** `_style_has_bold`: this style's rPr/b present and val is null or != "0". */
  hasBold(): boolean {
    const rPr = directChild(this.el, 'rPr');
    if (!rPr) return false;
    const b = directChild(rPr, 'b');
    if (!b) return false;
    const val = getAttr(b, 'val');
    return val === null || val !== '0';
  }
  /** `_style_has_border`: this style's rPr has a w:bdr child. */
  hasBorder(): boolean {
    const rPr = directChild(this.el, 'rPr');
    return rPr !== null && directChild(rPr, 'bdr') !== null;
  }
  /** This style's basedOn style id, or null. */
  basedOnId(): string | null {
    const b = directChild(this.el, 'basedOn');
    return b ? getAttr(b, 'val') : null;
  }
  /** This style's linked (paragraph<->character) style id, or null. */
  linkId(): string | null {
    const l = directChild(this.el, 'link');
    return l ? getAttr(l, 'val') : null;
  }
  /** This style's OWN pPr outline level (not inherited), or null. */
  ownOutlineLevel(): number | null {
    const pPr = directChild(this.el, 'pPr');
    if (!pPr) return null;
    const o = directChild(pPr, 'outlineLvl');
    if (!o) return null;
    const v = getAttr(o, 'val');
    if (v === null) return null;
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : null;
  }
  /** This style's OWN rPr bold toggle as a tri-state (true/false/null) — null
   *  means "not set here, inherit from basedOn". */
  ownBoldState(): boolean | null {
    const rPr = directChild(this.el, 'rPr');
    if (!rPr) return null;
    const b = directChild(rPr, 'b');
    if (!b) return null;
    return onOff(getAttr(b, 'val'));
  }
  getAlias(): string | null {
    const a = directChild(this.el, 'aliases');
    return a ? getAttr(a, 'val') : null;
  }
  setAlias(val: string): void {
    const a = directChild(this.el, 'aliases') ?? (() => {
      const e = createW(this.el.ownerDocument, 'aliases');
      // <w:aliases> follows <w:name> in the schema; append is fine for Word.
      this.el.appendChild(e);
      return e;
    })();
    setAttr(a, 'val', val);
  }
  removeAlias(): void {
    removeChildEl(this.el, 'aliases');
  }
  remove(): void {
    this.el.parentNode?.removeChild(this.el);
    this.owner?.invalidate();
  }
}

// ── Styles collection ────────────────────────────────────────────────

/** A style's effective formatting resolved through its basedOn chain. */
export interface EffectiveFormat {
  outlineLevel: number | null;
  bold: boolean;
}

export class Styles {
  // Lazily-built indexes. A document can have thousands of styles and the
  // cleaner does a lookup per run, so a linear scan per call is O(styles ×
  // runs) and times out on large docs. The cache is invalidated whenever a
  // style is added / removed / renamed.
  private cache: { all: Style[]; byId: Map<string, Style>; byName: Map<string, Style> } | null = null;
  private effectiveMemo = new Map<string, EffectiveFormat>();
  constructor(private root: Element) {}

  private index(): { all: Style[]; byId: Map<string, Style>; byName: Map<string, Style> } {
    if (this.cache) return this.cache;
    const all = directChildren(this.root, 'style').map((e) => new Style(e, this));
    const byId = new Map<string, Style>();
    const byName = new Map<string, Style>();
    for (const s of all) {
      const id = s.styleId;
      if (id !== null && !byId.has(id)) byId.set(id, s); // keep first, like find()
      const nm = s.name;
      if (nm !== null && !byName.has(nm)) byName.set(nm, s);
    }
    this.cache = { all, byId, byName };
    return this.cache;
  }

  /** Drop the cached indexes after a structural change. */
  invalidate(): void {
    this.cache = null;
    this.effectiveMemo.clear();
  }

  /** Resolve a style's *effective* outline level + bold by walking its
   *  basedOn chain (memoized, cycle-guarded). Lets header detection see
   *  heading/bold formatting that lives on the style chain rather than as
   *  direct paragraph/run formatting (e.g. a style based on Heading 4). */
  effectiveStyleFormat(styleId: string | null): EffectiveFormat {
    if (styleId === null) return { outlineLevel: null, bold: false };
    return this.resolveEffective(styleId, new Set());
  }
  private resolveEffective(styleId: string, seen: Set<string>): EffectiveFormat {
    const cached = this.effectiveMemo.get(styleId);
    if (cached) return cached;
    const style = this.byId(styleId);
    if (!style || seen.has(styleId)) return { outlineLevel: null, bold: false };
    seen.add(styleId);
    const based = style.basedOnId();
    const parent = based ? this.resolveEffective(based, seen) : { outlineLevel: null, bold: false };
    const ownBold = style.ownBoldState();
    const eff: EffectiveFormat = {
      outlineLevel: style.ownOutlineLevel() ?? parent.outlineLevel,
      bold: ownBold ?? parent.bold,
    };
    this.effectiveMemo.set(styleId, eff);
    return eff;
  }

  all(): Style[] {
    return this.index().all;
  }
  byId(id: string): Style | null {
    return this.index().byId.get(id) ?? null;
  }
  /** python-docx `styles[key]` — resolves by styleId (with a UI-name fallback). */
  get(key: string): Style {
    const idx = this.index();
    const s = idx.byId.get(key) ?? idx.byName.get(key) ?? null;
    if (!s) throw new Error(`no style with id or name '${key}'`);
    return s;
  }
  /** python-docx `key in styles` — matches by UI NAME only (not styleId). The
   *  cleaner's `_get_style_variation` relies on this name-based membership. */
  has(key: string): boolean {
    return this.index().byName.has(key);
  }
  defaultParagraphStyle(): Style {
    const found = this.index().all.find((s) => s.type === 1 && s.isDefault);
    return found ?? this.synthetic('Normal');
  }
  defaultCharacterStyle(): Style {
    const all = this.index().all;
    const found =
      all.find((s) => s.type === 2 && s.isDefault) ??
      all.find((s) => s.name === 'Default Paragraph Font');
    return found ?? this.synthetic('Default Paragraph Font');
  }
  private syntheticEl: Map<string, Style> = new Map();
  private synthetic(name: string): Style {
    let s = this.syntheticEl.get(name);
    if (!s) {
      const el = createW(this.root.ownerDocument, 'style');
      const nameEl = createW(this.root.ownerDocument, 'name');
      setAttr(nameEl, 'val', name);
      el.appendChild(nameEl);
      s = new Style(el); // detached; only its .name is read
      this.syntheticEl.set(name, s);
    }
    return s;
  }
}

// ── Document ─────────────────────────────────────────────────────────

export class OoxmlDoc {
  readonly styles: Styles;
  private constructor(
    private docx: Docx,
    private documentDoc: Document,
    private stylesDoc: Document,
  ) {
    this.styles = new Styles(stylesDoc.documentElement);
  }

  static async fromDocx(docx: Docx): Promise<OoxmlDoc> {
    const docXml = await docx.readText('word/document.xml');
    const stylesXml = await docx.readText('word/styles.xml');
    if (docXml === null) throw new Error('word/document.xml missing');
    if (stylesXml === null) throw new Error('word/styles.xml missing');
    const documentDoc = new DOMParser().parseFromString(docXml, 'application/xml');
    const stylesDoc = new DOMParser().parseFromString(stylesXml, 'application/xml');
    return new OoxmlDoc(docx, documentDoc, stylesDoc);
  }

  /** Body-level paragraphs only (direct w:p children of w:body), matching
   *  python-docx `document.paragraphs` (excludes table-cell paragraphs). */
  get paragraphs(): Paragraph[] {
    const body = directChild(this.documentDoc.documentElement, 'body');
    if (!body) return [];
    return directChildren(body, 'p').map((p) => new Paragraph(p, this));
  }

  /** All <w:hyperlink> elements in document.xml (for unwrapping). */
  hyperlinks(): Element[] {
    return descendants(this.documentDoc.documentElement, 'hyperlink');
  }

  /** Import every <w:style> from a canonical styles.xml whose styleId is not
   *  already defined, so a document missing the Verbatim styles can be cleaned
   *  rather than rejected. Returns the ids added. Invalidates the style index
   *  so the newly-added styles are resolvable. */
  injectMissingStyles(canonicalStylesXml: string): string[] {
    const canon = new DOMParser().parseFromString(canonicalStylesXml, 'application/xml');
    const root = this.stylesDoc.documentElement;
    const existing = new Set(
      this.styles.all().map((s) => s.styleId).filter((id): id is string => id !== null),
    );
    const added: string[] = [];
    for (const styleEl of Array.from(canon.getElementsByTagNameNS(W, 'style'))) {
      const sid = getAttr(styleEl, 'styleId');
      if (sid === null || existing.has(sid)) continue;
      root.appendChild(this.stylesDoc.importNode(styleEl, true));
      existing.add(sid);
      added.push(sid);
    }
    if (added.length) this.styles.invalidate();
    return added;
  }

  /** Serialize document.xml + styles.xml back into the docx and return bytes. */
  async save(): Promise<Uint8Array> {
    this.docx.writeText('word/document.xml', serializeXmlDoc(this.documentDoc));
    this.docx.writeText('word/styles.xml', serializeXmlDoc(this.stylesDoc));
    return this.docx.toBuffer();
  }
}
