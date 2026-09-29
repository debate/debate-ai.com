/**
 * @fileoverview Records a Workspace-menu/`t`-prefix navigation into the same
 * "Recent" tools list the app-wide command palette reads (see
 * `apps/debate-ai.com`'s `lib/hooks/useRecentTools.ts` and
 * `lib/recentTools.ts`) — closing `command-palette.mdx`'s Known gaps entry
 * that "the editor's Workspace menu still doesn't record a visit", leaving
 * `/tools`' own `RecordVisitLink` as the only other place besides a palette
 * selection that did.
 *
 * This package has no dependency on `apps/debate-ai.com` (or on
 * `debate-round`, which owns `isValidToolHref`), so this mirrors — rather
 * than imports — `lib/recentTools.ts`'s `localStorage` shape (`recent-tools`,
 * capped at 5, most-recent-first) and `useRecentTools.ts`'s
 * `recent-tools-changed` same-tab event, plus `saveRecentToolOp`'s
 * `PUT /api/settings` op. Every `WORKSPACE_LINKS` href is a hardcoded,
 * already-valid in-app path (`tool-catalog-consistency.test.ts` guards that),
 * so unlike the app's own writer this skips `isValidToolHref` validation.
 *
 * Both call sites (`../react/MenuBar.tsx`'s Workspace category, and
 * `quick-card-search-ui.ts`'s `t`-prefix results) navigate away with a full
 * `window.location.assign` rather than a router push, so the account sync
 * fetch is `keepalive: true` — otherwise the in-flight request would be at
 * risk of being cut off by the navigation before it reaches the server.
 * Best-effort throughout: a signed-out `401`, a network failure, or a
 * blocked/quota-full `localStorage` never blocks or throws back into the
 * caller, since the navigation itself must never be held up by this.
 *
 * @module editor/recent-tools
 */

const STORAGE_KEY = 'recent-tools';
const CHANGE_EVENT = 'recent-tools-changed';
/** Mirrors `apps/debate-ai.com`'s `lib/recentTools.ts#MAX_RECENT_TOOLS`. */
const MAX_RECENT_TOOLS = 5;

function readRecentTools(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((entry): entry is string => typeof entry === 'string');
  } catch {
    return [];
  }
}

function writeRecentTools(list: string[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Private-mode/quota-full localStorage — the visit still gets its
    // best-effort account sync attempt below.
  }
}

/**
 * Records that `href` (a `WORKSPACE_LINKS` entry) was just opened from the
 * editor, promoting it to the front of the shared "Recent" tools list —
 * both locally (so the app-wide palette's own "Recent" group and `/tools`'
 * "Recently opened" strip pick it up on the next page load) and, best
 * effort, on the signed-in user's account.
 */
export function recordWorkspaceVisit(href: string): void {
  if (typeof window === 'undefined') return;

  const current = readRecentTools();
  if (current[0] !== href) {
    const next = [href, ...current.filter((entry) => entry !== href)].slice(0, MAX_RECENT_TOOLS);
    writeRecentTools(next);
    try {
      window.dispatchEvent(new Event(CHANGE_EVENT));
    } catch {
      // No listeners left to notify (the navigation below is about to tear
      // this page down anyway) — never let this block the visit itself.
    }
  }

  if (typeof fetch === 'undefined') return;
  try {
    void fetch('/api/settings', {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ recordRecentTool: href }),
      keepalive: true,
    }).catch(() => {
      // Signed out, offline, or a server error — the local write above
      // already applied, matching every other best-effort account sync in
      // this package (e.g. `quick-cards-client.ts`'s callers).
    });
  } catch {
    // A synchronous `fetch` failure (e.g. a blocked/unavailable network
    // stack) — same "never block the navigation" contract as the rejection
    // case above.
  }
}
