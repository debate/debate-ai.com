/**
 * @fileoverview Tests for the coach-material account-sync clients —
 * `coach/coach-materials-client.ts` and `coach/coach-material-versions-client.ts`.
 * Each is a thin `fetch` wrapper: list (null when signed out), PUT-upsert by
 * id, DELETE by id, all surfacing the server's `{ error }` or a fallback.
 */

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  deleteSavedCoachMaterialFromAccount,
  listSavedCoachMaterials,
  saveCoachMaterialToAccount,
} from "../src/coach/coach-materials-client";
import {
  deleteSavedCoachMaterialVersionFromAccount,
  listSavedCoachMaterialVersions,
  saveCoachMaterialVersionToAccount,
} from "../src/coach/coach-material-versions-client";
import type { CoachMaterial } from "../src/coach/team-coach-materials";
import type { CoachMaterialVersion } from "../src/state/coachMaterialVersions";

function stubFetch(response: () => Response) {
  const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => response());
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

const MATERIAL = { id: "mat 1/a", title: "Kritik primer" } as unknown as CoachMaterial;
const VERSION = { id: "ver 1/a", materialId: "mat 1/a" } as unknown as CoachMaterialVersion;

const clients = [
  {
    name: "coach materials",
    endpoint: "/api/coach-materials",
    list: listSavedCoachMaterials,
    save: (endpoint?: string) => saveCoachMaterialToAccount(MATERIAL, endpoint),
    remove: (endpoint?: string) => deleteSavedCoachMaterialFromAccount("mat 1/a", endpoint),
    record: MATERIAL,
    encodedId: "mat%201%2Fa",
    fallbacks: {
      list: "Failed to load your synced coach materials.",
      save: "Failed to sync this material to your account.",
      remove: "Failed to remove this synced material.",
    },
  },
  {
    name: "coach material versions",
    endpoint: "/api/coach-material-versions",
    list: listSavedCoachMaterialVersions,
    save: (endpoint?: string) => saveCoachMaterialVersionToAccount(VERSION, endpoint),
    remove: (endpoint?: string) => deleteSavedCoachMaterialVersionFromAccount("ver 1/a", endpoint),
    record: VERSION,
    encodedId: "ver%201%2Fa",
    fallbacks: {
      list: "Failed to load your synced coach-material version history.",
      save: "Failed to sync this version to your account.",
      remove: "Failed to remove this synced version.",
    },
  },
];

describe.each(clients)("$name client", (client) => {
  it("lists synced records, or null when signed out", async () => {
    const fetchMock = stubFetch(() => json([client.record]));
    await expect(client.list()).resolves.toEqual([client.record]);
    expect(fetchMock).toHaveBeenCalledWith(client.endpoint);

    stubFetch(() => new Response(null, { status: 401 }));
    await expect(client.list("/custom")).resolves.toBeNull();
  });

  it("throws the server's error or a fallback when listing fails", async () => {
    stubFetch(() => json({ error: "DB down" }, 500));
    await expect(client.list()).rejects.toThrow("DB down");
    stubFetch(() => new Response("<html>", { status: 502 }));
    await expect(client.list()).rejects.toThrow(client.fallbacks.list);
  });

  it("PUTs a record under its URL-encoded id", async () => {
    const fetchMock = stubFetch(() => json({}));
    await client.save();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${client.endpoint}/${client.encodedId}`);
    expect(init?.method).toBe("PUT");
    expect(init?.headers).toEqual({ "content-type": "application/json" });
    expect(JSON.parse(String(init?.body))).toEqual({ record: client.record });

    await client.save("/other");
    expect(fetchMock.mock.calls[1][0]).toBe(`/other/${client.encodedId}`);
  });

  it("throws on a failed save, 401 included", async () => {
    stubFetch(() => json({ error: "Too large" }, 413));
    await expect(client.save()).rejects.toThrow("Too large");
    stubFetch(() => json({}, 401));
    await expect(client.save()).rejects.toThrow(client.fallbacks.save);
  });

  it("DELETEs a record by its URL-encoded id and throws on failure", async () => {
    const fetchMock = stubFetch(() => new Response(null, { status: 204 }));
    await client.remove();
    expect(fetchMock).toHaveBeenCalledWith(`${client.endpoint}/${client.encodedId}`, { method: "DELETE" });

    stubFetch(() => json({ error: "Not yours" }, 403));
    await expect(client.remove()).rejects.toThrow("Not yours");
    stubFetch(() => new Response("nope", { status: 500 }));
    await expect(client.remove("/x")).rejects.toThrow(client.fallbacks.remove);
  });
});
