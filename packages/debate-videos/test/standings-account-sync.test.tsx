// @vitest-environment jsdom
/**
 * @fileoverview Tests `useStandingsAccountSync`: the one-time account merge
 * (union of tournament results, "remote wins else push local" for the
 * qualification settings) and the local-first write helpers that only hit
 * the account once a merge proved this browser is signed in.
 *
 * The local stores and the account clients are mocked so each assertion is
 * about the hook's own routing; the module is re-imported per test because
 * the merge promise and the signed-in flag are module-level by design.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook, flush } from "./helpers/mount";

const m = vi.hoisted(() => ({
  listTournamentResults: vi.fn(),
  saveTournamentResultLocal: vi.fn(),
  deleteTournamentResultLocal: vi.fn(),
  bulkImportLocal: vi.fn(),
  listSaved: vi.fn(),
  saveToAccount: vi.fn(),
  deleteFromAccount: vi.fn(),
  getTable: vi.fn(),
  saveTable: vi.fn(),
  resetTable: vi.fn(),
  effectiveTable: vi.fn(),
  getCutoff: vi.fn(),
  saveCutoff: vi.fn(),
  resetCutoff: vi.fn(),
  effectiveCutoff: vi.fn(),
  fetchTable: vi.fn(),
  saveTableRemote: vi.fn(),
  fetchCutoff: vi.fn(),
  saveCutoffRemote: vi.fn(),
}));

vi.mock("@debate/data-sync/src/state/tournamentResults", () => ({
  listTournamentResults: m.listTournamentResults,
  saveTournamentResult: m.saveTournamentResultLocal,
  deleteTournamentResult: m.deleteTournamentResultLocal,
  bulkImportTournamentResults: m.bulkImportLocal,
}));
vi.mock("@debate/data-sync/src/state/tournament-results-client", () => ({
  listSavedTournamentResults: m.listSaved,
  saveTournamentResultToAccount: m.saveToAccount,
  deleteSavedTournamentResultFromAccount: m.deleteFromAccount,
}));
vi.mock("@debate/data-sync/src/state/qualificationPointsTable", () => ({
  getPersistedQualificationPointsTable: m.getTable,
  savePersistedQualificationPointsTable: m.saveTable,
  resetPersistedQualificationPointsTable: m.resetTable,
  getEffectiveQualificationPointsTable: m.effectiveTable,
}));
vi.mock("@debate/data-sync/src/state/qualificationCutoff", () => ({
  getPersistedQualificationCutoff: m.getCutoff,
  savePersistedQualificationCutoff: m.saveCutoff,
  resetPersistedQualificationCutoff: m.resetCutoff,
  getEffectiveQualificationCutoff: m.effectiveCutoff,
}));
vi.mock("@debate/data-sync/src/state/qualification-settings-sync-client", () => ({
  fetchQualificationPointsTable: m.fetchTable,
  saveQualificationPointsTable: m.saveTableRemote,
  fetchQualificationCutoff: m.fetchCutoff,
  saveQualificationCutoff: m.saveCutoffRemote,
}));

const r = (id: string) => ({ id }) as any;

async function load() {
  vi.resetModules();
  return (await import("../src/hooks/useStandingsAccountSync")).useStandingsAccountSync;
}

beforeEach(() => {
  for (const fn of Object.values(m)) fn.mockReset();
  m.listTournamentResults.mockReturnValue([]);
  m.saveToAccount.mockResolvedValue(undefined);
  m.deleteFromAccount.mockResolvedValue(undefined);
  m.saveTableRemote.mockResolvedValue(undefined);
  m.saveCutoffRemote.mockResolvedValue(undefined);
  m.getTable.mockReturnValue(null);
  m.getCutoff.mockReturnValue(null);
  m.effectiveTable.mockReturnValue({ default: true });
  m.effectiveCutoff.mockReturnValue({ cutoff: "default" });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("useStandingsAccountSync — signed out", () => {
  it("stays local-only when every account fetch returns null", async () => {
    m.listSaved.mockResolvedValue(null);
    m.fetchTable.mockResolvedValue(null);
    m.fetchCutoff.mockResolvedValue(null);
    const onChange = vi.fn();
    const useHook = await load();
    const hook = await renderHook(() => useHook(onChange));
    await flush();

    expect(hook.result.current.synced).toBe(false);
    expect(onChange).toHaveBeenCalledTimes(1);

    hook.result.current.saveTournamentResult(r("a"));
    hook.result.current.deleteTournamentResult("a");
    hook.result.current.saveQualificationPointsTable({ t: 1 } as any);
    hook.result.current.saveQualificationCutoff({ c: 1 } as any);
    expect(hook.result.current.resetQualificationPointsTable()).toEqual({ default: true });
    expect(hook.result.current.resetQualificationCutoff()).toEqual({ cutoff: "default" });

    expect(m.saveTournamentResultLocal).toHaveBeenCalledWith(r("a"));
    expect(m.deleteTournamentResultLocal).toHaveBeenCalledWith("a");
    expect(m.saveTable).toHaveBeenCalledWith({ t: 1 });
    expect(m.saveCutoff).toHaveBeenCalledWith({ c: 1 });
    expect(m.resetTable).toHaveBeenCalled();
    expect(m.resetCutoff).toHaveBeenCalled();
    expect(m.saveToAccount).not.toHaveBeenCalled();
    expect(m.deleteFromAccount).not.toHaveBeenCalled();
    expect(m.saveTableRemote).not.toHaveBeenCalled();
    expect(m.saveCutoffRemote).not.toHaveBeenCalled();
  });

  it("treats rejected fetches as signed out", async () => {
    m.listSaved.mockRejectedValue(new Error("401"));
    m.fetchTable.mockRejectedValue(new Error("401"));
    m.fetchCutoff.mockRejectedValue(new Error("401"));
    m.bulkImportLocal.mockReturnValue({ importedCount: 2, errors: [] });
    const useHook = await load();
    const hook = await renderHook(() => useHook(() => {}));
    await flush();

    expect(hook.result.current.synced).toBe(false);
    expect(hook.result.current.bulkImportTournamentResults("csv")).toEqual({ importedCount: 2, errors: [] });
    expect(m.bulkImportLocal).toHaveBeenCalledWith("csv");
    expect(m.saveToAccount).not.toHaveBeenCalled();
  });
});

describe("useStandingsAccountSync — signed in", () => {
  it("unions results by id: adopts remote-only, pushes local-only", async () => {
    m.listTournamentResults.mockReturnValue([r("shared"), r("local-only")]);
    m.listSaved.mockResolvedValue([r("shared"), r("remote-only")]);
    m.fetchTable.mockResolvedValue(null);
    m.fetchCutoff.mockResolvedValue(null);
    const useHook = await load();
    const hook = await renderHook(() => useHook(() => {}));
    await flush();

    expect(hook.result.current.synced).toBe(true);
    expect(m.saveTournamentResultLocal).toHaveBeenCalledTimes(1);
    expect(m.saveTournamentResultLocal).toHaveBeenCalledWith(r("remote-only"));
    expect(m.saveToAccount).toHaveBeenCalledTimes(1);
    expect(m.saveToAccount).toHaveBeenCalledWith(r("local-only"));
  });

  it("lets a saved remote points table and cutoff overwrite local", async () => {
    m.listSaved.mockResolvedValue(null);
    m.fetchTable.mockResolvedValue({ qualificationPointsTable: { remote: 1 } });
    m.fetchCutoff.mockResolvedValue({ qualificationCutoff: { remote: 2 } });
    const useHook = await load();
    const hook = await renderHook(() => useHook(() => {}));
    await flush();

    expect(hook.result.current.synced).toBe(true);
    expect(m.saveTable).toHaveBeenCalledWith({ remote: 1 });
    expect(m.saveCutoff).toHaveBeenCalledWith({ remote: 2 });
    expect(m.saveTableRemote).not.toHaveBeenCalled();
    expect(m.saveCutoffRemote).not.toHaveBeenCalled();
  });

  it("pushes local settings up when the account has none", async () => {
    m.listSaved.mockResolvedValue([]);
    m.fetchTable.mockResolvedValue({ qualificationPointsTable: null });
    m.fetchCutoff.mockResolvedValue({ qualificationCutoff: null });
    m.getTable.mockReturnValue({ local: 1 });
    m.getCutoff.mockReturnValue({ local: 2 });
    const useHook = await load();
    await renderHook(() => useHook(() => {}));
    await flush();

    expect(m.saveTableRemote).toHaveBeenCalledWith({ local: 1 });
    expect(m.saveCutoffRemote).toHaveBeenCalledWith({ local: 2 });
  });

  it("pushes nothing when neither side has settings", async () => {
    m.listSaved.mockResolvedValue([]);
    m.fetchTable.mockResolvedValue({ qualificationPointsTable: null });
    m.fetchCutoff.mockResolvedValue({ qualificationCutoff: null });
    const useHook = await load();
    await renderHook(() => useHook(() => {}));
    await flush();

    expect(m.saveTableRemote).not.toHaveBeenCalled();
    expect(m.saveCutoffRemote).not.toHaveBeenCalled();
  });

  it("swallows a failed best-effort push during the merge", async () => {
    m.listTournamentResults.mockReturnValue([r("x")]);
    m.listSaved.mockResolvedValue([]);
    m.saveToAccount.mockRejectedValue(new Error("offline"));
    m.fetchTable.mockResolvedValue({ qualificationPointsTable: null });
    m.fetchCutoff.mockResolvedValue({ qualificationCutoff: null });
    m.getTable.mockReturnValue({ t: 1 });
    m.getCutoff.mockReturnValue({ c: 1 });
    m.saveTableRemote.mockRejectedValue(new Error("offline"));
    m.saveCutoffRemote.mockRejectedValue(new Error("offline"));
    const useHook = await load();
    const hook = await renderHook(() => useHook(() => {}));
    await flush();

    expect(hook.result.current.synced).toBe(true);
    expect(m.saveToAccount).toHaveBeenCalledWith(r("x"));
  });

  it("mirrors every write helper to the account", async () => {
    m.listSaved.mockResolvedValue([]);
    m.fetchTable.mockResolvedValue(null);
    m.fetchCutoff.mockResolvedValue(null);
    const useHook = await load();
    const hook = await renderHook(() => useHook(() => {}));
    await flush();
    const api = hook.result.current;

    api.saveTournamentResult(r("n"));
    api.deleteTournamentResult("n");
    api.saveQualificationPointsTable({ t: 2 } as any);
    api.saveQualificationCutoff({ c: 2 } as any);
    expect(api.resetQualificationPointsTable()).toEqual({ default: true });
    expect(api.resetQualificationCutoff()).toEqual({ cutoff: "default" });

    expect(m.saveToAccount).toHaveBeenCalledWith(r("n"));
    expect(m.deleteFromAccount).toHaveBeenCalledWith("n");
    expect(m.saveTableRemote).toHaveBeenCalledWith({ t: 2 });
    expect(m.saveTableRemote).toHaveBeenCalledWith(null);
    expect(m.saveCutoffRemote).toHaveBeenCalledWith({ c: 2 });
    expect(m.saveCutoffRemote).toHaveBeenCalledWith(null);
  });

  it("keeps local writes when the account writes reject", async () => {
    m.listSaved.mockResolvedValue([]);
    m.fetchTable.mockResolvedValue(null);
    m.fetchCutoff.mockResolvedValue(null);
    const useHook = await load();
    const hook = await renderHook(() => useHook(() => {}));
    await flush();
    m.saveToAccount.mockRejectedValue(new Error("x"));
    m.deleteFromAccount.mockRejectedValue(new Error("x"));
    m.saveTableRemote.mockRejectedValue(new Error("x"));
    m.saveCutoffRemote.mockRejectedValue(new Error("x"));
    const api = hook.result.current;

    await flush(() => {
      api.saveTournamentResult(r("n"));
      api.deleteTournamentResult("n");
      api.saveQualificationPointsTable({} as any);
      api.saveQualificationCutoff({} as any);
      api.resetQualificationPointsTable();
      api.resetQualificationCutoff();
    });

    expect(m.saveTournamentResultLocal).toHaveBeenCalledWith(r("n"));
    expect(m.deleteTournamentResultLocal).toHaveBeenCalledWith("n");
  });

  it("pushes only the newly imported rows of a bulk import", async () => {
    m.listSaved.mockResolvedValue([]);
    m.fetchTable.mockResolvedValue(null);
    m.fetchCutoff.mockResolvedValue(null);
    const useHook = await load();
    const hook = await renderHook(() => useHook(() => {}));
    await flush();

    m.bulkImportLocal.mockReturnValue({ importedCount: 2, errors: [] });
    m.listTournamentResults.mockReturnValue([r("old"), r("new1"), r("new2")]);
    m.saveToAccount.mockClear();
    hook.result.current.bulkImportTournamentResults("csv");
    expect(m.saveToAccount.mock.calls.map((c) => c[0].id)).toEqual(["new1", "new2"]);

    m.saveToAccount.mockClear();
    m.saveToAccount.mockRejectedValue(new Error("x"));
    m.bulkImportLocal.mockReturnValue({ importedCount: 0, errors: ["bad"] });
    await flush(() => {
      hook.result.current.bulkImportTournamentResults("bad csv");
    });
    expect(m.saveToAccount).not.toHaveBeenCalled();

    m.bulkImportLocal.mockReturnValue({ importedCount: 1, errors: [] });
    await flush(() => {
      hook.result.current.bulkImportTournamentResults("csv2");
    });
    expect(m.saveToAccount).toHaveBeenCalledWith(r("new2"));
  });

  it("shares one merge across mounts and skips updates after unmount", async () => {
    let resolve!: (v: unknown) => void;
    m.listSaved.mockReturnValue(new Promise((res) => (resolve = res)));
    m.fetchTable.mockResolvedValue(null);
    m.fetchCutoff.mockResolvedValue(null);
    const useHook = await load();
    const first = vi.fn();
    const second = vi.fn();
    const a = await renderHook(() => useHook(first));
    const b = await renderHook(() => useHook(second));
    await a.unmount();

    await flush(() => resolve([]));
    expect(m.listSaved).toHaveBeenCalledTimes(1);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
    expect(b.result.current.synced).toBe(true);
  });
});
