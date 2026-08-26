/**
 * AI Repair Formatting — sibling of Repair Text, for the FORMATTING
 * side of imported cards.
 *
 * Verbatim's body-text scheme is four nested passes: underline_mark
 * (broadest, "everything relevant"), emphasis_mark (stand-out within
 * the underlining), highlight ("read aloud"), shading (distinguish
 * some of the highlighting). Imported cards break this in
 * characteristic ways: bold/italic standing in for emphasis, direct
 * underlining instead of the named style, bold-underline as the ONLY
 * underlining (no emphasis pass), or underlining destroyed entirely —
 * recoverable only from font size (normal-size text was underlined,
 * shrunk text wasn't).
 *
 * Mechanism: the model never re-emits the card. We compute the card's
 * distinct FORMATTING SIGNATURES (the set of marks on each run) and
 * send the plain text plus a signature table with sample excerpts;
 * the model returns a tiny mapping — signature → canonical target —
 * plus optional verbatim text fragments whose formatting should
 * differ from their signature's blanket rule. A helper applies the
 * mapping. The model physically cannot alter text, and output size is
 * constant regardless of card length. One request per card, so
 * card-scoped judgments (e.g. "is ALL underlining bold?") stay
 * card-scoped. Eligible blocks: card_body and doc-level paragraphs
 * only — never structural blocks or cite paragraphs.
 */

import type { EditorView } from 'prosemirror-view';
import type { EditorState, Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema } from '../../schema/index.js';
import { settings } from '../settings.js';
import { aiFailureNotice, aiGateToast, callLlm, LlmError, activeApiKey } from './llm.js';
import { salvageJson, extractJsonObjects } from './repair-text.js';
import { showToast } from '../toast.js';
import { AiActivity } from './ai-activity.js';
import { claimRegion } from './edit-coordinator.js';
import { setRepairFlashes, clearRepairFlashes } from '../repair-highlight-plugin.js';

export const DEFAULT_FORMAT_REPAIR_PROMPT = `You are a debate-evidence formatting repair tool. Cut cards use Verbatim's body-text scheme — four layers, each a subset of the one before:

- u  (underline): the broadest pass — everything relevant to the argument.
- em (emphasis): makes some of the underlining stand out. Renders bold+underline, so an em span is NOT also tagged u.
- hl (highlight): what is read aloud.
- shd (shading): distinguishes some of the highlighting.
- b / i (bold / italic): NOT part of the scheme — keep them ONLY when they are an intentional extra layer alongside real emphasis, or reproduce formatting from the source text itself (book titles, foreign terms, sic).

You receive one card: its plain text, then a table of the FORMATTING SIGNATURES present — each signature is the exact set of current formats on some runs of text, with run counts and sample excerpts. Input signatures may also contain:

- du: direct underlining (not the named underline style)
- small: text smaller than the card's base size (the shrink convention for un-underlined text)
- cite: citation character-style debris that leaked into body text

Decide what each signature SHOULD be, using these repair patterns:

1. du is underlining → map to u.
2. b+u (bold underline): the FACTS section states whether the card has plain (non-bold) underlining — follow it. If plain underlining exists, b+u is the stand-out layer → ["em"] (and b+hl+u → ["em","hl"]). If the FACTS say ALL underlining is bold, there was no emphasis pass — bold-underline IS the underlining: b+u → ["u"] and b+hl+u → ["u","hl"], NOT em.
3. b or i alone amid underlined text usually stands in for emphasis → em. BUT keep b / i (possibly alongside em or u) when it coexists with real emphasis as an extra differentiation layer, or when the samples read as reproduced source formatting (titles, foreign words, single emphasized terms from the original author).
4. If the card has NO underlining at all but mixes base-size and small text, the base-size text WAS the underlined text → map plain to u and small to nothing. (Sizes themselves are never changed — only the marks.)
5. Highlighting stays hl. Highlighted text should normally also be underlined: a signature of just hl usually maps to u+hl.
6. Shading stays shd (on top of its highlighting).
7. cite debris in body text is not formatting — drop it from the target.
8. em in the INPUT is already canonical emphasis — existing user work. Any signature containing em KEEPS em in its target (em+hl → ["em","hl"]). Never convert em to u; never strip it as part of a blanket rule.
9. When unsure, change less: map a signature to itself rather than guess.

Respond with ONLY a JSON object, no prose, no code fences:

{"map": {"<signature>": ["target","flags"], ...}, "exceptions": [{"text": "<verbatim fragment>", "format": ["i"]}]}

Rules:
- Map keys are signatures copied EXACTLY from the table (e.g. "b+u", "du", "plain", "small").
- Targets use only: u, em, b, i, hl, shd. Each target is an ARRAY of separate flag strings — ["u","hl"], never "u+hl". An empty array [] means plain text. Do not combine em with u (em implies underline).
- Include every signature from the table; mapping it to itself means "leave unchanged".
- "exceptions" (optional): verbatim text fragments — copied character-for-character from the card text — whose formatting should DIFFER from their signature's rule (e.g. a book title that must keep italics while the blanket rule converts italics to emphasis). Applied to every occurrence of the fragment.`;

/** Formats a run can currently carry (input signature vocabulary). */
export type FormatFlag = 'u' | 'du' | 'em' | 'b' | 'i' | 'hl' | 'shd' | 'cite' | 'small';
/** Formats the repair may produce (output vocabulary). */
export type TargetFlag = 'u' | 'em' | 'b' | 'i' | 'hl' | 'shd';

const TARGET_FLAGS: ReadonlySet<string> = new Set(['u', 'em', 'b', 'i', 'hl', 'shd']);

const FLAG_FOR_MARK: Record<string, FormatFlag> = {
  underline_mark: 'u',
  underline_direct: 'du',
  emphasis_mark: 'em',
  bold: 'b',
  italic: 'i',
  highlight: 'hl',
  shading: 'shd',
  cite_mark: 'cite',
};

const MARK_FOR_TARGET: Record<TargetFlag, string> = {
  u: 'underline_mark',
  em: 'emphasis_mark',
  b: 'bold',
  i: 'italic',
  hl: 'highlight',
  shd: 'shading',
};

/** Marks the repair owns: removed from every mapped run and rewritten
 *  from the target list. font_size is deliberately NOT here — sizes
 *  encode the shrink state (and, in pattern 4, the only surviving
 *  evidence of underlining) and are never touched. */
const SCHEME_MARK_NAMES = [
  'underline_mark',
  'underline_direct',
  'emphasis_mark',
  'bold',
  'italic',
  'highlight',
  'shading',
  'cite_mark',
] as const;

/** Default body size (half-points) when no font_size mark is present. */
const DEFAULT_HALF_POINTS = 22;

export interface BodyBlock {
  node: PMNode;
  pos: number;
}

/** Body paragraphs intersecting [from, to): card_body and doc-level
 *  paragraph only. Structural blocks (tag/pocket/hat/block/analytic/
 *  undertag) and cite_paragraphs are never eligible. */
export function collectBodyBlocks(doc: PMNode, from: number, to: number): BodyBlock[] {
  const out: BodyBlock[] = [];
  doc.nodesBetween(from, to, (node, pos) => {
    const t = node.type.name;
    if (t === 'card_body' || t === 'paragraph') {
      if (node.textContent.trim()) out.push({ node, pos });
      return false;
    }
    return true;
  });
  return out;
}

/** Group blocks one-card-at-a-time: blocks inside the same card node
 *  form a group; doc-level paragraphs (and anything else) pool into a
 *  single trailing group. */
export function groupBlocksByCard(doc: PMNode, blocks: readonly BodyBlock[]): BodyBlock[][] {
  const byCard = new Map<number, BodyBlock[]>();
  const loose: BodyBlock[] = [];
  for (const b of blocks) {
    const $pos = doc.resolve(b.pos);
    let cardPos: number | null = null;
    for (let d = $pos.depth; d > 0; d--) {
      if ($pos.node(d).type.name === 'card') {
        cardPos = $pos.before(d);
        break;
      }
    }
    if (cardPos == null) loose.push(b);
    else {
      let g = byCard.get(cardPos);
      if (!g) byCard.set(cardPos, (g = []));
      g.push(b);
    }
  }
  const groups = [...byCard.values()];
  if (loose.length) groups.push(loose);
  return groups;
}

interface RunInfo {
  /** Index into the card's block list. */
  blockIndex: number;
  /** Char offsets within the block's flat text. */
  start: number;
  end: number;
  flags: Set<FormatFlag>;
  /** Original colors, preserved when the target keeps hl / shd. */
  hlColor: string | null;
  shdColor: string | null;
  sizeHp: number;
}

export interface CardAnalysis {
  blocks: BodyBlock[];
  /** Per block: char→doc-position map (images occupy positions but no chars). */
  charPos: number[][];
  /** Per block flat text (text nodes only). */
  texts: string[];
  runs: RunInfo[];
  /** signature key → stats. */
  signatures: Map<string, { runs: number; chars: number; samples: string[] }>;
  /** Any underlining (u or du) WITHOUT bold? Decides pattern 3: when
   *  false, all underlining is bold — it IS the underline pass, not an
   *  emphasis layer. Computed here because models reliably miss the
   *  ABSENCE of a signature; the request states it as a fact. */
  hasPlainUnderline: boolean;
  /** The card's base font size in half-points (the largest size covering
   *  ≥10% of chars, else the modal size) — surfaced so the request can
   *  state the size relationship for size-encoded (pattern-4) cards. */
  baseHalfPoints: number;
}

export function signatureKey(flags: ReadonlySet<FormatFlag>): string {
  if (flags.size === 0) return 'plain';
  return [...flags].sort().join('+');
}

/** Analyze one card's blocks into uniform-format runs + the signature
 *  table. `small` is relative to the card's base size: the largest
 *  size covering at least 25% of characters (so a mostly-shrunk card
 *  still treats the full-size text as base), else the modal size. */
export function analyzeCard(group: readonly BodyBlock[]): CardAnalysis {
  const blocks = [...group];
  const charPos: number[][] = [];
  const texts: string[] = [];
  const rawRuns: Array<Omit<RunInfo, 'flags'> & { flags: Set<FormatFlag> }> = [];

  // First pass: per-text-node runs with sizes; merge adjacent equals later.
  for (let bi = 0; bi < blocks.length; bi++) {
    const { node, pos } = blocks[bi]!;
    const map: number[] = [];
    let text = '';
    let offset = 0;
    node.forEach((child, childOffset) => {
      if (!child.isText || !child.text) return;
      const flags = new Set<FormatFlag>();
      let hlColor: string | null = null;
      let shdColor: string | null = null;
      let sizeHp = DEFAULT_HALF_POINTS;
      for (const m of child.marks) {
        const f = FLAG_FOR_MARK[m.type.name];
        if (f) {
          flags.add(f);
          if (f === 'hl') hlColor = String(m.attrs['color'] ?? 'yellow');
          if (f === 'shd') shdColor = String(m.attrs['color'] ?? 'D2D2D2');
        }
        if (m.type.name === 'font_size') {
          const hp = Number(m.attrs['halfPoints']);
          if (Number.isFinite(hp) && hp > 0) sizeHp = hp;
        }
      }
      const start = offset;
      for (let i = 0; i < child.text.length; i++) {
        map.push(pos + 1 + childOffset + i);
      }
      text += child.text;
      offset += child.text.length;
      rawRuns.push({ blockIndex: bi, start, end: offset, flags, hlColor, shdColor, sizeHp });
    });
    charPos.push(map);
    texts.push(text);
  }

  // Base size: the LARGEST size with a substantial (≥10%) char share,
  // else the modal size. Largest-not-modal because in a size-encoded
  // card (pattern 4) the shrunk connective text is usually the
  // majority — the full-size minority is exactly the text that was
  // underlined, and it must not get flagged 'small'-relative-to-shrunk.
  const sizeChars = new Map<number, number>();
  let totalChars = 0;
  for (const r of rawRuns) {
    const n = r.end - r.start;
    sizeChars.set(r.sizeHp, (sizeChars.get(r.sizeHp) ?? 0) + n);
    totalChars += n;
  }
  let base = DEFAULT_HALF_POINTS;
  if (sizeChars.size > 0) {
    const entries = [...sizeChars.entries()];
    const big = entries.filter(([, n]) => n >= totalChars * 0.1).map(([s]) => s);
    if (big.length) base = Math.max(...big);
    else base = entries.sort((a, b) => b[1] - a[1])[0]![0];
  }
  for (const r of rawRuns) {
    if (r.sizeHp < base) r.flags.add('small');
  }

  // Merge adjacent runs with identical signatures (and colors) so the
  // table counts read naturally and applications are minimal.
  const runs: RunInfo[] = [];
  for (const r of rawRuns) {
    const prev = runs[runs.length - 1];
    if (
      prev &&
      prev.blockIndex === r.blockIndex &&
      prev.end === r.start &&
      signatureKey(prev.flags) === signatureKey(r.flags) &&
      prev.hlColor === r.hlColor &&
      prev.shdColor === r.shdColor
    ) {
      prev.end = r.end;
      continue;
    }
    runs.push(r);
  }

  const signatures = new Map<string, { runs: number; chars: number; samples: string[] }>();
  for (const r of runs) {
    const key = signatureKey(r.flags);
    let s = signatures.get(key);
    if (!s) signatures.set(key, (s = { runs: 0, chars: 0, samples: [] }));
    s.runs++;
    s.chars += r.end - r.start;
    if (s.samples.length < 3) {
      const sample = texts[r.blockIndex]!.slice(r.start, r.end).trim().slice(0, 48);
      if (sample.length >= 4) s.samples.push(sample);
    }
  }

  const hasPlainUnderline = runs.some(
    (r) => (r.flags.has('u') || r.flags.has('du')) && !r.flags.has('b'),
  );

  return { blocks, charPos, texts, runs, signatures, hasPlainUnderline, baseHalfPoints: base };
}

function formatPt(halfPoints: number): string {
  const pt = halfPoints / 2;
  return Number.isInteger(pt) ? String(pt) : pt.toFixed(1);
}

/** The FACTS bullets appended to a card request. Models reliably miss the
 *  ABSENCE of a signature, so the request states the underline situation as
 *  a fact. Three cases:
 *   - underlining present, some non-bold → bold+underline is a stand-out
 *     emphasis layer (pattern 2/3).
 *   - underlining present, all bold → bold+underline IS the underline pass.
 *   - NO underlining + a base/shrunk size split → size-encoded (pattern 4):
 *     state the base size and shrunk share AND the direction (base-size was
 *     underlined, shrunk is unread), because the shrunk text is usually the
 *     majority and the model otherwise underlines it backwards. */
export function buildFacts(analysis: CardAnalysis): string[] {
  const { runs } = analysis;
  const hasAnyUnderline = runs.some((r) => r.flags.has('u') || r.flags.has('du'));
  if (hasAnyUnderline) {
    return [
      analysis.hasPlainUnderline
        ? 'This card HAS plain (non-bold) underlining — bold+underline is a stand-out layer on top of it.'
        : 'This card has NO plain (non-bold) underlining — ALL underlined text is bold, so bold+underline IS the underline pass (there was no emphasis pass).',
    ];
  }
  let smallChars = 0;
  let baseChars = 0;
  for (const r of runs) {
    const n = r.end - r.start;
    if (r.flags.has('small')) smallChars += n;
    else baseChars += n;
  }
  if (smallChars > 0 && baseChars > 0) {
    const basePt = formatPt(analysis.baseHalfPoints);
    const pct = Math.round((smallChars / (smallChars + baseChars)) * 100);
    return [
      'This card has NO underlining at all — it is SIZE-ENCODED (pattern 4): the underline pass was destroyed on import and survives only in font size.',
      `Base size is ${basePt}pt; ${pct}% of the body is shrunk below it (the "small" signatures). Per pattern 4, the BASE-SIZE signatures (those WITHOUT "small") are the text that was underlined → give them u; the "small" signatures are unread → target nothing. Do NOT underline the "small" text, even though it is the majority of the card.`,
    ];
  }
  return ['This card has NO underlining.'];
}

/** The per-card request body: plain text + signature table. */
export function buildCardRequest(analysis: CardAnalysis): string {
  const table = [...analysis.signatures.entries()]
    .sort((a, b) => b[1].chars - a[1].chars)
    .map(
      ([key, s]) =>
        `${key} — ${s.runs} run${s.runs === 1 ? '' : 's'}, ${s.chars} chars · samples: ` +
        s.samples.map((x) => JSON.stringify(x)).join(', '),
    )
    .join('\n');
  const facts = buildFacts(analysis);
  return `CARD TEXT:\n${analysis.texts.join('\n')}\n\nFORMATTING SIGNATURES:\n${table}\n\nFACTS:\n- ${facts.join('\n- ')}`;
}

export interface FormatPlan {
  map: Map<string, TargetFlag[]>;
  exceptions: Array<{ text: string; format: TargetFlag[] }>;
}

/** Parse the model's mapping. Unknown signatures and invalid target
 *  flags are dropped (and reported) rather than failing the card. */
export function parseFormatResponse(
  text: string,
  knownSignatures: ReadonlySet<string>,
): { plan: FormatPlan; dropped: string[]; warnings: string[] } {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Formatting response had no JSON object.');
  const raw = text.slice(start, end + 1);
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // Exception fragments are verbatim evidence text — unescaped
    // interior quotes happen; salvage before giving up, then fall back
    // to balanced-object extraction (trailing junk / repeated objects).
    try {
      parsed = JSON.parse(salvageJson(raw));
      console.warn('[repair-fmt] response JSON needed quote-escape salvage');
    } catch {
      for (const chunk of extractJsonObjects(salvageJson(raw))) {
        try {
          const o = JSON.parse(chunk) as { map?: unknown };
          if (o && typeof o.map === 'object') {
            parsed = o;
            console.warn('[repair-fmt] response carried extra JSON — used the first object with a map');
            break;
          }
        } catch {
          // try the next chunk
        }
      }
      if (parsed === undefined) {
        throw new Error(
          `Formatting response was not valid JSON: ${e instanceof Error ? e.message : String(e)}`,
        );
      }
    }
  }
  const dropped: string[] = [];
  const plan: FormatPlan = { map: new Map(), exceptions: [] };

  // Targets tolerate the compound signature notation the table itself
  // teaches ("u+hl" reads as ["u","hl"]) — models mirror the key
  // syntax in targets, and rejecting that would drop the mapping.
  const normalizeTarget = (value: unknown): TargetFlag[] | null => {
    if (!Array.isArray(value)) return null;
    const out = new Set<TargetFlag>();
    for (const v of value) {
      if (typeof v !== 'string') return null;
      for (const part of v.split('+')) {
        const flag = part.trim().toLowerCase();
        if (!flag) continue;
        if (!TARGET_FLAGS.has(flag)) return null;
        out.add(flag as TargetFlag);
      }
    }
    return [...out];
  };

  const rawMap = (parsed as { map?: unknown }).map;
  if (rawMap && typeof rawMap === 'object') {
    for (const [key, value] of Object.entries(rawMap as Record<string, unknown>)) {
      if (!knownSignatures.has(key)) {
        dropped.push(`unknown signature ${JSON.stringify(key)}`);
        continue;
      }
      const target = normalizeTarget(value);
      if (target === null) {
        dropped.push(`invalid target ${JSON.stringify(value)} for ${JSON.stringify(key)}`);
        continue;
      }
      plan.map.set(key, target);
    }
  }
  const rawExceptions = (parsed as { exceptions?: unknown }).exceptions;
  if (Array.isArray(rawExceptions)) {
    for (const e of rawExceptions) {
      const text2 = (e as { text?: unknown })?.text;
      const format = normalizeTarget((e as { format?: unknown })?.format);
      if (typeof text2 === 'string' && text2.trim().length >= 3 && format !== null) {
        plan.exceptions.push({ text: text2, format });
      } else {
        dropped.push('invalid exception entry');
      }
    }
  }
  // HARD GUARD: existing emphasis is canonical user work — a blanket
  // rule must never strip it (live failure: a size-recovery card's one
  // emphasized sentence was bulldozed to u+hl). If the plan drops em
  // from an em-carrying signature, put it back (and drop u, which em
  // implies). The exceptions channel remains the deliberate override.
  const warnings: string[] = [];
  for (const [key, target] of plan.map) {
    const sigFlags = key === 'plain' ? [] : key.split('+');
    if (sigFlags.includes('em') && !target.includes('em')) {
      const fixed: TargetFlag[] = ['em', ...target.filter((t) => t !== 'u' && t !== 'em')];
      plan.map.set(key, fixed);
      warnings.push(
        `plan stripped em from "${key}" (→ [${target.join(',')}]) — emphasis preserved as [${fixed.join(',')}]`,
      );
    }
  }
  return { plan, dropped, warnings };
}

/** True when applying `target` to a run with `flags` would change
 *  nothing — used to keep the transaction (and flash) minimal. */
function targetEqualsFlags(flags: ReadonlySet<FormatFlag>, target: readonly TargetFlag[]): boolean {
  const effective = [...flags].filter((f) => f !== 'small');
  if (effective.length !== target.length) return false;
  return effective.every((f) => (target as readonly string[]).includes(f));
}

function addTargetMarks(
  tr: Transaction,
  from: number,
  to: number,
  target: readonly TargetFlag[],
  hlColor: string | null,
  shdColor: string | null,
): void {
  for (const t of target) {
    const markName = MARK_FOR_TARGET[t];
    const type = schema.marks[markName]!;
    if (t === 'hl') tr.addMark(from, to, type.create({ color: hlColor ?? 'yellow' }));
    else if (t === 'shd') tr.addMark(from, to, type.create({ color: shdColor ?? 'D2D2D2' }));
    else tr.addMark(from, to, type.create());
  }
}

/** Apply one card's plan onto `tr`. Formatting-only, so positions are
 *  stable across cards — every card rides in the same transaction
 *  (one undo step). Returns the doc ranges it touched (for flashes). */
export function applyFormatPlan(
  tr: Transaction,
  analysis: CardAnalysis,
  plan: FormatPlan,
  delta = 0,
): Array<{ from: number; to: number }> {
  const touched: Array<{ from: number; to: number }> = [];
  const removeTypes = SCHEME_MARK_NAMES.map((n) => schema.marks[n]!);

  const rewrite = (
    blockIndex: number,
    startChar: number,
    endChar: number,
    target: readonly TargetFlag[],
    hlColor: string | null,
    shdColor: string | null,
  ): void => {
    const map = analysis.charPos[blockIndex]!;
    if (endChar <= startChar || startChar >= map.length) return;
    // `delta` shifts the analysis's absolute positions to their current
    // location: edits elsewhere in the doc moved the whole leased region
    // by a uniform offset (edits inside it are blocked).
    const from = map[startChar]! + delta;
    const to = map[Math.min(endChar, map.length) - 1]! + 1 + delta;
    for (const type of removeTypes) tr.removeMark(from, to, type);
    addTargetMarks(tr, from, to, target, hlColor, shdColor);
    touched.push({ from, to });
  };

  for (const run of analysis.runs) {
    const target = plan.map.get(signatureKey(run.flags));
    if (!target) continue; // unmapped → untouched
    if (targetEqualsFlags(run.flags, target)) continue; // already canonical
    rewrite(run.blockIndex, run.start, run.end, target, run.hlColor, run.shdColor);
  }

  // Exceptions override the blanket rules — applied after, to every
  // occurrence of the verbatim fragment within the card's blocks.
  for (const ex of plan.exceptions) {
    for (let bi = 0; bi < analysis.texts.length; bi++) {
      const text = analysis.texts[bi]!;
      for (let idx = text.indexOf(ex.text); idx >= 0; idx = text.indexOf(ex.text, idx + ex.text.length)) {
        // Colors: borrow from the run containing the fragment start.
        const run = analysis.runs.find(
          (r) => r.blockIndex === bi && r.start <= idx && idx < r.end,
        );
        rewrite(bi, idx, idx + ex.text.length, ex.format, run?.hlColor ?? null, run?.shdColor ?? null);
      }
    }
  }

  return touched;
}

// --------------------------- command ----------------------------

const FLASH_MS = 1400;

/** Entry point — fires on the `repairFormatting` ribbon command. One
 *  model request per card (sequential), one transaction (one undo)
 *  applying every card's mapping at the end. */
export function runRepairFormatting(view: EditorView): void {
  if (!aiGateToast()) return;
  const apiKey = activeApiKey();
  const sel = view.state.selection;
  if (sel.empty) {
    showToast('Select the body text whose formatting needs repair.');
    return;
  }
  const blocks = collectBodyBlocks(view.state.doc, sel.from, sel.to);
  if (!blocks.length) {
    showToast('Formatting repair works on body paragraphs — not tags, cites, or headings.');
    return;
  }
  const groups = groupBlocksByCard(view.state.doc, blocks);

  // Lease the selection: edits elsewhere shift it (we apply a uniform
  // delta at the end), edits inside it are held so the analysis stays
  // valid for the whole multi-card request.
  const lease = claimRegion(view, { from: sel.from, to: sel.to }, { label: 'repair-formatting' });
  if (!lease) {
    showToast('Another AI edit is working on this selection — try again in a moment.');
    return;
  }

  const activity = new AiActivity(view, { from: sel.from, to: sel.to }, 'selection');
  activity.start();

  void (async () => {
    try {
      const results: Array<{ analysis: CardAnalysis; plan: FormatPlan }> = [];
      for (let gi = 0; gi < groups.length; gi++) {
        const analysis = analyzeCard(groups[gi]!);
        if (analysis.runs.length === 0) continue;
        // Log what the model SAW (the signature table) and what it
        // DECIDED (the full plan) — the refinement loop needs bad
        // outcomes attributed to analysis vs judgment vs apply.
        const tag = `[repair-fmt] card ${gi + 1}/${groups.length}`;
        for (const [key, s] of analysis.signatures) {
          console.warn(
            `${tag} sig: ${key} — ${s.runs} runs, ${s.chars} chars · ` +
              s.samples.map((x) => JSON.stringify(x)).join(', '),
          );
        }
        const reply = await callLlm({
          apiKey,
          system: DEFAULT_FORMAT_REPAIR_PROMPT,
          messages: [{ role: 'user', content: buildCardRequest(analysis) }],
          maxTokens: 4096,
          temperature: 0,
        });
        if (reply.stopReason === 'max_tokens') {
          throw new Error('The formatting plan was cut off — try a smaller selection.');
        }
        const known = new Set(analysis.signatures.keys());
        const { plan, dropped, warnings } = parseFormatResponse(reply.text, known);
        for (const d of dropped) console.warn(`${tag} dropped ${d}`);
        for (const w of warnings) console.warn(`${tag} WARNING: ${w}`);
        console.warn(`${tag} plan: ${JSON.stringify(Object.fromEntries(plan.map))}`);
        for (const ex of plan.exceptions) {
          console.warn(`${tag} exception: ${JSON.stringify(ex.text)} → [${ex.format.join(',')}]`);
        }
        const unmapped = [...known].filter((k) => !plan.map.has(k));
        if (unmapped.length) console.warn(`${tag} unmapped (left as-is): ${unmapped.join(', ')}`);
        if (!analysis.hasPlainUnderline) {
          for (const [key, target] of plan.map) {
            if (key.includes('b') && key.includes('u') && target.includes('em')) {
              console.warn(
                `${tag} WARNING: mapped ${key} → em despite ALL underlining being bold (pattern 3 says u)`,
              );
            }
          }
        }
        results.push({ analysis, plan });
      }

      // The leased selection may have shifted while we were analyzing
      // (edits elsewhere in the doc); apply the analysis at the current
      // offset. A null delta means the region was removed entirely.
      const delta = lease.delta();
      if (delta === null) {
        showToast('Repair formatting: the selected text is no longer in the document.');
        return;
      }
      const tr = view.state.tr;
      const touched: Array<{ from: number; to: number }> = [];
      for (const r of results) {
        const before = touched.length;
        touched.push(...applyFormatPlan(tr, r.analysis, r.plan, delta));
        console.warn(
          `[repair-fmt] applied: ${touched.length - before} of ${r.analysis.runs.length} runs rewritten`,
        );
      }
      if (!tr.docChanged || touched.length === 0) {
        showToast('Formatting already matches the scheme — nothing to change.');
        return;
      }
      lease.apply(tr);
      setRepairFlashes(view, touched);
      setTimeout(() => clearRepairFlashes(view), FLASH_MS + 200);
      const blockCount = results.reduce((n, r) => n + r.analysis.blocks.length, 0);
      showToast(
        `Repaired formatting in ${blockCount} paragraph${blockCount === 1 ? '' : 's'}` +
          (groups.length > 1 ? ` across ${groups.length} cards` : '') +
          '.',
      );
    } catch (e) {
      console.warn(`[repair-fmt] error: ${e instanceof Error ? e.message : String(e)}`);
      aiFailureNotice('Repair formatting', e);
    } finally {
      activity.stop();
      lease.release();
    }
  })();
}
