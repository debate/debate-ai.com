/**
 * Pinned-files store (file-search warm working set).
 *
 * Small + durable, in `localStorage`, which is shared across Electron
 * windows (a pin made in one window is seen by another on its next
 * read). Holds:
 *   - `manualPins`: paths the user pinned by hand (★ / Alt+P). Uncapped.
 *   - `usage`: per-path open/dive counts → powers "frequents".
 *
 * The *warm cache* of parsed docs lives in the renderer's memory (see
 * quick-card-search-ui.ts); this store only owns the lightweight,
 * persisted bookkeeping that decides WHICH files should be warm.
 */

const STORAGE_KEY = 'pmd-pins';

/** Auto set (recents ∪ frequents) is capped to this many; manual pins
 *  are exempt and never counted against it. */
export const AUTO_PIN_CAP = 10;
/** A file is "frequent" once used at least this many times. */
const FREQUENT_MIN_COUNT = 2;

interface UsageEntry {
  count: number;
  lastAt: number;
}

interface PinsBlob {
  manualPins: string[];
  usage: Record<string, UsageEntry>;
}

function read(): PinsBlob {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return {
          manualPins: Array.isArray(parsed.manualPins)
            ? parsed.manualPins.filter((p: unknown): p is string => typeof p === 'string')
            : [],
          usage: parsed.usage && typeof parsed.usage === 'object' ? parsed.usage : {},
        };
      }
    }
  } catch {
    /* fall through to empty */
  }
  return { manualPins: [], usage: {} };
}

function write(blob: PinsBlob): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(blob));
  } catch {
    /* quota / disabled storage — non-fatal, pins just won't persist */
  }}

/** Toggle a manual pin; returns the new pinned state. */
export function toggleManualPin(path: string): boolean {
  const blob = read();
  const i = blob.manualPins.indexOf(path);
  let pinned: boolean;
  if (i >= 0) {
    blob.manualPins.splice(i, 1);
    pinned = false;
  } else {
    blob.manualPins.push(path);
    pinned = true;
  }
  write(blob);
  return pinned;
}

/** Bump a file's usage (on open or dive) — feeds the frequents ranking. */
export function recordUsage(path: string): void {
  const blob = read();
  const prev = blob.usage[path];
  blob.usage[path] = { count: (prev?.count ?? 0) + 1, lastAt: Date.now() };
  write(blob);
}

/**
 * The auto-pinned set (recents ∪ frequents), capped at `AUTO_PIN_CAP`.
 * Recents (passed in from `recents-store`, already capped at 6) come
 * first in their recency order; frequents (used ≥ FREQUENT_MIN_COUNT,
 * by count desc then recency) fill the remaining slots. Manual pins are
 * NOT included here — they're unconditional and uncapped.
 */
export function autoPins(recentPaths: readonly string[]): string[] {
  const { usage } = read();
  const out: string[] = [];
  const seen = new Set<string>();
  const add = (p: string): void => {
    if (!seen.has(p) && out.length < AUTO_PIN_CAP) {
      seen.add(p);
      out.push(p);
    }
  };
  for (const p of recentPaths) add(p);
  const frequents = Object.entries(usage)
    .filter(([, u]) => u.count >= FREQUENT_MIN_COUNT)
    .sort((a, b) => b[1].count - a[1].count || b[1].lastAt - a[1].lastAt)
    .map(([p]) => p);
  for (const p of frequents) add(p);
  return out;
}

/** The full set that should be kept warm: manual pins (always) plus the
 *  auto set when `autoEnabled`. */
export function effectivePins(recentPaths: readonly string[], autoEnabled: boolean): Set<string> {
  const set = new Set(read().manualPins);
  if (autoEnabled) for (const p of autoPins(recentPaths)) set.add(p);
  return set;
}
