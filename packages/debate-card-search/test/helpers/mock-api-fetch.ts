import { vi } from "vitest";

/** Stubs `global.fetch` (grab-url's transport) with a JSON success response. */
export function mockFetchJson(body: unknown, status = 200, statusText = "OK"): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok: true,
    status,
    statusText,
    headers: { get: () => "application/json" },
    json: async () => body,
  })) as unknown as ReturnType<typeof vi.fn>;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

/** Stubs `global.fetch` with a failing (non-2xx) response — grab-url throws before the body is read. */
export function mockFetchError(status: number, statusText = "Error"): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async () => ({
    ok: false,
    status,
    statusText,
    headers: { get: () => "application/json" },
    json: async () => ({}),
  })) as unknown as ReturnType<typeof vi.fn>;
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}
