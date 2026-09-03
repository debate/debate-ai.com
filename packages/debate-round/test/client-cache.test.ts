import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type CacheModule = typeof import("../src/cache/client-cache");

const TOURNAMENTS = ["Berkeley", "Blake", "Glenbrooks", "Harvard"];
const SCHOOLS = {
  all: ["Michigan", "Northwestern", "Wake Forest"],
  byFormat: { policy: ["Michigan"], pf: ["Wake Forest"] },
};
const NAMES = ["Alice Chen", "Bob Alvarez", "Carla Diaz"];

/**
 * Loads a fresh copy of the module so its module-level caches start empty,
 * with `fetch` stubbed to serve the fixtures above.
 */
async function loadModule(
  respond: (url: string) => { ok: boolean; body: unknown } = (url) => ({
    ok: true,
    body: url.includes("tournaments")
      ? { tournaments: TOURNAMENTS }
      : url.includes("schools")
        ? SCHOOLS
        : { names: NAMES },
  }),
): Promise<{ mod: CacheModule; fetchMock: ReturnType<typeof vi.fn> }> {
  const fetchMock = vi.fn(async (url: string) => {
    const { ok, body } = respond(url);
    return { ok, status: ok ? 200 : 500, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  vi.resetModules();
  const mod = (await import("../src/cache/client-cache")) as CacheModule;
  return { mod, fetchMock };
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("searchTournaments", () => {
  it("returns the head of the list when no query is given", async () => {
    const { mod } = await loadModule();
    expect(await mod.searchTournaments("", 2)).toEqual(["Berkeley", "Blake"]);
  });

  it("fuzzy matches a query", async () => {
    const { mod } = await loadModule();
    expect(await mod.searchTournaments("glenbrook")).toContain("Glenbrooks");
  });

  it("fetches the endpoint only once across calls", async () => {
    const { mod, fetchMock } = await loadModule();
    await mod.searchTournaments();
    await mod.searchTournaments("blake");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("/api/tournaments");
  });

  it("degrades to an empty list when the API fails", async () => {
    const { mod } = await loadModule(() => ({ ok: false, body: null }));
    expect(await mod.searchTournaments()).toEqual([]);
  });
});

describe("searchSchools", () => {
  it("returns schools up to the requested limit", async () => {
    const { mod } = await loadModule();
    expect(await mod.searchSchools("", 2)).toEqual(["Michigan", "Northwestern"]);
  });

  it("fuzzy matches a school name", async () => {
    const { mod } = await loadModule();
    expect(await mod.searchSchools("wake")).toContain("Wake Forest");
  });
});

describe("getSchoolsByFormat", () => {
  it("exposes the per-format school map", async () => {
    const { mod } = await loadModule();
    expect(await mod.getSchoolsByFormat()).toEqual(SCHOOLS.byFormat);
  });

  it("returns an empty map when the API fails", async () => {
    const { mod } = await loadModule(() => ({ ok: false, body: null }));
    expect(await mod.getSchoolsByFormat()).toEqual({});
  });
});

describe("searchNames", () => {
  it("returns debater names and honours the limit", async () => {
    const { mod } = await loadModule();
    expect(await mod.searchNames("", 1)).toEqual(["Alice Chen"]);
  });

  it("fuzzy matches a debater name", async () => {
    const { mod } = await loadModule();
    expect(await mod.searchNames("alvarez")).toContain("Bob Alvarez");
  });
});

describe("searchUsers", () => {
  const USERS = [{ id: "u1", name: "Alice Chen", email: "alice@example.com", image: null }];

  it("returns [] without calling fetch for an empty/whitespace query", async () => {
    const { mod, fetchMock } = await loadModule(() => ({ ok: true, body: { users: USERS } }));
    expect(await mod.searchUsers("")).toEqual([]);
    expect(await mod.searchUsers("   ")).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("queries the endpoint and returns matching users, honouring the limit", async () => {
    const { mod, fetchMock } = await loadModule(() => ({ ok: true, body: { users: USERS } }));
    expect(await mod.searchUsers("alice", 1)).toEqual(USERS);
    expect(fetchMock).toHaveBeenCalledWith("/api/users/search?q=alice");
  });

  it("degrades to an empty list on a failed request", async () => {
    const { mod } = await loadModule(() => ({ ok: false, body: null }));
    expect(await mod.searchUsers("alice")).toEqual([]);
  });

  it("degrades to an empty list when fetch itself throws", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("network down");
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.resetModules();
    const mod = (await import("../src/cache/client-cache")) as CacheModule;

    expect(await mod.searchUsers("alice")).toEqual([]);
  });
});
