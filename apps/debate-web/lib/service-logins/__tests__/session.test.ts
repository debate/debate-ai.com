/**
 * @fileoverview The stored-login session behind every Tabroom and
 * openCaselist request: it reuses the saved token, logs in again only when
 * the token has expired or is rejected, shares one login between concurrent
 * requests, and backs off after a failed login instead of retrying in a loop.
 */

import { describe, expect, it, vi } from "vitest";
import {
  ServiceLoginError,
  ServiceSession,
  loginCooldownMs,
  type LoginResult,
  type ServiceLoginStore,
  type StoredServiceLogin,
} from "../session";

const MINUTE = 60_000;

function memoryStore(initial: Partial<StoredServiceLogin> | null) {
  let record: StoredServiceLogin | null = initial
    ? { username: null, password: null, token: null, tokenExpiresAt: null, lastLoginAt: null, lastFailureAt: null, failureCount: 0, lastError: null, ...initial }
    : null;
  const store: ServiceLoginStore & { loads: number; current: () => StoredServiceLogin | null; set: (patch: Partial<StoredServiceLogin>) => void } = {
    loads: 0,
    current: () => record,
    set: (patch) => {
      record = { ...record!, ...patch };
    },
    async load() {
      store.loads++;
      return record ? { ...record } : null;
    },
    async saveToken(token, expiresAt, at) {
      record = { ...record!, token, tokenExpiresAt: expiresAt, lastLoginAt: at, lastFailureAt: null, failureCount: 0, lastError: null };
    },
    async saveFailure(error, at, failureCount) {
      record = { ...record!, lastError: error, lastFailureAt: at, failureCount };
    },
  };
  return store;
}

/** A service that accepts only the newest token it issued. */
function fakeService() {
  let issued = 0;
  let valid: string | null = null;
  const seen: (string | null)[] = [];
  let failLogins = false;
  const login = vi.fn(async (): Promise<LoginResult> => {
    await new Promise((resolve) => setTimeout(resolve, 5));
    if (failLogins) throw new ServiceLoginError("Tabroom refused the username or password (401).", 401);
    valid = `tok${++issued}`;
    return { token: valid, expiresAt: null };
  });
  const fetchImpl = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
    const token = new Headers(init?.headers).get("x-token");
    seen.push(token);
    return new Response(token && token === valid ? "ok" : "denied", { status: token && token === valid ? 200 : 401 });
  }) as unknown as typeof fetch;
  return {
    login,
    fetchImpl,
    seen,
    expire: () => (valid = "gone"),
    accept: (token: string) => (valid = token),
    failLogins: (fail = true) => (failLogins = fail),
  };
}

function setup(initial: Partial<StoredServiceLogin> | null, extra: { fallback?: string | null } = {}) {
  let now = 1_000_000;
  const clock = { now: () => now, advance: (ms: number) => (now += ms) };
  const store = memoryStore(initial);
  const service = fakeService();
  const session = new ServiceSession({
    label: "Tabroom",
    store,
    login: service.login,
    applyToken: (headers, token) => headers.set("x-token", token),
    fallbackToken: () => extra.fallback ?? null,
    now: clock.now,
    fetchImpl: service.fetchImpl,
  });
  return { clock, store, service, session };
}

const login = { username: "coach@example.com", password: "secret" };

describe("ServiceSession", () => {
  it("reuses the stored token without logging in", async () => {
    const { session, service, store } = setup({ ...login, token: "saved" });
    service.accept("saved");
    for (let i = 0; i < 3; i++) expect((await session.fetch("https://api.tabroom.com/v1/x")).status).toBe(200);
    expect(service.login).not.toHaveBeenCalled();
    expect(service.seen).toEqual(["saved", "saved", "saved"]);
    expect(store.loads).toBe(1);
  });

  it("logs in once when no token is saved, then reuses it", async () => {
    const { session, service, store } = setup(login);
    await session.fetch("https://x/1");
    await session.fetch("https://x/2");
    expect(service.login).toHaveBeenCalledTimes(1);
    expect(store.current()?.token).toBe("tok1");
    expect(service.seen).toEqual(["tok1", "tok1"]);
  });

  it("logs in again when the token's known expiry has passed", async () => {
    const { session, service, store, clock } = setup({ ...login, token: "saved", tokenExpiresAt: 1_000_000 + 30 * MINUTE });
    service.accept("saved");
    await session.fetch("https://x/1");
    expect(service.login).not.toHaveBeenCalled();

    clock.advance(31 * MINUTE);
    await session.fetch("https://x/2");
    expect(service.login).toHaveBeenCalledTimes(1);
    expect(store.current()?.token).toBe("tok1");
    expect(service.seen.at(-1)).toBe("tok1");
  });

  it("logs in again when the token is rejected and retries the request once", async () => {
    const { session, service, store, clock } = setup({ ...login, token: "stale", lastLoginAt: 0 });
    clock.advance(10 * MINUTE);
    const res = await session.fetch("https://x/rounds");
    expect(res.status).toBe(200);
    expect(service.login).toHaveBeenCalledTimes(1);
    expect(service.seen).toEqual(["stale", "tok1"]);
    expect(store.current()?.token).toBe("tok1");
  });

  it("shares one login between concurrent rejected requests", async () => {
    const { session, service } = setup({ ...login, token: "stale", lastLoginAt: 0 });
    const responses = await Promise.all(Array.from({ length: 10 }, (_, i) => session.fetch(`https://x/${i}`)));
    expect(responses.every((res) => res.status === 200)).toBe(true);
    expect(service.login).toHaveBeenCalledTimes(1);
  });

  it("shares one login between concurrent first requests", async () => {
    const { session, service } = setup(login);
    await Promise.all(Array.from({ length: 5 }, (_, i) => session.fetch(`https://x/${i}`)));
    expect(service.login).toHaveBeenCalledTimes(1);
  });

  it("uses a token another isolate saved instead of logging in", async () => {
    const { session, service, store } = setup({ ...login, token: "old", lastLoginAt: 0 });
    service.accept("old");
    await session.fetch("https://x/1");
    store.set({ token: "fromOtherIsolate", lastLoginAt: 1_000_000 });
    service.accept("fromOtherIsolate");
    const res = await session.fetch("https://x/2");
    expect(res.status).toBe(200);
    expect(service.login).not.toHaveBeenCalled();
    expect(service.seen).toEqual(["old", "old", "fromOtherIsolate"]);
  });

  it("does not log in again when a token it just minted is rejected", async () => {
    const { session, service } = setup(login);
    await session.fetch("https://x/1");
    service.expire();
    const first = await session.fetch("https://x/forbidden");
    const second = await session.fetch("https://x/forbidden");
    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(service.login).toHaveBeenCalledTimes(1);
  });

  it("waits out a cooldown after a failed login, doubling it on each failure", async () => {
    const { session, service, store, clock } = setup(login);
    service.failLogins();

    expect((await session.fetch("https://x/1")).status).toBe(401);
    expect(service.login).toHaveBeenCalledTimes(1);
    expect(store.current()).toMatchObject({ failureCount: 1, lastError: expect.stringContaining("refused") });

    // Inside the cooldown: no new attempt, however many requests come in.
    for (let i = 0; i < 5; i++) await session.fetch(`https://x/${i}`);
    clock.advance(4 * MINUTE);
    await session.fetch("https://x/again");
    expect(service.login).toHaveBeenCalledTimes(1);
    expect(session.retryAfterMs(store.current())).toBe(MINUTE);

    clock.advance(MINUTE);
    await session.fetch("https://x/after");
    expect(service.login).toHaveBeenCalledTimes(2);
    expect(store.current()?.failureCount).toBe(2);

    // Second failure: ten minutes.
    clock.advance(9 * MINUTE);
    await session.fetch("https://x/later");
    expect(service.login).toHaveBeenCalledTimes(2);
    clock.advance(MINUTE);
    service.failLogins(false);
    expect((await session.fetch("https://x/recovered")).status).toBe(200);
    expect(service.login).toHaveBeenCalledTimes(3);
    expect(store.current()).toMatchObject({ failureCount: 0, lastError: null, token: "tok1" });
  });

  it("honours a cooldown recorded by another isolate", async () => {
    const { session, service } = setup({ ...login, failureCount: 1, lastFailureAt: 1_000_000 - MINUTE, lastError: "refused" });
    await session.fetch("https://x/1");
    expect(service.login).not.toHaveBeenCalled();
  });

  it("falls back to the env token when no login is saved, and never logs in", async () => {
    const { session, service } = setup(null, { fallback: "env-token" });
    service.accept("env-token");
    expect((await session.fetch("https://x/1")).status).toBe(200);
    service.expire();
    expect((await session.fetch("https://x/2")).status).toBe(401);
    expect(service.login).not.toHaveBeenCalled();
    expect(service.seen).toEqual(["env-token", "env-token"]);
  });

  it("falls back to the env token while the saved login is failing", async () => {
    const { session, service } = setup(login, { fallback: "env-token" });
    service.failLogins();
    service.accept("env-token");
    expect((await session.fetch("https://x/1")).status).toBe(200);
    expect(service.seen).toEqual(["env-token"]);
  });

  it("falls back to the env token when the store can't be read", async () => {
    const { session, service, store } = setup(login, { fallback: "env-token" });
    store.load = async () => {
      throw new Error("no such table");
    };
    service.accept("env-token");
    expect((await session.fetch("https://x/1")).status).toBe(200);
    expect(service.login).not.toHaveBeenCalled();
  });

  it("signIn ignores the cooldown and reports the failure", async () => {
    const { session, service, store } = setup({ ...login, failureCount: 3, lastFailureAt: 1_000_000 });
    service.failLogins();
    await expect(session.signIn()).rejects.toThrow(/refused the username or password/);
    expect(service.login).toHaveBeenCalledTimes(1);
    expect(store.current()?.failureCount).toBe(4);

    service.failLogins(false);
    await expect(session.signIn()).resolves.toMatchObject({ token: "tok1" });
    expect(store.current()).toMatchObject({ token: "tok1", failureCount: 0 });
  });

  it("signIn needs a saved login", async () => {
    const { session } = setup(null);
    await expect(session.signIn()).rejects.toBeInstanceOf(ServiceLoginError);
  });
});

describe("loginCooldownMs", () => {
  it("starts at five minutes, doubles and caps at an hour", () => {
    expect(loginCooldownMs(0)).toBe(0);
    expect(loginCooldownMs(1)).toBe(5 * MINUTE);
    expect(loginCooldownMs(2)).toBe(10 * MINUTE);
    expect(loginCooldownMs(3)).toBe(20 * MINUTE);
    expect(loginCooldownMs(10)).toBe(60 * MINUTE);
  });
});
