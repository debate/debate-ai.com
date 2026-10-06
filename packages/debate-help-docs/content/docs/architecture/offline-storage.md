---
title: "Offline Storage (bulk storage)"
---

# Offline Storage (bulk storage)

User-facing page: [Offline Storage](/docs/features/offline-storage).

## Rule

`localStorage` is for **small preferences only** — the kind of value a cookie
would hold. Anything that grows with use goes through `@debate/data-sync`'s
`src/state/bulk-storage.ts`. Signed-in data is synced to D1 by the owning
store (`saved_flows`, `saved_rounds`, `TOOL_RECORD_COLLECTIONS`); bulk storage
is the offline copy.

The flow workspace used to write whole flows, rounds and the flow history to
`localStorage`, and on `QuotaExceededError` it trimmed archived flows and then
`alert()`ed "Storage quota exceeded! … Please delete some flows". Both the
trimming and the alerts are gone.

## The store

Synchronous `getBulkItem` / `setBulkItem` / `removeBulkItem` (and a
`Storage`-shaped `bulkStorage`) over an in-memory cache, so callers kept their
shape. Keys it owns: `BULK_STORAGE_KEYS` = `flows`, `rounds`, `flow-history`.

| Backend | Role |
| --- | --- |
| IndexedDB (`debate-ai-bulk-storage` / `kv`) | Primary. Quota is a share of free disk; `navigator.storage.persist()` is requested on hydration. Unlimited inside the extension (`unlimitedStorage`). |
| Browser extension (`chrome.storage.local`) | Mirror, when installed. Every write is mirrored; a key IndexedDB lost is restored from it. Unlimited under `unlimitedStorage`. |
| `localStorage` | Legacy only: read to migrate, deleted once the value reaches IndexedDB. Written only when neither backend exists (tests, locked-down browsers); a refusal there is swallowed and the value stays in memory. |

- `hydrateBulkStorage()` loads every key into memory once and migrates legacy
  copies out. `useInitialLoad` (`debate-round/src/hooks/useFlowEffects.ts`)
  awaits it before reading flows and rounds, and returns `loaded` so the
  featured-round effect in `DebateRoundPanel` waits for it.
- A write made while hydrating wins over what is stored.
- Writes never throw and never reach the UI as an error.

## The extension bridge

`apps/debate-browser-ext/src/storage/bulk-storage-bridge.ts`, registered on
`runtime.onMessageExternal` in `entrypoints/background.ts`. The manifest's
`externally_connectable` admits only `https://debate-ai.com/*` and
`http://localhost:3000/*` (Chromium only; the Firefox build has no bridge).
Messages are `{ type: "debate-ai:bulk-storage", op: "ping" | "get" | "set" | "remove" }`;
only `BULK_STORAGE_KEYS` are accepted, stored under the `bulk:` prefix. The
site finds the extension by `DEBATE_EXTENSION_ID` (same value as
`debate-webview`'s `EXTENSION_ID`; keep them in sync).

Inside the extension's Options page (the whole app on `chrome-extension://`)
the bridge is skipped: IndexedDB there is already unlimited.

## Settings

`debate-webview/src/components/settings/DeviceStorageSettings.tsx`, on
`/settings`, explains the above and shows `getBulkStorageStatus()`.

## Known gaps

- Other tools' stores (`TOOL_RECORD_COLLECTIONS`, video caches, editor
  dictionaries) still keep their local copies in `localStorage`. They are
  account-synced and individually small, but moving them onto bulk storage is
  the next step.
- Orphaned `speech-doc-*` keys from older builds are still cleaned out of
  `localStorage` on load (`cleanupOldSpeechDocs`).
