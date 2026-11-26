/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { flush, renderHook } from "../../helpers/render-hook";

vi.mock("../../../src/lib/debug-log", () => ({ debugLog: vi.fn() }));

type Module = typeof import("../../../src/lib/hooks/useAuthProviders");

async function freshModule(): Promise<Module> {
  vi.resetModules();
  return import("../../../src/lib/hooks/useAuthProviders");
}

const fetchMock = vi.fn<(url: string) => Promise<Response>>();

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("fetchAuthProviders", () => {
  it("shares one request between callers and returns the providers and Google client id", async () => {
    fetchMock.mockResolvedValue(ok({ providers: ["google", "discord"], googleClientId: "gid" }));
    const { fetchAuthProviders } = await freshModule();
    const [a, b] = await Promise.all([fetchAuthProviders(), fetchAuthProviders()]);
    expect(a).toEqual({ providers: ["google", "discord"], googleClientId: "gid" });
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/providers");
  });

  it("ignores malformed fields", async () => {
    fetchMock.mockResolvedValue(ok({ providers: "google", googleClientId: 42 }));
    const { fetchAuthProviders } = await freshModule();
    expect(await fetchAuthProviders()).toEqual({ providers: [], googleClientId: "" });
  });

  it("treats a non-OK response as no providers", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }));
    const { fetchAuthProviders } = await freshModule();
    expect(await fetchAuthProviders()).toEqual({ providers: [], googleClientId: "" });
  });

  it("returns none on a network failure and retries on the next call", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    fetchMock.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValue(ok({ providers: ["google"] }));
    const { fetchAuthProviders } = await freshModule();
    expect(await fetchAuthProviders()).toEqual({ providers: [], googleClientId: "" });
    expect((await fetchAuthProviders()).providers).toEqual(["google"]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("useAuthProviders", () => {
  it("starts loading, then reports the providers", async () => {
    fetchMock.mockResolvedValue(ok({ providers: ["google"], googleClientId: "gid" }));
    const { useAuthProviders } = await freshModule();
    const hook = await renderHook(() => useAuthProviders());
    await flush();
    expect(hook.result.current).toMatchObject({
      providers: ["google"],
      googleClientId: "gid",
      isLoading: false,
      hasSocialProviders: true,
    });
    await hook.unmount();
  });

  it("reports no social providers when none are configured", async () => {
    fetchMock.mockResolvedValue(ok({ providers: [], googleClientId: "" }));
    const { useAuthProviders } = await freshModule();
    const hook = await renderHook(() => useAuthProviders());
    await flush();
    expect(hook.result.current.hasSocialProviders).toBe(false);
    expect(hook.result.current.isLoading).toBe(false);
    await hook.unmount();
  });

  it("does not update after unmount", async () => {
    let resolve!: (res: Response) => void;
    fetchMock.mockReturnValue(new Promise((r) => (resolve = r)));
    const { useAuthProviders } = await freshModule();
    const hook = await renderHook(() => useAuthProviders());
    expect(hook.result.current.isLoading).toBe(true);
    await hook.unmount();
    resolve(ok({ providers: ["google"] }));
    await flush();
    expect(hook.result.current.isLoading).toBe(true);
  });
});
