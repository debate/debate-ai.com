# Common Argument Library — Saved Collections

Closes the "saved custom collections per user" follow-up named under the
"📚 Common Argument Library" bullet (Research Crowdsourcing Organizer
Features section) in `TODO.md`.

- **Route:** `/cards/argument-library`
- **Package:** [`debate-research-evidence`](../../packages/debate-search-evidence/README.md)

## What it shows

`ArgumentLibraryPanel`'s tag-chip filter bar (toggling tags to narrow the
library to cards carrying at least one of them) now has a **Saved
collections** section beneath it, shown whenever the library has at least
one tag collection:

- Every saved collection renders as a button (its name plus tag count) —
  clicking it replaces the current tag-chip selection (`activeTags`) with
  that collection's saved tags, the same as picking each chip by hand — next
  to "Rename", "Update", and "✕" remove actions. Hovering a collection's
  button shows its full tag list. "Rename" swaps the button for an inline
  name field (Save/Cancel); "Update" (shown only while at least one tag chip
  is active) replaces that collection's saved tags with the current
  selection in place.
- A "Save current selection as" field + "Save collection" button saves the
  *currently active* tag chips under a new name. Disabled until at least one
  tag is selected and a name is typed. Saving under a name that's already in
  use (case-insensitively) leaves the existing collection untouched and
  shows a message instead of silently overwriting it. Every refusal shows
  its own message — duplicate name, at the 50-collection cap, more than 30
  tags selected, over-long name — via the pure
  `validateNewSavedArgumentCollection`/`buildSavedArgumentCollectionFailureMessage`
  helpers, which enforce the same limits at save time that
  `isValidSavedArgumentCollectionsList` enforces on read (previously an
  over-limit save persisted fine and then silently wiped every stored
  collection on the next read).

Unlike a tag itself (derived from whatever cards exist), a saved collection
is just a named, reusable set of tag strings — applying one to a library
that no longer has cards under one of its tags simply narrows to whatever
still matches, the same as a stale filter picked by hand.

## Data flow

```
lib/argument-library-collections.ts (pure validation/(de)serialization)
  → hooks/useSavedArgumentCollections.ts (localStorage: saved-argument-collections)
      — local-first state, best-effort synced via /api/settings's
        savedArgumentCollections field
  → panels/ArgumentLibraryPanel.tsx
      — "Saved collections" section: apply a collection (sets activeTags) or
        save the current activeTags selection as a new named collection
```

Local-first (works fully signed out, `localStorage` key
`saved-argument-collections`) and best-effort account-synced through the
same `/api/settings` row every other picker-style setting uses (the new
`savedArgumentCollections` field, backed by a `user_settings.saved_argument_collections`
D1 column), mirroring `debate-round`'s `outlineFilterPresets`/
`useOutlineFilterPresets` split and sync mechanism exactly — including the
"local apply is never blocked by a sync failure" convention (a failed
account write is silently retried on the next save, never surfaced as an
error to the UI). Up to 50 collections, each name unique
case-insensitively, each holding 1-30 tags.

`debate-research-evidence` can't import `debate-round`'s `round/user-settings-client.ts`
directly (that module already imports `NewsSyncPayload` *from*
this package family, so the reverse import would be a dependency cycle), so
`lib/argument-library-collections-client.ts` is a small standalone `fetch`
client scoped to just this one field, mirroring the shape (not the import)
of `round/user-settings-client.ts` — the same reason `news-stream-sync.ts`'s
account sync is wired in from the app layer instead.

## Known gaps

None currently open on this bullet — the previous "no rename" and "no
editing a saved collection's tag list" gaps are closed by the per-collection
"Rename" and "Update" actions above (`renameCollection`/`updateCollection`
in `hooks/useSavedArgumentCollections.ts`, validated by the pure
`validateSavedArgumentCollectionRename`/`validateSavedArgumentCollectionTagsUpdate`,
Vitest-covered in `test/argument-library-collections.test.ts`).
