# Proxying the YouTube transcript fetcher

Transcripts come from `apps/debate-ai.com/lib/youtube/transcript.ts`, which
asks YouTube's InnerTube `player` endpoint for a video's caption tracks and
then downloads one. YouTube bot-checks server IPs at random and rate-limits
them in bursts: when it does, the fetcher gets `LOGIN_REQUIRED` / "Sign in to
confirm you're not a bot" and `/api/transcript` answers 503. Routing those
requests through a proxy is how the app gets a clean IP.

## What's already in front of YouTube

Three layers sit ahead of the fetcher, and a proxy is only worth adding once
they're doing their job:

1. **Edge cache** — `caches.default`, keyed on the request URL.
2. **`video_transcripts` table** — every transcript ever fetched, keyed by
   video id and language. Captions don't change, so rows never expire; a video
   fetched once is never fetched again. See `lib/youtube/transcript-cache.ts`.
3. **The fetcher**, which retries once when the failure looks like a bot check.

Only a cold video — one nobody has opened since the table was populated —
reaches YouTube at all, so the proxy is billed for first views only.

## Configuring the proxy

The fetcher reads a single setting, `YOUTUBE_PROXY_URL`. Unset (the default),
it fetches YouTube directly. Set, every InnerTube call and caption download
goes through it.

It is a **URL template**, not a `http://user:pass@host:port` proxy address:

```
https://proxy.example.com/fetch?api_key=YOUR_KEY&url={url}
```

`{url}` is replaced with the URL-encoded target. A template without the
placeholder gets `&url=<encoded target>` appended, which is the shape most
scraping APIs use anyway.

Set it as a Worker secret for production, and in the app's `.env` for local
dev:

```bash
cd apps/debate-ai.com
wrangler secret put YOUTUBE_PROXY_URL   # paste the template when prompted
```

`wrangler.jsonc` sets `keep_vars`, so a secret survives deploys. The fetcher
reads the Worker binding first and falls back to `process.env` — that's what
makes it work under `bun run dev` and in scripts.

To turn the proxy off again, delete the secret
(`wrangler secret delete YOUTUBE_PROXY_URL`) and redeploy.

## Why not a normal HTTP proxy

The usual Node answer is an agent — `https-proxy-agent`, `HTTP_PROXY`, an
`undici` `ProxyAgent`. None of those exist on Cloudflare Workers: there is no
socket layer, and `fetch` has no `agent` option, so a `http://user:pass@host`
proxy URL has nothing to attach to. (The `extract-youtube` package's
`proxyConfig` is agent-based for exactly this reason and is a no-op here — see
its [`docs/proxy.md`](https://github.com/OpenSourceAGI/qwksearch-research-agent/blob/master/packages/extract-youtube/docs/proxy.md).)

What works on Workers is a **fetch-through** proxy: an HTTP endpoint that
takes the target URL, fetches it from its own IP, and returns the response.
Commercial ones (Bright Data, ScrapingBee, ScraperAPI, Oxylabs) all expose
this shape. Whichever you use, it must:

- **Forward the method and body.** The InnerTube calls are `POST`s with a JSON
  body. A proxy that only does GETs will fail every lookup.
- **Return the response body verbatim.** Caption payloads are JSON (`fmt=json3`)
  or srv3 XML. A proxy that renders pages, injects HTML, or wraps the body in
  its own JSON envelope breaks parsing.
- **Pass through `User-Agent`.** The fetcher identifies as the iOS and Android
  YouTube clients; a proxy that overwrites this gets desktop-client behaviour
  back, which needs a PO token and answers `UNPLAYABLE`.
- **Use residential IPs, ideally rotating.** Datacenter IPs get bot-checked
  about as fast as the Worker's own.

## Rolling your own

A fetch-through proxy is a small Worker on a different account, or anything
that can make an outbound request from an IP YouTube likes:

```javascript
export default {
  async fetch(request, env) {
    const params = new URL(request.url).searchParams;
    if (params.get("key") !== env.PROXY_KEY) {
      return new Response("Forbidden", { status: 403 });
    }

    const target = params.get("url");
    if (!target || !new URL(target).hostname.endsWith(".youtube.com")) {
      return new Response("Bad target", { status: 400 });
    }

    return fetch(target, {
      method: request.method,
      headers: request.headers,
      body: request.method === "POST" ? await request.text() : undefined,
    });
  },
};
```

Both guards matter: the host allowlist keeps it from becoming an open proxy
for anything on the internet, and the shared key keeps it from being used by
whoever finds the URL. The key rides in the query string because the fetcher
sends no custom headers — the template is the only place to put it:
`YOUTUBE_PROXY_URL=https://proxy.example.com/?key=…&url={url}`.

Another Cloudflare Worker will not help if the Worker's own IPs are what
YouTube is blocking — Cloudflare egress looks much the same from Google's
side. Put the proxy on a different provider (or a residential proxy service)
for it to change anything.

## Verifying it

1. Pick a video that isn't in `video_transcripts` yet (or delete its row:
   `wrangler d1 execute debate-ai-db --remote --command "DELETE FROM video_transcripts WHERE video_id = '<id>'"`).
2. Open it in the app and watch `wrangler tail`. A cold fetch that succeeds
   logs nothing; a failure logs `Failed to fetch transcript for <id>`.
3. Confirm the row landed:
   `wrangler d1 execute debate-ai-db --remote --command "SELECT video_id, fetched_at FROM video_transcripts WHERE video_id = '<id>'"`.

If requests still fail with the proxy configured, check the proxy endpoint
itself with `curl` first — POST a body through it to the InnerTube URL and see
whether the JSON comes back intact. Most failures are the proxy dropping the
method, the body, or the `User-Agent`.
