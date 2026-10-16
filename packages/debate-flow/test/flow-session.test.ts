// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    persistReplica: vi.fn(async () => {}),
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
    desktop: { value: false },
    invoke: vi.fn(async () => {}),
}));

vi.mock("../src/lib/collab/persist", () => ({ persistReplica: m.persistReplica }));
vi.mock("sonner", () => ({ toast: m.toast }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("../src/lib/update/adapter", () => ({ isDesktop: () => m.desktop.value }));

import {
    closeOpenFlow,
    openFlowFromPicker,
    revealOpenFlow,
    saveOpenFlow,
    saveOpenFlowAs,
} from "../src/lib/commands/fileCommands";
import { setFlowNavigator, flowRouteFor } from "../src/lib/commands/flowNav";
import { closeCurrentWindow, openNewWindow, reportOpenPath } from "../src/lib/commands/windowCommands";
import { makeFlowRound } from "../src/lib/model/flow";
import { serializeFlow } from "../src/lib/persistence/flowFile";
import { setFlowFs, type FlowFs } from "../src/lib/persistence/flowFs";
import {
    attachFlowAutosave,
    createFlowFile,
    forgetSeenStamp,
    isConflict,
    noteOpened,
    overwriteFlow,
    pickFlowToOpen,
    readFlowAt,
    resolveResumePath,
    saveFlowAs,
    saveFlowNow,
    type SaveStatus,
} from "../src/lib/persistence/flowSession";
import { useFlowStore } from "../src/lib/store/useFlowStore";

/** An in-memory FlowFs with an mtime per file and conflict detection. */
function memFs() {
    const files = new Map<string, { text: string; mtimeMs: number }>();
    let recents: string | null = null;
    let clock = 1000;
    const fs = {
        files,
        pickOpen: null as string | null,
        pickSave: null as string | null,
        failWrite: null as unknown,
        locations: vi.fn(async () => ({ flowsDir: "/flows", home: "/home" })),
        pickOpenPath: vi.fn(async () => fs.pickOpen),
        pickDirectory: vi.fn(async () => null),
        pickSavePath: vi.fn(async () => fs.pickSave),
        createFlow: vi.fn(async (dir: string, name: string, text: string) => {
            let path = `${dir}/${name}`;
            let n = 2;
            while (files.has(path)) path = `${dir}/${name.replace(/\.ebb$/, "")} ${n++}.ebb`;
            files.set(path, { text, mtimeMs: ++clock });
            return path;
        }),
        readFlow: vi.fn(async (path: string) => files.get(path) ?? null),
        writeFlow: vi.fn(async (path: string, text: string, expected?: number | null) => {
            if (fs.failWrite) throw fs.failWrite;
            const cur = files.get(path);
            if (expected != null && cur && cur.mtimeMs !== expected) throw "conflict: changed on disk";
            files.set(path, { text, mtimeMs: ++clock });
            return clock;
        }),
        readRecents: vi.fn(async () => recents),
        writeRecents: vi.fn(async (t: string) => {
            recents = t;
        }),
        reveal: vi.fn(async () => {}),
    };
    return fs;
}

let fs: ReturnType<typeof memFs>;
const initial = useFlowStore.getState();
const nav = { openPath: vi.fn(), toStart: vi.fn() };
const flushAll = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
};

beforeEach(() => {
    vi.clearAllMocks();
    m.desktop.value = false;
    window.localStorage.clear();
    useFlowStore.setState(initial, true);
    fs = memFs();
    setFlowFs(fs as unknown as FlowFs);
    forgetSeenStamp();
    setFlowNavigator(nav);
});

afterEach(() => {
    setFlowFs(null);
    setFlowNavigator(null);
    vi.useRealTimers();
});

describe("flowSession", () => {
    it("recognizes conflicts", () => {
        expect(isConflict("conflict: x")).toBe(true);
        expect(isConflict(new Error("conflict:"))).toBe(false);
    });

    it("creates, reads and remembers a flow", async () => {
        const round = makeFlowRound();
        const path = await createFlowFile(round);
        expect(path.startsWith("/flows/")).toBe(true);
        expect(m.persistReplica).toHaveBeenCalled();
        const read = await readFlowAt(path);
        expect(read?.id).toBe(round.id);
        expect(await readFlowAt("/missing.ebb")).toBeNull();
        expect(await resolveResumePath()).toBe(path);

        // A configured flows dir wins over the platform default.
        useFlowStore.setState({ flowsDir: "/custom" });
        expect(await createFlowFile(makeFlowRound(), fs as unknown as FlowFs)).toMatch(/^\/custom\//);
    });

    it("skips recents that no longer exist", async () => {
        await noteOpened("/gone.ebb");
        expect(await resolveResumePath()).toBeNull();
    });

    it("picks a flow: cancelled, .ebb, and a legacy export", async () => {
        expect(await pickFlowToOpen()).toBeNull();
        fs.pickOpen = "/a/My.EBB";
        expect(await pickFlowToOpen()).toBe("/a/My.EBB");

        const r1 = makeFlowRound();
        const r2 = makeFlowRound();
        fs.files.set("/dl/backup.json", {
            text: JSON.stringify({ version: 3, kind: "backup", rounds: [r1, r2] }),
            mtimeMs: 1,
        });
        fs.pickOpen = "/dl/backup.json";
        const first = await pickFlowToOpen();
        expect(first).toMatch(/^\/flows\//);
        expect(fs.createFlow).toHaveBeenCalledTimes(2);

        fs.pickOpen = "/dl/missing.json";
        await expect(pickFlowToOpen()).rejects.toThrow(/no longer exists/);
        fs.files.set("/dl/empty.json", { text: JSON.stringify({ version: 3, kind: "backup", rounds: [] }), mtimeMs: 1 });
        fs.pickOpen = "/dl/empty.json";
        await expect(pickFlowToOpen()).rejects.toThrow(/holds no flows/);
    });

    it("saves as, now, and detects conflicts", async () => {
        const round = makeFlowRound();
        expect(await saveFlowAs(round)).toBeNull();
        fs.pickSave = "/flows/x.ebb";
        expect(await saveFlowAs(round)).toBe("/flows/x.ebb");

        const statuses: SaveStatus[] = [];
        expect(await saveFlowNow("/flows/x.ebb", round, (s) => statuses.push(s))).toBe(true);
        expect(statuses).toEqual(["saving", "saved"]);

        // Someone else wrote the file: the stamp no longer matches.
        fs.files.get("/flows/x.ebb")!.mtimeMs = 1;
        statuses.length = 0;
        expect(await saveFlowNow("/flows/x.ebb", round, (s) => statuses.push(s))).toBe(false);
        expect(statuses).toEqual(["saving", "conflict"]);
        expect(await overwriteFlow("/flows/x.ebb", round)).toBe(true);

        fs.failWrite = new Error("disk full");
        statuses.length = 0;
        expect(await overwriteFlow("/flows/x.ebb", round, (s) => statuses.push(s))).toBe(false);
        expect(statuses).toEqual(["saving", "error"]);
    });

    it("autosaves debounced edits and flushes on detach", async () => {
        vi.useFakeTimers();
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round, { docPath: "/flows/auto.ebb" });
        const statuses: SaveStatus[] = [];
        const auto = attachFlowAutosave(useFlowStore, (s) => statuses.push(s));
        auto.prime();
        vi.setSystemTime(Date.now() + 10);
        useFlowStore.getState().renameSheet(round.sheets[1].id, "A");
        expect(fs.writeFlow).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(600);
        expect(fs.writeFlow).toHaveBeenCalledTimes(1);
        expect(statuses).toEqual(["saving", "saved"]);

        vi.setSystemTime(Date.now() + 10);
        useFlowStore.getState().renameSheet(round.sheets[1].id, "B");
        auto.detach();
        await flushAll();
        expect(fs.writeFlow).toHaveBeenCalledTimes(2);
        expect(JSON.parse(fs.files.get("/flows/auto.ebb")!.text).round.sheets[1].title).toBe("B");
    });

    it("autosave reports errors and flushes after the max wait", async () => {
        vi.useFakeTimers();
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round, { docPath: "/flows/auto.ebb" });
        const statuses: SaveStatus[] = [];
        const auto = attachFlowAutosave(useFlowStore, (s) => statuses.push(s));
        auto.prime();
        fs.failWrite = "conflict: nope";
        // Keep typing every 400ms: the debounce never settles but max wait does.
        for (let i = 0; i < 7; i++) {
            vi.setSystemTime(Date.now() + 400);
            useFlowStore.getState().renameSheet(round.sheets[1].id, `t${i}`);
            await vi.advanceTimersByTimeAsync(1);
        }
        expect(fs.writeFlow).toHaveBeenCalled();
        expect(statuses).toContain("conflict");
        auto.detach();
    });
});

describe("file commands", () => {
    it("opens from the picker and reports failures", async () => {
        fs.pickOpen = "/flows/a.ebb";
        await openFlowFromPicker();
        expect(nav.openPath).toHaveBeenCalledWith("/flows/a.ebb", undefined);
        fs.pickOpen = "/dl/missing.json";
        await openFlowFromPicker();
        expect(m.toast.error).toHaveBeenCalledWith(expect.stringMatching(/no longer exists/));
    });

    it("saves the open flow and treats nothing open as safe", async () => {
        expect(await saveOpenFlow()).toBe(true);
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round, { docPath: "/flows/s.ebb" });
        expect(await saveOpenFlow()).toBe(true);
        expect(fs.files.has("/flows/s.ebb")).toBe(true);
    });

    it("save as follows the new path", async () => {
        await saveOpenFlowAs();
        const round = makeFlowRound();
        useFlowStore.getState().loadRound(round, { docPath: "/flows/s.ebb" });
        await saveOpenFlowAs();
        expect(useFlowStore.getState().docPath).toBe("/flows/s.ebb");
        fs.pickSave = "/flows/copy.ebb";
        await saveOpenFlowAs();
        expect(useFlowStore.getState().docPath).toBe("/flows/copy.ebb");
        expect(nav.openPath).toHaveBeenCalledWith("/flows/copy.ebb", undefined);
        expect(m.toast.success).toHaveBeenCalledWith("Saved to /flows/copy.ebb");
        fs.failWrite = new Error("denied");
        await saveOpenFlowAs();
        expect(m.toast.error).toHaveBeenCalledWith("denied");
    });

    it("reveals the open flow", async () => {
        await revealOpenFlow();
        expect(fs.reveal).not.toHaveBeenCalled();
        useFlowStore.getState().loadRound(makeFlowRound(), { docPath: "/flows/r.ebb" });
        await revealOpenFlow();
        expect(fs.reveal).toHaveBeenCalledWith("/flows/r.ebb");
        fs.reveal.mockRejectedValueOnce(new Error("no finder"));
        await revealOpenFlow();
        expect(m.toast.error).toHaveBeenCalledWith("no finder");
    });

    it("closes only once the flow is written", async () => {
        useFlowStore.getState().loadRound(makeFlowRound(), { docPath: "/flows/c.ebb" });
        fs.failWrite = new Error("full");
        await closeOpenFlow();
        expect(useFlowStore.getState().round).not.toBeNull();
        expect(m.toast.error).toHaveBeenCalled();
        fs.failWrite = null;
        await closeOpenFlow();
        expect(useFlowStore.getState().round).toBeNull();
        expect(nav.toStart).toHaveBeenCalled();
    });

    it("builds a route for a path", () => {
        expect(flowRouteFor("/a b.ebb")).toBe("/flow?path=%2Fa%20b.ebb");
    });
});

describe("window commands", () => {
    it("no-op on the web", async () => {
        await openNewWindow();
        await closeCurrentWindow();
        await reportOpenPath("/x");
        expect(m.invoke).not.toHaveBeenCalled();
    });

    it("invoke the shell on desktop and swallow failures", async () => {
        m.desktop.value = true;
        await openNewWindow();
        await closeCurrentWindow();
        await reportOpenPath(null);
        expect(m.invoke.mock.calls).toEqual([["new_window"], ["close_window"], ["report_open_path", { path: null }]]);
        m.invoke.mockRejectedValue(new Error("x"));
        await expect(openNewWindow()).resolves.toBeUndefined();
        await expect(closeCurrentWindow()).resolves.toBeUndefined();
        await expect(reportOpenPath("/y")).resolves.toBeUndefined();
    });
});

it("serializeFlow fixture round-trips through the fake fs", async () => {
    const round = makeFlowRound();
    fs.files.set("/x.ebb", { text: serializeFlow(round), mtimeMs: 5 });
    expect((await readFlowAt("/x.ebb"))?.id).toBe(round.id);
});
