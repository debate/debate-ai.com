// @vitest-environment jsdom
/**
 * @fileoverview `useCustomOpponentPersonaLibrary` — the local-first custom
 * opponent persona library: account merge by id (newer `updatedAt` wins),
 * best-effort pushes and deletes, and the read-only "shared by your team"
 * fetch that falls back to an empty list on failure.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SavedCustomOpponentPersona } from "../src/state/customOpponentPersonaLibrary";
import { flush } from "./helpers/mount";
import { renderHook, type RenderedHook } from "./helpers/render-hook";

type Entries = SavedCustomOpponentPersona[] | null;

const client = vi.hoisted(() => ({
  listMyCustomOpponentPersonas: vi.fn<() => Promise<Entries>>(),
  listSharedCustomOpponentPersonas: vi.fn<() => Promise<SavedCustomOpponentPersona[]>>(),
  saveCustomOpponentPersonaToAccount: vi.fn<(entry: SavedCustomOpponentPersona) => Promise<void>>(),
  deleteCustomOpponentPersonaFromAccount: vi.fn<(id: string) => Promise<void>>(),
}));
const sharedOverride = vi.hoisted(() => ({ current: null as null | (() => Promise<SavedCustomOpponentPersona[]>) }));
vi.mock("../src/round/custom-opponent-persona-library-client", () => ({
  ...client,
  // A plain rejecting function rather than a rejecting `vi.fn` result,
  // which Vitest reports as a test error even once the hook has caught it.
  listSharedCustomOpponentPersonas: () =>
    sharedOverride.current ? sharedOverride.current() : client.listSharedCustomOpponentPersonas(),
}));

function persona(overrides: Partial<SavedCustomOpponentPersona> = {}): SavedCustomOpponentPersona {
  return {
    id: "persona-1",
    name: "Spreader",
    notes: "Reads six off-case positions.",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  } as SavedCustomOpponentPersona;
}

type Hook = typeof import("../src/hooks/useCustomOpponentPersonaLibrary");
type State = typeof import("../src/state/customOpponentPersonaLibrary");

let hookModule: Hook;
let state: State;
let rendered: RenderedHook<ReturnType<Hook["useCustomOpponentPersonaLibrary"]>> | null = null;

beforeEach(async () => {
  localStorage.clear();
  vi.clearAllMocks();
  sharedOverride.current = null;
  client.listSharedCustomOpponentPersonas.mockResolvedValue([]);
  client.saveCustomOpponentPersonaToAccount.mockResolvedValue(undefined);
  client.deleteCustomOpponentPersonaFromAccount.mockResolvedValue(undefined);
  vi.resetModules();
  hookModule = await import("../src/hooks/useCustomOpponentPersonaLibrary");
  state = await import("../src/state/customOpponentPersonaLibrary");
});

afterEach(async () => {
  await rendered?.unmount();
  rendered = null;
});

async function render() {
  rendered = await renderHook(() => hookModule.useCustomOpponentPersonaLibrary());
  await flush(async () => {});
  return rendered.result;
}

describe("useCustomOpponentPersonaLibrary signed out", () => {
  beforeEach(() => client.listMyCustomOpponentPersonas.mockResolvedValue(null));

  it("saves a new entry and edits it in place, locally only", async () => {
    const result = await render();
    expect(result.current.library).toEqual([]);
    expect(result.current.synced).toBe(false);

    let saved: SavedCustomOpponentPersona | undefined;
    await flush(() => {
      saved = result.current.saveEntry({ name: "Spreader", notes: "Fast." });
    });
    expect(result.current.library).toEqual([saved]);

    await flush(() => {
      result.current.saveEntry({ id: saved!.id, name: "Spreader", notes: "Very fast." });
    });
    expect(result.current.library).toHaveLength(1);
    expect(result.current.library?.[0]?.notes).toBe("Very fast.");
    expect(result.current.library?.[0]?.createdAt).toBe(saved!.createdAt);

    await flush(() => result.current.deleteEntry(saved!.id));
    expect(result.current.library).toEqual([]);
    expect(client.saveCustomOpponentPersonaToAccount).not.toHaveBeenCalled();
    expect(client.deleteCustomOpponentPersonaFromAccount).not.toHaveBeenCalled();
  });

  it("loads the team's shared entries, and an empty list when that fetch fails", async () => {
    client.listSharedCustomOpponentPersonas.mockResolvedValue([persona({ id: "team-1" })]);
    const result = await render();
    expect(result.current.sharedByTeam?.map((entry) => entry.id)).toEqual(["team-1"]);

    sharedOverride.current = () => Promise.reject(new Error("403"));
    await flush(() => result.current.refreshSharedByTeam());
    expect(result.current.sharedByTeam).toEqual([]);
  });
});

describe("useCustomOpponentPersonaLibrary signed in", () => {
  it("adopts newer remote entries and pushes newer or local-only ones", async () => {
    state.saveCustomOpponentPersonaLibraryEntry(persona({ id: "older-here", name: "Old", updatedAt: 1 }));
    state.saveCustomOpponentPersonaLibraryEntry(persona({ id: "local-only", name: "Mine", updatedAt: 1 }));
    client.listMyCustomOpponentPersonas.mockResolvedValue([
      persona({ id: "older-here", name: "Renamed", updatedAt: 5 }),
      persona({ id: "remote-only", name: "Theirs", updatedAt: 2 }),
    ]);

    const result = await render();
    expect(result.current.synced).toBe(true);
    expect(state.getCustomOpponentPersonaLibraryEntry("older-here")?.name).toBe("Renamed");
    expect(state.getCustomOpponentPersonaLibraryEntry("remote-only")).toBeDefined();
    expect(client.saveCustomOpponentPersonaToAccount.mock.calls.map(([entry]) => entry.id)).toEqual(["local-only"]);
  });

  it("pushes saves and deletes to the account", async () => {
    client.listMyCustomOpponentPersonas.mockResolvedValue([]);
    const result = await render();
    let saved: SavedCustomOpponentPersona | undefined;
    await flush(() => {
      saved = result.current.saveEntry({ name: "Kritik", notes: "Runs cap K.", shared: true });
    });
    expect(client.saveCustomOpponentPersonaToAccount).toHaveBeenCalledWith(saved);

    await flush(() => result.current.deleteEntry(saved!.id));
    expect(client.deleteCustomOpponentPersonaFromAccount).toHaveBeenCalledWith(saved!.id);
  });
});
