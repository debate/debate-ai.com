import { afterEach, describe, expect, it, vi } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { buildAllowedHosts, buildTrustedOrigins } from "../hosts";
import { OAUTH_STATE_COOKIE_MAX_AGE_SECONDS, SIGN_IN_ERROR_URL } from "../oauth-state";

/**
 * The bug this guards against: "Something went wrong — CODE: state_mismatch".
 *
 * better-auth checks the OAuth `state` twice when a provider redirects back —
 * against a row in the database and against a signed cookie — and reports
 * either one missing as `state_mismatch`, a CSRF failure. Two things about
 * this deployment used to make that the *expected* outcome of a slow sign-in:
 * the cookie expired at five minutes while the row it is checked against lives
 * for ten, and the failure was rendered by better-auth's own built-in error
 * page, which is a dead end with no way back to signing in.
 *
 * Built from the same config `lib/auth/index.ts` passes, with an in-memory
 * database so no D1 binding is needed.
 */
function testAuth() {
  return betterAuth({
    baseURL: { allowedHosts: buildAllowedHosts(), fallback: "https://debate-ai.com" },
    trustedOrigins: buildTrustedOrigins(),
    secret: "test-secret-value-for-oauth-state-only",
    onAPIError: { errorURL: SIGN_IN_ERROR_URL },
    advanced: {
      disableOriginCheck: false,
      trustedProxyHeaders: false,
      cookies: { state: { attributes: { maxAge: OAUTH_STATE_COOKIE_MAX_AGE_SECONDS } } },
    },
    database: memoryAdapter({}),
    socialProviders: {
      google: { clientId: "test-client-id", clientSecret: "test-client-secret" },
    },
  });
}

type Auth = ReturnType<typeof testAuth>;

/** Click "Continue with Google": returns the cookies set and the state issued. */
async function startSignIn(auth: Auth) {
  const response = await auth.handler(
    new Request("https://debate-ai.com/api/auth/sign-in/social", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: "https://debate-ai.com",
        // The origin check only runs for requests carrying cookies, which
        // every real browser sign-in does.
        cookie: "visited=1",
      },
      body: JSON.stringify({ provider: "google", callbackURL: "/" }),
    }),
  );

  const setCookies = response.headers.getSetCookie();
  const body = (await response.json()) as { url: string };
  return {
    setCookies,
    state: new URL(body.url).searchParams.get("state") ?? "",
    /** What the browser sends back on the callback navigation. */
    cookieHeader: setCookies.map((cookie) => cookie.split(";")[0]).join("; "),
  };
}

/** Google handing the browser back to us. */
function finishSignIn(auth: Auth, state: string, cookieHeader: string) {
  return auth.handler(
    new Request(
      `https://debate-ai.com/api/auth/callback/google?state=${encodeURIComponent(state)}&code=test-code`,
      { headers: cookieHeader ? { cookie: cookieHeader } : {} },
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the OAuth state cookie", () => {
  it("outlives the state row it is checked against", async () => {
    const { setCookies } = await startSignIn(testAuth());

    const stateCookie = setCookies.find((cookie) => cookie.includes("better-auth.state="));
    expect(stateCookie).toBeDefined();
    // better-auth gives the state row ten minutes; anything shorter here turns
    // a slow-but-valid sign-in into a CSRF failure.
    expect(stateCookie).toContain(`Max-Age=${OAUTH_STATE_COOKIE_MAX_AGE_SECONDS}`);
    expect(OAUTH_STATE_COOKIE_MAX_AGE_SECONDS).toBeGreaterThanOrEqual(600);
  });

  it("carries a sign-in through the callback when the browser returns it", async () => {
    // The state check is what this asserts, so the token exchange that follows
    // it is stubbed out rather than reaching accounts.google.com: getting as
    // far as `invalid_code` means the state was accepted.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "invalid_grant" }), { status: 400 })),
    );

    const auth = testAuth();
    const { state, cookieHeader } = await startSignIn(auth);
    const response = await finishSignIn(auth, state, cookieHeader);

    expect(response.headers.get("location")).not.toContain("state_mismatch");
  });
});

describe("a sign-in that fails on the way back", () => {
  it("lands on the app's login page, not better-auth's error page", async () => {
    const auth = testAuth();
    const { state } = await startSignIn(auth);

    // The state cookie never came back — a jar cleared mid-flow, an embedded
    // webview, a callback opened a second time.
    const response = await finishSignIn(auth, state, "");

    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location).toBe(`${SIGN_IN_ERROR_URL}?error=state_mismatch`);
    expect(location).not.toContain("/api/auth/error");
  });
});
