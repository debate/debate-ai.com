# Shared Files (Topic Starters for everyone)

Turns the admin-only "Topic Starter" evidence-pack library into a
shared-file library any signed-in user can contribute to and manage.
Before this, `topic_starter_items` rows had no owner: an admin uploaded a
DOCX/ZIP from `/admin`, everyone could browse the result read-only in the
Reason Editor's sidebar, and that was the entire lifecycle — no user could
publish their own document, keep something private, rename, unpublish, or
delete anything.

- **Route:** `/library?tab=shared`; files open at
  `/reason-editor?shared=<id>`
- **Nav:** the Reason Editor sidebar's "Shared Files" panel (formerly
  "Topic Starters"); the dock's Settings menu → "My Library"; the
  "Share to library" button in the editor header
- **Package:** [`debate-round`](../../packages/debate-round/README.md)
  (`state/sharedFiles.ts` helpers + `round/shared-files-client.ts`),
  `apps/debate-ai.com` (`/api/shared-files/**`, `lib/shared-files/import-docx.ts`,
  migration `0032_shared_files_owner`)

## What it does

`topic_starter_items` gained two nullable columns: `owner_id` (FK → `user`,
cascade-deleted with the account) and `source_document_id`. Admin packs
keep `owner_id = NULL` and read as the site's own curated "Topic Starter"
packs; everything created through `/api/shared-files` carries the sharing
user's id. Access rules (pure, in `debate-round`):

- **View** — a published row is public; an unpublished row is visible only
  to its owner.
- **Manage** (rename, edit content, retag, move, publish/unpublish,
  delete) — owner only. Admin packs can't be edited by users.

Ways a user's file enters the library:

1. **Share a document** — from `/library`'s Documents tab or the editor's
   "Share to library" button. The shared copy remembers its
   `source_document_id`, so re-sharing the same document updates that copy
   (title/content refreshed) instead of duplicating it.
2. **Upload a DOCX/ZIP** — `/library`'s Shared Files tab, up to 25 DOCX per
   upload (the admin uploader keeps its 100 cap). Zip directory names
   become nested folder rows, exactly as the admin importer does; both now
   call the same `importSharedFilesFromUpload`.
3. **Create directly** — `POST /api/shared-files` with a full payload
   (title/content/tags/published/parentId/isFolder), for API/SDK callers.

Anyone (signed in or not) can open a published file read-only in the
editor and **Save a copy** to their own documents; signed out, the copy
lands in the browser's anonymous document set, like the editor's own
"New document" does.

## Data flow

```
GET    /api/shared-files?scope=public|mine|all
         public (default): every published row from any owner
         mine: the user's rows, published or not (401 signed out)
         all: public ∪ mine — what the editor sidebar and /library load
POST   /api/shared-files            { documentId, published?, tags?, parentId? } — share a document
                                    { title, content, tags?, published?, parentId?, isFolder? } — create
GET    /api/shared-files/:id        row with content (404 unless published or owned)
PUT    /api/shared-files/:id        owner-only partial update; refuses moving a folder into itself/its subtree
DELETE /api/shared-files/:id        owner-only; deletes the row and, for a folder, every descendant
POST   /api/shared-files/:id/copy   copies into the viewer's documents → { id, title }
POST   /api/shared-files/upload     multipart: file (.docx/.zip), title?, published? → { root, imported }

GET    /api/topic-starters          unchanged public catalogue (published rows, capped at 100)
POST   /api/admin/topic-starters    unchanged admin importer, now via lib/shared-files/import-docx.ts
```

Every request body is validated by `validateSharedFilePayload` (type of
each field, 1 MB content cap, ≤20 tags of ≤40 chars each, trimmed titles
with "Untitled"/"New Folder" fallbacks). Folder deletion and the
move-into-own-subtree guard use `collectSharedFileDescendantIds`, since
the table has no self-referential cascade.

Vitest-covered in `packages/debate-round/test/sharedFiles.test.ts` and
`shared-files-client.test.ts` (see
[user-library.md](user-library.md#data-flow)).

## Known gaps

- No per-user storage quota beyond the per-upload file cap; a determined
  account could fill the library one 25-file zip at a time.
- No "report"/moderation path for a user-published file; an admin removes
  one by deleting the row in D1 (the admin GET lists every row, owned or
  not).
- Tags are free text with no autocomplete against tags already in use.
- A shared copy doesn't auto-update when its source document changes —
  re-share to refresh it.
