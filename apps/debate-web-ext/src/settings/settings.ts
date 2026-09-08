/**
 * Settings shared by both halves of the extension — the round timer and the
 * on-page card reuse check — persisted in `browser.storage.sync` and edited on
 * the single Options page (entrypoints/options).
 *
 * The `apiBase` and `skipDomains` keys keep the names the standalone
 * card-reuse extension used before the two extensions were merged. (Values
 * themselves don't migrate: `storage.sync` is scoped per extension ID, and the
 * merged extension keeps the timer's ID — see the README.)
 */
import { browser } from 'wxt/browser';

/** What clicking the toolbar icon does. */
export type ToolbarAction = 'popup' | 'timer';

export interface Settings {
  /** debate-ai.com deployment the reuse check runs against. */
  apiBase: string;
  /** Skip-check whitelist, raw newline-separated text exactly as typed. */
  skipDomains: string;
  /** Whether the toolbar icon opens the page-check popup or the timer window. */
  toolbarAction: ToolbarAction;
  /** Size of the timer window the background worker opens. */
  timerWindowWidth: number;
  timerWindowHeight: number;
  /** Run the reuse check as soon as the popup opens, vs. on an explicit click. */
  autoCheck: boolean;
}

export const DEFAULT_API_BASE = 'https://debate-ai.com';

/** Roomy enough for the 340px clock face plus the tab bar and format select. */
export const DEFAULT_TIMER_WINDOW = { width: 420, height: 560 } as const;

export const DEFAULT_SETTINGS: Settings = {
  apiBase: DEFAULT_API_BASE,
  skipDomains: '',
  toolbarAction: 'popup',
  timerWindowWidth: DEFAULT_TIMER_WINDOW.width,
  timerWindowHeight: DEFAULT_TIMER_WINDOW.height,
  autoCheck: true,
};

/** Chrome refuses windows smaller than this; keep the options page in range. */
export const MIN_TIMER_WINDOW = { width: 360, height: 360 } as const;
export const MAX_TIMER_WINDOW = { width: 1200, height: 1200 } as const;

function clamp(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/** Reads every setting, falling back to the defaults for anything unset. */
export async function getSettings(): Promise<Settings> {
  // `storage.sync.get(defaults)` fills in anything never saved; the cast is
  // only there because the API types its argument as a plain record.
  const stored = (await browser.storage.sync.get(
    DEFAULT_SETTINGS as unknown as Record<string, unknown>
  )) as Partial<Settings>;
  const apiBase =
    typeof stored.apiBase === 'string' && stored.apiBase.trim()
      ? stored.apiBase.trim()
      : DEFAULT_API_BASE;
  return {
    apiBase,
    skipDomains: typeof stored.skipDomains === 'string' ? stored.skipDomains : '',
    toolbarAction: stored.toolbarAction === 'timer' ? 'timer' : 'popup',
    timerWindowWidth: clamp(
      stored.timerWindowWidth,
      DEFAULT_TIMER_WINDOW.width,
      MIN_TIMER_WINDOW.width,
      MAX_TIMER_WINDOW.width
    ),
    timerWindowHeight: clamp(
      stored.timerWindowHeight,
      DEFAULT_TIMER_WINDOW.height,
      MIN_TIMER_WINDOW.height,
      MAX_TIMER_WINDOW.height
    ),
    autoCheck: stored.autoCheck !== false,
  };
}

/** Persists the given subset of settings. */
export async function saveSettings(patch: Partial<Settings>): Promise<void> {
  const next: Partial<Settings> = { ...patch };
  if (typeof next.apiBase === 'string') next.apiBase = next.apiBase.trim();
  await browser.storage.sync.set(next as Record<string, unknown>);
}
