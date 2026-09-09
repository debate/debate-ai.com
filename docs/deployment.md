# Deployment

Production is a Cloudflare Worker (`debate-ai-com`) deployed by **Workers Builds**,
which watches this repo and runs, from `apps/debate-ai.com`:

| Step   | Command                          |
| ------ | -------------------------------- |
| Install | `bun install --frozen-lockfile`  |
| Build   | `bun run build`                  |
| Deploy  | `bun run deploy:upload`          |

Those three commands live in the Cloudflare dashboard (Workers &amp; Pages →
`debate-ai-com` → Settings → Builds), not in this repo, so changing them means
editing them there.

## Why the deploy step is not `wrangler versions upload`

`wrangler versions upload` is what actually runs — `deploy:upload`
([`scripts/deploy-upload.mjs`](../apps/debate-ai.com/scripts/deploy-upload.mjs))
just wraps it in a retry.

Cloudflare's own API intermittently answers the asset-upload handshake with a
5xx from its edge:

```
✘ [ERROR] Received a malformed response from the API
  upstream connect error or disconnect/reset before headers. reset reason: connection termination
  POST /accounts/…/workers/scripts/debate-ai-com/assets-upload-session -> 503 Service Unavailable
```

Nothing is wrong with the build when that happens — the run just dies after
having already spent ~90s compiling. Retrying is safe here because
`versions upload` publishes a new immutable version rather than shifting live
traffic, so a repeated attempt re-uploads the same assets or no-ops on the ones
already stored.

The wrapper retries **only** Cloudflare-side failures (5xx, 429, dropped
sockets, malformed API responses), backing off 5s → 15s → 45s for up to 4
attempts. A real failure — bad `wrangler.jsonc`, a missing binding, an expired
token, an oversized Worker — is not retried and exits immediately with
wrangler's own status code, so genuine breakage still fails fast.

Tune with `DEPLOY_UPLOAD_ATTEMPTS` (default `4`); set it to `1` to disable
retries entirely. Extra arguments pass straight through to wrangler:

```sh
bun run deploy:upload -- --env production
```

## Worker name

`wrangler.jsonc` sets `"name": "debate-ai-com"` to match the Workers Builds
project. If the two ever diverge, CI overrides the config name and warns, while
a manual `wrangler deploy` from a laptop targets a *different* Worker than
production — so keep them identical.

## Promoting a version

`versions upload` uploads without serving. Promote the new version to 100% of
traffic from the dashboard (Deployments → the new version → Deploy), or:

```sh
cd apps/debate-ai.com
npx wrangler versions deploy
```
