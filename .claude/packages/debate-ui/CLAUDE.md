# CLAUDE.md — `debate-ui`

Public (`@debate-ai/` scope). The shared UI layer: shadcn/Radix primitives,
`cn`, `useIsMobile` and the panel building blocks. No debate code — if a file
needs a round, a card or a route, it belongs in a feature package.

## What lives where

- `src/primitives/*` — shadcn components (`button`, `card`, `dialog`, `select`,
  `sidebar`, …). Import as `@debate-ai/ui/primitives/button`.
- `src/lib/utils.ts` — `cn`.
- `src/hooks/use-mobile.ts` — the 768px breakpoint hook.
- `src/panels/` — `PanelShell` and friends (`@debate-ai/ui/panels/panel-shell`)
  and `useStoreSnapshot`.
- `src/loaders/` — `AnimatedLoader`, `OrbitalLoader`, `LoadingAnimation` and the
  clip-picking helpers (`loading-animations.ts`, over `grab-url/animations`).
  Never render a loader from a package that bundles its own React.
- Tests in `test/`, importing `../src/…`.

## Things that bite

- **Exports are explicit** (`primitives/*` → `.tsx`), not `./*`. A new
  top-level folder needs its own `exports` entry.
- **Depend on this, never on `debate-webview`.** Feature packages import
  primitives from here so they do not form a cycle with the shell.
- Tailwind sees these classes only because the host's
  `debate-webview/src/styles/app.css` lists `@source "../../../debate-ui/src"`.
- `debate-webview/components.json` points its `ui`/`utils` aliases here, but
  `shadcn add` cannot write into a package specifier — add the primitive, then
  move the generated file into `src/primitives/`.
- Some packages (`debate-file-market`, `debate-comments`) keep a private copy
  of `Button`/`cn` from before this package existed; prefer importing from here.
