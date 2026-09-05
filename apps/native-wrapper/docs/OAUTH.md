# Why login needs a deep link, and how it works

Google (and most OAuth providers) refuse to run their login flow inside an embedded webview —
Tauri's included WebView2/WKWebView/WebKitGTK included. Loading `https://debate-ai.com` and
clicking "Continue with Google" straight inside the wrapper's window either fails outright or
gets flagged as insecure. So sign-in has to happen in the user's actual default browser, and the
resulting session has to be handed back to the wrapper's window afterward — those are two
different cookie jars that can't otherwise see each other's session.

## The three steps

```
 Wrapper window                System browser                  Wrapper window
 (debate-ai.com)                (debate-ai.com)                 (debate-ai.com)
┌────────────────┐            ┌──────────────────┐            ┌────────────────┐
│ LoginForm.tsx   │  opener    │ /login            │            │ /auth/         │
│ "Continue in    │ ────────► │  → Google OAuth    │            │  native-callback│
│  your browser"  │  plugin    │  → /auth/          │  deep      │  verifies token │
│                 │            │    native-complete │  link      │  → session      │
│                 │            │  generates token,  │ ─────────► │    cookie set   │
│                 │            │  redirects to      │ debateai://│  → redirect "/" │
│                 │            │  debateai://...    │            │                 │
└────────────────┘            └──────────────────┘            └────────────────┘
      step 1                        step 2                          step 3
```

1. **`LoginForm.tsx`** (in `apps/debate-ai.com`) detects it's running inside the wrapper
   (`lib/native/tauri.ts`'s `isNativeWrapper()`, which checks for the `window.__TAURI__` global
   the wrapper injects — see `src-tauri/capabilities/remote.json`) and, instead of rendering the
   normal social/magic-link buttons, renders one "Continue in your browser" button. Clicking it
   calls the wrapper's opener plugin (`plugin:opener|open_url`) to open
   `https://debate-ai.com/login?callbackURL=/auth/native-complete` in the OS default browser.
2. The user signs in normally there — Google OAuth, Discord, LinkedIn, or a magic link, whichever
   they pick; none of this page's code needs to know which. better-auth's `callbackURL` lands the
   browser on **`/auth/native-complete`** once a session cookie exists. That page calls
   `authClient.oneTimeToken.generate()` (better-auth's
   [one-time-token plugin](https://better-auth.com/docs/plugins/one-time-token), registered in
   `apps/debate-ai.com/lib/auth/index.ts`) — a single-use token, valid 5 minutes, bound to that
   session — then redirects the browser to `debateai://auth-callback?token=<token>`. The custom
   scheme (registered by the wrapper — `profiles/<name>.json`'s `deepLinkScheme`) hands the OS
   back to the installed app.
3. `src-tauri/src/lib.rs`'s `on_open_url` handler catches that deep link and navigates the
   wrapper's own window to **`https://debate-ai.com/auth/native-callback?token=<token>`** — same
   origin the window already had loaded, so this is a same-origin request from here on, not a
   cross-origin one. That page calls `authClient.oneTimeToken.verify({ token })`, a same-origin
   POST which spends the token server-side and sets a session cookie scoped to *this* window's
   cookie jar (`disableSetSessionCookie` is left at its default `false` specifically so this call
   sets the cookie), then redirects to `/`. The wrapper's window is now signed in.

## Why the Rust side doesn't call the verify endpoint directly

better-auth's `/api/auth/one-time-token/verify` is a **POST** endpoint expecting a JSON body —
not something a plain window navigation (a GET) can hit. Routing through
`/auth/native-callback`'s own client-side `fetch` call (via the `authClient` the site already
ships) is what actually performs that POST, and doing it from a page already loaded at
`debate-ai.com`'s origin is what makes the resulting `Set-Cookie` land in the right cookie jar
with no CORS/`trustedOrigins` complications — a cross-origin fetch from a `tauri://localhost`
asset page would need those, a same-origin one doesn't.

## Windows/Linux: why `tauri-plugin-single-instance` is in `Cargo.toml`

Clicking a `debateai://` link while the app is already running launches a **second OS process**
on Windows and Linux instead of delivering the URL to the running one — `on_open_url` alone
doesn't fire for the already-running instance there. `tauri-plugin-single-instance` intercepts
that second launch and forwards its argv (which contains the deep-link URL) to
`handle_deep_link()` in the first, already-running process instead, and focuses its window. macOS
doesn't need this — `on_open_url` fires correctly there without it, and the plugin's build
dependency is scoped out (`#[cfg(not(any(target_os = "android", target_os = "ios")))]` covers
macOS too, but that cfg is really "not a plugin mobile has no use for" — see the comment in
`Cargo.toml`).

## Extending this to another site

Everything above is generic except the actual page routes — `/login`, `/auth/native-complete`,
`/auth/native-callback` — which have to exist on whatever `profiles/<name>.json`'s `url` points
at, using better-auth's `oneTimeToken`/`oneTimeTokenClient` plugins the same way
`apps/debate-ai.com` does. If you retarget this wrapper at a site that doesn't use better-auth,
you'll need equivalent generate/verify endpoints there instead — the deep-link and Rust-side
handoff mechanics in `src-tauri/` don't change either way.
