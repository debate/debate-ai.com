/**
 * UI for the in-app benchmark (Settings → Benchmark). Launches the battery in
 * `benchmark.ts` with only a small corner chip on screen (so the editor stays
 * visible and its paints aren't culled), then shows a game-style results card
 * with a frame-time graph.
 */

import type { EditorState } from 'prosemirror-state';
import { getActiveView, beginBenchmark, endBenchmark } from './index.js';
import { runBenchmark, type BenchmarkResults } from './benchmark.js';

let running = false;

export async function launchBenchmarkOverlay(): Promise<void> {
  if (running) return;
  const view = getActiveView();
  if (!view) {
    showMessage('Open a document first, then run the benchmark.');
    return;
  }
  if (!view.editable) {
    // The card-cutting test edits the document; read mode locks edits, so the
    // benchmark would have nothing meaningful to run.
    showMessage('The benchmark edits the document — exit read mode and run it again.');
    return;
  }
  running = true;
  // Snapshot the editor state + suppress autosave; the editing test mutates the
  // live doc, and we revert from this snapshot when the user CLOSES the results.
  const snapshot = beginBenchmark();
  const chip = makeChip();
  document.body.appendChild(chip.el);
  // One frame so the chip paints and the modal-free editor is on screen.
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  let results: BenchmarkResults | null = null;
  try {
    results = await runBenchmark(view, (label) => chip.set(label));
  } catch (err) {
    console.error('[benchmark] failed', err);
  } finally {
    chip.el.remove();
    running = false;
  }
  if (results) {
    // Leave the document in its post-run state on screen; it's reverted (and
    // autosave re-enabled) when the user closes the results.
    showResults(results, snapshot);
  } else {
    endBenchmark(snapshot); // nothing to show — revert now
    showMessage('Benchmark failed — see the console.');
  }
}

function makeChip(): { el: HTMLElement; set: (s: string) => void } {
  const el = document.createElement('div');
  el.className = 'pmd-bench-chip';
  const dot = document.createElement('span');
  dot.className = 'pmd-bench-chip-dot';
  const txt = document.createElement('span');
  txt.textContent = 'Benchmarking…';
  el.append(dot, txt);
  return { el, set: (s) => (txt.textContent = `Benchmarking — ${s}`) };
}

function overlay(onClose?: () => void): { root: HTMLElement; dialog: HTMLElement; close: () => void } {
  const root = document.createElement('div');
  root.className = 'pmd-bench-overlay';
  const dialog = document.createElement('div');
  dialog.className = 'pmd-bench-dialog';
  root.appendChild(dialog);
  const close = (): void => {
    onClose?.();
    root.remove();
  };
  root.addEventListener('mousedown', (e) => {
    if (e.target === root) close();
  });
  document.addEventListener(
    'keydown',
    (e) => {
      if (e.key === 'Escape' && document.body.contains(root)) close();
    },
    { once: true },
  );
  document.body.appendChild(root);
  return { root, dialog, close };
}

function showMessage(msg: string): void {
  const { dialog, close } = overlay();
  const p = document.createElement('p');
  p.className = 'pmd-bench-msg';
  p.textContent = msg;
  const btn = button('Close', close);
  dialog.append(p, footer([btn]));
}

function showResults(r: BenchmarkResults, snapshot: EditorState | null): void {
  // Revert the document (and re-enable autosave) when the results close, by any
  // path — Close, Run again, click-out, or Esc. Once-guarded.
  let reverted = false;
  const { dialog, close } = overlay(() => {
    if (reverted) return;
    reverted = true;
    endBenchmark(snapshot);
  });

  const header = document.createElement('div');
  header.className = 'pmd-bench-header';
  const h = document.createElement('h2');
  h.textContent = 'Benchmark results';
  header.appendChild(h);
  dialog.appendChild(header);

  const scoreWrap = document.createElement('div');
  scoreWrap.className = 'pmd-bench-score';
  const scoreNum = document.createElement('div');
  scoreNum.className = 'pmd-bench-score-num';
  scoreNum.textContent = String(r.score);
  const scoreLbl = document.createElement('div');
  scoreLbl.className = 'pmd-bench-score-lbl';
  labelWithNote(scoreLbl, 'Score');
  scoreWrap.append(scoreNum, scoreLbl);
  dialog.appendChild(scoreWrap);

  // Scrollable list of result sections.
  const list = document.createElement('div');
  list.className = 'pmd-bench-list';

  if (r.scroll) {
    list.appendChild(
      section('Scroll', [
        ['Avg FPS', String(r.scroll.fps)],
        ['1% low FPS', String(r.scroll.lowFps1pct)],
        ['p99 frame time', `${r.scroll.p99FrameMs} ms`],
        ['Jank frames', String(r.scroll.jankFrames)],
      ]),
    );
  }
  list.appendChild(
    section(
      'Navigation',
      r.nav
        ? [
            ['Median jump', `${r.nav.medianMs} ms`],
            ['p90 jump', `${r.nav.p90Ms} ms`],
            ['Jumps', String(r.nav.samples.length)],
          ]
        : [['Not run', 'needs ≥4 headings']],
    ),
  );
  if (r.edit) {
    const rows: [string, string][] = r.edit.steps.map((s) => [
      s.label,
      s.ms == null ? '—' : `${s.ms} ms`,
    ]);
    list.appendChild(section('Editing & card-cutting', rows));
  } else {
    list.appendChild(section('Editing & card-cutting', [['Not run', 'unavailable']]));
  }
  list.appendChild(
    section('Relayout', r.relayout ? [['Full document', `${r.relayout.ms} ms`]] : [['Not run', 'n/a']]),
  );
  list.appendChild(
    section('Long tasks', [
      ['Count', String(r.longTasks.count)],
      ['Total', `${r.longTasks.totalMs} ms`],
      ['Longest', `${r.longTasks.maxMs} ms`],
    ]),
  );
  list.appendChild(
    section('Document', [
      ['Headings', String(r.docInfo.headings)],
      ['Cards', String(r.docInfo.cards)],
      ['Characters', r.docInfo.chars.toLocaleString()],
    ]),
  );

  if (r.scroll && r.scroll.frameMs.length > 2) {
    list.appendChild(frameGraph(r.scroll.frameMs));
  }
  list.appendChild(notesSection());
  dialog.appendChild(list);

  dialog.appendChild(
    footer([
      button('Run again', () => {
        close();
        void launchBenchmarkOverlay();
      }),
      button('Close', close, true),
    ]),
  );
}

// ── Sections + footnotes ─────────────────────────────────────────────

const FOOTNOTES: { label: string; text: string }[] = [
  {
    label: 'Score',
    text: 'A 0–100 grade: frame-rate smoothness (weighted heaviest) plus the operation latencies, each scored against a fixed reference and blended. Higher is better — around 100 is a healthy, smooth machine. Most reliable for comparing runs on the same machine and display.',
  },
  {
    label: '1% low FPS',
    text: 'Frame rate during the worst 1% of frames (from the p99 frame time). A better gauge of perceived smoothness than the average — the slow frames are the ones you feel.',
  },
  {
    label: 'p99 frame time',
    text: '99% of frames were drawn at least this fast. Lower is smoother.',
  },
  {
    label: 'Jank frames',
    text: 'Frames that took more than 1.5× the median frame time — the visible hitches during a scroll.',
  },
  {
    label: 'Relayout',
    text: 'Time to force a full layout + repaint of the entire document; a proxy for the layout half of opening it.',
  },
  {
    label: 'Long tasks',
    text: 'Main-thread tasks longer than 50 ms (they block input) recorded over the whole run.',
  },
];

function noteIndex(label: string): number | null {
  const i = FOOTNOTES.findIndex((f) => f.label === label);
  return i >= 0 ? i + 1 : null;
}

/** Set `el`'s text to `label`, plus a footnote superscript if it's one of the
 *  explained terms. */
function labelWithNote(el: HTMLElement, label: string): void {
  el.textContent = label;
  const n = noteIndex(label);
  if (n != null) {
    const sup = document.createElement('sup');
    sup.className = 'pmd-bench-noteref';
    sup.textContent = String(n);
    el.appendChild(sup);
  }
}

function section(title: string, rows: [string, string][]): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'pmd-bench-section';
  const t = document.createElement('div');
  t.className = 'pmd-bench-section-title';
  labelWithNote(t, title);
  sec.appendChild(t);
  for (const [label, value] of rows) {
    const row = document.createElement('div');
    row.className = 'pmd-bench-row';
    const l = document.createElement('span');
    l.className = 'pmd-bench-row-label';
    labelWithNote(l, label);
    const v = document.createElement('span');
    v.className = 'pmd-bench-row-val';
    v.textContent = value;
    row.append(l, v);
    sec.appendChild(row);
  }
  return sec;
}

function notesSection(): HTMLElement {
  const sec = document.createElement('div');
  sec.className = 'pmd-bench-section pmd-bench-notes';
  const t = document.createElement('div');
  t.className = 'pmd-bench-section-title';
  t.textContent = 'Notes';
  sec.appendChild(t);
  FOOTNOTES.forEach((f, i) => {
    const row = document.createElement('div');
    row.className = 'pmd-bench-note-row';
    const num = document.createElement('span');
    num.className = 'pmd-bench-note-num';
    num.textContent = `${i + 1}`;
    const txt = document.createElement('span');
    txt.textContent = `${f.label} — ${f.text}`;
    row.append(num, txt);
    sec.appendChild(row);
  });
  const meth = document.createElement('p');
  meth.className = 'pmd-bench-note-meth';
  meth.textContent =
    "Self-reported by CardMirror's own renderer; frame rate is capped by your display's " +
    'refresh rate.';
  sec.appendChild(meth);
  return sec;
}

function frameGraph(frameMs: number[]): HTMLElement {
  const wrap = document.createElement('div');
  wrap.className = 'pmd-bench-graph';
  const cap = document.createElement('div');
  cap.className = 'pmd-bench-graph-cap';
  cap.textContent = 'Scroll frame times (lower is smoother; line = 60 fps / 16.7 ms)';
  const canvas = document.createElement('canvas');
  const W = 760;
  const H = 140;
  canvas.width = W;
  canvas.height = H;
  wrap.append(cap, canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return wrap;
  // Canvas needs resolved color strings, so pull the chart tokens off
  // :root rather than hardcoding (keeps the frame-graph swappable by a
  // future theme like every other surface).
  const cssVar = (name: string, fallback: string): string =>
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
  const chartBg = cssVar('--pmd-c-chart-bg', '#1b1d22');
  const chartRef = cssVar('--pmd-c-chart-ref', '#3a7d44');
  const chartLine = cssVar('--pmd-c-chart-line', '#7fd1ff');

  // Downsample to canvas width, plotting the worst (max) frame per bucket so
  // spikes survive — that's what the eye perceives as jank.
  const n = Math.min(W, frameMs.length);
  const bucket = frameMs.length / n;
  const series: number[] = [];
  for (let i = 0; i < n; i++) {
    let m = 0;
    for (let j = Math.floor(i * bucket); j < Math.floor((i + 1) * bucket); j++) m = Math.max(m, frameMs[j] ?? 0);
    series.push(m);
  }
  const maxMs = Math.max(33, ...series);
  const y = (ms: number): number => H - (ms / maxMs) * (H - 8) - 4;

  ctx.fillStyle = chartBg;
  ctx.fillRect(0, 0, W, H);
  // 60 fps reference line
  ctx.strokeStyle = chartRef;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(0, y(16.7));
  ctx.lineTo(W, y(16.7));
  ctx.stroke();
  ctx.setLineDash([]);
  // frame-time line
  ctx.strokeStyle = chartLine;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  series.forEach((ms, i) => {
    const px = (i / Math.max(1, n - 1)) * W;
    if (i === 0) ctx.moveTo(px, y(ms));
    else ctx.lineTo(px, y(ms));
  });
  ctx.stroke();
  return wrap;
}

function button(label: string, onClick: () => void, primary = false): HTMLButtonElement {
  const b = document.createElement('button');
  b.className = primary ? 'pmd-bench-btn pmd-bench-btn-primary' : 'pmd-bench-btn';
  b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}

function footer(buttons: HTMLElement[]): HTMLElement {
  const f = document.createElement('div');
  f.className = 'pmd-bench-footer';
  f.append(...buttons);
  return f;
}
