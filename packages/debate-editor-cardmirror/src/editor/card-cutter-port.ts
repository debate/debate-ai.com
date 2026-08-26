/**
 * Card-cutter PORT — the only place the app talks to the experimental
 * card-cutting engine. The engine itself lives in the separately-
 * versioned `@cardmirror/card-cutter` package and is NOT bundled. It
 * registers with us at runtime via `window.__registerCardCutter`; if
 * nothing registers (package absent), the feature stays inert.
 *
 * Responsibilities, all app-side:
 *  - hold whatever engine registered (registry),
 *  - inject an LlmCaller wrapping the app's browser-direct callLlm,
 *  - extract tag / cite / body text from the focused card,
 *  - translate the engine's returned mark spans into ONE ProseMirror
 *    transaction (underline / emphasis / highlight), with the highlight
 *    color resolved per the doc/ribbon rule.
 *
 * The engine is pure (no DOM, no PM, no network of its own), so the
 * boundary is: app gives it text + an llm, it returns spans.
 */

/// <reference path="../cardcutter-shim.d.ts" />
import type { EditorView } from 'prosemirror-view';
import { TextSelection } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import type { Node as PMNode } from 'prosemirror-model';
import { schema, newHeadingId } from '../schema/index.js';
import { settings } from './settings.js';
import { compileShrinkProtections, findProtectedRanges } from './ribbon-commands.js';
import { callLlm, activeApiKey, LlmError } from './ai/llm.js';
import { getAiPersona } from './comments-ui.js';
import { resolveAiModel } from './ai/llm.js';
import { showToast } from './toast.js';
import { AiActivity } from './ai/ai-activity.js';
import { claimRegion, type EditLease } from './ai/edit-coordinator.js';
import { setCardCutterPreview, setCutterFlagDecorations } from './card-cutter-preview-plugin.js';
import { getElectronHost } from './host/index.js';
import { learnStore } from './learn-store-host.js';
import { flattenDoc, resolveDescriptorIn } from './learn-anchor.js';

// ─── Engine contract (structural — no import of the package) ──────

type Layer = 'u' | 'em' | 'hl';
interface MarkSpan {
  layer: Layer;
  p: number;
  start: number;
  end: number;
}
interface PlainCard {
  id: string;
  doc: string;
  section: string;
  tag: string;
  cite: string;
  paras: string[];
}
type CutStage =
  | 'initial'
  | 'highlight'
  | 'prune'
  | 'skeletonize'
  | 'budget'
  | 'add'
  | 'tighten'
  | 'fluency';
interface CutOptions {
  /** Optional de-highlight cap; the primary cut is budget-free. */
  targetWords?: number;
  emphasisStyle: 'voice' | 'independent' | 'minimal';
  role: 'shell' | 'block' | 'at' | 'ext' | 'impact';
  /** Cutter context: file guidance + designated sections + section
   *  path + neighbor tags. The bench found missing purpose/context was
   *  the #1 cut killer; newer engines consume this, older ones ignore
   *  the extra field. */
  context?: string;
  /** Free-form user statement of what THIS cut is for. */
  intent?: string;
  /** Verbatim card stretches the user flagged to prioritize. */
  playUp?: string[];
  /** Verbatim card stretches the user flagged to de-prioritize. */
  playDown?: string[];
  underlineGenerosity?: 'lean' | 'standard' | 'generous';
  model?: string;
  terminalImpact?: boolean;
  onStage?: (stage: CutStage) => void;
}

/** Stage → gerund phrase shown in the pill ("…", or "Clod is …"). */

const CUTTER_NO_KEY_MESSAGE = 'Set an API key in Settings to use the card cutter.';
const CUTTER_ENGINE_MISSING_MESSAGE = 'Card-cutter engine not loaded.';
const STAGE_LABEL: Record<CutStage, string> = {
  initial: 'making the first pass',
  highlight: 'highlighting',
  prune: 'pruning for redundancy',
  skeletonize: 'skeletonizing',
  budget: 'highlighting down',
  add: 'adding highlighting',
  tighten: 'tightening',
  fluency: 'restoring connective words',
};

/** Stage label for a cut that is working from corpus examples: the
 *  compression step is the one that sees them, so it says so. `family`
 *  is null whenever this cut will show no examples, in which case the
 *  ordinary labels stand — the pill must never claim examples the
 *  engine isn't reading. */
function stageLabel(stage: CutStage, family: string | null): string {
  if (stage === 'skeletonize' && family) return `looking at examples about ${family}`;
  return STAGE_LABEL[stage];
}
interface BudgetShortfall {
  targetWords: number;
  words: number;
  reason?: string;
}
interface CutResult {
  spans: MarkSpan[];
  stats: unknown;
  readWords?: number;
  shortfall?: BudgetShortfall;
  warnings: string[];
  raw: unknown;
}
type LlmCaller = (system: string, user: string, model: string) => Promise<string>;
/** A contiguous, optional slice of the read the user can drop — counts
 *  are engine-counted (deterministic), not model estimates. */
export interface OmissionSection {
  id: number;
  label: string;
  description: string;
  words: number;
  spans: MarkSpan[];
}
/** Mirror of the engine's GenreHint — `index` is engine ≥0.9. */
interface GenreHintish {
  label: string;
  confidence: number;
  runnerUp?: string;
  index?: number;
}

interface CardCutterApi {
  readonly version: string;
  cutCard(card: PlainCard, opts: CutOptions, llm: LlmCaller): Promise<CutResult>;
  highlightCard(
    card: PlainCard,
    seed: MarkSpan[],
    opts: CutOptions,
    llm: LlmCaller,
  ): Promise<CutResult>;
  proposeOmissions(
    card: PlainCard,
    map: MarkMap,
    llm: LlmCaller,
    model?: string,
  ): Promise<OmissionSection[]>;
  highlightDown(
    card: PlainCard,
    map: MarkMap,
    targetWords: number,
    llm: LlmCaller,
    model?: string,
    onStage?: (stage: CutStage) => void,
    feedback?: string,
  ): Promise<{ map: MarkMap; words: number; raw: string; shortfall?: BudgetShortfall }>;
  refineHighlight(
    card: PlainCard,
    map: MarkMap,
    opts: {
      dropRedundancy?: boolean;
      skeletonize?: boolean;
      targetWords?: number;
      feedback?: string;
      allowAdd?: boolean;
      model?: string;
      onStage?: (stage: CutStage) => void;
    },
    llm: LlmCaller,
  ): Promise<{ map: MarkMap; words: number; warnings: string[]; shortfall?: BudgetShortfall }>;
  addHighlight(
    card: PlainCard,
    existing: MarkSpan[],
    opts: CutOptions,
    llm: LlmCaller,
    scope?: { p: number; start: number; end: number }[],
  ): Promise<CutResult>;
  detectTerminalImpact(tag: string): boolean;
  /** Corpus-derived argument-family hint (engine ≥0.8; optional so
   *  older installed bundles keep working). */
  classifyGenre?(bodyText: string, tag?: string): GenreHintish | null;
  genreHintLine?(hint: GenreHintish): string;
  /** Short family name for the progress pill, or null when this cut
   *  will show no examples. Engine ≥0.9. */
  genreDemoLabel?(hint: GenreHintish): string | null;
}

interface MarkMap {
  u: Uint8Array[];
  em: Uint8Array[];
  hl: Uint8Array[];
}

declare global {
  interface Window {
    __registerCardCutter?: (api: CardCutterApi) => void;
    /** Console entry point (see card-cutter-gate.ts). */
    __cardcutter?: (cmd: 'on' | 'off' | 'status') => string;
  }
}

let engine: CardCutterApi | null = null;

/** The engine package calls this on load (dev-only). Installed once. */
export function installCardCutterRegistry(): void {
  window.__registerCardCutter = (api) => {
    engine = api;
    console.log(`[cardcutter] engine registered (v${api.version})`);
  };
}

export function cardCutterEngineLoaded(): boolean {
  return engine !== null;
}

/** Dev convenience: pull the sibling package in so it can register.
 *  `@vite-ignore` keeps the bundler from resolving the specifier at
 *  build time, so production (where the sibling isn't present) builds
 *  fine and the import simply throws at runtime → caught, feature
 *  stays inert. The `@cardcutter` alias resolves only in dev. */
export async function tryLoadCardCutterEngine(): Promise<boolean> {
  if (engine) return true;
  try {
    // Resolved by the vite `@cardcutter/browser` alias: the sibling
    // package in dev, or the in-repo no-op stub when it's absent.
    // Side-effect import only — registration happens via the global.
    await import('@cardcutter/browser');
  } catch (err) {
    console.warn('[cardcutter] sibling import unavailable:', (err as Error).message);
  }
  // Packaged builds ship the no-op stub, so the import above registers
  // nothing. When the feature is switched on, load the user-installed
  // engine bundle from disk (userData/plugins, an explicit settings
  // path, or the CARDCUTTER_ENGINE env). The bundle self-registers.
  if (!engine && settings.get('cardCutterEnabled')) {
    const host = getElectronHost();
    if (host?.cardCutterLoad) {
      try {
        const r = await host.cardCutterLoad(settings.get('cardCutterEnginePath') || null);
        if (r.ok) console.log(`[cardcutter] engine loaded from ${r.path}`);
        else console.warn(`[cardcutter] engine plugin not loaded: ${r.error}`);
      } catch (err) {
        console.warn('[cardcutter] engine plugin load error:', (err as Error).message);
      }
    }
  }
  return engine !== null;
}

// ─── LLM injection ────────────────────────────────────────────────

// The engine hands this caller bare Anthropic model ids (`claude-…`), which
// OpenRouter rejects (it needs the `anthropic/…` prefix) — so the card cutter
// works only with the Anthropic provider. Model selection here must become
// provider-aware before the card cutter can run over OpenRouter.
function makeLlm(): LlmCaller {
  return async (system, user, model) => {
    // No temperature: non-default sampling params are REJECTED (400) on
    // Sonnet 5 / Opus 4.7+ — the bench caller hit exactly this. And
    // 16k max_tokens leaves headroom for adaptive thinking (on by
    // default on Sonnet 5), which counts against the cap — we throw on
    // truncation below.
    const reply = await callLlm({
      apiKey: activeApiKey(),
      model,
      system,
      maxTokens: 16000,
      messages: [{ role: 'user', content: user }],
    });
    if (reply.stopReason === 'max_tokens') throw new Error('truncated at max_tokens');
    return reply.text;
  };
}

// ─── Card extraction from the editor ──────────────────────────────

export interface FocusedCard {
  card: PlainCard;
  /** The card's tag/analytic heading id — a stable UUID stamped on load
   *  (see schema/ids.ts). Doc POSITIONS shift whenever text above the
   *  card changes, so any flow that outlives its own invocation (a panel
   *  the user leaves open, a stacked prompt answered later) must re-find
   *  its card by THIS, never by the live cursor. Null only for a card
   *  whose tag somehow carries no id. */
  cardId: string | null;
  cardFrom: number;
  /** End of the card node (cardFrom + nodeSize) — the AI-working tint
   *  spans [cardFrom, cardTo] so the whole card shows as worked-on. */
  cardTo: number;
  /** Doc positions of each body paragraph's content start (= text
   *  offset 0), parallel to card.paras, for span → doc-pos mapping. */
  paraStarts: number[];
  /** The card body's EXISTING marks as engine-shaped spans (char
   *  ranges per body paragraph). Lets the port tell a plain card
   *  (full cut) from an underlined one (highlight only). */
  existing: MarkSpan[];
}

/** Whether the card already has any underline/emphasis, and any
 *  highlight — drives cut vs highlight vs done routing. */
function cardState(f: FocusedCard): {
  hasUnderline: boolean;
  hasEmphasis: boolean;
  hasHighlight: boolean;
} {
  let hasUnderline = false;
  let hasEmphasis = false;
  let hasHighlight = false;
  for (const s of f.existing) {
    if (s.layer === 'hl') hasHighlight = true;
    else if (s.layer === 'em') hasEmphasis = true;
    else hasUnderline = true;
  }
  return { hasUnderline, hasEmphasis, hasHighlight };
}

/** Delimiter-protected spans — bracketed Omitted / ALT TEXT / FOOTNOTE
 *  markers, "Condense with warning" PAUSES/RESUMES, translator attributions,
 *  and the user's custom protections — must never be sent to the cutter: the
 *  highlight it returns is read aloud, and only text from the original article
 *  may be read. Same pattern set Shrink uses, applied unconditionally (this is
 *  independent of the shrink-keeps-protected setting). */
function cardCutterProtectionPatterns(): readonly RegExp[] {
  return compileShrinkProtections(
    settings.get('shrinkCustomProtections'),
    settings.get('condenseWarningDelimiter') === 'custom'
      ? settings.get('condenseWarningCustomPauseMarker')
      : '',
    settings.get('condenseWarningDelimiter') === 'custom'
      ? settings.get('condenseWarningCustomResumeMarker')
      : '',
  );
}

/** Blank every character of `text` whose doc position falls in a protected
 *  range, replacing it with a space. Keeping the length identical preserves
 *  the 1:1 text-offset ↔ doc-position mapping the rest of the port relies on;
 *  the cutter highlights words, so a blanked (whitespace) span is never
 *  selected, and the engine's whitespace-split word count skips it too. */
function maskProtected(
  text: string,
  contentStart: number,
  protectedRanges: readonly { from: number; to: number }[],
): string {
  if (protectedRanges.length === 0 || text.length === 0) return text;
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const docPos = contentStart + i;
    const masked = protectedRanges.some((r) => docPos >= r.from && docPos < r.to);
    out += masked ? ' ' : text[i];
  }
  return out;
}

/** Find the card containing the cursor and pull its tag / cite / plain
 *  body text, with delimiter-protected spans blanked out. Returns null if
 *  the cursor isn't in a card or the body is empty. */
export function focusedPlainCard(view: EditorView): FocusedCard | null {
  const { $from } = view.state.selection;
  let cardPos = -1;
  let cardNode: PMNode | null = null;
  for (let d = $from.depth; d >= 0; d--) {
    const n = $from.node(d);
    if (n.type.name === 'card' || n.type.name === 'analytic_unit') {
      cardPos = $from.before(d);
      cardNode = n;
      break;
    }
  }
  if (!cardNode || cardPos < 0) return null;
  return extractCard(view, cardNode, cardPos);
}

/** The heading id of a card node's tag / analytic child, or null. */
function cardIdOf(cardNode: PMNode): string | null {
  let id: string | null = null;
  cardNode.forEach((child) => {
    if (id !== null) return;
    if (child.type.name === 'tag' || child.type.name === 'analytic') {
      const v = child.attrs['id'];
      id = typeof v === 'string' && v ? v : null;
    }
  });
  return id;
}

/** Re-find a card by its heading id and re-extract it at its CURRENT
 *  position. The identity-stable counterpart to `focusedPlainCard`:
 *  used by every flow whose target was chosen earlier (a refine panel
 *  opened over card A must still act on card A after the user clicks
 *  into card B). Null if the card is gone from the doc. */
export function resolveCardById(view: EditorView, cardId: string): FocusedCard | null {
  let found: FocusedCard | null = null;
  view.state.doc.descendants((node, pos) => {
    if (found) return false;
    const t = node.type.name;
    if (t !== 'card' && t !== 'analytic_unit') return true;
    if (cardIdOf(node) === cardId) found = extractCard(view, node, pos);
    return false; // never descend into a card
  });
  return found;
}

/** Put the cursor in `cardId` and scroll it into view. Returns false if
 *  the card is no longer in the doc. */
export function jumpToCard(view: EditorView, cardId: string): boolean {
  const target = resolveCardById(view, cardId);
  if (!target) return false;
  const tr = view.state.tr.setSelection(
    TextSelection.create(view.state.doc, target.cardFrom + 1),
  );
  view.dispatch(tr.scrollIntoView());
  view.focus();
  return true;
}

/** The read as it stands: highlighted word count and approximate spoken
 *  seconds for the card, resolved by identity. Null if the card is gone.
 *  Powers the review panel's stats line without another engine call. */
export function cardReadStats(
  view: EditorView,
  cardId: string,
): { words: number; seconds: number } | null {
  const focused = resolveCardById(view, cardId);
  if (!focused) return null;
  let words = 0;
  for (const s of focused.existing) {
    if (s.layer !== 'hl') continue;
    const para = focused.card.paras[s.p];
    if (!para) continue;
    words += para
      .slice(s.start, s.end)
      .split(/\s+/)
      .filter(Boolean).length;
  }
  return { words, seconds: Math.max(1, Math.round((words / readerWpm()) * 60)) };
}

/** A short human label for a card — its tag, else the opening of its
 *  body. For telling stacked panels apart. */
export function cardLabel(focused: FocusedCard): string {
  const raw = focused.card.tag.trim() || focused.card.paras.find((p) => p.trim())?.trim() || 'this card';
  return raw.length > 70 ? `${raw.slice(0, 67)}…` : raw;
}

/** Mark state of an already-extracted card — the launch panel's
 *  routing when its target came from the bulk classifier rather than
 *  the cursor (focusedCardStatus is the cursor-derived twin). */
export function cardStatusOf(f: FocusedCard): {
  hasUnderline: boolean;
  hasEmphasis: boolean;
  hasHighlight: boolean;
} {
  return cardState(f);
}

// ─── Bulk cutting ─────────────────────────────────────────────────

export interface BulkTargets {
  /** Cards needing work, in doc order: 'cut' = plain, 'finish' =
   *  underlined but not yet highlighted. */
  actionable: { cardId: string; kind: 'cut' | 'finish' }[];
  /** Cards in the span already highlighted — left alone. */
  alreadyCut: number;
  /** Every card node the selection touches (including bodyless ones). */
  spanned: number;
}

/** Classify every card the selection touches, for the bulk flow. Null
 *  unless the selection intersects at least TWO card nodes — a
 *  within-card selection keeps its existing single-card meanings
 *  (sub-selection add, U/D annotation scope). Actionable cards missing
 *  a tag id are stamped here, in one attrs-only transaction: no
 *  positions move, one undo step, and every queued card is
 *  identity-addressable before the queue starts. */
export function selectionBulkTargets(view: EditorView): BulkTargets | null {
  const sel = view.state.selection;
  if (sel.empty) return null;
  const hits: { pos: number }[] = [];
  view.state.doc.nodesBetween(sel.from, sel.to, (node, pos) => {
    const t = node.type.name;
    if (t !== 'card' && t !== 'analytic_unit') return true;
    hits.push({ pos });
    return false; // never descend into a card
  });
  if (hits.length < 2) return null;

  // Stamp missing heading ids (rare: ids are stamped at load; only an
  // in-session-created card can lack one).
  let tr: Transaction | null = null;
  for (const h of hits) {
    const cardNode = view.state.doc.nodeAt(h.pos);
    if (!cardNode || cardIdOf(cardNode) !== null) continue;
    cardNode.forEach((child, offset) => {
      if (child.type.name !== 'tag' && child.type.name !== 'analytic') return;
      tr ??= view.state.tr;
      tr.setNodeMarkup(h.pos + 1 + offset, null, { ...child.attrs, id: newHeadingId() });
    });
  }
  if (tr) view.dispatch(tr);

  const actionable: BulkTargets['actionable'] = [];
  let alreadyCut = 0;
  for (const h of hits) {
    const cardNode = view.state.doc.nodeAt(h.pos); // fresh post-stamp
    if (!cardNode) continue;
    const f = extractCard(view, cardNode, h.pos);
    if (!f) continue; // no body text — nothing to cut
    const { hasUnderline, hasHighlight } = cardState(f);
    if (hasHighlight) {
      alreadyCut++;
    } else if (f.cardId) {
      actionable.push({ cardId: f.cardId, kind: hasUnderline ? 'finish' : 'cut' });
    }
  }
  return { actionable, alreadyCut, spanned: hits.length };
}

export interface BulkCutSummary {
  cut: number;
  finished: number;
  /** Deleted, or highlighted by someone/something else mid-run. */
  skipped: number;
  failed: number;
  /** Cards whose read ended over the default length cap. */
  shortfalls: number;
  /** User pressed Stop / Escape. */
  stopped: boolean;
  /** Auth failure or repeated-failure breaker ended the run early. */
  halted: boolean;
}

/** Run the bulk queue: default settings only, no flags, no per-card
 *  panels. Sequential — each card is re-resolved by id at its turn (a
 *  card deleted or cut meanwhile is skipped, not mis-targeted), and
 *  each cut still takes its own lease and undo step. Ends early on
 *  `shouldStop()` (checked between cards), immediately on an auth /
 *  model error (a dead key fails every remaining card too), or after
 *  three consecutive failures of any kind. */
export async function bulkCutCards(
  view: EditorView,
  targets: BulkTargets['actionable'],
  opts: {
    readTimeSec?: number | null;
    shouldStop?: () => boolean;
    onProgress?: (done: number, total: number) => void;
  } = {},
): Promise<BulkCutSummary> {
  const s: BulkCutSummary = {
    cut: 0,
    finished: 0,
    skipped: 0,
    failed: 0,
    shortfalls: 0,
    stopped: false,
    halted: false,
  };
  const total = targets.length;
  let streak = 0;
  for (let i = 0; i < total; i++) {
    if (opts.shouldStop?.()) {
      s.stopped = true;
      break;
    }
    const t = targets[i]!;
    const live = resolveCardById(view, t.cardId);
    if (!live || cardState(live).hasHighlight) {
      s.skipped++;
      continue;
    }
    try {
      const session = await cutFocusedCard(view, {
        cardId: t.cardId,
        quiet: true,
        useFlags: false,
        stageSuffix: ` · card ${i + 1} of ${total} · Esc to stop`,
        ...(opts.readTimeSec ? { readTimeSec: opts.readTimeSec } : {}),
      });
      if (!session) {
        // Lease denied or the card moved mid-cut — failure, not silence.
        s.failed++;
        streak++;
      } else {
        streak = 0;
        if (t.kind === 'finish') s.finished++;
        else s.cut++;
        if (session.shortfall) s.shortfalls++;
      }
    } catch (err) {
      s.failed++;
      streak++;
      console.error(`[cardcutter] bulk cut ${i + 1}/${total} failed:`, err);
      if (err instanceof LlmError && (err.kind === 'auth' || err.kind === 'model')) {
        s.halted = true;
        break;
      }
    }
    if (streak >= 3) {
      s.halted = true;
      break;
    }
    opts.onProgress?.(i + 1, total);
  }
  return s;
}

function extractCard(view: EditorView, cardNode: PMNode, cardPos: number): FocusedCard | null {

  // Blank delimiter-protected spans from everything sent to the engine so
  // protected spans can't be read aloud. Scan PER child paragraph: scanning
  // the whole card at once concatenates tag/cite/body with no separators, so
  // an opening delimiter in one (e.g. the tag's `[TRANSLATION…]`) could pair
  // with a keyword in another and over-mask across them.
  const protectionPatterns = cardCutterProtectionPatterns();
  const maskChild = (child: PMNode, childPos: number): string =>
    maskProtected(
      child.textContent,
      childPos + 1,
      findProtectedRanges(
        view.state.doc,
        [{ from: childPos, to: childPos + child.nodeSize }],
        protectionPatterns,
      ),
    );

  let tag = '';
  let cite = '';
  const paras: string[] = [];
  const paraStarts: number[] = [];
  const existing: MarkSpan[] = [];
  cardNode.forEach((child, offset) => {
    const t = child.type.name;
    const childPos = cardPos + 1 + offset; // position of child node
    if (t === 'tag' || t === 'analytic') {
      tag += maskChild(child, childPos);
    } else if (t === 'cite_paragraph') {
      cite += (cite ? '\n' : '') + maskChild(child, childPos);
    } else if (child.isTextblock) {
      const p = paras.length;
      // Read existing body marks into char-range spans, tracking the
      // text offset as we walk the inline runs.
      let textOff = 0;
      child.forEach((inline) => {
        if (!inline.isText || !inline.text) return;
        const start = textOff;
        const end = textOff + inline.text.length;
        for (const m of inline.marks) {
          const name = m.type.name;
          if (name === 'underline_mark' || name === 'underline_direct')
            existing.push({ layer: 'u', p, start, end });
          else if (name === 'emphasis_mark') existing.push({ layer: 'em', p, start, end });
          else if (name === 'highlight') existing.push({ layer: 'hl', p, start, end });
        }
        textOff = end;
      });
      paras.push(maskChild(child, childPos));
      paraStarts.push(childPos + 1); // +1 into the textblock's content
    }
  });
  if (paras.length === 0) return null;

  return {
    card: {
      id: 'live',
      doc: '',
      section: '',
      tag: tag.trim(),
      cite: cite.trim(),
      paras,
    },
    cardId: cardIdOf(cardNode),
    cardFrom: cardPos,
    cardTo: cardPos + cardNode.nodeSize,
    paraStarts,
    existing,
  };
}

// ─── Highlight color resolution (doc convention, else ribbon) ─────

/** If every highlighted run in the document uses the same color, that
 *  is the doc convention; if the doc mixes colors or has none, fall
 *  back to the ribbon-selected highlight color. */
function resolveHighlightColor(view: EditorView): string {
  const seen = new Set<string>();
  view.state.doc.descendants((node) => {
    if (!node.isText) return true;
    for (const m of node.marks) {
      if (m.type.name === 'highlight') seen.add(String(m.attrs['color'] ?? 'yellow'));
    }
    return true;
  });
  if (seen.size === 1) return [...seen][0]!;
  return settings.get('lastHighlightColor') || 'yellow';
}

// ─── Apply: MarkSpan[] → one transaction ──────────────────────────

const LAYER_MARK: Record<Layer, string> = {
  u: 'underline_mark',
  em: 'emphasis_mark',
  hl: 'highlight',
};

export function applyCutToCard(
  view: EditorView,
  focused: FocusedCard,
  spans: MarkSpan[],
  layers?: Layer[],
  dispatch: (tr: Transaction) => void = (tr) => view.dispatch(tr),
): void {
  const tr = view.state.tr;
  const color = resolveHighlightColor(view);
  for (const s of spans) {
    if (layers && !layers.includes(s.layer)) continue;
    const base = focused.paraStarts[s.p];
    if (base === undefined) continue;
    const from = base + s.start;
    const to = base + s.end;
    if (to <= from) continue;
    const markName = LAYER_MARK[s.layer];
    const type = schema.marks[markName];
    if (!type) continue;
    tr.addMark(from, to, s.layer === 'hl' ? type.create({ color }) : type.create());
  }
  if (!tr.docChanged && tr.steps.length === 0) return;
  // Deliberately NO selection move and NO scroll: the user may be
  // working elsewhere while the cut runs (especially in a bulk run),
  // and the purple activity pill already says where the work landed.
  // The review panel's jump button is the explicit way over.
  dispatch(tr);
}

/** Shift a focused card's doc positions by `delta` — used after the
 *  coordinator lease reports the card moved (an edit elsewhere in the doc
 *  shifted it during the model call). Marks are position-stable inside the
 *  leased card, so one uniform delta re-anchors every position. */
function shiftFocused(focused: FocusedCard, delta: number): FocusedCard {
  if (delta === 0) return focused;
  return {
    ...focused,
    cardFrom: focused.cardFrom + delta,
    cardTo: focused.cardTo + delta,
    paraStarts: focused.paraStarts.map((p) => p + delta),
  };
}

/** Claim a coordinator lease over the focused card for the duration of an
 *  async card-cutter op. Returns null (with a toast) if another AI edit
 *  already holds this card. */
function claimCardLease(view: EditorView, focused: FocusedCard, label: string): EditLease | null {
  const lease = claimRegion(view, { from: focused.cardFrom, to: focused.cardTo }, { label });
  if (!lease) {
    // Under clod mode "another AI edit" breaks the fiction — there is
    // only the one named persona, who is simply busy.
    showToast(
      settings.get('clodEnabled')
        ? `${getAiPersona().name.trim() || 'Clod'} is already working on this card — try again in a moment.`
        : 'Another AI edit is working on this card — try again in a moment.',
    );
  }
  return lease;
}

// ─── Cutter context (file guidance + sections + doc structure) ────

/** The active doc's annotation id, injected by the host (index.ts owns
 *  doc identity; importing it here would be a cycle). Null until wired
 *  or when no doc is open — context then omits the notes. */
let cutterDocIdProvider: (() => string | null) | null = null;
export function setCutterDocIdProvider(fn: () => string | null): void {
  cutterDocIdProvider = fn;
}

const GUIDANCE_DISTILL_SYSTEM = `You maintain a debate file's standing card-cutting guidance. A user just adjusted ONE AI-cut card in the file and typed the feedback below.

Decide whether the feedback expresses a DURABLE, CARD-NEUTRAL preference about how cards in THIS FILE should be cut (selection priorities, emphasis, length, style) — or a one-off correction about that specific card's content.

Reply with exactly one line:
RULE: <the preference restated as one concise, imperative, card-neutral instruction (max ~140 characters)>
or
NONE

Reply NONE when the feedback names specific content of one card (a particular warrant, author, statistic, or sentence), when it is ambiguous, or when the existing guidance below already covers it — restating an existing rule is worse than silence. Most feedback is card-specific; NONE should be your common answer.`;

/** The auto-update half of the guidance note's design: its replies are
 *  "the cutter's accumulated card-neutral refinements", and this is
 *  what writes them. Fire-and-forget after a successful refine that
 *  carried TYPED feedback (U/D flags are inherently card-specific and
 *  never distilled): a small model call judges whether the feedback
 *  generalises to the file; if so it lands as an ai-authored reply —
 *  rendered as a FILE GUIDANCE bullet in every later cut's context,
 *  individually deletable in the guidance note UI. Skips quietly when
 *  the doc has no annotation identity yet. Exported for tests. */
export async function maybeRecordGuidanceRefinement(feedback: string): Promise<void> {
  try {
    const fb = feedback.trim();
    if (!fb) return;
    const docId = cutterDocIdProvider?.();
    if (!docId) return;
    const existing = learnStore.cutterGuidanceNote(docId);
    const have = (existing?.comments ?? []).map((c) => c.text.trim()).filter(Boolean);
    const user = `FEEDBACK:\n${fb}\n\nEXISTING GUIDANCE:\n${
      have.length ? have.map((h) => `- ${h}`).join('\n') : '(none)'
    }`;
    const raw = (await makeLlm()(GUIDANCE_DISTILL_SYSTEM, user, resolveAiModel())).trim();
    const m = raw.match(/^RULE:\s*(.+)$/m);
    if (!m) return; // NONE, or anything malformed — silence is the default
    const rule = m[1]!.trim().slice(0, 200);
    if (!rule) return;
    // Belt over the model's own dedupe judgment: never store an exact twin.
    if (have.some((h) => h.toLowerCase() === rule.toLowerCase())) return;
    let noteId = existing?.noteId;
    if (!noteId) {
      noteId = crypto.randomUUID();
      learnStore.addNote({
        noteId,
        docId,
        comments: [],
        anchor: null,
        createdAt: new Date().toISOString(),
        kind: 'cutter-guidance',
      });
    }
    learnStore.appendNoteComment(noteId, {
      author: 'Card cutter',
      text: rule,
      at: new Date().toISOString(),
      ai: true,
    });
    showToast(`File guidance updated: \u201c${rule}\u201d`);
  } catch (err) {
    // Learning is a bonus — never let it surface as a refine failure.
    console.warn('[cardcutter] guidance distill failed:', err);
  }
}

/** Cap per designated-section excerpt so a huge selection can't blow
 *  up the prompt (the engine sees the card body separately anyway). */
const SECTION_EXCERPT_CHARS = 4000;

/** Append the engine's corpus-derived argument-family hint to a built
 *  context block. Engine ≥0.8 only; older bundles no-op. The hint is
 *  derived from the card's prose alone, so it helps most on loose
 *  cards with no section path — and the line itself tells the model
 *  the section path and user intent outrank it. */
/** Append the corpus genre hint to the cut context, and report the
 *  family whose examples this cut will use (null when it will use
 *  none) so the progress pill can name it. */
function withGenreHint(
  api: CardCutterApi,
  focused: FocusedCard,
  context: string,
): { context: string; family: string | null } {
  try {
    const hint = api.classifyGenre?.(focused.card.paras.join(' '), focused.card.tag);
    if (!hint || !api.genreHintLine) return { context, family: null };
    const line = api.genreHintLine(hint);
    // Engine ≥0.9 decides whether examples will actually be shown; an
    // older engine simply reports no family and the pill stays generic.
    const family = api.genreDemoLabel?.(hint) ?? null;
    return { context: context ? `${context}\n\n${line}` : line, family };
  } catch {
    return { context, family: null };
  }
}

/** Assemble the context block the engine's prompts consume: the file
 *  guidance note (root = user's "how this file works", replies = the
 *  cutter's accumulated refinements), each designated section's live
 *  text, the focused card's section path, and its neighbors' tags in
 *  the same block. Mirrors the bench's cutterContext contract — the
 *  ordering is stable so the [context prefix][card payload] split
 *  stays prompt-cache-friendly. */
export function buildCutterContext(view: EditorView, cardFrom: number): string {
  const parts: string[] = [];
  const docId = cutterDocIdProvider?.() ?? null;

  if (docId) {
    const guidance = learnStore.cutterGuidanceNote(docId);
    if (guidance && guidance.comments.length > 0) {
      // First USER comment is the prose root; every other turn — later
      // replies, and any ai-authored line even if it happens to be
      // first (the auto-refinement writer can precede a root the user
      // never wrote) — is a bullet.
      const lines: string[] = [];
      guidance.comments.forEach((c, i) => {
        const t = c.text.trim();
        if (!t) return;
        lines.push(i === 0 && !c.ai ? t : `- ${t}`);
      });
      if (lines.length > 0) {
        parts.push(`FILE GUIDANCE (how this file works):\n${lines.join('\n')}`);
      }
    }
    const sections = learnStore.cutterSectionNotes(docId);
    if (sections.length > 0) {
      // Resolve all descriptors against ONE flatten (O(doc) once).
      const flat = flattenDoc(view.state.doc);
      const excerpts: string[] = [];
      for (const n of sections) {
        if (!n.anchor) continue;
        const r = resolveDescriptorIn(flat, n.anchor);
        // Live text when the anchor resolves; the designation-time
        // quote when edits broke it (stale context beats none).
        let live = '';
        if (r) {
          const startI = flat.pos.findIndex((p) => p >= r.from);
          let endI = flat.pos.findIndex((p) => p >= r.to);
          if (endI === -1) endI = flat.text.length;
          if (startI >= 0) live = flat.text.slice(startI, endI);
        }
        const text = (live || n.anchor.quote).trim();
        if (!text) continue;
        const label = n.comments[0]?.text.trim();
        excerpts.push(
          (label ? `[${label}]\n` : '') + text.slice(0, SECTION_EXCERPT_CHARS),
        );
      }
      if (excerpts.length > 0) {
        parts.push(`DESIGNATED CONTEXT SECTIONS (from this file):\n${excerpts.join('\n---\n')}`);
      }
    }
  }

  const structure = docStructureAt(view, cardFrom);
  if (structure.section) parts.push(`SECTION: ${structure.section}`);
  if (structure.near.length > 0) {
    parts.push(
      `NEARBY TAGS IN THIS BLOCK (the card may continue their story):\n  ${structure.near.join('\n  ')}`,
    );
  }
  return parts.join('\n\n');
}

/** Walk the doc's top-level children to find the focused card's
 *  pocket › hat › block path and its neighbors' tags within the same
 *  block (blocks tell one story across cards — the engine credits
 *  material serving it). */
function docStructureAt(
  view: EditorView,
  cardFrom: number,
): { section: string; near: string[] } {
  interface Entry {
    kind: 'pocket' | 'hat' | 'block' | 'card';
    text: string;
    from: number;
    to: number;
  }
  const entries: Entry[] = [];
  view.state.doc.forEach((child, offset) => {
    const t = child.type.name;
    if (t === 'pocket' || t === 'hat' || t === 'block') {
      entries.push({ kind: t, text: child.textContent.trim(), from: offset, to: offset + child.nodeSize });
    } else if (t === 'card' || t === 'analytic_unit') {
      let tag = '';
      child.forEach((cc) => {
        if (!tag && (cc.type.name === 'tag' || cc.type.name === 'analytic')) {
          tag = cc.textContent.trim();
        }
      });
      entries.push({ kind: 'card', text: tag, from: offset, to: offset + child.nodeSize });
    }
  });
  const idx = entries.findIndex(
    (e) => e.kind === 'card' && e.from <= cardFrom && cardFrom < e.to,
  );
  if (idx < 0) return { section: '', near: [] };

  let pocket = '';
  let hat = '';
  let block = '';
  for (let i = idx - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (e.kind === 'block' && !block && !hat && !pocket) block = e.text;
    else if (e.kind === 'hat' && !hat && !pocket) hat = e.text;
    else if (e.kind === 'pocket' && !pocket) pocket = e.text;
  }
  const section = [pocket, hat, block].filter(Boolean).join(' › ');

  // Neighbor cards within the same block: stop at any heading.
  const near: string[] = [];
  for (let i = idx - 1; i >= 0; i--) {
    const e = entries[i]!;
    if (e.kind !== 'card') break;
    if (e.text) near.push(`previous tag: ${e.text}`);
    break;
  }
  for (let i = idx + 1; i < entries.length; i++) {
    const e = entries[i]!;
    if (e.kind !== 'card') break;
    if (e.text) near.push(`next tag: ${e.text}`);
    break;
  }
  return { section, near };
}

// ─── Play-up / play-down flags (cut-panel annotation mode) ────────

export interface CutFlag {
  kind: 'up' | 'down';
  /** Verbatim flagged text (what ships in the prompt). */
  text: string;
  /** Selection positions at annotation time — for the tint
   *  decorations. The decoration set maps them through edits; the
   *  prompt ships the captured text either way. */
  from: number;
  to: number;
  /** Doc the flag was made in — flags never leak across docs. */
  docId: string | null;
}

/** Flags for the in-progress cut panel. Transient by design: consumed
 *  by the cut that used them, or discarded when the panel closes. */
let cutFlags: CutFlag[] = [];

function refreshFlagDecorations(view: EditorView): void {
  const flags = pendingCutterFlags();
  setCutterFlagDecorations(
    view,
    flags.length > 0 ? flags.map((f) => ({ from: f.from, to: f.to, kind: f.kind })) : null,
  );
}

/** Flag the current selection to play up or down in the next cut and
 *  tint it green/red. Returns the flag, or null if nothing usable is
 *  selected. */
export function addCutterFlag(view: EditorView, kind: 'up' | 'down'): CutFlag | null {
  const { from, to, empty } = view.state.selection;
  if (empty) return null;
  const text = view.state.doc.textBetween(from, to, ' ').trim();
  if (!text) return null;
  const flag: CutFlag = { kind, text, from, to, docId: cutterDocIdProvider?.() ?? null };
  cutFlags.push(flag);
  refreshFlagDecorations(view);
  return flag;
}

/** Flags pending for the active doc (what the cut panel lists). */
export function pendingCutterFlags(): CutFlag[] {
  const docId = cutterDocIdProvider?.() ?? null;
  return cutFlags.filter((f) => f.docId === docId);
}

/** Remove one pending flag by identity (panel ✕ buttons). */
export function removeCutterFlag(view: EditorView, flag: CutFlag): void {
  cutFlags = cutFlags.filter((f) => f !== flag);
  refreshFlagDecorations(view);
}

/** Discard the active doc's pending flags (panel cancelled). */
export function clearCutterFlags(view: EditorView): void {
  const docId = cutterDocIdProvider?.() ?? null;
  cutFlags = cutFlags.filter((f) => f.docId !== docId);
  setCutterFlagDecorations(view, null);
}

// ─── The one public entry the command layer calls ─────────────────

export interface CutInvocation {
  /** Free-form user statement of what this cut is for. Replaces the
   *  old role radios — the engine infers genre from the section path
   *  and treats a stated purpose as outranking that inference. */
  intent?: string;
  /** Optional read-time CAP in seconds. The cut is always made
   *  efficiently first; when set, a secondary de-highlight trims it
   *  toward this length (never pads up to it). Omit = no cap. */
  readTimeSec?: number;
  /** Cut THIS card rather than the cursor's — the same identity
   *  contract as RefineInvocation.cardId. Used by the launch panel
   *  (whose target is captured at open, not at Go) and the bulk queue. */
  cardId?: string;
  /** Bulk mode: no per-card toasts, and errors RETHROW instead of
   *  becoming toast+null — the orchestrator needs the LlmError kind
   *  for auth fail-fast and its failure-streak breaker. */
  quiet?: boolean;
  /** Appended to every stage label ("skeletonizing · card 3 of 7 ·
   *  Esc to stop"). A suffix, never a prefix: the clod-mode pill wraps
   *  the label as "<persona> is <label>…", so the gerund must lead. */
  stageSuffix?: string;
  /** false = ignore (and do not consume) pending panel flags — a
   *  stray U/D from an abandoned panel must not bias, or be eaten by,
   *  a bulk run. Default true (panel behaviour). */
  useFlags?: boolean;
}

/** What a completed cut leaves the UI to work with: the card handle
 *  (positions stay valid — applying marks doesn't move text), the
 *  engine MarkMap of the applied result (for proposeOmissions), the
 *  exact read length, and any budget shortfall. */
export interface CutSession {
  focused: FocusedCard;
  map: MarkMap;
  readWords: number;
  shortfall?: BudgetShortfall;
}

export async function cutFocusedCard(
  view: EditorView,
  inv: CutInvocation,
): Promise<CutSession | null> {
  if (!engine) {
    const ok = await tryLoadCardCutterEngine();
    if (!ok) {
      showToast(CUTTER_ENGINE_MISSING_MESSAGE);
      return null;
    }
  }
  const api = engine!;
  if (!activeApiKey()) {
    showToast(CUTTER_NO_KEY_MESSAGE);
    return null;
  }
  const focused = inv.cardId ? resolveCardById(view, inv.cardId) : focusedPlainCard(view);
  if (!focused) {
    if (!inv.quiet) showToast('Put the cursor in a card with body text first.');
    return null;
  }
  const { hasUnderline, hasEmphasis, hasHighlight } = cardState(focused);
  // Already highlighted → done; don't clobber a finished cut. (Highlight
  // Down shrinks it.)
  if (hasHighlight) {
    if (!inv.quiet) showToast('This card is already highlighted.');
    return null;
  }
  const flags = inv.useFlags === false ? [] : pendingCutterFlags();
  const genre = withGenreHint(api, focused, buildCutterContext(view, focused.cardFrom));
  const opts: CutOptions = {
    // Efficient by default; a read-time cap becomes the secondary
    // de-highlight target. No cap → undefined → pure efficient cut.
    ...(inv.readTimeSec
      ? { targetWords: Math.max(15, Math.round((inv.readTimeSec * readerWpm()) / 60)) }
      : {}),
    emphasisStyle: settings.get('cardCutterEmphasisStyle'),
    // Inert on current engines (genre comes from the section path in
    // context); kept so an older installed bundle still gets a value.
    role: 'block',
    context: genre.context,
    ...(inv.intent?.trim() ? { intent: inv.intent.trim() } : {}),
    ...(flags.some((f) => f.kind === 'up')
      ? { playUp: flags.filter((f) => f.kind === 'up').map((f) => f.text) }
      : {}),
    ...(flags.some((f) => f.kind === 'down')
      ? { playDown: flags.filter((f) => f.kind === 'down').map((f) => f.text) }
      : {}),
    model: resolveAiModel(),
    terminalImpact: api.detectTerminalImpact(focused.card.tag),
  };
  // Lease the card so the cut lands on it even if the doc shifts during
  // the model call, and user edits to the card are held meanwhile.
  const lease = claimCardLease(view, focused, 'card-cut');
  if (!lease) return null;
  // Pill + purple tint over the whole card while the model works.
  const activity = new AiActivity(view, { from: focused.cardFrom, to: focused.cardTo });
  activity.start();
  opts.onStage = (s) => activity.setStage(stageLabel(s, genre.family) + (inv.stageSuffix ?? ''));
  const llm = makeLlm();
  try {
    // Underlined-but-not-highlighted → Highlight Card (trust the
    // existing underlines, add only highlights). Plain → full Cut.
    const result = hasUnderline
      ? await api.highlightCard(focused.card, focused.existing, opts, llm)
      : await api.cutCard(focused.card, opts, llm);
    // Re-anchor to the card's current position (edits elsewhere may have
    // shifted it). Null delta → the card was removed mid-cut.
    const delta = lease.delta();
    if (delta === null) {
      if (!inv.quiet) showToast('The card moved while cutting — cut not applied.');
      return null;
    }
    const placed = shiftFocused(focused, delta);
    // Finish-the-card: existing underlining is immutable, but a card
    // underlined with NO emphasis gets the emphasis layer added along
    // with highlights (the settled design: the cutter adds only the
    // MISSING lower layers, never touches present ones).
    const applyLayers: Layer[] | undefined = hasUnderline
      ? hasEmphasis
        ? ['hl']
        : ['em', 'hl']
      : undefined;
    applyCutToCard(view, placed, result.spans, applyLayers, (tr) => lease.apply(tr));
    for (const w of result.warnings) console.log(`[cardcutter] ${w}`);
    // Flags are per-cut: consumed by the cut that used them.
    for (const f of flags) removeCutterFlag(view, f);
    if (!inv.quiet) showToast(hasUnderline ? 'Card highlighted — ↶ to undo' : 'Card cut — ↶ to undo');
    return {
      focused: placed,
      map: cardMapAfter(placed, result.spans),
      readWords: result.readWords ?? 0,
      ...(result.shortfall ? { shortfall: result.shortfall } : {}),
    };
  } catch (err) {
    console.error('[cardcutter] cut failed:', err);
    // Bulk callers get the real error — its LlmError kind drives auth
    // fail-fast and the failure-streak breaker.
    if (inv.quiet) throw err;
    showToast(`Card cut failed: ${(err as Error).message}`);
    return null;
  } finally {
    activity.stop();
    lease.release();
  }
}

/** The engine MarkMap of the card after applying `spans` on top of its
 *  existing marks — what proposeOmissions / section toggles read. */
function cardMapAfter(focused: FocusedCard, spans: MarkSpan[]): MarkMap {
  const map = buildMarkMap(focused);
  for (const s of spans) {
    const arr = map[s.layer][s.p];
    if (!arr) continue;
    for (let i = s.start; i < s.end && i < arr.length; i++) arr[i] = 1;
  }
  return map;
}

/** First reader's WPM, or a sane default. */
function readerWpm(): number {
  const readers = settings.get('readers');
  return readers[0]?.wpm && readers[0].wpm > 0 ? readers[0].wpm : 350;
}

/** Whether the cursor is in a cuttable card, and its mark state — for
 *  the launch sheet to label cut vs highlight vs already-done. */
export function focusedCardStatus(
  view: EditorView,
): { cuttable: boolean; hasUnderline: boolean; hasHighlight: boolean } {
  const f = focusedPlainCard(view);
  if (!f) return { cuttable: false, hasUnderline: false, hasHighlight: false };
  return { cuttable: true, ...cardState(f) };
}

/** After an efficient cut, ask the engine to nominate optional sections
 *  the user could drop (with exact, engine-counted word savings). Empty
 *  on failure or when little is optional. */
export async function proposeFocusedOmissions(
  session: CutSession,
): Promise<OmissionSection[]> {
  if (!engine) return [];
  try {
    return await engine.proposeOmissions(
      session.focused.card,
      session.map,
      makeLlm(),
      resolveAiModel(),
    );
  } catch (err) {
    console.warn('[cardcutter] proposeOmissions failed:', (err as Error).message);
    return [];
  }
}

/** Toggle a nominated section: remove its highlight (omit) or restore
 *  it (un-omit). Underline/emphasis untouched. Positions come from the
 *  card handle, valid because applying marks never moves text. */
export function setSectionOmitted(
  view: EditorView,
  session: CutSession,
  section: OmissionSection,
  omit: boolean,
): void {
  const hlType = schema.marks['highlight'];
  if (!hlType) return;
  const tr = view.state.tr;
  const color = omit ? '' : resolveHighlightColor(view);
  for (const s of section.spans) {
    const base = session.focused.paraStarts[s.p];
    if (base === undefined) continue;
    const from = base + s.start;
    const to = base + s.end;
    if (to <= from) continue;
    if (omit) tr.removeMark(from, to, hlType);
    else tr.addMark(from, to, hlType.create({ color }));
  }
  if (tr.steps.length > 0) view.dispatch(tr);
}

/** Hover preview for the trim checklist: box the highlighted words a
 *  section's checkbox would affect (purple boxes hugging each run), or
 *  clear with `null`. Positions are valid because applying marks never
 *  moves text. */
export function previewOmissionSection(
  view: EditorView,
  session: CutSession,
  section: OmissionSection | null,
): void {
  if (!section) {
    setCardCutterPreview(view, null);
    return;
  }
  const ranges: { from: number; to: number }[] = [];
  for (const s of section.spans) {
    const base = session.focused.paraStarts[s.p];
    if (base === undefined) continue;
    const from = base + s.start;
    const to = base + s.end;
    if (to > from) ranges.push({ from, to });
  }
  setCardCutterPreview(view, ranges);
}

export async function ensureEngine(): Promise<boolean> {
  if (engine) return true;
  return tryLoadCardCutterEngine();
}

// ─── Highlight Down ───────────────────────────────────────────────

/** Build the engine's MarkMap from a focused card's existing marks. */
function buildMarkMap(focused: FocusedCard): MarkMap {
  const map: MarkMap = {
    u: focused.card.paras.map((p) => new Uint8Array(p.length)),
    em: focused.card.paras.map((p) => new Uint8Array(p.length)),
    hl: focused.card.paras.map((p) => new Uint8Array(p.length)),
  };
  for (const s of focused.existing) {
    const arr = map[s.layer][s.p];
    if (!arr) continue;
    for (let i = s.start; i < s.end && i < arr.length; i++) arr[i] = 1;
  }
  return map;
}

/** Apply the highlight DIFF between the original card and a refined map:
 *  remove highlight where it was dropped, add it where it was added (the
 *  refine "allow adding" path; adds are always within existing underline,
 *  so no new underline is needed). Surviving runs keep their color. */
function applyHlDiff(
  view: EditorView,
  focused: FocusedCard,
  original: MarkMap,
  result: MarkMap,
  dispatch: (tr: Transaction) => void = (tr) => view.dispatch(tr),
): void {
  const tr = view.state.tr;
  const hlType = schema.marks['highlight'];
  if (!hlType) return;
  const color = resolveHighlightColor(view);
  for (let p = 0; p < focused.paraStarts.length; p++) {
    const base = focused.paraStarts[p]!;
    const orig = original.hl[p]!;
    const res = result.hl[p]!;
    let i = 0;
    while (i < orig.length) {
      if (orig[i] && !res[i]) {
        const start = i;
        while (i < orig.length && orig[i] && !res[i]) i++;
        tr.removeMark(base + start, base + i, hlType);
      } else i++;
    }
    i = 0;
    while (i < res.length) {
      if (res[i] && !orig[i]) {
        const start = i;
        while (i < res.length && res[i] && !orig[i]) i++;
        tr.addMark(base + start, base + i, hlType.create({ color }));
      } else i++;
    }
  }
  if (tr.steps.length > 0) dispatch(tr); // no scroll — see applyCutToCard
}

/** Options for the dehighlight skill — every field optional and
 *  composable; `readTimeSec` is a length cap, the rest are toggles. */
export interface RefineInvocation {
  dropRedundancy?: boolean;
  skeletonize?: boolean;
  readTimeSec?: number;
  feedback?: string;
  /** Permit refine to ADD highlight (within underline), not just remove. */
  allowAdd?: boolean;
  /** The card this refine is FOR, captured when its panel opened. The
   *  panel is non-blocking and its prompts can stack, so by the time the
   *  user answers, the cursor may sit in a different card entirely —
   *  targeting the cursor would silently refine the wrong one. Omitted
   *  (older callers) falls back to the focused card. */
  cardId?: string;
  /** Post-cut review mode: the cut is DONE and the user is pointing at
   *  what to change. The model is told to make the smallest adjustment
   *  that addresses the notes and leave every other highlight exactly
   *  as it is — and the U/D directives switch from pre-cut hints
   *  ("play up") to region edits ("add/remove highlighting here",
   *  still imprecise by design: the model picks the right words in the
   *  region; exact manual edits are what the editor itself is for). */
  surgical?: boolean;
}

/** Refine (dehighlight) the focused card per the chosen combination of
 *  drop-redundancy / skeletonize / target-length / guidance. Removes
 *  highlight only (underline/emphasis untouched). */
export async function refineHighlightFocusedCard(
  view: EditorView,
  inv: RefineInvocation,
): Promise<boolean> {
  if (!(await ensureEngine())) {
    showToast(CUTTER_ENGINE_MISSING_MESSAGE);
    return false;
  }
  if (!activeApiKey()) {
    showToast(CUTTER_NO_KEY_MESSAGE);
    return false;
  }
  const feedback = inv.feedback?.trim() || undefined;
  if (
    !inv.dropRedundancy &&
    !inv.skeletonize &&
    !inv.readTimeSec &&
    !feedback &&
    pendingCutterFlags().length === 0
  ) {
    showToast('Pick a target or a setting, point at some text, or type guidance.');
    return false;
  }
  // Identity first, cursor only as fallback — see RefineInvocation.cardId.
  const focused = inv.cardId ? resolveCardById(view, inv.cardId) : focusedPlainCard(view);
  if (!focused) {
    showToast(
      inv.cardId
        ? 'That card is no longer in the document — refine cancelled.'
        : 'Put the cursor in a card first.',
    );
    return false;
  }
  if (!cardState(focused).hasHighlight) {
    showToast('This card has no highlights to refine.');
    return false;
  }
  const targetWords = inv.readTimeSec
    ? Math.max(10, Math.round((inv.readTimeSec * readerWpm()) / 60))
    : undefined;
  // Play-up / play-down annotations made while the panel was open.
  // `refineHighlight` takes no directional args (only the cut passes do),
  // so fold them into the free-text guidance the refine prompt already
  // reads — the same instruction, expressed in the channel that exists.
  // Wording depends on the mode: pre-cut they are emphasis HINTS; in the
  // post-cut surgical review they are region EDITS (imprecise ones — the
  // model chooses the right words in and around the pointed-at region).
  const flags = pendingCutterFlags();
  const directives = inv.surgical
    ? [
        ...flags
          .filter((f) => f.kind === 'up')
          .map(
            (f) =>
              `ADD highlighting in this region (the selection is imprecise — pick the words that belong in the read): "${f.text}"`,
          ),
        ...flags
          .filter((f) => f.kind === 'down')
          .map(
            (f) =>
              `REMOVE highlighting in this region (the selection is imprecise — un-highlight what falls in it): "${f.text}"`,
          ),
      ]
    : [
        ...flags
          .filter((f) => f.kind === 'up')
          .map((f) => `Play UP (keep / read more of): "${f.text}"`),
        ...flags
          .filter((f) => f.kind === 'down')
          .map((f) => `Play DOWN (trim / de-emphasise): "${f.text}"`),
      ];
  const surgicalRule = inv.surgical
    ? 'SURGICAL ADJUSTMENT of an accepted cut: make the smallest change that addresses the notes below, and leave every other highlight exactly as it is. If a note only points at regions, change highlighting only there.'
    : '';
  const guidance = [surgicalRule, inv.feedback?.trim() || '', ...directives]
    .filter(Boolean)
    .join('\n');
  const original = buildMarkMap(focused);
  const lease = claimCardLease(view, focused, 'card-refine');
  if (!lease) return false;
  const activity = new AiActivity(view, { from: focused.cardFrom, to: focused.cardTo });
  activity.start();
  // Consumed — drop the tints now the directives are in the request.
  if (flags.length > 0) clearCutterFlags(view);
  try {
    const result = await engine!.refineHighlight(
      focused.card,
      original,
      {
        ...(inv.dropRedundancy ? { dropRedundancy: true } : {}),
        ...(inv.skeletonize ? { skeletonize: true } : {}),
        ...(targetWords ? { targetWords } : {}),
        ...(guidance ? { feedback: guidance } : {}),
        ...(inv.allowAdd ? { allowAdd: true } : {}),
        model: resolveAiModel(),
        onStage: (s) => activity.setStage(STAGE_LABEL[s]),
      },
      makeLlm(),
    );
    const delta = lease.delta();
    if (delta === null) {
      showToast('The card moved while refining — refine not applied.');
      return false;
    }
    applyHlDiff(view, shiftFocused(focused, delta), original, result.map, (tr) => lease.apply(tr));
    for (const w of result.warnings) console.log(`[cardcutter] ${w}`);
    const sec = Math.round((result.words / readerWpm()) * 60);
    if (result.shortfall && inv.readTimeSec) {
      showToast(
        `Refined to ${result.words}w · ~${sec}s — couldn't reach ${inv.readTimeSec}s` +
          (result.shortfall.reason ? ` without dropping ${result.shortfall.reason}` : '') +
          '. ↶ to undo',
      );
    } else {
      showToast(`Refined to ${result.words}w · ~${sec}s — ↶ to undo`);
    }
    // The file learns: typed feedback (never the folded U/D directives —
    // those are card-specific by nature) is distilled in the background
    // into the guidance note when it generalises. Fire-and-forget so the
    // review loop's reopen never waits on it.
    if (feedback) void maybeRecordGuidanceRefinement(feedback);
    return true;
  } catch (err) {
    console.error('[cardcutter] refine failed:', err);
    showToast(`Refine failed: ${(err as Error).message}`);
    return false;
  } finally {
    activity.stop();
    lease.release();
  }
}

// ─── Add Highlight ────────────────────────────────────────────────

/** The current selection mapped to body-paragraph char ranges, or null
 *  if the selection is empty or covers the whole card (→ whole-card). */
function selectionScope(
  view: EditorView,
  focused: FocusedCard,
): { p: number; start: number; end: number }[] | null {
  const { from, to } = view.state.selection;
  if (to <= from) return null;
  const ranges: { p: number; start: number; end: number }[] = [];
  let coversAll = true;
  for (let p = 0; p < focused.card.paras.length; p++) {
    const base = focused.paraStarts[p]!;
    const len = focused.card.paras[p]!.length;
    const s = Math.max(from, base) - base;
    const e = Math.min(to, base + len) - base;
    if (e > s) ranges.push({ p, start: s, end: e });
    if (s > 0 || e < len) coversAll = false;
  }
  // Empty intersection, or the selection spans the whole body → no scope.
  if (ranges.length === 0 || coversAll) return null;
  return ranges;
}

/** Whether a usable sub-selection exists inside the focused card (drives
 *  the hotkey's add-highlight-vs-shorten routing). */
export function hasCardSubSelection(view: EditorView): boolean {
  const f = focusedPlainCard(view);
  return !!f && selectionScope(view, f) !== null;
}

/** Add Highlight — extend the read within the user's selection (or the
 *  whole card if none), highlighting tag-relevant material that isn't
 *  already read. Adds marks only; never removes. */
export async function addHighlightFocusedCard(view: EditorView): Promise<void> {
  if (!(await ensureEngine())) {
    showToast(CUTTER_ENGINE_MISSING_MESSAGE);
    return;
  }
  if (!activeApiKey()) {
    showToast(CUTTER_NO_KEY_MESSAGE);
    return;
  }
  const focused = focusedPlainCard(view);
  if (!focused) {
    showToast('Put the cursor in a card first.');
    return;
  }
  const scope = selectionScope(view, focused) ?? undefined;
  const genre = withGenreHint(engine!, focused, buildCutterContext(view, focused.cardFrom));
  const opts: CutOptions = {
    emphasisStyle: settings.get('cardCutterEmphasisStyle'),
    role: 'block',
    context: genre.context,
    model: resolveAiModel(),
  };
  const lease = claimCardLease(view, focused, 'card-add-highlight');
  if (!lease) return;
  const activity = new AiActivity(view, { from: focused.cardFrom, to: focused.cardTo });
  activity.start();
  opts.onStage = (s) => activity.setStage(stageLabel(s, genre.family));
  try {
    const result = await engine!.addHighlight(focused.card, focused.existing, opts, makeLlm(), scope);
    if (result.spans.length === 0) {
      showToast(scope ? 'Nothing tag-relevant to add in the selection.' : 'Nothing more to add.');
      return;
    }
    const shift = lease.delta();
    if (shift === null) {
      showToast('The card moved while adding highlight — not applied.');
      return;
    }
    const placed = shiftFocused(focused, shift);
    // Add the delta marks (u + hl) without moving the selection.
    const tr = view.state.tr;
    const color = resolveHighlightColor(view);
    for (const s of result.spans) {
      const base = placed.paraStarts[s.p];
      if (base === undefined) continue;
      const from = base + s.start;
      const to = base + s.end;
      if (to <= from) continue;
      const type = schema.marks[LAYER_MARK[s.layer]];
      if (!type) continue;
      tr.addMark(from, to, s.layer === 'hl' ? type.create({ color }) : type.create());
    }
    for (const w of result.warnings) console.log(`[cardcutter] ${w}`);
    if (tr.steps.length > 0) lease.apply(tr); // no scroll — see applyCutToCard
    showToast('Highlight added — ↶ to undo');
  } catch (err) {
    console.error('[cardcutter] add-highlight failed:', err);
    showToast(`Add highlight failed: ${(err as Error).message}`);
  } finally {
    activity.stop();
    lease.release();
  }
}
