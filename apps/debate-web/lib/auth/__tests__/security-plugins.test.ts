import { describe, expect, it } from "vitest";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { magicLink } from "better-auth/plugins";
import { getTableConfig } from "drizzle-orm/sqlite-core";
import { buildAllowedHosts, isAllowedHost } from "../hosts";
import {
  redirectLocation,
  relyingPartyFor,
  securityPlugins,
  TWO_FACTOR_PAGE,
  twoFactorPageURL,
} from "../security-plugins";
import { SECURITY_DDL } from "../ensure-security-tables";
import { passkey, twoFactor, user } from "../../database/schema";

describe("relyingPartyFor", () => {
  it("uses the page's host as the rpID, without www, and keeps the exact origin", () => {
    expect(relyingPartyFor("https://www.debate-ai.com/api/auth/passkey/x")).toEqual({
      rpID: "debate-ai.com",
      origin: "https://www.debate-ai.com",
    });
    expect(relyingPartyFor("https://ebate.app/settings")).toEqual({ rpID: "ebate.app", origin: "https://ebate.app" });
    expect(relyingPartyFor("http://localhost:3000/")).toEqual({ rpID: "localhost", origin: "http://localhost:3000" });
  });
});

describe("isAllowedHost", () => {
  const hosts = buildAllowedHosts();
  it.each(["debate-ai.com", "www.debate-ai.com", "preview.debate-ai.com", "ebate.app", "x.workers.dev", "localhost:3000"])(
    "allows %s",
    (host) => expect(isAllowedHost(host, hosts)).toBe(true),
  );
  it.each(["evil.com", "debate-ai.com.evil.com", "localhost:4000", "notdebate-ai.com"])("rejects %s", (host) =>
    expect(isAllowedHost(host, hosts)).toBe(false),
  );
});

describe("twoFactorPageURL", () => {
  const base = "https://debate-ai.com/api/auth";
  it("carries a same-site destination", () => {
    expect(twoFactorPageURL("https://debate-ai.com/practice?x=1", base)).toBe(
      `${TWO_FACTOR_PAGE}?callbackURL=${encodeURIComponent("/practice?x=1")}`,
    );
    expect(twoFactorPageURL("/settings", base)).toBe(`${TWO_FACTOR_PAGE}?callbackURL=${encodeURIComponent("/settings")}`);
  });
  it("drops another site's destination", () => {
    expect(twoFactorPageURL("https://evil.com/", base)).toBe(`${TWO_FACTOR_PAGE}?callbackURL=%2F`);
    expect(twoFactorPageURL(null, base)).toBe(`${TWO_FACTOR_PAGE}?callbackURL=%2F`);
  });
});

describe("redirectLocation", () => {
  it("reads Location from Headers or a plain record", () => {
    expect(redirectLocation({ headers: new Headers({ location: "/a" }) })).toBe("/a");
    expect(redirectLocation({ headers: { Location: "/b" } })).toBe("/b");
    expect(redirectLocation({ token: "x" })).toBeNull();
    expect(redirectLocation(null)).toBeNull();
  });
});

describe("SECURITY_DDL", () => {
  // ensure-security-tables creates the tables by hand; a column the Drizzle
  // schema names but the DDL lacks fails every insert on a live D1.
  it.each([
    ["passkey", passkey],
    ["two_factor", twoFactor],
  ] as const)("creates every %s column the schema names", (name, table) => {
    const ddl = SECURITY_DDL.find((statement) => statement.startsWith(`CREATE TABLE IF NOT EXISTS "${name}"`));
    expect(ddl).toBeDefined();
    for (const column of getTableConfig(table).columns) expect(ddl).toContain(`"${column.name}"`);
  });

  it("adds user.two_factor_enabled through the schema, with a default ensureTableColumns can add", () => {
    const column = getTableConfig(user).columns.find((c) => c.name === "two_factor_enabled");
    expect(column?.notNull).toBe(false);
    expect(column?.hasDefault).toBe(true);
  });
});

/** A real better-auth with magic links and the security plugins, on an in-memory database. */
function buildTestAuth() {
  const db: Record<string, Record<string, unknown>[]> = {
    user: [],
    session: [],
    account: [],
    verification: [],
    passkey: [],
    twoFactor: [],
  };
  const links: string[] = [];
  const auth = betterAuth({
    baseURL: { allowedHosts: buildAllowedHosts(), fallback: "https://debate-ai.com" },
    secret: "test-secret-value-for-security-plugins-only",
    database: memoryAdapter(db),
    advanced: { trustedProxyHeaders: false },
    plugins: [
      magicLink({
        sendMagicLink: async ({ url }) => {
          links.push(url);
        },
      }),
      ...securityPlugins(relyingPartyFor("https://www.debate-ai.com"), "Debate AI"),
    ],
  });
  return { auth, db, links };
}

const ORIGIN = "https://www.debate-ai.com";

/** Requests a magic link for `email` and returns the emailed verify URL with `callbackURL`. */
async function magicLinkFor(t: ReturnType<typeof buildTestAuth>, email: string, callbackURL = "/practice") {
  const res = await t.auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-in/magic-link`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, callbackURL }),
    }),
  );
  expect(res.status).toBe(200);
  return t.links.at(-1)!;
}

function setCookies(res: Response): string[] {
  return res.headers.getSetCookie?.() ?? [];
}

describe("passwordless two-factor gate", () => {
  it("lets a magic-link sign-in through when 2FA is off", async () => {
    const t = buildTestAuth();
    const link = await magicLinkFor(t, "off@example.com");
    const res = await t.auth.handler(new Request(link, { headers: { origin: ORIGIN } }));
    expect(res.status).toBe(302);
    expect(new URL(res.headers.get("location")!, ORIGIN).pathname).toBe("/practice");
    expect(t.db.session).toHaveLength(1);
  });

  it("sends a magic-link sign-in to the code page and drops its session when 2FA is on", async () => {
    const t = buildTestAuth();
    // First sign-in creates the account; then turn 2FA on for it.
    const first = await magicLinkFor(t, "on@example.com");
    await t.auth.handler(new Request(first, { headers: { origin: ORIGIN } }));
    t.db.user[0]!.twoFactorEnabled = true;
    t.db.session.length = 0;

    const link = await magicLinkFor(t, "on@example.com", "/practice?tab=2");
    const res = await t.auth.handler(new Request(link, { headers: { origin: ORIGIN } }));
    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(`${TWO_FACTOR_PAGE}?callbackURL=${encodeURIComponent("/practice?tab=2")}`);
    expect(t.db.session).toHaveLength(0);
    const cookies = setCookies(res);
    expect(cookies.some((c) => /two_factor=/.test(c) && !/Max-Age=0/.test(c))).toBe(true);
    // The session cookie set by the magic link is expired again.
    expect(cookies.filter((c) => /session_token=/.test(c)).at(-1)).toMatch(/Max-Age=0/);
  });
});

describe("passkey relying party", () => {
  it("offers registration for the configured host, not localhost", async () => {
    const t = buildTestAuth();
    const link = await magicLinkFor(t, "pk@example.com");
    const signIn = await t.auth.handler(new Request(link, { headers: { origin: ORIGIN } }));
    const cookie = setCookies(signIn)
      .map((c) => c.split(";")[0])
      .join("; ");

    const res = await t.auth.handler(
      new Request(`${ORIGIN}/api/auth/passkey/generate-register-options`, { headers: { cookie, origin: ORIGIN } }),
    );
    expect(res.status).toBe(200);
    const options = (await res.json()) as { rp: { id: string; name: string } };
    expect(options.rp).toEqual({ id: "debate-ai.com", name: "Debate AI" });
  });
});

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s) for a base32 secret — what an authenticator app shows. */
async function totp(base32: string, at = Date.now()): Promise<string> {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const char of base32.replace(/=+$/, "").toUpperCase()) bits += alphabet.indexOf(char).toString(2).padStart(5, "0");
  const bytes = new Uint8Array(Math.floor(bits.length / 8));
  for (let i = 0; i < bytes.length; i++) bytes[i] = parseInt(bits.slice(i * 8, i * 8 + 8), 2);
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(Math.floor(at / 1000 / 30)));
  const key = await crypto.subtle.importKey("raw", bytes, { name: "HMAC", hash: "SHA-1" }, false, ["sign"]);
  const mac = new Uint8Array(await crypto.subtle.sign("HMAC", key, counter));
  const offset = mac[mac.length - 1]! & 0xf;
  const value = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(value % 1_000_000).padStart(6, "0");
}

const cookieHeader = (res: Response) =>
  setCookies(res)
    .filter((c) => !/Max-Age=0/.test(c))
    .map((c) => c.split(";")[0])
    .join("; ");

describe("two-factor round trip", () => {
  it("turns 2FA on from settings, then finishes a later magic-link sign-in with a TOTP code", async () => {
    const t = buildTestAuth();
    const json = { "content-type": "application/json", origin: ORIGIN };

    // Signed in, no password: enable → scan → verify.
    const signIn = await t.auth.handler(new Request(await magicLinkFor(t, "rt@example.com"), { headers: { origin: ORIGIN } }));
    const session = cookieHeader(signIn);
    const enable = await t.auth.handler(
      new Request(`${ORIGIN}/api/auth/two-factor/enable`, { method: "POST", headers: { ...json, cookie: session }, body: "{}" }),
    );
    expect(enable.status).toBe(200);
    const { totpURI, backupCodes } = (await enable.json()) as { totpURI: string; backupCodes: string[] };
    expect(backupCodes.length).toBeGreaterThan(0);
    const secret = new URL(totpURI).searchParams.get("secret")!;
    const verifySetup = await t.auth.handler(
      new Request(`${ORIGIN}/api/auth/two-factor/verify-totp`, {
        method: "POST",
        headers: { ...json, cookie: session },
        body: JSON.stringify({ code: await totp(secret) }),
      }),
    );
    expect(verifySetup.status).toBe(200);
    expect(t.db.user[0]!.twoFactorEnabled).toBe(true);

    // A new sign-in now stops at the code page…
    t.db.session.length = 0;
    const gated = await t.auth.handler(new Request(await magicLinkFor(t, "rt@example.com"), { headers: { origin: ORIGIN } }));
    expect(gated.headers.get("location")).toMatch(/^\/login\/two-factor/);
    expect(t.db.session).toHaveLength(0);

    // …and the code finishes it with a real session.
    const finish = await t.auth.handler(
      new Request(`${ORIGIN}/api/auth/two-factor/verify-totp`, {
        method: "POST",
        headers: { ...json, cookie: cookieHeader(gated) },
        body: JSON.stringify({ code: await totp(secret), trustDevice: true }),
      }),
    );
    expect(finish.status).toBe(200);
    expect(t.db.session).toHaveLength(1);

    // A trusted device skips the code next time.
    const trust = setCookies(finish)
      .filter((c) => /trust_device=/.test(c))
      .map((c) => c.split(";")[0])
      .join("; ");
    expect(trust).not.toBe("");
    const trusted = await t.auth.handler(
      new Request(await magicLinkFor(t, "rt@example.com"), { headers: { origin: ORIGIN, cookie: trust } }),
    );
    expect(new URL(trusted.headers.get("location")!, ORIGIN).pathname).toBe("/practice");
  });
});
