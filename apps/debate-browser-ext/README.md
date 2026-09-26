# Debate AI — browser extension

One extension with three tools for a debater's browser:

1. **Article panel** — any page you're on, in reading mode, in the browser's
   side panel, with an AI you can ask about it. Ported from the article reader
   in [qwksearch-research-agent]'s `research-agent-ui` package; see
   [The article panel](#the-article-panel) for what changed and why.
2. **Round timer** — Constructive / Rebuttal / Cross-x plus per-side prep
   clocks, a round timeline you can export as a PNG, and a resumable session.
   It opens in **its own browser window**, not the toolbar dropdown.
3. **On-page card reuse check** — for the page you currently have open, whether
   your team has already cut a card from it, against `debate-ai.com`'s
   server-backed shared reuse index (`/api/evidence-reuse-check`, see
   [`../../docs/features/evidence-library.md`](../../docs/features/evidence-library.md#on-page-card-reuse-check)),
   not just what's saved in one browser's own `localStorage`.
3. **The app itself, on the Options page** — the video archive, card search,
   the reuse check over *any* URL you can paste, season standings and the
   catalog of every tool in the app, from
   [`debate-webview`](../../packages/debate-webview). The extension's own
   settings are the last screen in its nav.

[qwksearch-research-agent]: https://github.com/OpenSourceAGI/qwksearch-research-agent

Both used to be separate extensions — `apps/debate-timer-progress-ext` (WXT +
React) and a plain-HTML/JS `apps/debate-web-ext`. They are now a single
[WXT](https://wxt.dev) MV3 extension with a single Options page; the reuse
check was ported to TypeScript and both halves share `storage` and settings.

## Stack

- **WXT** — MV3 build, HMR dev, zipping
- **React 18** + TypeScript
- **Tailwind CSS v3** + **shadcn/ui** (new-york) — the chrome around the timer
  (format `Select`, `Tabs`, `Button`, `Tooltip`), the popup and the Options
  page. The circular clock face, the font-timer-digits font, the depleting SVG ring,
  per-speech colors and the ripple are ported CSS, not shadcn.
- **`debate-webview`** — the app's own UI, mounted by the Options page. It
  brings its own scoped stylesheet (`.dai-root`, no Tailwind) and talks to the
  API through `debate-api-client`, so nothing in this extension hand-writes a
  request to reach it.

## Develop

This app is a **workspace member** (it joined when the Options page started
mounting `debate-webview`), so install from the repo root — there is no
lockfile here any more.

```bash
bun install          # at the repo root
cd apps/debate-web-ext
bun run dev          # launches Chrome with the extension + HMR
bun run dev:firefox  # the same, in Firefox
bun run typecheck    # wxt prepare && tsc --noEmit (also run by the root CI)
bun run test         # vitest: the extractor, the citation reader, the renderer
bun run build        # production build -> .output/chrome-mv3
bun run zip          # -> .output/debate-web-ext-<version>-chrome.zip
```

`wxt prepare` runs as part of `typecheck` and of `dev`/`build` rather than as a
`postinstall`, so a root install never has to run this app's scripts. Two
things follow from being in the workspace, both handled in config:

- **React is pinned here.** The rest of the monorepo is on React 19 and this
  app is on 18, and bun's isolated `node_modules` will happily give a shared
  package its own resolution of `react`. `wxt.config.ts` dedupes `react` /
  `react-dom` for the bundle and `tsconfig.json`'s `paths` does the same for
  types; without either, the shell's hooks run against a second React
  ("invalid hook call") and every lucide icon becomes "not a valid JSX element
  type".
- **`debate-api-client` is a built package.** Run `bun run build` at the repo
  root (or `turbo build`, which orders it for you) before building this
  extension from a clean checkout.

`wxt dev` launches a browser with the extension already loaded, so there is no
"load unpacked" step while developing. To load a built extension by hand:
`chrome://extensions` → Developer mode → **Load unpacked** →
`.output/chrome-mv3`.

## Configuration

**This extension reads no environment variables.** There is no `.env` and no API
key in the bundle — everything configurable is a user-facing setting on the
Options page, documented under [Options](#options) below.

Two of those settings are not in `storage.sync` with the rest, and deliberately
so:

- **Model API keys** live in `storage.local`. `storage.sync` is uploaded to the
  signed-in browser profile's account and copied to every device on it, which
  is not somewhere a billable API key should land without the user asking. The
  cost is that keys don't follow the user to another computer.
- **The debate-ai.com session** lives in `storage.local` too, for the same
  reason and because it is scoped to one deployment anyway.

The one thing worth knowing before you point it somewhere new: the **API base
URL** setting decides which `debate-ai.com` deployment the reuse check queries,
but only the production domain and `http://localhost:3000` are pre-authorized in
the manifest's `host_permissions`. Another host needs
[`wxt.config.ts`](./wxt.config.ts) updated and the extension reloaded first —
the setting alone will not grant access.

Everything the API itself needs — auth, model keys, the card database — is
configured on that deployment; see
[its README](../debate-ai.com/README.md#environment-variables).

## Publishing

```bash
bun run build && bun run zip           # → .output/debate-web-ext-<version>-chrome.zip
bun run build:firefox && bun run zip   # Firefox equivalents
```

Bump `version` in `package.json` first — a store rejects an upload whose version
is not higher than the last.

| Store | Upload | What you need |
| --- | --- | --- |
| Chrome Web Store | [Developer Dashboard](https://chrome.google.com/webstore/devconsole) | A developer account (one-time $5 registration fee) and the `chrome-mv3` zip. |
| Firefox Add-ons | [addons.mozilla.org/developers](https://addons.mozilla.org/developers/) | A Mozilla account and the Firefox zip. Source must be submitted alongside the build, since the bundle is generated. |

Both stores want a privacy policy URL, and both will ask why the extension sends
page URLs to a server — the reuse check does, which is why the skip-check
whitelist and the "check automatically" toggle exist. Neither upload needs a
secret in this repository; nothing here automates them.

## The four pages

| Page | Built as | What it is |
| --- | --- | --- |
| `sidepanel.html` | `entrypoints/sidepanel` | The article panel, opened as the browser's side panel (Chrome) or sidebar (Firefox). |
| `popup.html` | `entrypoints/popup` | Toolbar dropdown: the reuse check for the active tab + **Read this page** and **Open round timer** buttons. |
| `timer.html` | `entrypoints/timer` | The timer + timeline, opened as its own `popup`-type window. |
| `options.html` | `entrypoints/options` | `debate-webview`'s app UI, with every setting for the other three tools as its last screen. |

`popup.html` doubles as a standalone check window: right-click any page →
**Check this page for existing cards** opens it in its own window with a
`?url=` to check, so the reuse check stays reachable whichever the toolbar
icon is set to open.

## The article panel

Open it from **Read this page** in the popup, from right-click → **Read this
page in Debate AI**, or by setting the toolbar icon to open it directly. It
shows the page you're on in reading mode, with the toolbar, prompt box,
suggested follow-up questions, chat history, reading zoom and Alt-key shortcuts
ported from `research-agent-ui`'s `ArticleExtractPanel`.

Three things work differently here than they do in the web app it came from,
and each difference is why the port was worth doing.

### It reads the tab, not the URL

The web app fetches the URL server-side and extracts the HTML that comes back.
This reads the page **out of the tab you already have open** —
`src/reader/snapshot.ts` injects a one-line collector that hands back
`document.documentElement.outerHTML` — and extracts it in the panel
(`src/article/extract.ts`). That means it works on a page behind your own
subscription, past a cookie wall, or rendered entirely in the client: anything
you can see, it can read. A server-side fetch of the same URL gets whatever an
anonymous crawler gets, which for a lot of the web is a paywall notice.

Injection is allowed by **`activeTab`**, granted per user action, so the
extension does not ask for access to every site you visit and can only read a
page you explicitly opened it on.

The extractor (`src/article/readability.ts`) is a DOM port of the scoring
extractor in [qwksearch-research-agent]'s `extract-webpage` package: the same
unlikely-candidate filter and the same "score the prose, credit its container"
shape, walking a cloned document instead of running regexes over a string. It
rebuilds the body from an allowlist of tags and attributes rather than
stripping a blocklist, so scripts, event handlers and `javascript:` URLs are
gone by construction — the panel renders that markup as HTML, so this is the
part the tests are most pointed at.

### The answers are yours

There's no server holding a model key here, so **Ask** and **Suggest** run
against whichever of these you pick on the Options page:

| Provider | Key | Where the request goes |
| --- | --- | --- |
| My Debate AI account | none — sign in | `POST /api/reason-ai` on your deployment, with the session as a bearer token |
| OpenRouter | yours | `openrouter.ai` |
| OpenAI | yours | `api.openai.com` |
| Anthropic | yours | `api.anthropic.com` |
| Google Gemini | yours | `generativelanguage.googleapis.com` |

The prompts are copied verbatim from the web app's `article-qa` and
`article-followups` handlers, so answers read the same. Your key is sent to
that provider and to nothing else, and never leaves `storage.local`. Each
provider's origin is in `host_permissions` so an extension page can call it
without a preflight; nothing is sent anywhere unless you have both selected
that provider and stored a key for it.

### Signing in, and staying signed in

The extension and debate-ai.com share a cookie jar, but every request the
extension makes to that origin is cross-site and the session cookie is
`SameSite=Lax` — so the browser never attaches it, however many host
permissions the extension holds. The extension therefore carries its own copy
of the session as a **bearer token**, which the server's `bearer()` plugin
accepts in place of the cookie.

Getting one mirrors the native wrapper's handoff (`/auth/native-complete`):

1. The extension opens `…/login?callbackURL=/auth/extension-complete` in a
   normal tab, so you sign in **on debate-ai.com**, never on an extension
   surface — which is also the only place Google's OAuth will run.
2. [`/auth/extension-complete`](../debate-ai.com/app/auth/extension-complete/page.tsx)
   mints a single-use, five-minute token off the session it now has and parks
   it in its own URL **fragment** (a fragment never reaches a server, so the
   token isn't logged on the way past).
3. The background worker, watching that tab, reads the token, closes the tab
   and spends it at `POST /api/auth/one-time-token/verify`.

You stay signed in because every authorized response is checked for a rotated
`set-auth-token`, and an alarm pings `/api/auth/get-session` every six hours,
which is what makes better-auth roll the session's expiry forward. Signing out,
or leaving the browser untouched past the session's lifetime, is what ends it.

The server has to trust the extension's origin for step 3 — better-auth rejects
any state-changing request from an untrusted one. The **Chrome** origin is
pinned by id in
[`lib/auth/hosts.ts`](../debate-ai.com/lib/auth/hosts.ts), derived from the
`key` in `wxt.config.ts`; keep the two in sync. A **Firefox** build's
`moz-extension://` origin is a fresh UUID per install, so there is no id to
pin — add it to `BETTER_AUTH_TRUSTED_ORIGINS` on the deployment.

### Why a side panel, not an overlay

Same reason the timer is its own window: a panel that is part of the browser
stays open while you click around the page it came from. It's also an extension
page, so it renders with the extension's own styles instead of fighting
whatever CSS the site ships — no shadow DOM, no specificity war. Chrome gets
`sidePanel`, Firefox `sidebar_action`, both from the one `entrypoints/sidepanel`
entrypoint.

Both APIs only open a panel while handling a user action, and they check the
call stack — so `openReaderPanel` awaits nothing before opening, and its
callers resolve what they need beforehand. That's why the background worker
caches the toolbar mode instead of reading it from storage on click.

### Why the timer is a window, not a dropdown

An action dropdown closes the moment you click back into the page or switch
tabs — which is exactly what can't happen mid-speech. `entrypoints/background.ts`
therefore opens `timer.html` with `windows.create({ type: 'popup' })` and
remembers the window id in `storage.local`, so a second request focuses the
window that's already open instead of stacking another one. (This restores the
original pre-WXT extension's floating-window behavior.) The timer window is
resizable and its size is configurable; the *reuse check* stays a dropdown,
since it is about the tab you're looking at.

## Options

Open them from the gear in either page, or `chrome://extensions` → Details →
Extension options.

The page opens on the app's UI — Videos, Cards, Reuse check, Rankings, All
tools — pointed at whatever **API base URL** is set below; saving a different
one repoints every screen without a reload. What the browser will actually let
those screens reach is still `host_permissions`, so a deployment other than
production or `localhost:3000` needs `wxt.config.ts` updated and the extension
reloaded, exactly as the reuse check always has.

The extension's own settings are the **Extension** screen at the end of that
nav:

**Your Debate AI account**

- **Sign in with Google** — opens sign-in on debate-ai.com in a normal tab, and
  keeps the session alive afterwards. See
  [Signing in](#signing-in-and-staying-signed-in).

**Article panel AI**

- **Answers come from** — your account (the deployment holds the model key), or
  OpenRouter / OpenAI / Anthropic / Google Gemini with your own key.
- **Model** — the model id for that provider; blank uses its default. Disabled
  for the account option, where the deployment picks.
- **Your API keys** — one per provider, stored in `storage.local` only. Clear a
  field and save to delete a key.
- **Default question** — what the panel's prompt box starts with.
- **Follow-up questions to suggest** — how many **Suggest** asks for (1–8).

**Round timer**

- **Default debate format** — the format the timer starts in (writes the same
  `debatetype` key the timer window's own format `Select` does; changing it
  resets the clocks and drops any resumable session, as it always has).
- **Toolbar icon opens** — the reuse-check popup (default), the article panel,
  or the timer window directly. Implemented by clearing/restoring
  `action.default_popup`, since Chrome only fires `action.onClicked` when no
  popup is registered. Whichever you pick, the other two stay one right-click
  away (above).
- **Timer window size** — width × height for the window that gets opened next,
  clamped to 360–1200 px.

**Card reuse check**

- **API base URL** — the debate-ai.com deployment the reuse check, sign-in and
  account-backed AI answers all run against (e.g. `http://localhost:3000`
  during local development). Only the production domain and
  `http://localhost:3000` are pre-authorized in the manifest's
  `host_permissions`; another host needs the manifest updated (and the
  extension reloaded) first. Changing it signs you out, since a session belongs
  to the deployment that issued it.
- **Skip-check whitelist** — one domain per line (an internal team wiki, a
  general reference site) the popup always skips without a network request,
  showing a neutral "on your skip-check whitelist" status instead. A subdomain
  of a listed domain is skipped too.
- **Check automatically when the popup opens** — off means the page's URL is
  only sent when you click "Check this page".

## Layout

```
entrypoints/
  background.ts          MV3 service worker: toolbar mode, context menus, panel,
                         timer window, sign-in, session-refresh alarm
  sidepanel/             the article panel (ported ArticleExtractPanel)
  popup/                 reuse check + "Read this page" + "Open round timer"
  timer/                 Tabs (Timer | Timeline) + format Select
  options/               App.tsx mounts debate-webview; SettingsPanel.tsx is the
                         extension's own settings, appended as one of its screens
src/
  settings/settings.ts   shared storage.sync settings + defaults
  article/
    readability.ts       DOM reading-mode extractor + allowlist sanitizer
    cite.ts              JSON-LD / meta-tag citation metadata
    extract.ts           PageSnapshot -> Article
    types.ts             Article, ChatMessage, PageSnapshot
  reader/
    snapshot.ts          reads the tab's HTML under `activeTab`
    panel.ts             open the side panel / sidebar; panel message names
  ai/
    providers.ts         the provider registry and their origins
    keys.ts              API keys in storage.local (never storage.sync)
    article-ai.ts        Ask + Suggest, against account or own key
    markdown.ts          escape-first Markdown -> HTML for model answers
  auth/
    handoff.ts           the names both halves share; token-from-URL parsing
    session.ts           bearer session: store, authorize, refresh, sign out
    sign-in-flow.ts      background half of the sign-in handoff
    useAccount.ts        the account as React state, synced across pages
  reuse/api.ts           GET /api/evidence-reuse-check + skip-domain matching
  timer/
    constants.ts         debate formats, speech tables, toTimeString/toNumber
    storage.ts           browser.storage.local: debatetype, savedTimes, timelog
    useTimer.ts          all timer state + behavior
    window.ts            open/focus the standalone timer window
  components/
    TimerFace.tsx        circular clock face, speech/prep buttons, editable count
    Timeline.tsx         React/SVG timeline; PNG export via <canvas>
    article/             the ported panel: toolbar, prompt, follow-ups,
                         AI response, article body, account strip
  styles/
    base.css             Tailwind layers + shadcn tokens (every page)
    timer.css            font-timer-digits font, clock face, ring, timeline
    sidepanel.css        reading typography for the article and the answers
    popup.css options.css   each page's shell
test/                    vitest: extractor, citations, renderer, token parsing
components/ui/           shadcn primitives
lib/utils.ts             cn()
public/
  icon/                  16/32/48/96/128
  res/                   font-timer-digits.woff, beep_final.mp3
```

## Timer behavior

- Six formats with the same speech/prep minute tables (HS Policy … Extemp).
- Speech buttons load that speech's full time; **prep buttons are running banks**
  per side that deplete as you use them and persist across speeches.
  Double-click a prep button to reset that side's bank.
- 1-second countdown, circular meter depletes from the top, per-speech accent
  colors, click the face to play/pause, ripple.
- At `0:00`: beep + auto-advance (Constructive/Rebuttal→Cross-x, Cross-x→
  Constructive, Aff/Neg Prep→Rebuttal).
- Session autosaves every tick and resumes for 1 hour (`savedTimes`).
- Ctrl/Cmd+Z undoes the last time switch.
- Timeline logs every play/pause, keeps the last 2 hours, shows per-speech
  totals and a pause %, exports a PNG. 2-step Clear.

## Migration notes

- The original timer extension's manifest `key` is retained, so the extension
  ID — and existing users' stored timer data — carry over.
- Because the merged extension keeps that ID, `storage.sync` values saved by
  the *old standalone* card-reuse extension (a different ID) do not migrate;
  its two settings, the API base URL and the skip-check whitelist, keep the
  same key names but need re-entering once on the Options page.
- That same retained `key` is what fixes the Chrome extension id, and so what
  lets debate-ai.com pin the extension's origin as a trusted one for sign-in.
  Changing the `key` changes the id, and sign-in stops working until
  `EXTENSION_ID` in `apps/debate-ai.com/lib/config/site.ts` is updated to match.

## Known gaps

- `bun run test` covers the parts that are plain functions over a DOM — the
  reading-mode extractor, the citation reader, the Markdown renderer, the
  token-from-URL parsing. Anything that touches `browser.*` has no coverage:
  the panel, sign-in and the timer are verified by loading the built
  `.output/chrome-mv3` unpacked. Joining the workspace did get the root CI to
  type-check this app (`bun run typecheck` at the root now includes it), and
  the UI the Options page mounts is covered by
  `packages/debate-webview/test/` — but the root test run does not reach
  `apps/`, so these tests are run by hand from this directory.
- The article panel has only been exercised against the pages used to write the
  extractor's tests. A scoring extractor is never right on every site; a page
  it gets wrong shows the wrong block rather than failing, so it is worth
  trying on the sites you actually cut from.
- Registering a newly-cut card into the shared index
  (`POST /api/evidence-reuse-check`) still only happens from the web app's
  Evidence Library submission form, not from this extension — the extension is
  check-only.
