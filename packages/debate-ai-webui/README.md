# debate-ai-webui

The debate-ai.com frontend UI as a standalone React package: the video
archive, card search, the on-page card reuse check, season standings, and the
catalog of every tool in the app — mountable anywhere React runs, and reaching
the API only through [`debate-api-client`](../debate-api-client).

```tsx
import { DebateWebUI } from "debate-ai-webui";
import "debate-ai-webui/styles.css";

<DebateWebUI origin="https://debate-ai.com" />;
```

## Why it is a package

The app's UI used to be reachable only by loading the Next.js app in
`apps/debate-ai.com`. Anything else that wanted it — the browser extension, the
native wrapper, a docs demo — had to reimplement a slice of it or embed the
site in an iframe, which is why the extension's popup had its own hand-written
copy of one API call and no way to show anything else.

Everything here is therefore free of the app's framework: no `next/link`, no
server components, no router, no session. The shell keeps the selected screen
in React state, builds one `debate-api-client` client from the configured
origin, and opens in-app routes through a host-supplied callback.

`apps/debate-web-ext`'s Options page is the first host.

## What talks to the server

`src/api.ts`, and nothing else. Every screen calls an SDK operation with the
shell's client; nothing here imports `fetch` or writes a URL. That is what
gives an embedded UI the same caching, retries, rate limiting and request
dedupe the web app gets, since `debate-api-client` routes every call through
`grab-url`.

The SDK never rejects on an HTTP error — each operation resolves to
`{ data?, error? }` — so `unwrap()` turns that into the throw the screens'
`useAsync` hook renders as a retryable failure.

## Screens

| Screen | Route it mirrors | API |
| --- | --- | --- |
| Videos | `/videos` | `listVideos` |
| Cards | `/cards` | `searchCards` |
| Reuse check | — (the extension popup's check, over any URL) | `checkEvidenceReuse` |
| Rankings | `/rank` | `getLeaderboard` |
| All tools | `/features` | none — `debate-feature-catalog` |

A host adds its own with `extraScreens`; the extension appends its settings
that way rather than forking the shell.

## Styling

One plain-CSS stylesheet (`src/styles.css`), every rule scoped under
`.dai-root`, `dai-`-prefixed class names, no Tailwind and no Radix. The hosts
that embed this each have their own design system — the extension's Options
page is Tailwind v3 + shadcn, a wrapper may have nothing — and a package that
only looks right inside one of them is not embeddable. Colour follows the
host's theme: `prefers-color-scheme` by default, or a `.dark` ancestor /
`data-theme` attribute where the host sets one by hand.

## Not rendered here

Card bodies. `searchCards` returns HTML with `<mark>`/`<u>` in it, uploaded by
other people; this package has no sanitizer, and its hosts are privileged
pages (an extension Options tab can reach `browser.*`). The screen shows the
plain-text summary and citation, and hands the full card to the web app, which
does have one.

## Tests

`bun run test` from this directory, or `bun run test` at the repo root for
every package. Markup is asserted through `react-dom/server`, the same way
`debate-timer` asserts its progress ring.
