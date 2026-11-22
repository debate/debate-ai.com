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
 * Some tools use both: settings and side records in synced collections, and
 * their main saved items (documents, practice debates, judge decisions) in an
 * account SQL table. {@link TOOL_SQL_ALONGSIDE} names those tables, so the
 * "Where each tool saves" list in Settings says the items are saved to the
 * account rather than "kept on this device otherwise". The app's
 * `saved-data-tool-storage.test.ts` fails when a Settings → Saved data kind
 * points at a tool that is described as neither.
 *
 * @module lib/tools/tool-storage
 */

import { TOOL_RECORD_COLLECTIONS } from "@debate-ai/research-evidence/src/account-sync/toolRecordCollections"

export type ToolStorage =
  /**
   * Backed by account-synced tool-record collections (device copy when signed
   * out). `sql`, when set, names what the tool also keeps in its own account
   * SQL table (from {@link TOOL_SQL_ALONGSIDE}).
   */
  | { kind: "synced"; collections: string[]; sql?: string }
  /** Backed by its own SQL table(s) in the account database. */
  | { kind: "sql"; what: string }
  /** Shows other tools' or public data; stores nothing of its own. */
  | { kind: "derived"; reason: string }

/** Tools whose storage is not a tool-record collection. Keyed by exact `href`. */
export const TOOL_STORAGE_OVERRIDES: Readonly<Record<string, ToolStorage>> = {
  "/research/market": { kind: "sql", what: "wallets and file listings" },
  "/news": { kind: "derived", reason: "Product news and forum threads; posts live in the forums tables." },
  "/contacts": { kind: "sql", what: "contacts and blocks" },
  "/notifications": { kind: "sql", what: "notifications" },
  "/word-count": { kind: "sql", what: "word-count rounds" },
  "/practice/predictions": { kind: "sql", what: "prediction wallets and bets" },
  "/practice/debates": { kind: "sql", what: "online challenges, drill sets, practice profiles and judge pool listings" },
  "/speech-documents": { kind: "sql", what: "speech documents" },
  "/coaching/rankings": { kind: "derived", reason: "Public team rankings." },
}

/**
 * Tools that own tool-record collections *and* save their main items to an
 * account SQL table. Keyed by exact `href`; the value is a plain-language
 * plural for the items, as Settings → Saved data names them.
 */
export const TOOL_SQL_ALONGSIDE: Readonly<Record<string, string>> = {
  "/reason-editor": "documents",
  "/practice/versus-ai": "practice debates vs AI",
  "/practice/judge-decision": "judge decisions",
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
  const sql = TOOL_SQL_ALONGSIDE[target]
  const exact = TOOL_RECORD_COLLECTIONS.filter((c) => path(c.href) === target)
  if (exact.length > 0) return { kind: "synced", collections: exact.map((c) => c.key), ...(sql ? { sql } : {}) }
  let best: string | null = null
  for (const c of TOOL_RECORD_COLLECTIONS) {
    const parent = path(c.href)
    if (target.startsWith(`${parent}/`) && (best === null || parent.length > best.length)) best = parent
  }
  if (best === null) return null
  return {
    kind: "synced",
    collections: TOOL_RECORD_COLLECTIONS.filter((c) => path(c.href) === best).map((c) => c.key),
    ...(sql ? { sql } : {}),
  }
}

/** Options for {@link describeToolStorage}. */
export interface DescribeToolStorageOptions {
  /**
   * Whether someone is signed in. Leave it out where that isn't known (a
   * static note in a Settings section) to get the line that holds either way.
   * Set it where it is known, as the "Where each tool saves" list does, so a
   * signed-out visitor isn't told their items are already in an account.
   */
  signedIn?: boolean
}

/**
 * One plain-language line for a tool header; `null` when nothing is stored
 * worth saying. With `signedIn` set, the line says what happens now: signed
 * out, a SQL tool's items are saved "once you sign in" and a synced tool's
 * data is "kept on this device until you sign in"; signed in, both are simply
 * "saved to your account".
 */
export function describeToolStorage(
  storage: ToolStorage | null,
  { signedIn }: DescribeToolStorageOptions = {},
): string | null {
  if (!storage) return null
  switch (storage.kind) {
    case "synced":
      if (signedIn === true) {
        return storage.sql ? `Saved to your account: ${storage.sql}, plus its other settings.` : "Saved to your account."
      }
      if (signedIn === false) {
        return storage.sql
          ? `Saved to your account once you sign in: ${storage.sql}. Its other settings are kept on this device until then.`
          : "Kept on this device until you sign in, then saved to your account."
      }
      return storage.sql
        ? `Saved to your account: ${storage.sql}. Its other settings are saved to your account when you're signed in, and kept on this device otherwise.`
        : "Saved to your account when you're signed in, and kept on this device otherwise."
    case "sql":
      return signedIn === false
        ? `Saved to your account once you sign in: ${storage.what}.`
        : `Saved to your account: ${storage.what}.`
    case "derived":
      return null
  }
}
