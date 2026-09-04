/**
 * One-time sweep of the flows that used to live in IndexedDB.
 *
 * Ebb kept every round in a single-table Dexie database before flows became
 * files. That data is a user's tournament history, so the sweep runs itself: it
 * checks every record against the file format, writes each round into the flows
 * folder, reads every file back and parses it, and only then deletes the
 * database. Any failure leaves the source untouched, because a half-finished
 * migration that has already dropped its input is the one outcome worse than
 * not migrating at all. A record the format rejects is such a failure: the
 * shape a v3 round needs is the shape this build can render, and normalizing
 * anything else produces an empty round that the read-back cannot tell from a
 * real one.
 *
 * The raw IndexedDB API is used rather than Dexie so the dependency can go.
 * Soft-deleted rounds are written to a trash subfolder instead of discarded:
 * the trash concept is gone, but the rounds that were in it are still the
 * user's.
 */

import { normalizeFlow } from "../model/flow";

import { checkRound, parseFlowFile, serializeFlow } from "./flowFile";
import { getFlowFs, type FlowFs } from "./flowFs";
import { joinPath, suggestFilename } from "./flowPaths";
import { loadRecents, promoteRecent, saveRecents } from "./recents";

const DB_NAME = "ebbflow";
const STORE = "flows";
const DONE_KEY = "ebb-idb-migrated";

export interface MigrationReport {
    /** Live rounds written into the flows folder. */
    moved: number;
    /** Soft-deleted rounds written into its trash subfolder. */
    trashed: number;
    flowsDir: string;
}

function openDb(): Promise<IDBDatabase | null> {
    return new Promise((resolve) => {
        // Opening creates an empty database when none exists, which reads as
        // "no flows to migrate" and is deleted along with a real one.
        const req = indexedDB.open(DB_NAME);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
    });
}

function readAll(db: IDBDatabase): Promise<unknown[]> {
    if (!db.objectStoreNames.contains(STORE)) return Promise.resolve([]);
    return new Promise((resolve, reject) => {
        const req = db.transaction(STORE, "readonly").objectStore(STORE).getAll();
        req.onsuccess = () => resolve(req.result as unknown[]);
        req.onerror = () => reject(req.error ?? new Error("Could not read the old flows"));
    });
}

function deleteDb(): Promise<void> {
    return new Promise((resolve) => {
        const req = indexedDB.deleteDatabase(DB_NAME);
        // A blocked or failed deletion is not worth surfacing: the files are
        // already written and verified, and the marker stops a second sweep.
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
        req.onblocked = () => resolve();
    });
}

/**
 * How many rounds are still sitting in the old database.
 *
 * Read-only and side-effect free, so the start screen can ask before deciding
 * whether to prompt. `indexedDB.open` would create the database if it were
 * absent, which is the wrong thing to do while merely looking, so existence is
 * checked first where the browser can answer that.
 */
export async function countLegacyFlows(): Promise<number> {
    if (typeof indexedDB === "undefined") return 0;
    if (typeof localStorage !== "undefined" && localStorage.getItem(DONE_KEY)) return 0;

    if (typeof indexedDB.databases === "function") {
        const present = (await indexedDB.databases()).some((d) => d.name === DB_NAME);
        if (!present) return 0;
    }

    const db = await openDb();
    if (!db) return 0;
    try {
        return (await readAll(db)).length;
    } finally {
        db.close();
    }
}

/** Record that there is nothing left to move, so no launch prompts again. */
export function markMigrationSettled(): void {
    localStorage?.setItem(DONE_KEY, "1");
}

/**
 * Move every stored round into `targetDir`. Never runs on its own: the user is
 * asked first, because where their rounds land is their decision, and a silent
 * bulk write into a folder they did not choose is not a migration they can
 * disagree with.
 *
 * Resolves to null when there was nothing to move.
 */
export async function migrateFromIndexedDb(
    targetDir: string,
    fs?: FlowFs,
): Promise<MigrationReport | null> {
    if (typeof indexedDB === "undefined") return null;

    const db = await openDb();
    if (!db) return null;

    let records: unknown[];
    try {
        records = await readAll(db);
    } finally {
        db.close();
    }

    if (!records.length) {
        await deleteDb();
        markMigrationSettled();
        return null;
    }

    const io = fs ?? (await getFlowFs());
    const trashDir = joinPath(targetDir, "trash");

    // Check every record before writing any of them. normalizeFlow fills
    // defaults rather than validating, so a record whose shape this build cannot
    // represent becomes an empty round stamped version 3, which the read-back
    // below then parses happily: the content is gone before the write, so the
    // guard cannot see it. A throw here leaves the database whole.
    const rounds = records.map((record) => {
        const trashed =
            typeof record === "object" &&
            record !== null &&
            "deletedAt" in record &&
            record.deletedAt != null;
        // normalizeFlow drops deletedAt; the subfolder carries that fact now.
        return { round: normalizeFlow(checkRound(record, "record")), live: !trashed };
    });

    const written: { path: string; live: boolean }[] = [];
    for (const { round, live } of rounds) {
        const path = await io.createFlow(
            live ? targetDir : trashDir,
            suggestFilename(round),
            serializeFlow(round),
        );
        written.push({ path, live });
    }

    // Read every file back before dropping the source. A write that reported
    // success but produced something unparseable is exactly the failure this
    // guards, and it is only detectable from the far side.
    for (const { path } of written) {
        const snapshot = await io.readFlow(path);
        if (snapshot === null) {
            throw new Error(`Migration wrote ${path} but could not read it back`);
        }
        parseFlowFile(snapshot.text);
    }

    await deleteDb();
    markMigrationSettled();

    // Seed the start screen oldest-first, so the most recently updated round
    // ends up at the top of the list.
    const live = written.filter((w) => w.live);
    let recents = await loadRecents(io);
    for (const { path } of live) recents = promoteRecent(recents, path, Date.now());
    await saveRecents(io, recents);

    return {
        moved: live.length,
        trashed: written.length - live.length,
        flowsDir: targetDir,
    };
}
