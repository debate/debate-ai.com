/**
 * Shared helpers for the Debate AI "On Page Card Reuse Search" extension.
 * Mirrors packages/debate-card-search/src/lib/evidence-reuse-check-client.ts's
 * request/response shape against the same `/api/evidence-reuse-check` route
 * (see TODO.md idea #7, follow-up (a)) — kept as plain, dependency-free JS
 * here rather than importing that package, since a Manifest V3 extension
 * has no bundler step in this repo.
 */

const DEFAULT_API_BASE = "https://debate-ai.com";
const STORAGE_KEY = "apiBase";

/** Reads the configured API base URL (set on the Options page), falling back to the production default. */
async function getApiBase() {
  const stored = await chrome.storage.sync.get(STORAGE_KEY);
  const base = typeof stored[STORAGE_KEY] === "string" ? stored[STORAGE_KEY].trim() : "";
  return base || DEFAULT_API_BASE;
}

/** Saves the configured API base URL. */
async function setApiBase(base) {
  await chrome.storage.sync.set({ [STORAGE_KEY]: base.trim() });
}

/**
 * Checks whether `pageUrl` has already been cut into the shared evidence
 * repository, via GET `${apiBase}/api/evidence-reuse-check?url=`.
 */
async function checkPageForExistingCards(pageUrl, apiBase) {
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
