/**
 * @fileoverview Logging into Tabroom and openCaselist with a username and
 * password, reading the session cookie (and its expiry) off the response,
 * and the AES-GCM sealing the stored password and token go through.
 */

import { describe, expect, it, vi } from "vitest";
import { decryptSecret, encryptSecret } from "../crypto";
import { OPENCASELIST_LOGIN_URL, TABROOM_LOGIN_URL, loginOpenCaselist, loginTabroom, readSetCookie } from "../providers";
import { ServiceLoginError } from "../session";

function loginResponse(body: unknown, setCookies: string[], status = 200) {
  const headers = new Headers({ "content-type": "application/json" });
  for (const cookie of setCookies) headers.append("set-cookie", cookie);
  return new Response(JSON.stringify(body), { status, headers });
}

describe("readSetCookie", () => {
  it("reads the named cookie's value and Max-Age expiry", () => {
    const headers = new Headers();
    headers.append("set-cookie", "csrf=abc; Path=/");
    headers.append("set-cookie", "TabroomToken=%246%24salt; Path=/; Max-Age=3600; HttpOnly");
    expect(readSetCookie(headers, "TabroomToken", 1_000)).toEqual({ value: "$6$salt", expiresAt: 1_000 + 3_600_000 });
  });

  it("reads an Expires date, and null when the cookie is a session cookie", () => {
    const headers = new Headers();
    headers.append("set-cookie", "caselist_token=xyz; Expires=Wed, 21 Oct 2026 07:28:00 GMT; Path=/");
    expect(readSetCookie(headers, "caselist_token")).toEqual({ value: "xyz", expiresAt: Date.parse("Wed, 21 Oct 2026 07:28:00 GMT") });
    const session = new Headers({ "set-cookie": "TabroomToken=tok; Path=/; HttpOnly" });
    expect(readSetCookie(session, "TabroomToken")).toEqual({ value: "tok", expiresAt: null });
    expect(readSetCookie(session, "other")).toBeNull();
  });
});

describe("loginTabroom", () => {
  it("posts the login to Tabroom's API and returns the session token", async () => {
    const fetchImpl = vi.fn(async () => loginResponse({ token: "body-token", Person: { id: 1, email: "a@b.c" } }, ["TabroomToken=cookie-token; Path=/; HttpOnly"]));
    await expect(loginTabroom("coach@example.com", "pw", fetchImpl as unknown as typeof fetch)).resolves.toEqual({ token: "cookie-token", expiresAt: null });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(TABROOM_LOGIN_URL);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ username: "coach@example.com", password: "pw" });
  });

  it("falls back to the token in the body when no cookie is set", async () => {
    const fetchImpl = async () => loginResponse({ token: "body-token" }, []);
    await expect(loginTabroom("u", "p", fetchImpl as unknown as typeof fetch)).resolves.toEqual({ token: "body-token", expiresAt: null });
  });

  it("reports a refused login without echoing the password", async () => {
    const fetchImpl = async () => loginResponse({ title: "Invalid Credentials" }, [], 401);
    const error = await loginTabroom("u", "hunter2", fetchImpl as unknown as typeof fetch).catch((e) => e);
    expect(error).toBeInstanceOf(ServiceLoginError);
    expect(error.status).toBe(401);
    expect(error.message).toMatch(/refused/);
    expect(error.message).not.toContain("hunter2");
  });
});

describe("loginOpenCaselist", () => {
  it("logs in and keeps the caselist_token cookie's expiry", async () => {
    const fetchImpl = vi.fn(async () =>
      loginResponse({ message: "Successfully logged in" }, ["caselist_token=ct; Path=/; Expires=Wed, 21 Oct 2026 07:28:00 GMT"], 201),
    );
    await expect(loginOpenCaselist("me", "pw", fetchImpl as unknown as typeof fetch)).resolves.toEqual({
      token: "ct",
      expiresAt: Date.parse("Wed, 21 Oct 2026 07:28:00 GMT"),
    });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(OPENCASELIST_LOGIN_URL);
    expect(JSON.parse(String(init.body))).toEqual({ username: "me", password: "pw", remember: true });
  });

  it("fails when no session comes back", async () => {
    const fetchImpl = async () => loginResponse({}, []);
    await expect(loginOpenCaselist("me", "pw", fetchImpl as unknown as typeof fetch)).rejects.toThrow(/no session token/);
  });
});

describe("encryptSecret", () => {
  it("round-trips and never stores the plain text", async () => {
    const sealed = await encryptSecret("p@ssw0rd", "server-secret");
    expect(sealed).toMatch(/^v1\./);
    expect(sealed).not.toContain("p@ssw0rd");
    expect(await decryptSecret(sealed, "server-secret")).toBe("p@ssw0rd");
    expect(await encryptSecret("p@ssw0rd", "server-secret")).not.toBe(sealed);
  });

  it("reads as null with another secret or a malformed value", async () => {
    const sealed = await encryptSecret("token", "one");
    expect(await decryptSecret(sealed, "two")).toBeNull();
    expect(await decryptSecret("garbage", "one")).toBeNull();
    expect(await decryptSecret(null, "one")).toBeNull();
  });
});
