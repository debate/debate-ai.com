/**
 * Opening, creating, and saving the one flow file ebb has open.
 *
 * Autosave keeps the shape it had against the database - a 500ms debounce, a
 * sequence guard so a slow earlier write cannot report over a newer one, and a
 * flush on teardown - because that behavior is what makes losing a round
 * impossible, and none of it depended on the storage being a database. Only the
 * sink changed, and it gained an atomic write on the way.
 *
 * A new flow is written to the flows folder the moment it is created, so there
 * is never an unanchored buffer, never a dirty state, and never a save prompt
 * between the user and a speech that has already started.
 */

import type { StoreApi } from "zustand";

import { persistReplica } from "../collab/persist";
import type { FlowRound } from "../model/flow";

import { parseFlowFile, parseLegacyExport, serializeFlow } from "./flowFile";
import { getFlowFs, type FlowFs } from "./flowFs";
import { EBB_EXT, basename, suggestFilename } from "./flowPaths";
import { resolveFlowsDir } from "./flowsDir";
import { loadRecents, promoteRecent, saveRecents } from "./recents";

/**
 * Lifecycle of a single save, reported so the header can reassure the user.
 * "conflict" is distinct from "error" because the fix is a decision, not a
 * retry: the file changed outside ebb and someone has to choose a winner.
 */
export type SaveStatus = "saving" | "saved" | "error" | "conflict";

const DEBOUNCE_MS = 500;

/**
 * Longest an edit may sit unwritten. A debounce that only ever resets never
 * fires during a fast speech, where cell edits land closer together than the
 * window, so a crash would cost the whole burst instead of half a second.
 */
const MAX_WAIT_MS = 2_000;

/** Rust tags a refused overwrite with this; the prefix is a shared contract. */
const CONFLICT_PREFIX = "conflict:";

export function isConflict(err: unknown): boolean {
    return typeof err === "string" && err.startsWith(CONFLICT_PREFIX);
}

/**
 * The version of the open file ebb last saw.
 *
 * Every write carries it back so the shell can tell whether anything else
 * touched the file meanwhile - a sync client pulling a copy from another
 * machine is the realistic case, since the default flows folder sits under
 * Documents, which iCloud syncs by default on many Macs. Keyed by path so a
 * stamp left over from a previously open flow can never be applied to a new
 * one.
 */
let seen: { path: string; mtimeMs: number } | null = null;

function stampFor(path: string): number | null {
    return seen?.path === path ? seen.mtimeMs : null;
}

function remember(path: string, mtimeMs: number): void {
    seen = { path, mtimeMs };
}

/** Test seam: drop the remembered stamp so suites cannot leak into each other. */
export function forgetSeenStamp(): void {
    seen = null;
}

// --- Recents bookkeeping -------------------------------------------------------

/** Record a path as the most recently opened flow. */
export async function noteOpened(path: string, fs?: FlowFs): Promise<void> {
    const io = fs ?? (await getFlowFs());
    await saveRecents(io, promoteRecent(await loadRecents(io), path, Date.now()));
}

// --- Reading -------------------------------------------------------------------

/**
 * Read the flow at `path`, or null when the file is gone - an ordinary outcome
 * for a recent entry whose flow was moved or deleted outside ebb. A file that
 * exists but does not parse throws, because that is a real problem the user
 * needs told about rather than a flow quietly vanishing from the list.
 */
export async function readFlowAt(path: string, fs?: FlowFs): Promise<FlowRound | null> {
    const io = fs ?? (await getFlowFs());
    const snapshot = await io.readFlow(path);
    if (snapshot === null) return null;
    remember(path, snapshot.mtimeMs);
    return parseFlowFile(snapshot.text);
}

/**
 * The most recently opened flow that still exists on disk, so the editor can
 * resume straight into a document instead of asking. Walks the recents list
 * in order and skips anything moved or deleted outside ebb, rather than
 * pruning it here — the list is pruned lazily wherever it's read for display.
 */
export async function resolveResumePath(fs?: FlowFs): Promise<string | null> {
    const io = fs ?? (await getFlowFs());
    for (const recent of await loadRecents(io)) {
        if ((await io.readFlow(recent.path)) !== null) return recent.path;
    }
    return null;
}

// --- Creating and saving -------------------------------------------------------

/** Write a brand-new flow into the flows folder; resolves to the path used. */
export async function createFlowFile(round: FlowRound, fs?: FlowFs): Promise<string> {
    const io = fs ?? (await getFlowFs());
    const dir = await resolveFlowsDir(io);
    const text = serializeFlow(round);
    const path = await io.createFlow(dir, suggestFilename(round), text);
    await noteOpened(path, io);
    void persistReplica(round, text);
    return path;
}

/**
 * Pick a flow to open. A `.ebb` is opened in place; anything else is treated as
 * a legacy export and materialized into the flows folder first, so the exports
 * users already have stay openable without becoming a second kind of document.
 * Resolves to the path to route to, or null when the picker was cancelled.
 */
export async function pickFlowToOpen(fs?: FlowFs): Promise<string | null> {
    const io = fs ?? (await getFlowFs());
    const picked = await io.pickOpenPath();
    if (!picked) return null;
    if (picked.toLowerCase().endsWith(EBB_EXT)) {
        await noteOpened(picked, io);
        return picked;
    }
    return importLegacyExport(picked, io);
}

/**
 * Turn a pre-.ebb JSON export into real flow files. A backup holding many
 * rounds becomes many files; the first is the one to open.
 */
async function importLegacyExport(path: string, io: FlowFs): Promise<string> {
    const snapshot = await io.readFlow(path);
    if (snapshot === null) throw new Error(`${basename(path)} no longer exists`);

    const rounds = parseLegacyExport(snapshot.text);
    if (!rounds.length) throw new Error(`${basename(path)} holds no flows`);

    const dir = await resolveFlowsDir(io);
    const written: string[] = [];
    for (const round of rounds) {
        written.push(await io.createFlow(dir, suggestFilename(round), serializeFlow(round)));
    }
    await noteOpened(written[0], io);
    return written[0];
}

/**
 * Save the open round to a location the user picks, and continue editing there.
 * Resolves to the new path, or null when the picker was cancelled.
 */
export async function saveFlowAs(round: FlowRound, fs?: FlowFs): Promise<string | null> {
    const io = fs ?? (await getFlowFs());
    const path = await io.pickSavePath(suggestFilename(round));
    if (!path) return null;
    const text = serializeFlow(round);
    // A path the user just chose is theirs to claim, so the write is forced.
    remember(path, await io.writeFlow(path, text, null));
    await noteOpened(path, io);
    void persistReplica(round, text);
    return path;
}

/**
 * Write immediately and report whether the flow reached disk.
 *
 * The boolean matters: a caller that is about to discard the round - closing
 * it, or quitting - must not treat a failed write as done. Backs the manual
 * retry affordance too.
 */
export async function saveFlowNow(
    path: string,
    round: FlowRound,
    onStatus?: (status: SaveStatus) => void,
): Promise<boolean> {
    return write(path, round, stampFor(path), onStatus);
}

/**
 * Write over a flow that changed outside ebb, keeping the round in memory and
 * discarding whatever the other writer put there. Only reachable once the user
 * has been told about the conflict.
 */
export async function overwriteFlow(
    path: string,
    round: FlowRound,
    onStatus?: (status: SaveStatus) => void,
): Promise<boolean> {
    return write(path, round, null, onStatus);
}

async function write(
    path: string,
    round: FlowRound,
    expectedMtimeMs: number | null,
    onStatus?: (status: SaveStatus) => void,
): Promise<boolean> {
    onStatus?.("saving");
    try {
        const io = await getFlowFs();
        const text = serializeFlow(round);
        remember(path, await io.writeFlow(path, text, expectedMtimeMs));
        onStatus?.("saved");
        void persistReplica(round, text);
        return true;
    } catch (err) {
        onStatus?.(isConflict(err) ? "conflict" : "error");
        return false;
    }
}

// --- Autosave --------------------------------------------------------------------

export interface FlowAutosave {
    /**
     * Treat the store's current round as already on disk.
     *
     * Called right after a flow is loaded, and after Save As has written the
     * round to its new path. Without it the subscriber cannot tell a freshly
     * opened round from an edited one: guessing from the round id used to skip
     * the first edit after Save As entirely, because the new subscriber never
     * saw the load it was inferring from.
     */
    prime(): void;
    /** Stop listening, flushing anything still pending. */
    detach(): void;
}

/**
 * Subscribe to a store holding the open round and its path, and write on every
 * change, debounced. Only the newest write reports a terminal status, so a slow
 * earlier one cannot clobber a newer one's result.
 */
export function attachFlowAutosave(
    store: StoreApi<{ round: FlowRound | null; docPath: string | null }>,
    onStatus?: (status: SaveStatus) => void,
): FlowAutosave {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let lastSeenId: string | null = null;
    let lastSeenUpdatedAt: number | null = null;
    let pending: { path: string; round: FlowRound } | null = null;
    let pendingSince = 0;
    let saveSeq = 0;

    function doSave(job: { path: string; round: FlowRound }) {
        const seq = ++saveSeq;
        const text = serializeFlow(job.round);
        onStatus?.("saving");
        getFlowFs()
            .then((io) => io.writeFlow(job.path, text, stampFor(job.path)))
            .then(
                (mtimeMs) => {
                    remember(job.path, mtimeMs);
                    if (seq === saveSeq) onStatus?.("saved");
                    // Beside each autosave, and only once the flow itself
                    // landed: a sidecar that outran the file it stamps would
                    // be discarded on the next open anyway.
                    void persistReplica(job.round, text);
                },
                (err: unknown) => {
                    if (seq === saveSeq) onStatus?.(isConflict(err) ? "conflict" : "error");
                },
            );
    }

    function flush() {
        clearTimeout(timer);
        timer = undefined;
        if (pending !== null) {
            const job = pending;
            pending = null;
            doSave(job);
        }
    }

    function prime() {
        const { round } = store.getState();
        lastSeenId = round?.id ?? null;
        lastSeenUpdatedAt = round?.updatedAt ?? null;
        // Anything queued before priming described the state we are declaring
        // already saved, so writing it would only rewrite identical bytes.
        pending = null;
        clearTimeout(timer);
        timer = undefined;
    }

    const unsubscribe = store.subscribe((state) => {
        const { round, docPath } = state;
        if (!round || !docPath) return;
        if (round.id === lastSeenId && round.updatedAt === lastSeenUpdatedAt) return;
        lastSeenId = round.id;
        lastSeenUpdatedAt = round.updatedAt;

        if (pending === null) pendingSince = Date.now();
        pending = { path: docPath, round };

        // A debounce that only ever resets never fires during a fast speech,
        // where edits land closer together than the window. The ceiling bounds
        // what a crash can cost to MAX_WAIT_MS rather than the whole burst.
        if (Date.now() - pendingSince >= MAX_WAIT_MS) {
            flush();
            return;
        }
        clearTimeout(timer);
        timer = setTimeout(flush, DEBOUNCE_MS);
    });

    return {
        prime,
        detach() {
            unsubscribe();
            flush();
        },
    };
}
