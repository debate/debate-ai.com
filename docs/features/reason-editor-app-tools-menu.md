# Reason Editor — "More Tools" app-navigation menu

Adds a trailing "More Tools" dropdown to the live Reason Editor's Google
Docs-style menu bar, linking out to related tools elsewhere in
debate-ai.com (Speech Documents, Prep Notes, Argument Tree Outline,
Word-Count Speeches, AI Coach Mode, Evidence Library, News Stream, and
"All tools…") — closing the "the live editor doesn't surface any of the
other tools that work with what you're drafting" gap: CardMirror's own
menu-bar categories (File/Edit/Card/Format/Insert/AI/View/Tools) and its
`Ctrl/Cmd-Shift-Space` command bar only reach *editor* commands
(`RIBBON_GROUPS`/`runRibbon`), since neither has any notion of the
surrounding Next.js app's routes.

- **Route:** `/reason-editor`
- **Package:** [`debate-editor-cardmirror`](../../packages/debate-editor-cardmirror/README.md)

## What actually changed

The live editor at `/reason-editor` is `CardMirrorEditor`
(`debate-editor-cardmirror`'s React shell around the vendored CardMirror
ProseMirror engine merged in by #293/#294) — not the older
TipTap-based `reason-editor` package, which is now unused for editing
itself (only its `SpeechDocumentsPanel` is still imported by the app).

- `react/MenuBar.tsx` gained an optional `appLinks` prop and a
  `MoreToolsMenu` dropdown, rendered as plain `<a>` tags (not a router
  call) so this package never needs a Next.js dependency.
- `react/CardMirrorEditor.tsx`'s `ReasonEditorProps` gained a matching
  `appLinks?: AppLink[]`, threaded straight to `<MenuBar appLinks={...} />`.
- `apps/debate-ai.com/app/reason-editor/page.tsx` passes a curated
  `REASON_EDITOR_APP_LINKS` list into `EditorWithToolbar`'s new `appLinks`
  prop — no changes needed in the `debate-editor` re-export shim or
  `debate-editor-cardmirror`'s `EditorWithToolbar`/`EditorContent`/
  `LexicalEditorWrapper` wrappers, since they already spread `{...props}`
  onto `CardMirrorEditor`.

## Why not a fourth Ctrl/Cmd-Shift-Space source instead

CardMirror's engine module (`../editor/index.js`) is a page-level
singleton, imported (and its global `Mod-Shift-Space` key handler
installed) only once a `<CardMirrorEditor live>` actually mounts — i.e.
only on pages that render the live editor. Binding a second, app-wide
`Ctrl/Cmd-Shift-Space` listener for site-wide tool navigation would race
that handler on the one page where both would be present. The "More
Tools" dropdown is click-based instead, so it adds zero keybinding
surface and needs no coordination with the engine's own global handler.

## Known gaps

- `appLinks` is a fixed, hand-curated list per call site, not derived from
  the document's own content (e.g. suggesting the Outline tool only when
  the document actually has headings).
- Site-wide tool navigation via `Ctrl/Cmd-Shift-Space` remains scoped to
  wherever a page already renders its own command surface (CardMirror's,
  on `/reason-editor`); pages without a mounted editor have no equivalent
  keyboard-driven "jump to a tool" gesture yet — only `/tools` and, per
  `docs/features/news-stream.md`, its per-tool "Updated" badges.
