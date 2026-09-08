import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import { SPEECH_NAMES, TIMELINE_ROWS, toTimeString } from '@/src/timer/constants';
import {
  TIMELINE_WINDOW_MS,
  clearTimelog,
  getTimelog,
  setTimelog,
  type TimelogEntry,
} from '@/src/timer/storage';

const VIEW_W = 480;
const VIEW_H = 240;
const GUTTER = 128;
const RIGHT_PAD = 14;
const TOP = 26;
const AXIS_H = 20;
const PLOT_TOP = TOP + 4;
const PLOT_BOTTOM = VIEW_H - AXIS_H;
const ROW_H = (PLOT_BOTTOM - PLOT_TOP) / TIMELINE_ROWS.length;
const TICK_MS = 15 * 60 * 1000;

interface Band {
  row: number;
  start: number;
  end: number;
}

interface Built {
  bands: Band[];
  rowLabels: string[];
  min: number;
  max: number;
  hasData: boolean;
}

/** Port of Timeline.show()'s nested-timeline + totals math, minus d3. */
function build(entries: TimelogEntry[]): Built {
  const pauseIndex = TIMELINE_ROWS.length - 1;
  const perRow: { start: number; end: number }[][] = TIMELINE_ROWS.map(() => []);

  for (const t of entries) {
    const ti = (SPEECH_NAMES as readonly string[]).indexOf(t.type);
    if (ti < 0) continue;

    if (t.start) {
      perRow[ti].push({ start: t.time, end: t.time });
      const pauseArr = perRow[pauseIndex];
      if (pauseArr.length) pauseArr[pauseArr.length - 1].end = t.time;
    } else {
      const arr = perRow[ti];
      if (arr.length) arr[arr.length - 1].end = t.time;
      perRow[pauseIndex].push({ start: t.time, end: t.time });
    }
  }

  // If the last event was a "start", the speech is still running: close it at now.
  const last = entries[entries.length - 1];
  const now = Date.now();
  if (last?.start) {
    const ti = (SPEECH_NAMES as readonly string[]).indexOf(last.type);
    const arr = perRow[ti];
    if (arr.length) arr[arr.length - 1].end = now;
  }

  const rowTotals = perRow.map((segs) =>
    segs.reduce((a, s) => a + Math.max(0, s.end - s.start), 0)
  );
  const grand = rowTotals.reduce((a, b) => a + b, 0);

  const rowLabels = TIMELINE_ROWS.map((r, i) => {
    let label = `${r.label} ${toTimeString(Math.floor(rowTotals[i] / 1000))}`;
    if (i === pauseIndex && grand > 0) {
      label += ` ${Math.round((rowTotals[i] / grand) * 100)}%`;
    }
    return label;
  });

  const times = entries.map((e) => e.time);
  if (last?.start) times.push(now);
  const min = times.length ? Math.min(...times) : 0;
  const max = times.length ? Math.max(...times) : 0;

  const bands: Band[] = [];
  perRow.forEach((segs, row) => {
    for (const seg of segs) {
      if (seg.end > seg.start) bands.push({ row, start: seg.start, end: seg.end });
    }
  });

  return { bands, rowLabels, min, max, hasData: bands.length > 0 && max > min };
}

function fmtClock(ms: number): string {
  const d = new Date(ms);
  return `${String(d.getHours()).padStart(2, '0')}:${String(
    d.getMinutes()
  ).padStart(2, '0')}`;
}

export function Timeline({ active }: { active: boolean }) {
  const [entries, setEntries] = useState<TimelogEntry[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);
  const [tip, setTip] = useState<{ x: number; y: number; text: string } | null>(
    null
  );
  const svgRef = useRef<SVGSVGElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const confirmTimer = useRef<number | null>(null);

  // Load + prune (drop empty types and anything older than 2h), then persist.
  const refresh = useCallback(async () => {
    const raw = await getTimelog();
    const cutoff = Date.now() - TIMELINE_WINDOW_MS;
    const pruned = raw.filter((e) => e.type && e.type.length >= 3 && e.time >= cutoff);
    if (pruned.length !== raw.length) await setTimelog(pruned);
    setEntries(pruned);
  }, []);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  useEffect(
    () => () => {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
    },
    []
  );

  const model = useMemo(() => build(entries), [entries]);

  const x = useCallback(
    (t: number) => {
      if (model.max === model.min) return GUTTER;
      return (
        GUTTER +
        ((t - model.min) / (model.max - model.min)) *
          (VIEW_W - GUTTER - RIGHT_PAD)
      );
    },
    [model.min, model.max]
  );

  const ticks = useMemo(() => {
    if (!model.hasData) return [] as number[];
    const out = new Set<number>([model.min, model.max]);
    const first = Math.ceil(model.min / TICK_MS) * TICK_MS;
    for (let t = first; t <= model.max; t += TICK_MS) out.add(t);
    return [...out].sort((a, b) => a - b);
  }, [model.hasData, model.min, model.max]);

  const handleClear = useCallback(() => {
    if (confirmClear) {
      if (confirmTimer.current) window.clearTimeout(confirmTimer.current);
      setConfirmClear(false);
      void clearTimelog().then(() => setEntries([]));
    } else {
      setConfirmClear(true);
      confirmTimer.current = window.setTimeout(
        () => setConfirmClear(false),
        4000
      );
    }
  }, [confirmClear]);

  const title = `Debate ${new Date().toLocaleDateString().replace(/\//g, '-')}`;

  const downloadPng = useCallback(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const scale = 2;
    const xml = new XMLSerializer().serializeToString(svg);
    const svg64 = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = VIEW_W * scale;
      canvas.height = VIEW_H * scale;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.fillStyle = 'aliceblue';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2000);
      }, 'image/png');
    };
    img.src = svg64;
  }, [title]);

  return (
    <div className="timeline">
      <div ref={wrapRef} className="timeline-plot" onMouseLeave={() => setTip(null)}>
        <svg
          ref={svgRef}
          xmlns="http://www.w3.org/2000/svg"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          width={VIEW_W}
          height={VIEW_H}
        >
          <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#ffffff" />
          <text
            x="8"
            y="16"
            fill="#1d9bd6"
            fontFamily="Verdana, Geneva, sans-serif"
            fontSize="12"
            fontWeight="bold"
          >
            {title}
          </text>

          {TIMELINE_ROWS.map((row, i) => {
            const y = PLOT_TOP + i * ROW_H;
            return (
              <g key={row.label}>
                <rect
                  x={GUTTER}
                  y={y}
                  width={VIEW_W - GUTTER - RIGHT_PAD}
                  height={ROW_H}
                  fill={i % 2 ? '#f4f7fa' : '#eef2f6'}
                />
                <text
                  x="6"
                  y={y + ROW_H / 2 + 3}
                  fill="#333333"
                  fontFamily="'Arial Narrow', Arial, sans-serif"
                  fontSize="9"
                  fontWeight="bold"
                >
                  {model.rowLabels[i]}
                </text>
              </g>
            );
          })}

          {model.bands.map((b, i) => {
            const bx = x(b.start);
            const bw = Math.max(1.5, x(b.end) - bx);
            const y = PLOT_TOP + b.row * ROW_H + 3;
            const dur = toTimeString(Math.floor((b.end - b.start) / 1000));
            return (
              <rect
                key={i}
                x={bx}
                y={y}
                width={bw}
                height={ROW_H - 6}
                rx="2"
                fill={TIMELINE_ROWS[b.row].color}
                onMouseMove={(e) => {
                  const wrap = wrapRef.current?.getBoundingClientRect();
                  if (!wrap) return;
                  setTip({
                    x: e.clientX - wrap.left + 10,
                    y: e.clientY - wrap.top - 24,
                    text: `${TIMELINE_ROWS[b.row].label}  ${dur}`,
                  });
                }}
              >
                <title>{`${TIMELINE_ROWS[b.row].label} ${dur}`}</title>
              </rect>
            );
          })}

          {model.hasData && (
            <>
              <line
                x1={GUTTER}
                y1={PLOT_BOTTOM}
                x2={VIEW_W - RIGHT_PAD}
                y2={PLOT_BOTTOM}
                stroke="#999999"
              />
              {ticks.map((t) => (
                <g key={t}>
                  <line
                    x1={x(t)}
                    y1={PLOT_BOTTOM}
                    x2={x(t)}
                    y2={PLOT_BOTTOM + 4}
                    stroke="#999999"
                  />
                  <text
                    x={x(t)}
                    y={PLOT_BOTTOM + 14}
                    fill="#666666"
                    fontFamily="Arial, sans-serif"
                    fontSize="8"
                    textAnchor="middle"
                  >
                    {fmtClock(t)}
                  </text>
                </g>
              ))}
            </>
          )}

          {!model.hasData && (
            <text
              x={VIEW_W / 2}
              y={VIEW_H / 2}
              fill="#999999"
              fontFamily="Arial, sans-serif"
              fontSize="12"
              textAnchor="middle"
            >
              No timeline data yet — run the timer to record speeches.
            </text>
          )}
        </svg>

        {tip && (
          <div className="timeline-tooltip" style={{ left: tip.x, top: tip.y }}>
            {tip.text}
          </div>
        )}
      </div>

      <div className="timeline-actions">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={downloadPng}
          disabled={!model.hasData}
        >
          Download
        </Button>
        <Button
          type="button"
          size="sm"
          variant={confirmClear ? 'destructive' : 'outline'}
          onClick={handleClear}
          disabled={entries.length === 0}
        >
          {confirmClear ? 'Click again to confirm' : 'Clear'}
        </Button>
      </div>
    </div>
  );
}
