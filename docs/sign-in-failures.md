# When a sign-in fails on the way back — `state_mismatch`

Google (or Discord, or LinkedIn) sends the browser back to
`/api/auth/callback/<provider>` with a `state` parameter. better-auth checks
that state twice before it will trust the callback:

1. against a **row in the `verification` table** written when the sign-in
   started, which it gives **ten minutes**, and
2. against a **signed `state` cookie** set on the same response, which it gives
   **five minutes** by default.

Either one missing is reported the same way — `state_mismatch`, a CSRF failure
— and, left to itself, better-auth renders it on its own built-in page at
`/api/auth/error`: a dead end that shows the raw code and offers nothing but
"Go Home".

```
ERROR
Something went wrong
CODE: state_mismatch
```

## What this deployment does about it

**The row is always read from the primary.** `debate-ai-db` runs read
replication (`auto`) with its primary in WNAM. The sign-in writes the state row
on one request and the provider's callback reads it back on the next, so a
callback answered by a replica that has not caught up finds nothing. The
bookmark that normally carries consistency between two requests travels as a
cookie, and the callback is a cross-site navigation, so it cannot be relied on
here. `/api/auth/*` therefore always opens its D1 session on the primary — see
[D1 read replication](./d1-read-replication.md#why-auth-ignores-the-bookmark).

**The cookie outlives the row it is checked against.** The five-minute default
is shorter than the state's own ten-minute lifetime, so a sign-in that took
between five and ten minutes — a new Google account, a password manager,
two-factor, a consent screen actually read — arrived with the state still valid
and the cookie already gone. `OAUTH_STATE_COOKIE_MAX_AGE_SECONDS` in
`apps/debate-ai.com/lib/auth/oauth-state.ts` raises the cookie to match. It
does not widen how long a state is accepted; the row still expires at ten
minutes.

**Failures land back on `/login`.** `onAPIError.errorURL` sends every OAuth
callback failure to the app's own sign-in page instead of better-auth's error
page. The page reads the `error` query parameter and says what happened in
words (`lib/auth/sign-in-errors.ts`), with the sign-in buttons right there —
which matters because most of these codes mean "start over", and starting over
works.

## Still worth checking first

`state_mismatch` is not the only reason a sign-in can fail on the callback, and
two things the code cannot fix:

- The provider console must list `https://<host>/api/auth/callback/<provider>`
  for every host visitors sign in from. See
  [Auth across several domains](./auth-domains.md#adding-a-domain).
- `BETTER_AUTH_SECRET` must not change between the sign-in and the callback:
  the cookie is signed with it, and a rotated secret invalidates every sign-in
  in flight.

Workers Logs carry the distinguishing line, which the error code does not:
`State mismatch: verification not found` is the row, `State mismatch: State not
persisted correctly` is the cookie.

## Tests

`apps/debate-ai.com/lib/auth/__tests__/oauth-state.test.ts` drives the real
better-auth handler: the state cookie is issued with the longer lifetime, a
callback carrying the cookie gets past the state check, and a callback without
it lands on `/login?error=state_mismatch` rather than `/api/auth/error`.
`lib/database/__tests__/d1-session.test.ts` covers the primary pinning.
