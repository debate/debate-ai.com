# Auth across several domains

The app is served from more than one host. `ebate.app` is the short-domain
rebrand the production deployment now answers on, `debate-ai.com` may still
resolve, preview builds land on `*.workers.dev` / `*.vercel.app`, and dev runs
on `localhost:3000`.

better-auth pins its base URL to a single origin unless told otherwise, and its
CSRF middleware rejects any state-changing request whose `Origin` is not
trusted — with a `403` and `Invalid origin`, *before* the sign-in handler runs.
That produced exactly this in the browser console on the short domain:

```
api/auth/sign-in/social: Failed to load resource: 403
[auth] google sign-in failed: Error: Invalid origin
```

and, since `/admin` needs a session, no way to reach the admin dashboard.

## What is wired up

`apps/debate-ai.com/lib/auth/hosts.ts` holds the host allowlist, and
`lib/auth/index.ts` hands it to better-auth as a dynamic `baseURL`:

```ts
baseURL: { allowedHosts, fallback: configuredBaseURL || APP_ORIGIN }
```

With that, better-auth resolves the base URL per request from the request's own
host instead of once per Worker isolate. Three consequences worth knowing:

- The origin check accepts a sign-in from every host in the list.
- The OAuth `redirect_uri`, the session cookie and magic-link URLs are built
  for the host the visitor is actually on, so a sign-in started on `ebate.app`
  finishes there rather than dropping them back signed out.
- A host that is *not* in the list falls back to the canonical origin, and the
  origin check then rejects it — which is the intended answer. The allowlist is
  the point: resolving the base URL from an unchecked `Host` header would let a
  spoofed request mint magic links pointing at someone else's domain.

`advanced.trustedProxyHeaders` is turned off alongside it. better-auth prefers
`x-forwarded-host` over the real `Host` whenever proxy headers are trusted, and
it trusts them by default in this mode — but nothing sits in front of this
Worker to set that header, so it would be attacker-supplied, and a request
routed to `ebate.app` could have its callback (and the magic link we email)
built for someone else's domain. Cloudflare routes on `Host`, so taking the
host from the request itself is both correct here and forgeable only by someone
who already controls a routed hostname.

Leaving `baseURL` unset is not equivalent. better-auth then derives it from the
first request an isolate happens to serve and caches it on the shared instance,
so which domain works becomes a race.

## Adding a domain

Set `BETTER_AUTH_ALLOWED_HOSTS` (comma-separated; hosts, origins or wildcard
patterns such as `*.preview.example` all work) as a plain Variable on the
Worker, or add it to `DEFAULT_ALLOWED_HOSTS` when it is permanent.
`BETTER_AUTH_TRUSTED_ORIGINS` still works for anything that is an origin rather
than a host.

**The provider consoles need the new domain too — the code cannot do this
part.** For every host that visitors sign in from, add to the Google Cloud
console OAuth client:

- Authorized JavaScript origins: `https://<host>` — Google One Tap fails
  without it, and the failure surfaces as
  `[GSI_LOGGER]: FedCM get() rejects with NetworkError: Error retrieving a
  token`. Chrome no longer honours `use_fedcm_for_prompt: false`, so One Tap
  goes through FedCM and an unregistered origin cannot be issued a token.
- Authorized redirect URIs: `https://<host>/api/auth/callback/google`.

Discord and LinkedIn need their redirect URIs registered the same way.

## Tests

`lib/auth/__tests__/origin-check.test.ts` drives the real better-auth handler:
a sign-in POST from each of our hosts succeeds and comes back with a
`redirect_uri` on that same host, a request from an unknown origin is still
rejected, a spoofed `x-forwarded-host` is ignored, and the old single-`baseURL`
config is kept around as a live reproduction of the 403.

Note that better-auth disables the origin check by default under
`NODE_ENV=test`, so those tests pass `advanced: { disableOriginCheck: false }`
— without it they assert nothing.

## See also

[When a sign-in fails on the way back](./sign-in-failures.md) — the
`state_mismatch` error, which happens *after* the origin check has passed and
the provider has sent the visitor back.
