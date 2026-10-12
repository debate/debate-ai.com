// @vitest-environment jsdom
/**
 * @fileoverview Tests for `hooks/useCoachMaterialsSync.ts` — the local
 * coach-material store plus its one-time, module-level account merge of
 * materials and version history. Each test re-imports the hook after
 * `vi.resetModules()` so the module-level merge promise starts fresh.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";

import type { UseCoachMaterialsSyncResult } from "../src/hooks/useCoachMaterialsSync";
import type { CoachMaterial } from "../src/coach/team-coach-materials";
import type { CoachMaterialVersion } from "../src/state/coachMaterialVersions";
import { flush, mount } from "./helpers/mount";
import type { Mounted } from "./helpers/mount";

type FetchMock = ReturnType<typeof vi.fn<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>>;

let latest: UseCoachMaterialsSyncResult;
let view: Mounted;
let fetchMock: FetchMock;

function material(id: string, overrides: Partial<CoachMaterial> = {}): CoachMaterial {
  return { id, kind: "camp_material", title: `Title ${id}`, tags: [], text: `Text ${id}`, ...overrides };
}

const REMOTE_VERSION: CoachMaterialVersion = {
  id: "remote-mat-v1-0",
  materialId: "remote-mat",
  kind: "camp_material",
  title: "Old remote title",
  tags: [],
  text: "Old remote text",
  replacedAt: 1,
};

async function load() {
  vi.resetModules();
  const hooks = await import("../src/hooks/useCoachMaterialsSync");
  const materials = await import("../src/state/coachMaterials");
  const versions = await import("../src/state/coachMaterialVersions");
  function Harness() {
    latest = hooks.useCoachMaterialsSync();
    return null;
  }
  return { Harness, materials, versions };
}

function stubFetch(handler: (url: string, init?: RequestInit) => Response) {
  fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => handler(String(input), init));
  vi.stubGlobal("fetch", fetchMock);
}

const calls = (method: string) =>
  fetchMock.mock.calls.filter(([, init]) => (init?.method ?? "GET") === method).map(([url]) => String(url));

beforeEach(() => {
  localStorage.clear();
});

afterEach(async () => {
  await view?.unmount();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("useCoachMaterialsSync signed out", () => {
  it("becomes ready unsynced and keeps every change local", async () => {
    stubFetch(() => new Response(null, { status: 401 }));
    const { Harness, materials, versions } = await load();
    view = await mount(createElement(Harness));
    await flush();

    expect(latest.ready).toBe(true);
    expect(latest.synced).toBe(false);

    latest.saveMaterial(material("m1"));
    latest.saveMaterial(material("m1", { title: "Edited" }));
    expect(materials.getCoachMaterial("m1")?.title).toBe("Edited");
    expect(versions.listVersionsForMaterial("m1")).toHaveLength(1);

    latest.reviewMaterial("m1", "approved", "coach");
    expect(materials.getCoachMaterial("m1")).toMatchObject({ status: "approved", reviewedBy: "coach" });

    latest.deleteMaterial("m1");
    expect(materials.listCoachMaterials()).toEqual([]);
    expect(calls("PUT")).toEqual([]);
    expect(calls("DELETE")).toEqual([]);
  });

  it("treats a failed account load as unsynced", async () => {
    stubFetch(() => new Response(JSON.stringify({ error: "down" }), { status: 500 }));
    const { Harness } = await load();
    view = await mount(createElement(Harness));
    await flush();
    expect(latest.ready).toBe(true);
    expect(latest.synced).toBe(false);
  });
});

describe("useCoachMaterialsSync signed in", () => {
  it("adopts remote-only records and uploads local-only ones", async () => {
    stubFetch((url, init) => {
      if (init?.method) return new Response("{}");
      if (url === "/api/coach-materials") {
        return new Response(JSON.stringify([{ ...material("remote-mat"), updatedAt: "2026-01-01" }]));
      }
      return new Response(JSON.stringify([REMOTE_VERSION]));
    });
    const { Harness, materials, versions } = await load();
    materials.saveCoachMaterial(material("local-mat"));
    materials.saveCoachMaterial(material("local-mat", { title: "v2" }));
    const [localVersion] = versions.listVersionsForMaterial("local-mat");

    view = await mount(createElement(Harness));
    await flush();

    expect(latest.synced).toBe(true);
    expect(latest.ready).toBe(true);
    expect(materials.getCoachMaterial("remote-mat")?.title).toBe("Title remote-mat");
    expect(versions.listVersionsForMaterial("remote-mat").map((v) => v.id)).toEqual(["remote-mat-v1-0"]);
    expect(calls("PUT").sort()).toEqual(
      [
        "/api/coach-materials/local-mat",
        `/api/coach-material-versions/${encodeURIComponent(localVersion.id)}`,
      ].sort(),
    );
  });

  it("syncs saves (with their version snapshot), reviews and deletes", async () => {
    stubFetch((_url, init) => (init?.method ? new Response("{}") : new Response("[]")));
    const { Harness, versions } = await load();
    view = await mount(createElement(Harness));
    await flush();
    expect(latest.synced).toBe(true);

    latest.saveMaterial(material("m1"));
    expect(calls("PUT")).toEqual(["/api/coach-materials/m1"]);

    latest.saveMaterial(material("m1", { title: "Edited" }));
    const [snapshot] = versions.listVersionsForMaterial("m1");
    expect(calls("PUT")).toEqual([
      "/api/coach-materials/m1",
      "/api/coach-materials/m1",
      `/api/coach-material-versions/${encodeURIComponent(snapshot.id)}`,
    ]);

    latest.reviewMaterial("m1", "rejected", "coach", "Off topic");
    const reviewPut = fetchMock.mock.calls.filter(([, init]) => init?.method === "PUT").at(-1)!;
    expect(JSON.parse(String(reviewPut[1]?.body)).record).toMatchObject({
      id: "m1",
      status: "rejected",
      reviewNote: "Off topic",
    });

    // Reviewing an unknown id is a no-op locally and remotely.
    const putsBefore = calls("PUT").length;
    latest.reviewMaterial("missing", "approved", "coach");
    expect(calls("PUT")).toHaveLength(putsBefore);

    latest.deleteMaterial("m1");
    expect(calls("DELETE")).toEqual([
      "/api/coach-materials/m1",
      `/api/coach-material-versions/${encodeURIComponent(snapshot.id)}`,
    ]);
  });

  it("treats a signed-out version list as empty and swallows failed pushes", async () => {
    stubFetch((url, init) => {
      if (init?.method) return new Response(JSON.stringify({ error: "nope" }), { status: 500 });
      if (url === "/api/coach-materials") return new Response("[]");
      return new Response(null, { status: 401 });
    });
    const { Harness, materials } = await load();
    materials.saveCoachMaterial(material("local"));
    view = await mount(createElement(Harness));
    await flush();
    const second = await mount(createElement(Harness));
    await flush();

    expect(latest.synced).toBe(true);
    // Both mounts share one pair of account GETs.
    expect(calls("GET")).toEqual(["/api/coach-materials", "/api/coach-material-versions"]);

    latest.saveMaterial(material("local", { title: "Edited" }));
    latest.reviewMaterial("local", "approved", "coach");
    latest.deleteMaterial("local");
    await flush();
    expect(materials.listCoachMaterials()).toEqual([]);
    expect(calls("DELETE")).toContain("/api/coach-materials/local");
    await second.unmount();
  });
});
