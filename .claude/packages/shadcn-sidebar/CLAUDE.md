# CLAUDE.md — `shadcn-sidebar`

Public, **unscoped** package (`shadcn-sidebar`, MIT) meant to be published to npm and
used outside debate-ai.com. A generic port of the app sidebar — the resizable column
(`ResizableSidebarLayout` + `sidebar-collapse` in `debate-videos`), the app dock
(`debate-webview`'s `dock.tsx` / `CategoryDock`), the collapsible tree (`VideoSidebarTree`
/ `TreeItem`) and the account menu (`nav-user.tsx`). Entry `src/index.ts`, demo and mock
data behind `src/demo` (`shadcn-sidebar/demo`), stories in `stories/`, tests in `test/`.

## Boundaries

- **No `@debate/*` imports, ever.** The point of the package is that it carries no debate
  code; it may not depend on any workspace package. Debate-specific behaviour goes in the
  host, configured through props and data.
- **No router, no session, no theme library.** Links go through the provider's
  `renderLink`, the account comes in as `user`, the theme as `NavUser`'s `theme` prop
  (`useThemeMode` is only a fallback for hosts without one).
- **SSR-safe.** Every stored value (collapse, width, theme) reads as its default on the
  server and in the hydrating render; storage access is wrapped in try/catch.
- `debate-ai.com` itself does not use this package yet — the original sidebar still lives
  in `debate-videos` / `debate-webview`. Changing one does not change the other.

## Storybook

`.storybook/` is package-local (the repo root stays free of tool configs). Tailwind v4
runs through `@tailwindcss/vite` and compiles `.storybook/storybook.css`, which imports
`src/styles/sidebar.css` (the default shadcn tokens). `bun run storybook` /
`bun run build-storybook` inside the package. `storybook-static/` is git-ignored.
Give every story its own `storageKey` so stored collapse state doesn't leak between them.
