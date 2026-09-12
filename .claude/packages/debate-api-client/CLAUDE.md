# CLAUDE.md — `debate-api-client`

**The only published package in this repo.** A typed SDK for the
[Debate AI API](https://debate-ai.com/api/api-docs), **generated** from
`apps/debate-ai.com/public/debate-openapi.yml` with Hey API.

## Two things that make this package unusual

1. **It never throws on an HTTP error.** Every operation resolves to
   `{ data?, error? }`. A `try/catch` around a call is dead code, and code that
   waits for a rejected promise on a 4xx will treat a failure as success. Check
   `error` first, always.
2. **Calls run through [`grab-url`](https://grab.js.org), not fetch or axios** —
   so every operation gets caching, retries, rate limiting and request dedupe
   for free. Do not swap in a bare `fetch` to "simplify" a call; you lose all
   four silently.

## Do not hand-edit the generated SDK

One function per `operationId`, generated. To change the client:

1. Change the route in `apps/debate-ai.com/app/api/…`.
2. Update `apps/debate-ai.com/public/debate-openapi.yml`.
3. Regenerate, and commit the result with the same change.

Hand-written helpers go in a separate file, never inside the generated ones.

## Build and tests

This is the one package with a **build step** (`main: ./dist/index.js`) because
it publishes. Rebuild after editing. Tests live in `test/`.

Publishing is manual: the `npm-release.yml` workflow, run by hand with a
dist-tag input.
