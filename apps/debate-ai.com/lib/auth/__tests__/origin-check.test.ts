import { describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { buildAllowedHosts, buildTrustedOrigins } from "../hosts";

/**
 * The bug this guards against: better-auth rejects a state-changing request
 * whose `Origin` is not trusted with a 403 "Invalid origin" before the
 * sign-in handler ever runs. With `baseURL` pinned to a single string (or left
 * unset, in which case better-auth latches onto whichever host happened to
 * warm the Worker isolate first) that is every request arriving on any other
 * domain this app is served from — which is how Google sign-in, and so
 * /admin, broke on ebate.app.
 *
 * Built from the same host/origin config `lib/auth/index.ts` passes, but with
 * an in-memory database so no D1 binding is needed.
 */
function authWith(baseURL: Parameters<typeof betterAuth>[0]["baseURL"]) {
  return betterAuth({
    baseURL,
    trustedOrigins: buildTrustedOrigins(),
    secret: "test-secret-value-for-origin-check-only",
    // better-auth turns the origin check off by default under NODE_ENV=test,
    // which is exactly the behaviour these tests exist to exercise.
    advanced: { disableOriginCheck: false, trustedProxyHeaders: false },
    database: memoryAdapter({}),
    socialProviders: {
      google: { clientId: "test-client-id", clientSecret: "test-client-secret" },
    },
  });
}

/** The request the "Continue with Google" button makes, from `host`. */
function signInFrom(auth: ReturnType<typeof authWith>, host: string) {
  return auth.handler(
    new Request(`https://${host}/api/auth/sign-in/social`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        origin: `https://${host}`,
        // The origin check only runs for requests carrying cookies, which
        // every real browser sign-in does.
        cookie: "better-auth.state=test",
      },
      body: JSON.stringify({ provider: "google", callbackURL: "/admin" }),
    }),
  );
}

const dynamicAuth = authWith({
  allowedHosts: buildAllowedHosts(),
  fallback: "https://debate-ai.com",
});

describe("sign-in origin check", () => {
  it.each([
    "debate-ai.com",
    "ebate.app",
    "www.debate-ai.com",
    // Preview deployments, which the previous `trustedOrigins` list covered
    // with the same wildcards and which must keep working.
    "debate-ai-dev.example.workers.dev",
    "debate-ai-git-branch.vercel.app",
  ])(
    "accepts a sign-in served from %s",
    async (host) => {
      const response = await signInFrom(dynamicAuth, host);
      expect(response.status).not.toBe(403);
      expect(response.ok).toBe(true);
    },
  );

  it("sends the visitor back to the domain they started on", async () => {
    const response = await signInFrom(dynamicAuth, "ebate.app");
    const { url } = (await response.json()) as { url: string };
    // The OAuth callback (and so the host the session cookie is set on) has to
    // stay on ebate.app, or the visitor lands back there still signed out.
    expect(new URL(url).searchParams.get("redirect_uri")).toBe(
      "https://ebate.app/api/auth/callback/google",
    );
  });

  it("still rejects an origin this app is not served from", async () => {
    const response = await signInFrom(dynamicAuth, "evil.example");
    expect(response.status).toBe(403);
  });

  it("rejects a cross-site origin even when the host is one of ours", async () => {
    const response = await dynamicAuth.handler(
      new Request("https://ebate.app/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://evil.example",
          cookie: "better-auth.state=test",
        },
        body: JSON.stringify({ provider: "google", callbackURL: "/admin" }),
      }),
    );
    expect(response.status).toBe(403);
  });

  it("ignores a spoofed x-forwarded-host", async () => {
    // Nothing proxies this Worker, so the header is attacker-supplied. Honouring
    // it would let a request routed to ebate.app build its callback — and the
    // magic link we email — for someone else's domain.
    const response = await dynamicAuth.handler(
      new Request("https://ebate.app/api/auth/sign-in/social", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://ebate.app",
          "x-forwarded-host": "attacker.workers.dev",
          cookie: "better-auth.state=test",
        },
        body: JSON.stringify({ provider: "google", callbackURL: "/admin" }),
      }),
    );
    const { url } = (await response.json()) as { url: string };
    expect(new URL(url).searchParams.get("redirect_uri")).toBe(
      "https://ebate.app/api/auth/callback/google",
    );
  });

  it("reproduces the failure a single pinned baseURL produced", async () => {
    const pinned = authWith("https://debate-ai.com");
    expect((await signInFrom(pinned, "debate-ai.com")).ok).toBe(true);
    expect((await signInFrom(pinned, "ebate.app")).status).toBe(403);
  });
});
