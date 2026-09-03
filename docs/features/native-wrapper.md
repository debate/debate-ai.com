# Native Wrapper

A native desktop (Windows/macOS/Linux) and mobile (Android/iOS) app that opens debate-ai.com in
its own window instead of a browser tab — a real taskbar/dock icon, no browser chrome, and a
Google-OAuth-compatible sign-in flow despite Google blocking OAuth inside embedded webviews. Built
with [Tauri](https://tauri.app) as `native-wrapper`, a generic wrapper package that happens to
ship pre-configured for this site rather than something debate-ai.com-specific.

- **Package:** [native-wrapper](../../packages/native-wrapper/README.md) — the Tauri shell itself
  (window setup, icons, OAuth handoff, build/release CI).
- **Auth integration:** [`lib/auth/index.ts`](../../apps/debate-ai.com/lib/auth/index.ts) and
  [`lib/auth/client.ts`](../../apps/debate-ai.com/lib/auth/client.ts) (better-auth's
  `oneTimeToken`/`oneTimeTokenClient` plugins), plus
  [`app/auth/native-complete`](../../apps/debate-ai.com/app/auth/native-complete/page.tsx) and
  [`app/auth/native-callback`](../../apps/debate-ai.com/app/auth/native-callback/page.tsx).
- **Native detection:** [`lib/native/tauri.ts`](../../apps/debate-ai.com/lib/native/tauri.ts),
  consumed by [`LoginForm.tsx`](../../apps/debate-ai.com/components/layout/LoginForm.tsx).

## What it shows

Functionally identical to the website — the wrapper's window loads `https://debate-ai.com`
directly, so every feature documented elsewhere in this folder works unchanged inside the native
app. The one visible difference is sign-in: inside the wrapper, `LoginForm` replaces its normal
social/magic-link buttons with a single "Continue in your browser" button, since Google (and most
OAuth providers) refuse to run inside an embedded webview.

## Data flow

```
apps/debate-ai.com (website, unmodified for everything except auth)
  lib/native/tauri.ts          -- isNativeWrapper() checks for window.__TAURI__
  components/layout/LoginForm.tsx
    -- native branch: opens /login?callbackURL=/auth/native-complete in the system browser
       via the wrapper's opener plugin (window.__TAURI__.core.invoke("plugin:opener|open_url"))
  app/auth/native-complete/page.tsx   (runs in the system browser, after OAuth succeeds there)
    -- authClient.oneTimeToken.generate() -> redirects to debateai://auth-callback?token=...
  app/auth/native-callback/page.tsx   (runs back inside the wrapper's window)
    -- authClient.oneTimeToken.verify({ token }) -> session cookie set in the wrapper's
       own cookie jar -> router.replace("/")

packages/native-wrapper (Tauri shell, generic — see its own README for the profile mechanism)
  src-tauri/src/lib.rs
    -- tauri_plugin_deep_link catches debateai://auth-callback, navigates the window to
       /auth/native-callback (same-origin from there on)
    -- tauri_plugin_single_instance forwards a second deep-link launch's argv on Windows/Linux,
       where a running app doesn't receive on_open_url directly
  src-tauri/capabilities/remote.json
    -- scopes window.__TAURI__ IPC access to https://debate-ai.com/* specifically
```

Full mechanics, including why the token hand-off is shaped this way (better-auth's verify
endpoint is a same-origin POST, not something a plain navigation can hit), are in
[`packages/native-wrapper/docs/OAUTH.md`](../../packages/native-wrapper/docs/OAUTH.md).

## Known gaps

- No auto-update yet — `tauri-plugin-updater` is wired into the Rust side but left inactive
  (`plugins.updater.active: false` in `tauri.conf.json`) until a signing keypair and update
  endpoint are set up. See `packages/native-wrapper/docs/BUILDING.md`'s "Auto-update" section.
- Android/iOS mobile projects (`gen/android`, `gen/apple`) aren't generated or checked in — this
  environment had neither an Android SDK/NDK nor a macOS+Xcode host available, so mobile support
  is scaffolded (the Rust core is mobile-ready) but not exercised end-to-end. See
  `packages/native-wrapper/docs/MOBILE.md`.
- No store submissions have been made for any platform — `packages/native-wrapper/docs/APP_STORES.md`
  documents what each store needs (including the real Guideline 4.2 "minimum functionality"
  rejection risk a webview-wrapper app should expect specifically on iOS), but every store needs
  a human-held developer account and credentials this environment doesn't have.
- The native sign-in handoff always lands the wrapper's window at `/` after success
  (`app/auth/native-callback/page.tsx` hardcodes `router.replace("/")`), regardless of what
  `callbackURL` the original `LoginForm` call was given — acceptable today since the wrapper
  currently only ever calls `LoginForm` with its default, but would need threading the original
  `callbackURL` through both handoff pages if that stops being true.
