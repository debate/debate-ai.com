<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <a href="https://www.npmjs.com/package/debate-api-client"><img src="https://img.shields.io/npm/dm/debate-api-client.svg" alt="NPM Monthly Downloads" /></a>
    <a href="https://www.npmjs.com/package/debate-api-client"><img src="https://img.shields.io/npm/v/debate-api-client.svg" alt="npm version" /></a>
    <a href="https://www.npmjs.com/package/debate-api-client"><img src="https://img.shields.io/npm/dt/debate-api-client.svg" alt="NPM Total Downloads" /></a>
    <a href="https://www.npmjs.com/package/debate-api-client"><img src="https://img.shields.io/npm/types/debate-api-client" alt="TypeScript types" /></a>
    <a href="https://packagephobia.com/result?p=debate-api-client"><img src="https://packagephobia.com/badge?p=debate-api-client" alt="Install size" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-api-client"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

# debate-api-client

Typed SDK for the [Debate AI API](https://debate-ai.com/api), generated
from [`debate-openapi.yml`](./debate-openapi.yml)
with [Hey API](https://heyapi.dev/) and powered by
[`grab-url`](https://grab.js.org) instead of fetch/axios — every call gets
grab's caching, retries, rate limiting, and request dedupe.

📖 Interactive API reference (Scalar): **https://debate-ai.com/api**

```bash
npm i debate-api-client
```

```ts
import { getVideoTranscript, searchCards, client } from "debate-api-client"

const { data, error } = await getVideoTranscript({ query: { videoId: "dQw4w9WgXcQ" } })
if (error) throw new Error(error)
console.log(data.snippets)

// Point at a different origin (e.g. a local dev server) or add default headers:
client.setConfig({ baseUrl: "http://localhost:3000/api" })
```

Every operation in `debate-openapi.yml` has a matching function named after its
`operationId` (e.g. `getVideoTranscript`, `searchCards`, `syncFlow`,
`reasonAiComplete`). Each returns `Promise<{ data?: T; error?: string }>` — it
never throws for an HTTP error, only for a network failure.

```ts
import { createClient, type Client } from "debate-api-client"

// Or use a dedicated client instance instead of the shared default:
const client: Client = createClient({
  baseUrl: "https://debate-ai.com/api",
  headers: { Authorization: `Bearer ${token}` },
  grab: { cache: true, retryAttempts: 2, rateLimit: 1 },
})

await searchCards({ query: { q: "climate change" } }, { client })
```

## grab defaults

Requests are sent with **`grab-url/slim`** — the same `grab()`, without the
bundled `linkedom`/`archiver-web` HTML and archive extractors an API response
never needs. Anything reaching for `grab.mock` or `grab.log` alongside this SDK
has to import the same entry: `grab-url` and `grab-url/slim` are separate
modules with separate `mock` and `log`, and a stub registered on one is
invisible to the other.

Every client starts from `DEFAULT_GRAB_OPTIONS`, so a call gets grab's behavior
without being configured:

```ts
import { DEFAULT_GRAB_OPTIONS } from "debate-api-client"

// { cache: false, cacheForTime: 60, retryAttempts: 2, timeout: 30 }
```

`cache` is configured but off: an SDK that served a GET from a minute-old cache
would hand back pre-write data after a POST to the same resource, and that is
not something a caller can opt out of after the fact. Turn it on with
`grab: { cache: true }` — the window is already set.

`cache`, `cacheForTime` and `retryAttempts` apply to `GET` only. Setting them
client-wide leaves writes alone, since serving a POST from cache or replaying a
`DELETE` that failed changes what the API was asked to do; a single call can
still ask for them with its own `{ grab }`.

```ts
// Client-wide, reads only:
client.setConfig({ grab: { cache: true, rateLimit: 1 } })

// Per call, whatever the method:
await syncFlow({ body: flow }, { grab: { retryAttempts: 3 } })
```

## Inspecting requests — Ctrl+Alt+I

In a browser, creating a client attaches grab's request inspector: **Ctrl+Alt+I**
opens a modal listing every request the SDK made, with its parsed response.

grab keeps that log on the global `window.grab` rather than on the instance the
SDK holds, so the client publishes its grab there when nothing else has —
without that the shortcut opens onto a log the SDK never wrote to. An app that
imports grab itself keeps its own global, and its log, untouched, and the
shortcut is bound once per page however many clients are created.

It does nothing outside a browser, and `devtools: false` turns it off:

```ts
const client = createClient({ devtools: false })
```

## Regenerating types

Request/response types live in `src/generated/` and are regenerated from
`debate-openapi.yml` — they are not committed. `src/client.ts` (the grab-url
transport) and `src/sdk.ts` (the operation functions) are hand-written on top
of those types and are not touched by codegen.

```bash
npm run generate   # re-run @hey-api/openapi-ts against debate-openapi.yml
npm run build       # generate + compile to dist/
```

This package pins TypeScript 5 while the rest of the monorepo is on 7.
TypeScript 7 ships the native compiler and no longer exposes the JavaScript
compiler API (`ts.SyntaxKind` and friends), which `@hey-api/openapi-ts` builds
its output with — under TS 7 codegen dies with
`Cannot read properties of undefined (reading 'AnyKeyword')`. Bun resolves
Hey API's `typescript` peer from this package, so the pin keeps codegen (and
therefore `typecheck`, which runs `generate` first) working. Drop it once
Hey API supports TypeScript 7.

## Release

Publishing to npm is automated by
[`.github/workflows/npm-release.yml`](../../.github/workflows/npm-release.yml):
push a `debate-api-client@x.y.z` tag (matching this package's `version`) and
CI builds, tests, and publishes it. This is the only package in the monorepo
published to npm — every other workspace package stays `"private": true`.

## Tests

```bash
bun run test        # or: npx vitest run
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **29.70%** (tracked
under the `debate-api-client` flag).
