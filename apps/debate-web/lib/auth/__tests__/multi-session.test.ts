import { describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { magicLink } from "better-auth/plugins";
import { buildAllowedHosts } from "../hosts";
import { multiSessionPlugins } from "../multi-session";

const ORIGIN = "https://www.debate-ai.com";

/** A real better-auth with magic links, on an in-memory database, with or without multi-session. */
function buildTestAuth({
  multi = true,
  cookieCache = false,
  db = { user: [], session: [], account: [], verification: [] } as Record<string, Record<string, unknown>[]>,
  links = [] as string[],
} = {}) {
  const auth = betterAuth({
    baseURL: { allowedHosts: buildAllowedHosts(), fallback: "https://debate-ai.com" },
    secret: "test-secret-value-for-multi-session-only",
    database: memoryAdapter(db),
    advanced: { trustedProxyHeaders: false },
    session: { cookieCache: { enabled: cookieCache, maxAge: 300 } },
    plugins: [
      magicLink({
        sendMagicLink: async ({ url }) => {
          links.push(url);
        },
      }),
      ...(multi ? multiSessionPlugins(3) : []),
    ],
  });
  return { auth, db, links };
}

type TestAuth = ReturnType<typeof buildTestAuth>;

/** A cookie jar: applies a response's Set-Cookie lines the way a browser would. */
class Jar {
  private cookies = new Map<string, string>();
  apply(res: Response) {
    for (const line of res.headers.getSetCookie?.() ?? []) {
      const [pair] = line.split(";");
      const eq = pair!.indexOf("=");
      const name = pair!.slice(0, eq);
      if (/Max-Age=0/i.test(line)) this.cookies.delete(name);
      else this.cookies.set(name, pair!.slice(eq + 1));
    }
    return res;
  }
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  names() {
    return [...this.cookies.keys()];
  }
}

async function call(t: TestAuth, jar: Jar, path: string, body?: unknown) {
  const res = await t.auth.handler(
    new Request(`${ORIGIN}/api/auth${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { "content-type": "application/json", origin: ORIGIN, cookie: jar.header() },
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
  );
  return jar.apply(res);
}

async function signIn(t: TestAuth, jar: Jar, email: string) {
  await call(t, jar, "/sign-in/magic-link", { email, callbackURL: "/" });
  const res = await t.auth.handler(new Request(t.links.at(-1)!, { headers: { origin: ORIGIN, cookie: jar.header() } }));
  expect(res.status).toBe(302);
  jar.apply(res);
}

async function currentEmail(t: TestAuth, jar: Jar) {
  const res = await call(t, jar, "/get-session");
  const data = (await res.json()) as { user?: { email: string } } | null;
  return data?.user?.email ?? null;
}

async function deviceSessions(t: TestAuth, jar: Jar) {
  const res = await call(t, jar, "/multi-session/list-device-sessions");
  return (await res.json()) as { session: { token: string }; user: { email: string } }[];
}

describe("multi-session account switching", () => {
  it("keeps both accounts signed in and switches between them", async () => {
    const t = buildTestAuth();
    const jar = new Jar();
    await signIn(t, jar, "a@example.com");
    await signIn(t, jar, "b@example.com");

    expect(await currentEmail(t, jar)).toBe("b@example.com");
    const sessions = await deviceSessions(t, jar);
    expect(sessions.map((s) => s.user.email).sort()).toEqual(["a@example.com", "b@example.com"]);

    const a = sessions.find((s) => s.user.email === "a@example.com")!;
    const switched = await call(t, jar, "/multi-session/set-active", { sessionToken: a.session.token });
    expect(switched.status).toBe(200);
    expect(await currentEmail(t, jar)).toBe("a@example.com");
  });

  it("signing out of the active account makes another one active", async () => {
    const t = buildTestAuth();
    const jar = new Jar();
    await signIn(t, jar, "a@example.com");
    await signIn(t, jar, "b@example.com");
    const b = (await deviceSessions(t, jar)).find((s) => s.user.email === "b@example.com")!;

    const res = await call(t, jar, "/multi-session/revoke", { sessionToken: b.session.token });
    expect(res.status).toBe(200);
    expect(await currentEmail(t, jar)).toBe("a@example.com");
    expect((await deviceSessions(t, jar)).map((s) => s.user.email)).toEqual(["a@example.com"]);
  });

  it("sign out ends every account on the browser", async () => {
    const t = buildTestAuth();
    const jar = new Jar();
    await signIn(t, jar, "a@example.com");
    await signIn(t, jar, "b@example.com");

    await call(t, jar, "/sign-out", {});
    expect(await currentEmail(t, jar)).toBeNull();
    expect(t.db.session).toHaveLength(0);
  });

  it.each([false, true])(
    "adopts a session signed in before the plugin shipped (cookie cache %s)",
    async (cookieCache) => {
      // Sign in on an instance without the plugin, so there is no `_multi-` cookie.
      const before = buildTestAuth({ multi: false, cookieCache });
      const jar = new Jar();
      await signIn(before, jar, "old@example.com");
      expect(jar.names().some((n) => n.includes("_multi-"))).toBe(false);

      // Same database and secret, now with the plugin: the first session lookup adopts it.
      const t = buildTestAuth({ cookieCache, db: before.db, links: before.links });

      expect(await currentEmail(t, jar)).toBe("old@example.com");
      expect(jar.names().some((n) => n.includes("_multi-"))).toBe(true);

      await signIn(t, jar, "new@example.com");
      const emails = (await deviceSessions(t, jar)).map((s) => s.user.email).sort();
      expect(emails).toEqual(["new@example.com", "old@example.com"]);
    },
  );

  it("stops adding accounts at the limit", async () => {
    const t = buildTestAuth();
    const jar = new Jar();
    for (const email of ["1@x.com", "2@x.com", "3@x.com", "4@x.com"]) await signIn(t, jar, email);
    expect(jar.names().filter((n) => n.includes("_multi-"))).toHaveLength(3);
  });
});

