import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchAccountSettings, pushAccountSettings } from "../src/state/settings-client";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchAccountSettings", () => {
  it("GETs /api/settings and returns the parsed signedIn/data", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ signedIn: true, data: { debateStyle: 1, fontSize: 14 } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchAccountSettings();

    expect(result).toEqual({ signedIn: true, data: { debateStyle: 1, fontSize: 14 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/api/settings");
  });

  it("returns signed-out with null data when the account has no session", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ signedIn: false, data: null }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchAccountSettings()).toEqual({ signedIn: false, data: null });
  });

  it("treats invalid data as null rather than passing it through", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ signedIn: true, data: ["not", "an", "object"] }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchAccountSettings()).toEqual({ signedIn: true, data: null });
  });

  it("fetches from a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ signedIn: false, data: null }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await fetchAccountSettings("/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message when the request fails", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => ({ error: "Database unavailable." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAccountSettings()).rejects.toThrow("Database unavailable.");
  });

  it("falls back to a status-code message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 502,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchAccountSettings()).rejects.toThrow(
      "Fetching account settings failed (502).",
    );
  });
});

describe("pushAccountSettings", () => {
  it("PUTs the data as JSON to /api/settings", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({ signedIn: true, data: { fontSize: 16 } }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushAccountSettings({ fontSize: 16 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = (fetchMock as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/settings");
    expect((init as RequestInit).method).toBe("PUT");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ data: { fontSize: 16 } });
  });

  it("pushes to a caller-supplied endpoint override", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => ({}),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await pushAccountSettings({ fontSize: 16 }, "/custom-endpoint");

    expect((fetchMock as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe("/custom-endpoint");
  });

  it("throws the server's error message on a 401 (not signed in)", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: "Sign in to sync settings to your account." }),
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pushAccountSettings({ fontSize: 16 })).rejects.toThrow(
      "Sign in to sync settings to your account.",
    );
  });

  it("falls back to a status-code message when the error body isn't JSON", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("not json");
      },
    })) as unknown as typeof fetch;
    vi.stubGlobal("fetch", fetchMock);

    await expect(pushAccountSettings({ fontSize: 16 })).rejects.toThrow(
      "Saving account settings failed (500).",
    );
  });
});
