# CLAUDE.md — `debate-qwksearch`

Public (`@debate-ai/` scope). The QwkSearch research workspace embedded at
`/doc` and the pieces around it. Split out of `debate-webview`'s
`components/qwksearch` and `lib/qwksearch`. Tests in `test/`.

## What lives where

- `src/components/Workspace.tsx` — REASON docs editor + research chat tabs.
  Takes an optional `SidebarComponent`; the app passes `SidebarWithAppDock`.
- `src/components/Providers.tsx`, `MainViewProvider.tsx`, `useChatTabs.ts`,
  `GrabBaseScope.tsx` — context and chat-tab state.
- `src/components/base-url.ts` — sets the API base-URL global. **Must be the
  first import** of anything that loads `research-agent-ui`; it is listed in
  `sideEffects`.
- `src/components/connect-auth.ts` — "Sign in with QwkSearch" and the session
  hook. `host-connect.ts` holds the extension's replacement connect flow.
- `src/components/Settings/` — the research-agent settings screens.
  `src/components/ui/` and `src/components/lib/` are its small local helpers.
- `src/lib/` — `connect.ts` (the OAuth-style handshake, also used by the
  extension and the app's `/api/qwksearch/*` routes), `doc-paths.ts`,
  `settings-paths.ts`, `open-sidebar-event.ts`.
- **`debate-webview`** keeps `components/qwksearch/SidebarWithAppDock.tsx`
  (it embeds the app dock, a shell component) and `routes/doc/` that mounts all
  of it.

## Things that bite

- **Never import `debate-webview`.** What the shell must supply comes in
  through a prop (`SidebarComponent`) or a setter: `configureHost` forwards the
  host's `connectQwkSearch` to `setHostConnectQwkSearch`.
- The dock's "open sidebar" button dispatches `OPEN_OWN_SIDEBAR_EVENT`; the
  string is defined here and re-exported by `debate-webview/src/lib/mobile-sidebar.ts`.
- Exports are `./*` with extension fallbacks, so import by file
  (`@debate-ai/qwksearch/lib/connect`). The browser extension aliases
  `@debate-ai/qwksearch/lib/*` to source in `wxt.config.ts`.
- `test/helpers/` are copies of `debate-webview/test/helpers/`.
