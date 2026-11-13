// @vitest-environment jsdom
/**
 * The one-time sweep of rounds out of ebb's old IndexedDB database, run
 * against a small in-memory stand-in for the IndexedDB request API.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { makeFlowRound } from "../src/lib/model/flow";
import type { FlowFs } from "../src/lib/persistence/flowFs";
import { createFlowFs } from "../src/lib/persistence/flowFsMemory";
import { parseFlowFile } from "../src/lib/persistence/flowFile";
import { countLegacyFlows, markMigrationSettled, migrateFromIndexedDb } from "../src/lib/persistence/migrateIdb";
import { loadRecents } from "../src/lib/persistence/recents";

const DONE_KEY = "ebb-idb-migrated";

interface FakeIdb {
    /** Records in the `flows` store, or null for a database with no such store. */
    records: unknown[] | null;
    exists: boolean;
    openFails?: boolean;
    readFails?: boolean;
    deleted: number;
    closed: number;
    listable: boolean;
}

/** An IDBRequest-shaped object that fires `onsuccess`/`onerror` on the next tick. */
function request<T>(outcome: () => { result?: T; error?: unknown }) {
    const req: Record<string, any> = {};
    queueMicrotask(() => {
        const { result, error } = outcome();
        if (error !== undefined) {
            req.error = error;
            req.onerror?.();
        } else {
            req.result = result;
            req.onsuccess?.();
        }
    });
    return req;
}

function installIdb(state: FakeIdb) {
    const db = {
        objectStoreNames: { contains: (name: string) => name === "flows" && state.records !== null },
        transaction: () => ({
            objectStore: () => ({
                getAll: () =>
                    request(() => (state.readFails ? { error: null } : { result: [...(state.records ?? [])] })),
            }),
        }),
        close: () => {
            state.closed++;
        },
    };
    const idb: Record<string, unknown> = {
        open: () =>
            request(() => {
                if (state.openFails) return { error: new Error("blocked") };
                state.exists = true;
                return { result: db };
            }),
        deleteDatabase: () =>
            request(() => {
                state.deleted++;
                state.exists = false;
                state.records = null;
                return { result: undefined };
            }),
    };
    if (state.listable) idb.databases = async () => (state.exists ? [{ name: "ebbflow" }] : []);
    vi.stubGlobal("indexedDB", idb);
}

const fresh = (overrides: Partial<FakeIdb> = {}): FakeIdb => ({
    records: [],
    exists: true,
    deleted: 0,
    closed: 0,
    listable: true,
    ...overrides,
});

const round = (overrides: Record<string, unknown> = {}) => ({ ...makeFlowRound({ event: "ld" }), ...overrides });

let fs: FlowFs;

beforeEach(() => {
    localStorage.clear();
    fs = createFlowFs();
});

afterEach(() => {
    vi.unstubAllGlobals();
});

describe("countLegacyFlows", () => {
    it("is zero without IndexedDB, once settled, or when the database is absent", async () => {
        vi.stubGlobal("indexedDB", undefined);
        expect(await countLegacyFlows()).toBe(0);

        const state = fresh({ records: [round()] });
        installIdb(state);
        markMigrationSettled();
        expect(await countLegacyFlows()).toBe(0);

        localStorage.removeItem(DONE_KEY);
        state.exists = false;
        expect(await countLegacyFlows()).toBe(0);
    });

    it("counts the stored rounds and closes the database", async () => {
        const state = fresh({ records: [round(), round()] });
        installIdb(state);
        expect(await countLegacyFlows()).toBe(2);
        expect(state.closed).toBe(1);
    });

    it("opens directly where the browser cannot list databases, and treats a failed open as empty", async () => {
        installIdb(fresh({ records: [round()], listable: false }));
        expect(await countLegacyFlows()).toBe(1);

        installIdb(fresh({ records: [round()], openFails: true }));
        expect(await countLegacyFlows()).toBe(0);
    });

    it("counts a database without the flows store as empty", async () => {
        installIdb(fresh({ records: null }));
        expect(await countLegacyFlows()).toBe(0);
    });
});

describe("migrateFromIndexedDb", () => {
    it("does nothing without IndexedDB or when the database will not open", async () => {
        vi.stubGlobal("indexedDB", undefined);
        expect(await migrateFromIndexedDb("/flows", fs)).toBeNull();
        installIdb(fresh({ openFails: true }));
        expect(await migrateFromIndexedDb("/flows", fs)).toBeNull();
    });

    it("drops an empty database and settles", async () => {
        const state = fresh();
        installIdb(state);
        expect(await migrateFromIndexedDb("/flows", fs)).toBeNull();
        expect(state.deleted).toBe(1);
        expect(localStorage.getItem(DONE_KEY)).toBe("1");
    });

    it("writes live rounds to the folder and trashed ones to trash, then deletes the source", async () => {
        const live = round({ updatedAt: 1 });
        const trashed = round({ deletedAt: 5 });
        const state = fresh({ records: [live, trashed] });
        installIdb(state);
        const { flowsDir } = await fs.locations();

        const report = await migrateFromIndexedDb(flowsDir, fs);
        expect(report).toEqual({ moved: 1, trashed: 1, flowsDir });
        expect(state.deleted).toBe(1);
        expect(localStorage.getItem(DONE_KEY)).toBe("1");

        const recents = await loadRecents(fs);
        expect(recents).toHaveLength(1);
        const snapshot = await fs.readFlow(recents[0].path);
        expect(parseFlowFile(snapshot!.text).id).toBe(live.id);
        expect(recents[0].path.startsWith(flowsDir)).toBe(true);
        expect(recents[0].path).not.toContain("/trash/");
    });

    it("leaves the database whole when a record is not a round", async () => {
        const state = fresh({ records: [round(), { not: "a round" }] });
        installIdb(state);
        await expect(migrateFromIndexedDb("/flows", fs)).rejects.toThrow();
        expect(state.deleted).toBe(0);
        expect(localStorage.getItem(DONE_KEY)).toBeNull();
    });

    it("leaves the database whole when a written file cannot be read back", async () => {
        const state = fresh({ records: [round()] });
        installIdb(state);
        const broken: FlowFs = { ...fs, readFlow: async () => null } as FlowFs;
        await expect(migrateFromIndexedDb("/flows", broken)).rejects.toThrow(/could not read it back/);
        expect(state.deleted).toBe(0);
    });

    it("surfaces a failed read and still closes the database", async () => {
        const state = fresh({ records: [round()], readFails: true });
        installIdb(state);
        await expect(migrateFromIndexedDb("/flows", fs)).rejects.toThrow(/Could not read the old flows/);
        expect(state.closed).toBe(1);
    });
});
