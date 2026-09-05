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
const SKIP_DOMAINS_STORAGE_KEY = "skipDomains";

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
 * Reads the domain whitelist's raw, newline-separated text exactly as
 * typed on the Options page (so reopening it shows back what was saved,
 * casing and blank lines included), falling back to "" when nothing's
 * been configured yet.
 */
async function getSkipDomainsRaw() {
  const stored = await chrome.storage.sync.get(SKIP_DOMAINS_STORAGE_KEY);
  return typeof stored[SKIP_DOMAINS_STORAGE_KEY] === "string" ? stored[SKIP_DOMAINS_STORAGE_KEY] : "";
}

/** Saves the domain whitelist's raw text, as typed on the Options page. */
async function setSkipDomains(raw) {
  await chrome.storage.sync.set({ [SKIP_DOMAINS_STORAGE_KEY]: raw });
}

/** Parses the whitelist's raw newline-separated text into a trimmed, lowercased, blank-line-filtered domain list. */
function parseSkipDomains(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim().toLowerCase())
    .filter((line) => line.length > 0);
}

/**
 * Reads the configured domain whitelist — sites (e.g. an internal team
 * wiki, a search engine's results page) the reuse check should always skip
 * without hitting the network, since they're never themselves a cut card's
 * source (TODO.md idea #7's "An extension options page for whitelisting
 * sites" follow-up) — as a parsed domain list ready for `isUrlDomainSkipped`.
 */
async function getSkipDomains() {
  return parseSkipDomains(await getSkipDomainsRaw());
}

/**
 * Whether `pageUrl`'s hostname is covered by the whitelist: an exact match,
 * or a subdomain of a whitelisted domain (`"docs.example.com"` matches a
 * whitelisted `"example.com"`, but `"example.com.evil.com"` does not).
 * Returns `false` for an unparseable URL rather than throwing.
 */
function isUrlDomainSkipped(pageUrl, skipDomains) {
  if (skipDomains.length === 0) return false;
  let hostname;
  try {
    hostname = new URL(pageUrl).hostname.toLowerCase();
  } catch {
    return false;
  }
  return skipDomains.some((domain) => hostname === domain || hostname.endsWith(`.${domain}`));
}

/**
 * Checks whether `pageUrl` has already been cut into the shared evidence
 * repository, via GET `${apiBase}/api/evidence-reuse-check?url=&source=extension`.
 * The `source=extension` param tags this check in the server's reuse-check
 * log (TODO.md idea #7's "team dashboard of pages flagged as already-cut"
 * follow-up) as coming from the extension rather than the web app's own
 * "Check this page" box.
 */
async function checkPageForExistingCards(pageUrl, apiBase) {
  const endpoint = `${apiBase.replace(/\/$/, "")}/api/evidence-reuse-check?url=${encodeURIComponent(pageUrl)}&source=extension`;
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
