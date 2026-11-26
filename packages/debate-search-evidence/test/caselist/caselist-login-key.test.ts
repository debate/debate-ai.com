import { beforeEach, describe, expect, it } from "vitest";
import { clearCaselistSessions, createCaselistClient, parseCaselistKey } from "../../src/caselist/caselist-api";

describe("parseCaselistKey", () => {
  it("reads username:password as a Tabroom login", () => {
    expect(parseCaselistKey(" coach@example.com:p:ss ")).toEqual({ username: "coach@example.com", password: "p:ss" });
  });
  it("keeps anything else as a caselist_token", () => {
    expect(parseCaselistKey("abc123")).toEqual({ token: "abc123" });
    expect(parseCaselistKey(":nouser")).toEqual({ token: ":nouser" });
    expect(parseCaselistKey("")).toBeNull();
  });
});

describe("createCaselistClient with a username:password key", () => {
  beforeEach(() => clearCaselistSessions());

  function fakeApi() {
    const calls: { path: string; cookie: string | null; body?: string }[] = [];
    let issued = 0;
    let valid = "";
    const fetchImpl = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const path = String(input).replace("https://api.opencaselist.com/v1", "");
      const cookie = new Headers(init?.headers).get("cookie");
      calls.push({ path, cookie, body: typeof init?.body === "string" ? init.body : undefined });
      if (path === "/login") {
        valid = `tok${++issued}`;
        return new Response("{}", { status: 201, headers: { "Set-Cookie": `caselist_token=${valid}; Path=/` } });
      }
      if (cookie !== `caselist_token=${valid}`) return new Response("{}", { status: 401 });
      return Response.json([]);
    }) as typeof fetch;
    return { calls, fetchImpl, expire: () => (valid = "gone") };
  }

  it("logs in with the key to get the session cookie, once per isolate", async () => {
    const api = fakeApi();
    await createCaselistClient({ token: "me:secret", fetch: api.fetchImpl }).caselists();
    await createCaselistClient({ token: "me:secret", fetch: api.fetchImpl }).caselists();
    const logins = api.calls.filter((call) => call.path === "/login");
    expect(logins).toHaveLength(1);
    expect(JSON.parse(logins[0].body ?? "{}")).toMatchObject({ username: "me", password: "secret" });
    expect(api.calls.at(-1)?.cookie).toBe("caselist_token=tok1");
  });

  it("logs in again when the session expired", async () => {
    const api = fakeApi();
    const client = createCaselistClient({ token: "me:secret", fetch: api.fetchImpl });
    await client.caselists();
    api.expire();
    await client.caselists();
    expect(api.calls.filter((call) => call.path === "/login")).toHaveLength(2);
    expect(await client.token()).toBe("tok2");
  });

  it("leaves the session to an authenticatedFetch: no cookie, no login, no retry", async () => {
    const api = fakeApi();
    const calls: (string | null)[] = [];
    const authenticatedFetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      calls.push(new Headers(init?.headers).get("cookie"));
      return new Response("{}", { status: 401 });
    }) as typeof fetch;
    const client = createCaselistClient({ token: "me:secret", fetch: api.fetchImpl, authenticatedFetch });
    await expect(client.caselists()).rejects.toMatchObject({ status: 401 });
    expect(calls).toEqual([null]);
    expect(api.calls).toEqual([]);
  });

  it("falls back to the login when a stored token has expired", async () => {
    const api = fakeApi();
    const client = createCaselistClient({ token: "stale", username: "me", password: "secret", fetch: api.fetchImpl });
    await expect(client.caselists()).resolves.toEqual([]);
    expect(api.calls.map((call) => call.path)).toEqual(["/caselists", "/login", "/caselists"]);
  });
});
