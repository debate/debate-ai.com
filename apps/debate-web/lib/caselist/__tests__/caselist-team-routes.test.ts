/**
 * @fileoverview `/api/caselist-team` and `/api/caselist-team/file`: a team a
 * staff member synced is answered from our own storage with no openCaselist
 * session; otherwise the server's session fetches it once and the edge cache
 * serves the repeats. The upstream's errors are mapped to honest statuses, and
 * only `<caselist>/<school>/<team>/<file>` paths ever reach the proxy.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  stored: null as unknown,
  storedError: null as Error | null,
  client: null as null | { download: (path: string) => Promise<Response> },
  lookup: null as null | (() => Promise<unknown>),
  lookups: [] as unknown[],
  bucket: null as null | { get: (key: string) => Promise<{ arrayBuffer: () => Promise<ArrayBuffer> } | null> },
}));

vi.mock("@/lib/database/context", () => ({ getDBFromContext: async () => ({}), getCloudflareContext: () => undefined }));
vi.mock("@/lib/caselist/team-caselist-sync", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/caselist/team-caselist-sync")>()),
  readStoredTeamCaselist: async () => {
    if (state.storedError) throw state.storedError;
    return state.stored;
  },
}));
vi.mock("@/lib/caselist/team-caselist", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/caselist/team-caselist")>()),
  openCaselistClient: async () => state.client,
  lookupTeamCaselist: async (_client: unknown, query: unknown) => {
    state.lookups.push(query);
    return state.lookup!();
  },
}));
vi.mock("@/lib/search/card-text-store", () => ({ getCardTextBucket: () => state.bucket }));

const team = await import("@/app/api/caselist-team/route");
const file = await import("@/app/api/caselist-team/file/route");
const { CaselistApiError } = await import("@debate-ai/research-evidence/src/caselist/caselist-api");

const TEAM_URL = "https://debate-ai.com/api/caselist-team?dataset=hspf&school=Harker&team=Lin%20%26%20Lee";
const PATH = "hspf25/Harker/LiLe/hspf25-Harker-LiLe-Pro-Blake-Round1.docx";
const FILE_URL = `https://debate-ai.com/api/caselist-team/file?path=${encodeURIComponent(PATH)}`;

function installEdgeCache() {
  const entries = new Map<string, Response>();
  (globalThis as { caches?: unknown }).caches = {
    default: {
      match: async (request: Request) => entries.get(request.url)?.clone(),
      put: async (request: Request, response: Response) => void entries.set(request.url, response),
    },
  };
  return entries;
}

beforeEach(() => {
  Object.assign(state, { stored: null, storedError: null, client: null, lookup: null, lookups: [], bucket: null });
  delete (globalThis as { caches?: unknown }).caches;
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  delete (globalThis as { caches?: unknown }).caches;
});

describe("GET /api/caselist-team", () => {
  it("needs dataset, school and team", async () => {
    for (const query of ["", "?dataset=hspf&school=Harker", "?dataset=%20&school=Harker&team=X"]) {
      const res = await team.GET(new Request(`https://debate-ai.com/api/caselist-team${query}`));
      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({ error: "dataset, school and team are required" });
    }
  });

  it("answers a synced team from our own storage, briefly cached, without opening a session", async () => {
    state.stored = { configured: true, found: true, rounds: [{ id: 1 }] };
    const res = await team.GET(new Request(TEAM_URL));
    expect(await res.json()).toEqual(state.stored);
    expect(res.headers.get("Cache-Control")).toBe("public, max-age=300");
    expect(state.lookups).toEqual([]);
  });

  it("falls through to openCaselist when the stored lookup throws", async () => {
    state.storedError = new Error("table missing");
    expect((await (await team.GET(new Request(TEAM_URL))).json()).configured).toBe(false);
  });

  it("reports an unconfigured server without caching the answer", async () => {
    const res = await team.GET(new Request(TEAM_URL));
    expect(await res.json()).toMatchObject({ configured: false, found: false, rounds: [], cites: [] });
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("looks the team up once with trimmed parameters, then serves repeats from the edge cache", async () => {
    const entries = installEdgeCache();
    state.client = { download: async () => new Response() };
    state.lookup = async () => ({ configured: true, found: true, rounds: [] });

    const first = await team.GET(new Request(TEAM_URL.replace("school=Harker", "school=%20Harker%20")));
    expect(first.headers.get("Cache-Control")).toBe("public, max-age=21600");
    expect(state.lookups).toEqual([{ dataset: "hspf", school: "Harker", team: "Lin & Lee" }]);
    expect(entries.size).toBe(1);

    const second = await team.GET(new Request(TEAM_URL.replace("school=Harker", "school=%20Harker%20")));
    expect(await second.json()).toMatchObject({ found: true });
    expect(state.lookups).toHaveLength(1);
  });

  it("explains an expired session and any other upstream failure, never caching either", async () => {
    state.client = { download: async () => new Response() };
    state.lookup = async () => {
      throw new CaselistApiError("expired", 401, "/x");
    };
    const expired = await team.GET(new Request(TEAM_URL));
    expect(await expired.json()).toMatchObject({ configured: true, found: false, error: "The openCaselist session on the server has expired." });
    expect(expired.headers.get("Cache-Control")).toBe("no-store");

    state.lookup = async () => {
      throw new Error("network");
    };
    expect((await (await team.GET(new Request(TEAM_URL))).json()).error).toBe("openCaselist did not answer.");
  });
});

describe("GET /api/caselist-team/file", () => {
  it.each(["", "../etc/passwd", "/hspf25/Harker/LiLe/a.docx", "hspf25/Harker/a.docx", "hspf25/Harker/LiLe/noextension"])(
    "rejects the path %j",
    async (path) => {
      const res = await file.GET(new Request(`https://debate-ai.com/api/caselist-team/file?path=${encodeURIComponent(path)}`));
      expect(res.status).toBe(400);
    },
  );

  it("serves a synced file from storage as an immutable attachment with its content type", async () => {
    state.bucket = { get: async () => ({ arrayBuffer: async () => new TextEncoder().encode("synced").buffer as ArrayBuffer }) };
    const res = await file.GET(new Request(FILE_URL));
    expect(await res.text()).toBe("synced");
    expect(res.headers.get("Content-Type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(res.headers.get("Content-Disposition")).toBe("attachment; filename*=UTF-8''hspf25-Harker-LiLe-Pro-Blake-Round1.docx");
    expect(res.headers.get("Cache-Control")).toContain("immutable");
  });

  it("uses a generic content type for an unrecognised extension", async () => {
    state.bucket = { get: async () => ({ arrayBuffer: async () => new ArrayBuffer(1) }) };
    const path = "hspf25/Harker/LiLe/notes.xyz";
    const res = await file.GET(new Request(`https://debate-ai.com/api/caselist-team/file?path=${encodeURIComponent(path)}`));
    expect(res.headers.get("Content-Type")).toBe("application/octet-stream");
  });

  it("says downloads are not configured when there is no stored copy and no session", async () => {
    const res = await file.GET(new Request(FILE_URL));
    expect(res.status).toBe(503);
  });

  it("downloads once with the server's session and serves repeats from the edge cache", async () => {
    const entries = installEdgeCache();
    state.bucket = { get: async () => { throw new Error("r2 down"); } };
    const download = vi.fn(async () => new Response("from-upstream"));
    state.client = { download };

    const first = await file.GET(new Request(FILE_URL));
    expect(await first.text()).toBe("from-upstream");
    expect(entries.size).toBe(1);
    const second = await file.GET(new Request(FILE_URL));
    expect(await second.text()).toBe("from-upstream");
    expect(download).toHaveBeenCalledTimes(1);
    expect(download).toHaveBeenCalledWith(PATH);
  });

  it("passes a 404 or 429 through, and reports any other failure as a bad gateway", async () => {
    const failWith = (error: unknown) => {
      state.client = {
        download: async () => {
          throw error;
        },
      };
    };
    failWith(new CaselistApiError("gone", 404, PATH));
    const missing = await file.GET(new Request(FILE_URL));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "File not found on openCaselist." });

    failWith(new CaselistApiError("slow", 429, PATH));
    const limited = await file.GET(new Request(FILE_URL));
    expect(limited.status).toBe(429);
    expect((await limited.json()).error).toContain("download limit");

    failWith(new CaselistApiError("teapot", 418, PATH));
    expect((await file.GET(new Request(FILE_URL))).status).toBe(502);
    failWith(new Error("socket hang up"));
    expect((await file.GET(new Request(FILE_URL))).status).toBe(502);
  });
});
