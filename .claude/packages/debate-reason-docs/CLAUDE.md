# CLAUDE.md — `debate-reason-docs`

Public (`@debate-ai/` scope). The REASON docs workspace: the file tree and tabs
that live in the app sidebar, the editor screen they open files in, sharing and
selling a file, and Topic Starters. Split out of `debate-webview`'s
`components/` and `lib/`. Tests in `test/` mirror `src/`.

## What lives where

- `src/docs/` — `ReasonDocsProvider` (all docs/tabs state), the sidebar panels,
  the file manager (`file-manager/`, with its `filemanager.css`), route sync.
- `src/editor/` — `ReasonEditorScreen`, `EditorTabStrip`, `ShareWithContacts`.
- `src/market/` — `SellFileDialog`. It sits here, not in `debate-file-market`,
  because it reads the open documents from the provider and the file tree
  mounts it; `debate-file-market` cannot depend back on this package.
- `src/lib/reason-docs/`, `src/lib/topic-starters/`, `src/lib/debate-editor/` —
  the pure helpers: slugs and paths, save queue, tab rules, Topic Starter
  changes and cache, and the stored `.cmir` format helpers.
- `src/session.tsx` — `ReasonSessionProvider` / `useReasonSession`.
- **`debate-webview`** mounts it: `components/layout/providers/ReasonDocsWithSession.tsx`
  wraps `ReasonDocsProvider` from `AppShell`; `routes/reason-editor` renders the screen.

## Things that bite

- **No auth client in here.** Signed-in state comes from `useReasonSession()`;
  the shell feeds it from its own `useSession`. Without the provider the user
  reads as signed out (a test that forgets it will see a logged-out UI).
- **Exports are `./*` → `./src/*`**, so import by file, e.g.
  `@debate-ai/reason-docs/docs/ReasonDocsProvider`. There is no index.
- Topic Starter tab ids are negative row ids (`lib/reason-docs/tab-ids.ts`);
  never mix them into a plain document-id array.
- `test/helpers/dom.tsx` is a copy of the one in `debate-webview/test/helpers`.
