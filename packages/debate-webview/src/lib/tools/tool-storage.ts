/**
 * @fileoverview Where each `/tools` entry keeps what a person does in it.
 *
 * Three places exist: an account-synced `localStorage` collection
 * (`TOOL_RECORD_COLLECTIONS`), a dedicated `saved_*` SQL table behind its own
 * `/api` route, or nowhere (a hub or read-only view). Until now that answer
 * lived only in the heads of the people who wrote each tool, so a new tool
 * could ship with no persistence story and nothing noticed.
 *
 * Collections are derived from the sync catalog (a tool owns the collections
 * filed under its `href`, or under the nearest parent route, as the shared
 * cards hub does). Everything else is declared in {@link TOOL_STORAGE_OVERRIDES}
 * with a reason; `tool-storage.test.ts` fails when a tool resolves to neither.
 *
 * @module lib/tools/tool-storage
 */

import { TOOL_RECORD_COLLECTIONS } from "@debate-ai/data-sync/src/state/toolRecordCollections"

export type ToolStorage =
  /** Backed by account-synced tool-record collections (device copy when signed out). */
  | { kind: "synced"; collections: string[] }
  /** Backed by its own SQL table(s) in the account database. */
  | { kind: "sql"; what: string }
  /** Shows other tools' or public data; stores nothing of its own. */
  | { kind: "derived"; reason: string }

/** Tools whose storage is not a tool-record collection. Keyed by exact `href`. */
export const TOOL_STORAGE_OVERRIDES: Readonly<Record<string, ToolStorage>> = {
  "/research/market": { kind: "sql", what: "wallets and file listings" },
  "/research": { kind: "derived", reason: "A hub that links to the research tools." },
  "/news": { kind: "derived", reason: "Product news and forum threads; posts live in the forums tables." },
  "/contacts": { kind: "sql", what: "contacts and blocks" },
  "/notifications": { kind: "sql", what: "notifications" },
  "/word-count": { kind: "sql", what: "word-count rounds" },
  "/practice/predictions": { kind: "sql", what: "prediction wallets and bets" },
  "/speech-documents": { kind: "sql", what: "speech documents" },
  "/coaching/rankings": { kind: "derived", reason: "Public team rankings." },
}

function path(href: string): string {
  return href.split("?")[0]
}

/**
 * The storage story for the tool at `href`, or `null` when none is declared.
 * Precedence: an explicit override, then collections filed under the exact
 * route, then collections filed under the nearest parent route.
 */
export function resolveToolStorage(href: string): ToolStorage | null {
  const target = path(href)
  const override = TOOL_STORAGE_OVERRIDES[target]
  if (override) return override
  const exact = TOOL_RECORD_COLLECTIONS.filter((c) => path(c.href) === target)
  if (exact.length > 0) return { kind: "synced", collections: exact.map((c) => c.key) }
  let best: string | null = null
  for (const c of TOOL_RECORD_COLLECTIONS) {
    const parent = path(c.href)
    if (target.startsWith(`${parent}/`) && (best === null || parent.length > best.length)) best = parent
  }
  if (best === null) return null
  return {
    kind: "synced",
    collections: TOOL_RECORD_COLLECTIONS.filter((c) => path(c.href) === best).map((c) => c.key),
  }
}

/** One plain-language line for a tool header; `null` when nothing is stored worth saying. */
export function describeToolStorage(storage: ToolStorage | null): string | null {
  if (!storage) return null
  switch (storage.kind) {
    case "synced":
      return "Saved to your account when you're signed in, and kept on this device otherwise."
    case "sql":
      return `Saved to your account: ${storage.what}.`
    case "derived":
      return null
  }
}
