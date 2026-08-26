/**
 * Browser adapter for `npm run dev` and the test suite.
 *
 * Where the File System Access API exists (Chromium), this is a real editor:
 * the pickers are the OS's own, and a file opened through one is written back
 * through its handle, so edits land on disk. Everywhere else - other browsers,
 * and jsdom - it falls back to an in-memory map with virtual paths, which is
 * what the tests run against.
 *
 * The map is mirrored to localStorage so a dev reload does not lose the flow
 * you were looking at. That is a development convenience, not a product
 * surface: the static export exists only as Tauri's frontend.
 */

import type { FlowFs } from "./flowFs";
import { basename, dedupeFilename, joinPath } from "./flowPaths";

const STORE_KEY = "ebb-dev-flow-files";
const RECENTS_KEY = "ebb-dev-recents";
const HOME = "/home/dev";
const FLOWS_DIR = "/home/dev/Documents/ebb";

const EBB_TYPES = [{ description: "ebb flow", accept: { "application/json": [".ebb"] } }];
const OPEN_TYPES = [{ description: "ebb flow", accept: { "application/json": [".ebb", ".json"] } }];

type Files = Record<string, string>;

interface FilePickers {
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
    showSaveFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle>;
    showDirectoryPicker?: (opts?: unknown) => Promise<FileSystemDirectoryHandle>;
}

function pickers(): FilePickers {
    return typeof window === "undefined" ? {} : (window as unknown as FilePickers);
}

/** A cancelled picker throws AbortError; every other failure is real. */
function cancelled(err: unknown): boolean {
    return err instanceof DOMException && err.name === "AbortError";
}

function load(): Files {
    if (typeof localStorage === "undefined") return {};
    try {
        const raw = localStorage.getItem(STORE_KEY);
        return raw ? (JSON.parse(raw) as Files) : {};
    } catch {
        return {};
    }
}

export function createFlowFs(): FlowFs {
    let files = load();

    /**
     * Handles for files opened through a real picker, keyed by the virtual path
     * they were given. Writing through one is what makes the browser adapter an
     * editor rather than a scratchpad.
     */
    const handles = new Map<string, FileSystemFileHandle>();

    /** Write stamps, so readFlow can hand back the shape the port promises. */
    const stamps = new Map<string, number>();

    function persist(): void {
        if (typeof localStorage === "undefined") return;
        try {
            localStorage.setItem(STORE_KEY, JSON.stringify(files));
        } catch {
            // A dev convenience; a full quota is not worth an error path.
        }
    }

    async function adopt(handle: FileSystemFileHandle): Promise<string> {
        const path = joinPath(FLOWS_DIR, handle.name);
        files = { ...files, [path]: await (await handle.getFile()).text() };
        handles.set(path, handle);
        persist();
        return path;
    }

    return {
        locations: () => Promise.resolve({ flowsDir: FLOWS_DIR, home: HOME }),

        async pickOpenPath() {
            const show = pickers().showOpenFilePicker;
            if (!show) return Object.keys(files)[0] ?? null;
            try {
                const [handle] = await show({ multiple: false, types: OPEN_TYPES });
                return handle ? await adopt(handle) : null;
            } catch (err) {
                if (cancelled(err)) return null;
                throw err;
            }
        },

        async pickDirectory() {
            const show = pickers().showDirectoryPicker;
            // A browser never exposes a real path, only the folder's name, so
            // this is a stand-in good enough to exercise the setting in dev.
            if (!show) return null;
            try {
                return joinPath(HOME, (await show()).name);
            } catch (err) {
                if (cancelled(err)) return null;
                throw err;
            }
        },

        async pickSavePath(suggested) {
            const show = pickers().showSaveFilePicker;
            if (!show) return joinPath(FLOWS_DIR, basename(suggested));
            try {
                const handle = await show({
                    suggestedName: basename(suggested),
                    types: EBB_TYPES,
                });
                const path = joinPath(FLOWS_DIR, handle.name);
                handles.set(path, handle);
                return path;
            } catch (err) {
                if (cancelled(err)) return null;
                throw err;
            }
        },

        createFlow: (dir, name, text) => {
            const taken = new Set(
                Object.keys(files)
                    .filter((p) => p.startsWith(dir + "/"))
                    .map(basename),
            );
            const path = joinPath(dir, dedupeFilename(name, taken));
            files = { ...files, [path]: text };
            stamps.set(path, Date.now());
            persist();
            return Promise.resolve(path);
        },

        readFlow: (path) =>
            Promise.resolve(
                path in files ? { text: files[path], mtimeMs: stamps.get(path) ?? 0 } : null,
            ),

        async writeFlow(path, text) {
            // Conflict detection needs a real filesystem to observe; the dev
            // adapter is the only writer here, so its stamp always matches.
            files = { ...files, [path]: text };
            const mtimeMs = Date.now();
            stamps.set(path, mtimeMs);
            persist();

            const handle = handles.get(path);
            if (handle) {
                const writable = await handle.createWritable();
                await writable.write(text);
                await writable.close();
            }
            return mtimeMs;
        },

        readRecents: () =>
            Promise.resolve(
                typeof localStorage === "undefined" ? null : localStorage.getItem(RECENTS_KEY),
            ),

        writeRecents: (text) => {
            if (typeof localStorage !== "undefined") localStorage.setItem(RECENTS_KEY, text);
            return Promise.resolve();
        },

        reveal: () => Promise.resolve(),
    };
}
