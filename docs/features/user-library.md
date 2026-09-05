# My Library (documents, flows, shared files) and the demo account

Gives a signed-in user one place to manage everything linked to their
account — Reason Editor documents, cloud-saved flows and rounds, and the
shared-file library — and adds a shared **demo account** a visitor can sign
in as with one click to tour all of it with sample content already in
place. Closes the "total support for users with docs and management of
flows and shared files" ask: every account-linked store already existed
(`documents`, `saved_flows`, `saved_rounds`, `topic_starter_items`) but
was only reachable through the surface that happened to create it — the
Reason Editor's sidebar, `FlowHistoryDialog`'s cloud tab, the admin-only
Topic Starter uploader — with no user-facing management and no way to try
any of it without an account.

- **Route:** `/library` (tabs `?tab=documents|flows|shared`); the
  Reason Editor gained `?doc=<id>` / `?shared=<id>` deep links
- **Nav:** the dock's Settings menu → "My Library"; `/tools` → Workspaces
  → "My Library"; `/features`; the Reason Editor sidebar's new library
  icon; the sign-in page's "Try the demo account" button
- **Package:** [`debate-round`](../../packages/debate-round/README.md)
  (pure helpers + fetch clients, unit-tested), `apps/debate-ai.com`
  (`/library`, `/api/shared-files`, `/api/demo`, the `topic_starter_items`
  owner columns)

## What it does

**Documents tab** — lists the account's Reason Editor documents and
folders (newest first, searchable, with each file's folder path). Per row:
open in the editor (`/reason-editor?doc=<id>`), inline rename, duplicate
("Title (copy)", numbered if taken), share to the library, delete (a folder
takes everything inside it). "New document" / "New folder" buttons. Signed
out, the tab manages the browser's anonymous document set, matching the
editor's own signed-out behavior.

**Flows tab** — lists `saved_flows` summaries. Per row: **Open in Debate**
(fetches the full flow, upserts it into the browser-local flow list
`/debate` loads on mount, then navigates there), download as JSON, remove
from the account. "Import flow JSON" validates an export with
`isValidFlow` and saves it to the account. A "Saved rounds" section below
lists `saved_rounds` with a remove action (loading a round stays in Round
History's "Saved to account" tab, which already resolves its flow ids).

**Shared Files tab** — two sections over the same `topic_starter_items`
table (see [shared-files.md](shared-files.md)):

- *My shared files*: everything the user has shared, published or private.
  Per row: open, inline rename, publish/unpublish toggle, delete. An upload
  card takes one `.docx` or a `.zip` of up to 25 (folder names inside the
  zip are kept) — the same importer the admin Topic Starter uploader uses.
- *Community library*: the admin-curated Topic Starter packs (badged) plus
  every file other users have published. Per row: open read-only in the
  editor, or **Save a copy** to my documents.

**Reason Editor** — the sidebar's "Topic Starters" panel is now "Shared
Files" and lists everything the viewer can see (public packs, other users'
published files, and the viewer's own private ones, badged "private"). The
header gains **Share to library** on an owned document (re-sharing updates
the same shared copy) and **Save a copy** on an open shared file.

**Demo account** — `/login` (and the signed-out `/library` card) offers
"Try the demo account". One click signs the browser in as
`demo@debate-ai.com` ("Demo Debater"), pre-loaded with a case folder (1AC,
2AC blocks), a prep checklist, three saved flows (Policy with a speech
doc, Public Forum, LD), two published shared files, and one private draft.
Seeding is idempotent (documents/shared files by title, flows by their
stable `Flow.id`), so repeat sign-ins never duplicate rows; `/library`
shows a banner with **Reset demo data** for the demo user, which wipes the
account's documents, flows, and shared files back to the sample set.

## Data flow

```
packages/debate-round/src/state/sharedFiles.ts       (pure — no fetch)
  → validateSharedFilePayload / normalizeSharedFileTags / normalizeSharedFileTitle
  → buildSharedFileTree / collectSharedFileDescendantIds / sharedFilePath / filterSharedFiles
  → canViewSharedFile / canManageSharedFile / partitionSharedFiles
packages/debate-round/src/state/demoAccount.ts       (pure)
  → DEMO_ACCOUNT, isDemoAccountEmail, DEMO_FLOW_IDS, buildDemoSeed, setFlowCell/getFlowCell
packages/debate-round/src/round/documents-client.ts  → /api/doc/documents (+ duplicateDocument, deleteDocumentTree)
packages/debate-round/src/round/shared-files-client.ts → /api/shared-files (list/mine/fetch/create/share/update/delete/copy/upload)
packages/debate-round/src/round/demo-account-client.ts → GET /api/demo, POST /api/demo/login
packages/debate-round/src/round/saved-flows-client.ts, saved-rounds-client.ts (now exported from the package index)

apps/debate-ai.com/app/library/LibraryPageContent.tsx → the three tabs above
apps/debate-ai.com/app/reason-editor/page.tsx         → ?doc / ?shared deep links, Share to library, Save a copy
apps/debate-ai.com/app/api/shared-files/**            → see shared-files.md
apps/debate-ai.com/app/api/demo/route.ts              → { enabled, email, name }
apps/debate-ai.com/app/api/demo/login/route.ts        → ensureDemoUser + seedDemoAccount, then better-auth's
                                                        signInEmail server-side; forwards Set-Cookie
apps/debate-ai.com/lib/demo-account/index.ts          → password derived from BETTER_AUTH_SECRET (or
                                                        DEMO_ACCOUNT_PASSWORD); DEMO_ACCOUNT_DISABLED=true turns it off
apps/debate-ai.com/lib/auth/index.ts                  → emailAndPassword { enabled, disableSignUp } — password sign-in
                                                        exists only for the demo account; public sign-up stays closed
```

Vitest-covered in `packages/debate-round/test/` — `sharedFiles.test.ts`,
`demoAccount.test.ts`, `shared-files-client.test.ts`,
`documents-client.test.ts`, `demo-account-client.test.ts` (70 cases:
payload validation for every field and the size caps, tree building with
orphans and cycles, descendant collection, path/search filtering, the
owner/viewer access rules, the seed's validity against `isValidFlow` and
the shared-file validator, and every fetch client's URL/method/body and
401/404 handling).

## Known gaps

- The demo account is one shared user: anything a visitor adds is visible
  to (and deletable by) the next visitor until someone clicks Reset. A
  per-visitor sandbox would need the `anonymous` plugin plus a per-user
  seed instead.
- Flows tab "Open in Debate" writes to the browser-local flow list; it
  doesn't yet select the loaded flow as the active tab in `/debate`.
- Saved rounds can be removed here but not loaded — loading still goes
  through Round History's "Saved to account" tab.
- The Documents tab has no drag-to-folder; moving a document between
  folders is still done in the editor's file tree.
