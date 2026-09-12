# Debate AI — browser extension

One extension with two tools for a debater's browser:

1. **Round timer** — Constructive / Rebuttal / Cross-x plus per-side prep
   clocks, a round timeline you can export as a PNG, and a resumable session.
   It opens in **its own browser window**, not the toolbar dropdown.
2. **On-page card reuse check** — for the page you currently have open, whether
   your team has already cut a card from it, against `debate-ai.com`'s
   server-backed shared reuse index (`/api/evidence-reuse-check`, see
   [`../../docs/features/evidence-library.md`](../../docs/features/evidence-library.md#on-page-card-reuse-check)),
   not just what's saved in one browser's own `localStorage`.

Both used to be separate extensions — `apps/debate-timer-progress-ext` (WXT +
React) and a plain-HTML/JS `apps/debate-web-ext`. They are now a single
[WXT](https://wxt.dev) MV3 extension with a single Options page; the reuse
check was ported to TypeScript and both halves share `storage` and settings.

## Stack

- **WXT** — MV3 build, HMR dev, zipping
- **React 18** + TypeScript
- **Tailwind CSS v3** + **shadcn/ui** (new-york) — the chrome around the timer
  (format `Select`, `Tabs`, `Button`, `Tooltip`), the popup and the Options
  page. The circular clock face, the Digital-7 font, the depleting SVG ring,
  per-speech colors and the ripple are ported CSS, not shadcn.

## Develop

This app is **outside the workspace globs** — a root `bun install` does not
install it, so install here explicitly.

```bash
cd apps/debate-web-ext
bun install         # runs `wxt prepare`
bun run dev         # launches Chrome with the extension + HMR
bun run dev:firefox # the same, in Firefox
bun run compile     # tsc --noEmit
bun run build       # production build -> .output/chrome-mv3
bun run zip         # -> .output/debate-web-ext-<version>-chrome.zip
```

`wxt dev` launches a browser with the extension already loaded, so there is no
"load unpacked" step while developing. To load a built extension by hand:
`chrome://extensions` → Developer mode → **Load unpacked** →
`.output/chrome-mv3`.

## Configuration

**This extension reads no environment variables.** There is no `.env` and no API
key in the bundle — everything configurable is a user-facing setting on the
Options page, stored in `chrome.storage`, documented under
[Options](#options) below.

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

## The three pages

| Page | Built as | What it is |
| --- | --- | --- |
| `popup.html` | `entrypoints/popup` | Toolbar dropdown: the reuse check for the active tab + an **Open round timer** button. |
| `timer.html` | `entrypoints/timer` | The timer + timeline, opened as its own `popup`-type window. |
| `options.html` | `entrypoints/options` | Every setting for both halves, in one page. |

`popup.html` doubles as a standalone check window: right-click any page →
**Check this page for existing cards** opens it in its own window with a
`?url=` to check, so the reuse check stays reachable whichever the toolbar
icon is set to open.

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

**Round timer**

- **Default debate format** — the format the timer starts in (writes the same
  `debatetype` key the timer window's own format `Select` does; changing it
  resets the clocks and drops any resumable session, as it always has).
- **Toolbar icon opens** — the reuse-check popup (default), or the timer window
  directly. Implemented by clearing/restoring `action.default_popup`, since
  Chrome only fires `action.onClicked` when no popup is registered. With the
  icon set to the timer, the reuse check is still one right-click away (above).
- **Timer window size** — width × height for the window that gets opened next,
  clamped to 360–1200 px.

**Card reuse check**

- **API base URL** — the debate-ai.com deployment to check against (e.g.
  `http://localhost:3000` during local development). Only the production domain
  and `http://localhost:3000` are pre-authorized in the manifest's
  `host_permissions`; another host needs the manifest updated (and the
  extension reloaded) first.
- **Skip-check whitelist** — one domain per line (an internal team wiki, a
  general reference site) the popup always skips without a network request,
  showing a neutral "on your skip-check whitelist" status instead. A subdomain
  of a listed domain is skipped too.
- **Check automatically when the popup opens** — off means the page's URL is
  only sent when you click "Check this page".

## Layout

```
entrypoints/
  background.ts          MV3 service worker: toolbar mode, context menu, timer window
  popup/                 reuse check for the active tab + "Open round timer"
  timer/                 Tabs (Timer | Timeline) + format Select
  options/               one settings page for both halves
src/
  settings/settings.ts   shared storage.sync settings + defaults
  reuse/api.ts           GET /api/evidence-reuse-check + skip-domain matching
  timer/
    constants.ts         debate formats, speech tables, toTimeString/toNumber
    storage.ts           browser.storage.local: debatetype, savedTimes, timelog
    useTimer.ts          all timer state + behavior
    window.ts            open/focus the standalone timer window
  components/
    TimerFace.tsx        circular clock face, speech/prep buttons, editable count
    Timeline.tsx         React/SVG timeline; PNG export via <canvas>
  styles/
    base.css             Tailwind layers + shadcn tokens (every page)
    timer.css            Digital-7 font, clock face, ring, timeline
    popup.css options.css   each page's shell
components/ui/           shadcn primitives
lib/utils.ts             cn()
public/
  icon/                  16/32/48/96/128
  res/                   Digital-7.woff, beep_final.mp3
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

## Known gaps

- No automated tests (no test runner is wired up for this extension, which
  isn't part of the repo's `bun`/`turbo` workspaces) — verified by loading the
  built `.output/chrome-mv3` unpacked.
- Registering a newly-cut card into the shared index
  (`POST /api/evidence-reuse-check`) still only happens from the web app's
  Evidence Library submission form, not from this extension — the extension is
  check-only.
