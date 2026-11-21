import type { BetterAuthPlugin } from "better-auth";
import { createAuthMiddleware } from "better-auth/api";
import { parseCookies } from "better-auth/cookies";
import { multiSession } from "better-auth/plugins";

/**
 * How many accounts one browser can be signed in to at once. The account
 * menu's "Add another account" is hidden at this limit; past it better-auth
 * still signs the new account in but leaves it out of the switcher.
 */
export const MAXIMUM_SESSIONS = 5;

/** better-auth's marker for a per-account session cookie (`<session cookie>_multi-<token>`). */
const isMultiSessionCookie = (name: string) => name.includes("_multi-");

/**
 * Registers the current session in the switcher if it isn't already.
 *
 * multiSession only records a session in its `_multi-` cookie when the session
 * is created, so everyone signed in before the plugin shipped has a session
 * the switcher has never seen: signing in to a second account would replace
 * it, and the first account would vanish from the list instead of staying one
 * click away. Every page load asks `GET /get-session`, so after it answers
 * with a session whose cookie is missing, this sets that cookie, signed the
 * same way multiSession signs its own. Nothing is read from D1: the answer is
 * already in hand (often from the cookie cache).
 */
function adoptExistingSession(maximumSessions: number): BetterAuthPlugin {
  return {
    id: "multi-session-adopt",
    hooks: {
      after: [
        {
          matcher: (context) => context.path === "/get-session",
          handler: createAuthMiddleware(async (ctx) => {
            const returned = ctx.context.returned as { session?: { token?: unknown } } | null | undefined;
            const token = returned?.session?.token;
            if (typeof token !== "string" || !token) return;

            const sessionCookie = ctx.context.authCookies.sessionToken;
            const cookieName = `${sessionCookie.name}_multi-${token.toLowerCase()}`;
            const cookies = parseCookies(ctx.headers?.get("cookie") || "");
            if (cookies.has(cookieName)) return;
            const tracked = [...cookies.keys()].filter(isMultiSessionCookie).length;
            if (tracked >= maximumSessions) return;

            await ctx.setSignedCookie(cookieName, token, ctx.context.secret, sessionCookie.attributes);
          }),
        },
      ],
    },
  };
}

/**
 * Lets one browser stay signed in to several accounts and switch between them
 * from the account menu (packages/debate-webview's `AccountSwitcherSubmenu`).
 * Each signed-in account keeps its own session row and `_multi-` cookie; the
 * ordinary session cookie points at whichever one is active. "Sign out" in the
 * menu ends every account on the browser (multiSession's `/sign-out` hook);
 * `multiSession.revoke` ends one and makes the next one active.
 */
export function multiSessionPlugins(maximumSessions = MAXIMUM_SESSIONS): BetterAuthPlugin[] {
  return [multiSession({ maximumSessions }), adoptExistingSession(maximumSessions)];
}
