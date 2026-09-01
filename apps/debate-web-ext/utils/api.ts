/**
 * Shared helpers for the Debate AI "On Page Card Reuse Search" extension.
 * Mirrors packages/debate-card-search/src/lib/evidence-reuse-check-client.ts's
 * request/response shape against the same `/api/evidence-reuse-check` route
 * (see TODO.md idea #7, follow-up (a)).
 */

import { browser } from "wxt/browser";
import { storage } from "wxt/utils/storage";

export const DEFAULT_API_BASE = "https://debate-ai.com";

const apiBaseItem = storage.defineItem<string>("sync:apiBase", {
  fallback: DEFAULT_API_BASE,
});

/** Reads the configured API base URL (set on the Options page), falling back to the production default. */
export async function getApiBase(): Promise<string> {
  const base = (await apiBaseItem.getValue()).trim();
  return base || DEFAULT_API_BASE;
}

/** Saves the configured API base URL. */
export async function setApiBase(base: string): Promise<void> {
  await apiBaseItem.setValue(base.trim());
}

export interface ReuseMatch {
  argBlock?: string;
  cite?: string;
  topic?: string;
}

export interface ReuseCheckResult {
  alreadyCut: boolean;
  matches: ReuseMatch[];
}

/**
 * Checks whether `pageUrl` has already been cut into the shared evidence
 * repository, via GET `${apiBase}/api/evidence-reuse-check?url=`.
 */
export async function checkPageForExistingCards(
  pageUrl: string,
  apiBase: string,
): Promise<ReuseCheckResult> {
  const endpoint = `${apiBase.replace(/\/$/, "")}/api/evidence-reuse-check?url=${encodeURIComponent(pageUrl)}`;
  const res = await fetch(endpoint, { method: "GET" });
  if (!res.ok) {
    let detail = "";
    try {
      const payload = await res.json();
      detail = payload?.error ?? "";
    } catch {
      // Body wasn't JSON.
    }
    throw new Error(detail || `Reuse check request failed (${res.status}).`);
  }
  return res.json();
}

/** Reads the URL of the active tab in the current window. */
export async function getActiveTabUrl(): Promise<string> {
  const [tab] = await browser.tabs.query({ active: true, currentWindow: true });
  return tab?.url ?? "";
}
