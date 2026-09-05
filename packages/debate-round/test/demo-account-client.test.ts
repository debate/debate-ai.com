import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchDemoAccountStatus, signInAsDemoAccount } from "../src/round/demo-account-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchDemoAccountStatus", () => {
  it("returns the server's status", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({ enabled: true, email: "demo@debate-ai.com", name: "Demo Debater" }) })));
    expect(await fetchDemoAccountStatus()).toEqual({ enabled: true, email: "demo@debate-ai.com", name: "Demo Debater" });
  });

  it("reports disabled on a non-OK response or a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, json: async () => ({}) })));
    expect((await fetchDemoAccountStatus()).enabled).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect((await fetchDemoAccountStatus()).enabled).toBe(false);
  });
});

describe("signInAsDemoAccount", () => {
  it("POSTs the reset flag and returns the result", async () => {
    const result = { user: { id: "u", email: "demo@debate-ai.com", name: "Demo Debater" }, seeded: { documents: 4, flows: 3, sharedFiles: 3 }, reset: true };
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => result })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    expect(await signInAsDemoAccount({ reset: true })).toEqual(result);
    const [url, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/demo/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ reset: true });
  });

  it("defaults reset to false", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({}) })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);
    await signInAsDemoAccount();
    const [, init] = (fetchMock as unknown as ReturnType<typeof vi.fn>).mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({ reset: false });
  });

  it("throws the server's message when disabled", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404, json: async () => ({ error: "The demo account is disabled on this deployment." }) })));
    await expect(signInAsDemoAccount()).rejects.toThrow("The demo account is disabled on this deployment.");
  });
});
