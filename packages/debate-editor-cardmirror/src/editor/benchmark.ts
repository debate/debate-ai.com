/**
 * In-app performance benchmark — a game-style suite that runs a battery of real
 * in-editor operations on the currently open document and reports frame rate,
 * frame-time percentiles, and operation latencies. Surfaced in Settings →
 * General (see `benchmark-ui.ts`).
 *
 * Self-instrumented via `requestAnimationFrame` + `PerformanceObserver`, so it
 * measures CardMirror's OWN rendering — a "how fast is it on my machine" readout,
 * not a cross-application comparison.
 *
 * The editor must be VISIBLE while this runs (occluded content gets its paints
 * culled by the compositor, which would falsify the frame times), so the UI
 * closes any modal and shows only a small corner chip during the run.
 */

import { TextSelection } from 'prosemirror-state';
import type { Transaction } from 'prosemirror-state';
import type { Mark, Node as ProseNode } from 'prosemirror-model';
import type { EditorView } from 'prosemirror-view';
import { newHeadingId } from '../schema/index.js';
import { preciseScrollIntoView } from './precise-scroll.js';
import { condenseBranchC } from './condense.js';
import { runRibbon } from './index.js';
import { SAMPLE_PARAS, CITE_RUNS } from './benchmark-sample.js';

/** Dispatch a benchmark edit. (The benchmark no-ops when the doc is in read mode
 *  — see launchBenchmarkOverlay — so these edits always apply.) */
function benchDispatch(view: EditorView, tr: Transaction): void {
  view.dispatch(tr);
}

const CITE_TEXT = CITE_RUNS.map((r) => r[0]).join('');

const HEADING_NODES = new Set(['pocket', 'hat', 'block', 'tag']);

/** A slight pause between discrete benchmark steps so the user can see what's
 *  happening (the suite doubles as a visual demo). Not counted in any timing. */
const STEP_PAUSE_MS = 650;

/** True while the benchmark is mutating the document. The editor's
 *  dispatchTransaction checks this to SKIP autosave/dirty/nav-rebuild side
 *  effects, so the temporary benchmark edits never touch disk or pollute the
 *  nav — and a single `view.updateState(snapshot)` fully reverts them.
 *  The flag itself lives in benchmark-state.ts so those hot-path checks
 *  don't statically pull this module (and its embedded sample card) into
 *  the main chunk. */
export { isBenchmarkActive, setBenchmarkActive } from './benchmark-state.js';

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export interface FrameStats {
  frames: number;
  fps: number; // mean
  p50FrameMs: number;
  p95FrameMs: number;
  p99FrameMs: number;
  lowFps1pct: number; // 1%-low fps, derived from the p99 frame time
  jankFrames: number; // frames longer than 1.5x the median
}

export interface EditStep {
  label: string;
  ms: number | null;
}

export interface BenchmarkResults {
  docInfo: { headings: number; cards: number; chars: number };
  scroll: (FrameStats & { durationMs: number; frameMs: number[] }) | null;
  nav: { medianMs: number; p90Ms: number; samples: number[] } | null;
  edit: { steps: EditStep[]; totalMs: number } | null;
  relayout: { ms: number } | null;
  longTasks: { count: number; totalMs: number; maxMs: number };
  score: number;
}

export type ProgressFn = (label: string) => void;

const raf = (): Promise<number> => new Promise((r) => requestAnimationFrame(r));
async function nextPaint(): Promise<void> {
  await raf();
  await raf();
}
const round1 = (x: number): number => Math.round(x * 10) / 10;

function pct(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[i]!;
}

function frameStats(intervals: number[]): FrameStats {
  const valid = intervals.filter((x) => x > 0 && x < 1000);
  const sorted = [...valid].sort((a, b) => a - b);
  const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : 0;
  const median = pct(sorted, 50);
  const p99 = pct(sorted, 99);
  return {
    frames: valid.length,
    fps: mean ? Math.round(1000 / mean) : 0,
    p50FrameMs: round1(median),
    p95FrameMs: round1(pct(sorted, 95)),
    p99FrameMs: round1(p99),
    lowFps1pct: p99 ? Math.round(1000 / p99) : 0,
    jankFrames: median ? valid.filter((x) => x > 1.5 * median).length : 0,
  };
}

/** The element that actually scrolls behind the editor (walk up to the first
 *  overflow:auto/scroll ancestor; mirrors `precise-scroll`'s own gate logic). */
function scrollGate(view: EditorView): HTMLElement {
  let cur: HTMLElement | null = view.dom as HTMLElement;
  while (cur && cur !== document.body) {
    const oy = getComputedStyle(cur).overflowY;
    if ((oy === 'auto' || oy === 'scroll') && cur.scrollHeight > cur.clientHeight) return cur;
    cur = cur.parentElement;
  }
  return (document.scrollingElement as HTMLElement | null) ?? document.documentElement;
}

function headingPositions(view: EditorView): number[] {
  const out: number[] = [];
  view.state.doc.descendants((node, pos) => {
    if (HEADING_NODES.has(node.type.name)) out.push(pos);
    return true;
  });
  return out;
}

/** Continuously scroll top→bottom over `durationMs`, sampling each frame's
 *  interval. The scroll position is driven by elapsed time (not frame count),
 *  so a slow renderer scrolls the same distance but yields longer frames. */
async function benchScroll(
  view: EditorView,
  durationMs: number,
): Promise<FrameStats & { durationMs: number; frameMs: number[] }> {
  const gate = scrollGate(view);
  const startTop = gate.scrollTop;
  gate.scrollTop = 0;
  await nextPaint();
  const max = Math.max(1, gate.scrollHeight - gate.clientHeight);
  const intervals: number[] = [];
  const t0 = performance.now();
  let last = t0;
  for (;;) {
    const now = await raf();
    intervals.push(now - last);
    last = now;
    const frac = (now - t0) / durationMs;
    gate.scrollTop = Math.min(max, frac * max);
    if (now - t0 >= durationMs || gate.scrollTop >= max) break;
  }
  const durationActual = performance.now() - t0;
  gate.scrollTop = startTop;
  await nextPaint();
  // Drop the first interval (warm-up / measurement start jitter).
  const frameMs = intervals.slice(1).map((x) => round1(x));
  return { ...frameStats(intervals.slice(1)), durationMs: Math.round(durationActual), frameMs };
}

async function settleScroll(gate: HTMLElement): Promise<void> {
  let stable = 0;
  let lastTop = gate.scrollTop;
  for (let i = 0; i < 300; i++) {
    await raf();
    if (Math.abs(gate.scrollTop - lastTop) < 0.5) {
      if (++stable >= 5) return;
    } else {
      stable = 0;
    }
    lastTop = gate.scrollTop;
  }
}

/** Jump to several headings spread across the doc (the same `preciseScrollIntoView`
 *  the nav pane uses), timing click→settled for each. */
async function benchNav(
  view: EditorView,
  onProgress?: ProgressFn,
): Promise<{ medianMs: number; p90Ms: number; samples: number[] } | null> {
  const positions = headingPositions(view);
  if (positions.length < 4) return null;
  const gate = scrollGate(view);
  const fracs = [0.12, 0.3, 0.5, 0.68, 0.85, 0.95];
  const samples: number[] = [];
  let i = 0;
  for (const f of fracs) {
    i++;
    const pos = positions[Math.floor(f * (positions.length - 1))]!;
    gate.scrollTop = 0;
    await nextPaint();
    await sleep(STEP_PAUSE_MS / 2); // let the eye reset to the top before the jump
    const dom = view.nodeDOM(pos);
    if (!(dom instanceof HTMLElement)) continue;
    onProgress?.(`Navigating ${i}/${fracs.length}…`);
    const t0 = performance.now();
    preciseScrollIntoView(view, dom, 'center');
    await settleScroll(gate);
    samples.push(performance.now() - t0);
    await sleep(STEP_PAUSE_MS); // hold on the target so the jump is legible
  }
  if (samples.length === 0) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  return {
    medianMs: round1(pct(sorted, 50)),
    p90Ms: round1(pct(sorted, 90)),
    samples: samples.map(round1),
  };
}

/** Force a full relayout + repaint of the whole editor subtree (a proxy for the
 *  layout half of "open this document"). Non-destructive — no state is rebuilt. */
async function benchRelayout(view: EditorView): Promise<{ ms: number }> {
  const el = view.dom as HTMLElement;
  const prev = el.style.display;
  await nextPaint();
  const t0 = performance.now();
  el.style.display = 'none';
  void el.offsetHeight; // flush the teardown
  el.style.display = prev;
  void el.offsetHeight; // force the full relayout synchronously
  await nextPaint(); // include the paint
  const ms = performance.now() - t0;
  return { ms: round1(ms) };
}

// ── Mutating tests (the doc is reverted afterward by the caller) ──────

function nodePos(
  doc: ProseNode,
  pred: (n: ProseNode) => boolean,
): { node: ProseNode; pos: number } | null {
  let found: { node: ProseNode; pos: number } | null = null;
  doc.descendants((node, pos) => {
    if (found) return false;
    if (pred(node)) {
      found = { node, pos };
      return false;
    }
    return true;
  });
  return found;
}

const findById = (doc: ProseNode, id: string): { node: ProseNode; pos: number } | null =>
  nodePos(doc, (n) => n.attrs?.['id'] === id);

/** A textblock child of the card owning `tagId` whose text matches `text` —
 *  found by TEXT (node-type-agnostic), so it survives normalization. Used to
 *  locate the cite line we typed (a body paragraph isn't a "cite paragraph"
 *  until the cite mark is applied) and to position the body relative to it. */
function findChildByText(
  doc: ProseNode,
  tagId: string,
  text: string,
): { node: ProseNode; pos: number } | null {
  const found = cardOfTag(doc, tagId);
  if (!found) return null;
  const { card, cardPos } = found;
  let result: { node: ProseNode; pos: number } | null = null;
  card.forEach((child, offset) => {
    if (!result && child.isTextblock && child.textContent === text) {
      result = { node: child, pos: cardPos + 1 + offset };
    }
  });
  return result;
}

function cardOfTag(doc: ProseNode, tagId: string): { card: ProseNode; cardPos: number } | null {
  const tg = findById(doc, tagId);
  if (!tg) return null;
  const $pos = doc.resolve(tg.pos);
  for (let d = $pos.depth; d >= 0; d--) {
    if ($pos.node(d).type.name === 'card') return { card: $pos.node(d), cardPos: $pos.before(d) };
  }
  return null;
}

/** Run one labelled, paused, timed step. Failures are recorded as `null` and
 *  never abort the run (docs vary; resilience matters more than completeness). */
async function measureStep(
  label: string,
  fn: () => void,
  onProgress: ProgressFn | undefined,
  steps: EditStep[],
): Promise<void> {
  onProgress?.(label);
  await nextPaint();
  const t0 = performance.now();
  let ok = true;
  try {
    fn();
  } catch (err) {
    ok = false;
    console.error('[benchmark] edit step failed:', label, err);
  }
  await nextPaint();
  steps.push({ label, ms: ok ? round1(performance.now() - t0) : null });
  await sleep(STEP_PAUSE_MS);
}

/** Like measureStep, but the sweep returns the summed apply time so the visual
 *  inter-segment delays aren't counted in the metric. */
async function measureSweep(
  label: string,
  sweep: () => Promise<number>,
  onProgress: ProgressFn | undefined,
  steps: EditStep[],
): Promise<void> {
  onProgress?.(label);
  await nextPaint();
  let ms: number | null = null;
  try {
    ms = await sweep();
  } catch (err) {
    console.error('[benchmark] sweep failed:', label, err);
  }
  steps.push({ label, ms });
  await sleep(STEP_PAUSE_MS);
}

interface Range {
  from: number;
  to: number;
}

/** The body card_bodies in the card owning `tagId`, EXCLUDING the cite line
 *  (matched by text, so this only ever touches our own card). Before condense
 *  this includes the blank spacer paragraphs; after condense it's the content
 *  paragraphs in order (which line up with SAMPLE_PARAS). */
function bodyParagraphs(doc: ProseNode, tagId: string): { node: ProseNode; pos: number }[] {
  const found = cardOfTag(doc, tagId);
  if (!found) return [];
  const { card, cardPos } = found;
  const out: { node: ProseNode; pos: number }[] = [];
  card.forEach((child, offset) => {
    if (child.type.name === 'card_body' && child.textContent !== CITE_TEXT) {
      out.push({ node: child, pos: cardPos + 1 + offset });
    }
  });
  return out;
}

/** Spans to cut for one mark code, re-derived per paragraph AFTER condense: each
 *  content paragraph lines up with SAMPLE_PARAS in order, so we locate the marked
 *  runs' text within that paragraph's (possibly whitespace-cleaned) content —
 *  robust to whatever condense did. */
function computeSpans(doc: ProseNode, tagId: string, code: string): Range[] {
  const bodies = bodyParagraphs(doc, tagId);
  const out: Range[] = [];
  for (let i = 0; i < SAMPLE_PARAS.length && i < bodies.length; i++) {
    const base = bodies[i]!.pos + 1;
    const text = bodies[i]!.node.textContent;
    let cursor = 0;
    for (const [runText, c] of SAMPLE_PARAS[i]!) {
      if (runText.length === 0) continue;
      const idx = text.indexOf(runText, cursor);
      if (idx < 0) continue;
      if (c.includes(code)) out.push({ from: base + idx, to: base + idx + runText.length });
      cursor = idx + runText.length;
    }
  }
  return out;
}

/** Raw-addMark a span at each range top→bottom (the F9/F10/highlight result),
 *  with a brief visible delay; return the summed apply+paint time (excluding
 *  delays). scrollIntoView keeps the cutter on screen. */
async function sweepMark(view: EditorView, ranges: Range[], mark: Mark): Promise<number> {
  let total = 0;
  let count = 0;
  for (const r of ranges) {
    if (r.to <= r.from) continue;
    const t0 = performance.now();
    const tr = view.state.tr.addMark(r.from, r.to, mark);
    tr.setSelection(TextSelection.create(tr.doc, r.from, r.to)).scrollIntoView();
    benchDispatch(view, tr);
    await nextPaint();
    total += performance.now() - t0;
    count++;
    await sleep(18); // brisk visible top-to-bottom sweep (the card is long)
  }
  // AVERAGE per mark application — totals just track card length / span count,
  // and nobody is bottlenecked on a whole card's worth of rapid-fire marks.
  return count ? round1(total / count) : 0;
}

/** A narrated editing sequence: new heading → type → new tag → type → cite →
 *  cite-mark → paste a long body → card-cutting sweeps (underline → emphasis →
 *  highlight, top→bottom) → condense. Each step is paused so the user can watch;
 *  all on the live doc, reverted by the caller via the snapshot. */
async function benchEdit(
  view: EditorView,
  onProgress?: ProgressFn,
): Promise<{ steps: EditStep[]; totalMs: number } | null> {
  const sch = view.state.schema;
  const need = ['pocket', 'card', 'tag', 'card_body'];
  const needMarks = ['cite_mark', 'underline_mark', 'emphasis_mark', 'highlight'];
  if (need.some((n) => !sch.nodes[n]) || needMarks.some((m) => !sch.marks[m])) return null;
  const steps: EditStep[] = [];
  const pocketId = newHeadingId();
  const tagId = newHeadingId();
  const HEAD = 'Benchmark';
  const TAGTXT = 'Benchmark Tag';

  // Jump to the very top so the new card and the card-cutting happen on screen
  // (the nav test leaves the viewport mid-document).
  scrollGate(view).scrollTop = 0;
  await nextPaint();

  await measureStep(
    'New heading at top',
    () => {
      const pocket = sch.nodes['pocket']!.create({ id: pocketId }, sch.text(HEAD));
      const tr = view.state.tr.insert(0, pocket);
      tr.setSelection(TextSelection.create(tr.doc, 1 + HEAD.length));
      benchDispatch(view, tr.scrollIntoView());
    },
    onProgress,
    steps,
  );

  await measureStep(
    'Type in heading',
    () => benchDispatch(view, view.state.tr.insertText(' — Pocket')),
    onProgress,
    steps,
  );

  await measureStep(
    'New tag',
    () => {
      const pk = findById(view.state.doc, pocketId);
      const at = pk ? pk.pos + pk.node.nodeSize : 0;
      const tag = sch.nodes['tag']!.create({ id: tagId }, sch.text(TAGTXT));
      const card = sch.nodes['card']!.createChecked(null, [tag]);
      const tr = view.state.tr.insert(at, card);
      tr.setSelection(TextSelection.create(tr.doc, at + 2 + TAGTXT.length));
      benchDispatch(view, tr.scrollIntoView());
    },
    onProgress,
    steps,
  );

  await measureStep(
    'Type in tag',
    () => benchDispatch(view, view.state.tr.insertText(' — Smith 2024')),
    onProgress,
    steps,
  );

  await measureStep(
    'Type a cite line',
    () => {
      const tg = findById(view.state.doc, tagId);
      if (!tg) throw new Error('tag missing');
      const at = tg.pos + tg.node.nodeSize; // just after the tag, inside the card
      // A plain body paragraph with the real citation text — it only becomes
      // "the cite" once the cite mark is applied (the next step).
      const line = sch.nodes['card_body']!.create(null, sch.text(CITE_TEXT));
      const tr = view.state.tr.insert(at, line);
      tr.setSelection(TextSelection.create(tr.doc, at + 1));
      benchDispatch(view, tr.scrollIntoView());
    },
    onProgress,
    steps,
  );

  await measureStep(
    'Cite mark on author/date',
    () => {
      const c = findChildByText(view.state.doc, tagId, CITE_TEXT);
      if (!c) throw new Error('cite line missing');
      const base = c.pos + 1; // content start of the cite line
      const mark = sch.marks['cite_mark']!.create();
      let tr = view.state.tr;
      let off = 0;
      const marked: Range[] = [];
      for (const [text, code] of CITE_RUNS) {
        if (code.includes('c') && text.length > 0) {
          marked.push({ from: base + off, to: base + off + text.length });
        }
        off += text.length;
      }
      if (marked.length === 0) throw new Error('no cite-mark span');
      for (const r of marked) tr = tr.addMark(r.from, r.to, mark);
      tr.setSelection(
        TextSelection.create(tr.doc, marked[0]!.from, marked[marked.length - 1]!.to),
      ).scrollIntoView();
      benchDispatch(view, tr);
    },
    onProgress,
    steps,
  );

  await measureStep(
    'Paste a multi-paragraph card',
    () => {
      const c = findChildByText(view.state.doc, tagId, CITE_TEXT);
      if (!c) throw new Error('cite line missing');
      // Insert the real card's paragraphs below the cite, with extra blank
      // paragraphs between them — a messy fresh paste that condense will clean.
      const after = c.pos + c.node.nodeSize;
      const blank = (): ProseNode => sch.nodes['card_body']!.create();
      const nodes: ProseNode[] = [];
      SAMPLE_PARAS.forEach((para, i) => {
        if (i > 0) nodes.push(blank(), blank());
        nodes.push(sch.nodes['card_body']!.create(null, sch.text(para.map((r) => r[0]).join(''))));
      });
      const tr = view.state.tr.insert(after, nodes);
      tr.setSelection(TextSelection.create(tr.doc, after + 1)).scrollIntoView();
      benchDispatch(view, tr);
    },
    onProgress,
    steps,
  );

  // Condense FIRST to make the card "cutting ready" — drops the blank spacer
  // paragraphs and whitespace-cleans the body, exactly the cleanup a fresh paste
  // needs before you can cut it.
  const selectBody = (): void => {
    const bodies = bodyParagraphs(view.state.doc, tagId);
    if (bodies.length === 0) return;
    const from = bodies[0]!.pos + 1;
    const last = bodies[bodies.length - 1]!;
    const to = last.pos + last.node.nodeSize - 1;
    benchDispatch(
      view,
      view.state.tr.setSelection(TextSelection.create(view.state.doc, from, to)).scrollIntoView(),
    );
  };
  await measureStep(
    'Condense (clean up the paste)',
    () => {
      selectBody();
      condenseBranchC()(view.state, (tr) => benchDispatch(view, tr), view);
    },
    onProgress,
    steps,
  );

  // Now cut the cleaned card: underline → emphasis → highlight, each sweeping
  // top→bottom. Spans are re-derived per paragraph from the post-condense doc
  // and stay valid across the mark-only sweeps.
  const uSpans = computeSpans(view.state.doc, tagId, 'u');
  const eSpans = computeSpans(view.state.doc, tagId, 'e');
  const hSpans = computeSpans(view.state.doc, tagId, 'h');
  await measureSweep(
    'Underline (avg per mark)',
    () => sweepMark(view, uSpans, sch.marks['underline_mark']!.create()),
    onProgress,
    steps,
  );
  await measureSweep(
    'Emphasis (avg per mark)',
    () => sweepMark(view, eSpans, sch.marks['emphasis_mark']!.create()),
    onProgress,
    steps,
  );
  await measureSweep(
    'Highlight (avg per mark)',
    () => sweepMark(view, hSpans, sch.marks['highlight']!.create({ color: 'yellow' })),
    onProgress,
    steps,
  );
  await measureStep(
    'Shrink the card',
    () => {
      selectBody();
      runRibbon('smartShrink'); // Smart Shrink — unmarked text gets smaller
    },
    onProgress,
    steps,
  );

  const totalMs = round1(steps.reduce((a, s) => a + (s.ms ?? 0), 0));
  return { steps, totalMs };
}

// ── Score ────────────────────────────────────────────────────────────────────
// A 0–100 "how fast on this machine" grade. Each component is a SMOOTH 0–100
// sub-score (no hard cliffs — a slow machine degrades gradually instead of
// snapping to zero) combined as a weighted average. Frame-rate smoothness, the
// thing you actually feel, dominates; the operation latencies modulate it.
//
// Deliberately NOT penalized by long-task time. The benchmark's own battery
// (cut / condense / shrink / the mark sweeps) is itself captured as long tasks,
// so subtracting that total would punish the suite for the very work it exists
// to run — slower hardware worst. Perceived jank still reaches the score
// through the scroll's 1%-low frame rate. longTasks stays in the results for
// information only.

/** Frame rate → 0–100 against a 60fps "smooth enough" target (capped, so a
 *  high-refresh display isn't rewarded for exceeding smoothness). */
function fpsSubScore(fps: number, target = 60): number {
  return 100 * Math.min(1, Math.max(0, fps / target));
}

/** Latency → 0–100: full marks at or under `refMs`, then a smooth 1/x decay
 *  above it (never a hard zero, so even a slow run keeps a proportional score). */
function latencySubScore(actualMs: number, refMs: number): number {
  if (actualMs <= refMs) return 100;
  return (100 * refMs) / actualMs;
}

// Reference times (ms) at/under which a component earns full marks. Tunable —
// set near a healthy desktop's numbers so typical machines land high and only
// genuine slowness drags the grade down. Not yet calibrated against real run
// data from a range of machines.
const EDIT_REF_MS = 600;
const NAV_REF_MS = 250;
const RELAYOUT_REF_MS = 250;

function computeScore(r: BenchmarkResults): number {
  const parts: Array<[number, number]> = []; // [sub-score 0–100, weight]
  if (r.scroll) {
    // Smoothness is dominated by the worst frames (1%-low), with the mean as a
    // secondary signal: a scroll that mostly hits refresh but hitches scores
    // below one that's uniformly smooth.
    const smooth = 0.6 * fpsSubScore(r.scroll.lowFps1pct) + 0.4 * fpsSubScore(r.scroll.fps);
    parts.push([smooth, 45]);
  }
  if (r.edit) parts.push([latencySubScore(r.edit.totalMs, EDIT_REF_MS), 30]);
  if (r.relayout) parts.push([latencySubScore(r.relayout.ms, RELAYOUT_REF_MS), 15]);
  // Nav settle is partly bound by the scroll animation's own duration, so it's a
  // weaker hardware signal — kept, but weighted lightly.
  if (r.nav) parts.push([latencySubScore(r.nav.medianMs, NAV_REF_MS), 10]);

  const wSum = parts.reduce((a, [, w]) => a + w, 0);
  if (!wSum) return 0;
  const weighted = parts.reduce((a, [sub, w]) => a + sub * w, 0) / wSum;
  return Math.round(weighted);
}

/** Run the full battery on the active view's current document. Reports progress
 *  by label. The editor must be visible (caller closes any modal first). */
export async function runBenchmark(view: EditorView, onProgress?: ProgressFn): Promise<BenchmarkResults> {
  let headings = 0;
  let cards = 0;
  let chars = 0;
  view.state.doc.descendants((node) => {
    if (HEADING_NODES.has(node.type.name)) headings++;
    if (node.type.name === 'card') cards++;
    if (node.isText) chars += node.text?.length ?? 0;
    return true;
  });

  const longTaskDurations: number[] = [];
  let obs: PerformanceObserver | null = null;
  try {
    obs = new PerformanceObserver((list) => {
      for (const e of list.getEntries()) longTaskDurations.push(e.duration);
    });
    obs.observe({ type: 'longtask', buffered: false });
  } catch {
    /* longtask timing unsupported (e.g. Safari) — skip */
  }

  onProgress?.('Warming up…');
  await nextPaint();
  onProgress?.('Scrolling…');
  const scroll = await benchScroll(view, 4000);
  onProgress?.('Navigating…');
  const nav = await benchNav(view, onProgress);
  onProgress?.('Editing…');
  const edit = await benchEdit(view, onProgress);
  onProgress?.('Relayout…');
  const relayout = await benchRelayout(view);
  obs?.disconnect();

  const total = Math.round(longTaskDurations.reduce((a, b) => a + b, 0));
  const results: BenchmarkResults = {
    docInfo: { headings, cards, chars },
    scroll,
    nav,
    edit,
    relayout,
    longTasks: {
      count: longTaskDurations.length,
      totalMs: total,
      maxMs: Math.round(longTaskDurations.length ? Math.max(...longTaskDurations) : 0),
    },
    score: 0,
  };
  results.score = computeScore(results);
  return results;
}
