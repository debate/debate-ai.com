// @vitest-environment jsdom
import { CompletionContext } from "@codemirror/autocomplete";
import { EditorState } from "@codemirror/state";
import { beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => ({
    toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
    joinRound: vi.fn(),
    resumeJoined: vi.fn(async () => {}),
    invoke: vi.fn(),
    desktop: { value: true },
}));

vi.mock("sonner", () => ({ toast: m.toast }));
vi.mock("../src/lib/collab/join", () => ({ joinRound: m.joinRound }));
vi.mock("../src/lib/collab/runtime", () => ({ resumeJoined: m.resumeJoined }));
vi.mock("@tauri-apps/api/core", () => ({ invoke: m.invoke }));
vi.mock("../src/lib/update/adapter", () => ({ isDesktop: () => m.desktop.value, getCurrentVersion: async () => "1.2.3" }));

import { liveCells, seedSheet } from "../src/lib/collab/doc";
import { gridPatchFor } from "../src/lib/collab/gridPatch";
import { isReplicatedSource, rowOpFromHook, textOpsFromChanges } from "../src/lib/collab/gridOps";
import { acceptInvite, announceInvite } from "../src/lib/collab/inbox";
import { broadcastName, clearShellStrings, machineName, myEndpointId } from "../src/lib/collab/machineName";
import { ORIGIN_STAMP } from "../src/lib/collab/stamp";
import { setFlowNavigator } from "../src/lib/commands/flowNav";
import { breakEmptiedLinks, STRUCTURED_WRITE } from "../src/lib/grid/staleSource";
import { makeFlowRound, makeFlowSheet } from "../src/lib/model/flow";
import { cellCompletions, makeCellCompletionSource, quoteContinuation } from "../src/lib/rfd/cellCompletion";
import { askToShare, useCollabConsent } from "../src/lib/store/useCollabConsent";
import { useCollabStore } from "../src/lib/store/useCollabStore";
import { useFlowStore } from "../src/lib/store/useFlowStore";
import { askForCode, useJoinDialog } from "../src/lib/store/useJoinDialog";
import { askToRejoin, useRejoinDialog } from "../src/lib/store/useRejoinDialog";
import {
    closeShareSheet,
    openShareSheet,
    showShareCode,
    showShareFailure,
    showShareGuest,
    useShareSheet,
} from "../src/lib/store/useShareSheet";

import { FakeHot } from "./helpers/fakeHot";

const PEER = "b".repeat(64);
const initial = useFlowStore.getState();

beforeEach(() => {
    vi.clearAllMocks();
    m.desktop.value = true;
    window.localStorage.clear();
    useFlowStore.setState(initial, true);
    useCollabStore.getState().reset();
    clearShellStrings();
});

describe("gridPatchFor", () => {
    function sheet(data: (string | null)[][], meta = {}) {
        const s = makeFlowSheet({ title: "t", group: "aff", order: 0 });
        s.data = data;
        s.meta = meta;
        return seedSheet(s, ORIGIN_STAMP);
    }

    it("lists changed text and meta, and the new height", () => {
        const before = sheet([["a", "b"], ["c", null]]);
        const after = sheet([["a", "B"], ["c", "d"], ["e", null]], { "0,0": { bold: true } });
        const patch = gridPatchFor(before, after);
        expect(patch.height).toBe(3);
        expect(patch.writes).toEqual(
            expect.arrayContaining([
                { row: 0, col: 1, text: "B" },
                { row: 1, col: 1, text: "d" },
                { row: 2, col: 0, text: "e" },
            ]),
        );
        expect(patch.meta).toEqual([{ row: 0, col: 0, meta: { bold: true } }]);
    });

    it("writes a whole new sheet and skips deferred cells", () => {
        const after = sheet([["x"]]);
        expect(gridPatchFor(undefined, after).writes).toEqual([{ row: 0, col: 0, text: "x" }]);
        const [held] = liveCells(after, 0);
        const deferred = gridPatchFor(undefined, after, [{ col: 0, rank: held.rank, actor: held.actor } as never]);
        expect(deferred.writes).toEqual([]);
    });
});

describe("gridOps", () => {
    it("classifies sources", () => {
        expect(isReplicatedSource("edit")).toBe(true);
        expect(isReplicatedSource("UndoRedo.undo")).toBe(true);
        expect(isReplicatedSource(STRUCTURED_WRITE)).toBe(false);
        expect(isReplicatedSource("loadData")).toBe(false);
        expect(isReplicatedSource(3)).toBe(false);
    });

    it("turns changes into text ops", () => {
        expect(
            textOpsFromChanges("s", [
                [0, 1 as never, "a", "b"],
                [1, "prop", "a", "b"],
                [2, 0 as never, "x", "x"],
                [3, 2 as never, "x", null],
            ]),
        ).toEqual([
            { kind: "cellText", sheetId: "s", col: 1, row: 0, text: "b" },
            { kind: "cellText", sheetId: "s", col: 2, row: 3, text: null },
        ]);
    });

    it("turns row hooks into row ops unless self-describing", () => {
        expect(rowOpFromHook("insert", "s", 2, 2, "ContextMenu")).toEqual([
            { kind: "insertRow", sheetId: "s", row: 2 },
            { kind: "insertRow", sheetId: "s", row: 3 },
        ]);
        expect(rowOpFromHook("remove", "s", 1, 2, undefined)).toEqual([
            { kind: "removeRow", sheetId: "s", row: 1 },
            { kind: "removeRow", sheetId: "s", row: 1 },
        ]);
        expect(rowOpFromHook("insert", "s", 0, 1, "auto")).toEqual([]);
    });
});

describe("breakEmptiedLinks", () => {
    it("drops the source of a cell that was emptied", () => {
        const hot = new FakeHot(2, 2);
        hot.setCellMeta(0, 0, "source", { key: "k" });
        hot.setCellMeta(1, 1, "source", { key: "j" });
        expect(breakEmptiedLinks(hot, [[0, 1, "a", "b"]])).toBe(false);
        expect(
            breakEmptiedLinks(hot, [
                [0, 0, "a", ""],
                [1, 1, "b", "still"],
                [1, "x", "b", ""],
            ]),
        ).toBe(true);
        expect(hot.getCellMeta(0, 0).source).toBeUndefined();
        expect(hot.getCellMeta(1, 1).source).toEqual({ key: "j" });
    });
});

describe("cell completion", () => {
    function roundWith(text: string) {
        const r = makeFlowRound();
        r.sheets[1].data = [[text]];
        return r;
    }

    it("continues a blockquote across lines", () => {
        expect(quoteContinuation("a\nb", "> ")).toBe("a\n> b");
        expect(quoteContinuation("a\nb", "x")).toBe("a\nb");
    });

    it("offers cells after a quote marker or on explicit request", () => {
        const round = roundWith("first line\nsecond");
        expect(cellCompletions(round)).toEqual([expect.objectContaining({ label: "first line\nsecond", type: "aff" })]);
        const source = makeCellCompletionSource(() => round);
        const quoted = EditorState.create({ doc: "> fir" });
        const res = source(new CompletionContext(quoted, 5, false))!;
        expect(res).toMatchObject({ from: 2, to: 5 });

        const plain = EditorState.create({ doc: "abc fir" });
        expect(source(new CompletionContext(plain, 7, false))).toBeNull();
        expect(source(new CompletionContext(plain, 7, true))).toMatchObject({ from: 4 });
        expect(makeCellCompletionSource(() => null)(new CompletionContext(plain, 7, true))).toBeNull();
        expect(makeCellCompletionSource(() => makeFlowRound())(new CompletionContext(plain, 7, true))).toBeNull();

        // Applying inserts the cell text, continuing the quote.
        let state = quoted;
        const view = {
            get state() {
                return state;
            },
            dispatch: (spec: Parameters<EditorState["update"]>[0]) => {
                state = state.update(spec).state;
            },
        };
        const opt = res.options[0];
        (opt.apply as (v: unknown, c: unknown, f: number, t: number) => void)(view, opt, res.from, res.to);
        expect(state.doc.toString()).toBe("> first line\n> second");
    });
});

describe("dialog stores", () => {
    it("asks for a code and settles on submit, close, or a second ask", async () => {
        const p = askForCode();
        expect(useJoinDialog.getState().open).toBe(true);
        useJoinDialog.getState().submit("CODE");
        await expect(p).resolves.toBe("CODE");
        const p2 = askForCode();
        const p3 = askForCode();
        await expect(p2).resolves.toBeNull();
        useJoinDialog.getState().close();
        await expect(p3).resolves.toBeNull();
        expect(useJoinDialog.getState().open).toBe(false);
    });

    it("asks to rejoin", async () => {
        const p = askToRejoin({ round: "R", endpointId: PEER });
        expect(useRejoinDialog.getState()).toMatchObject({ open: true, ask: { round: "R" } });
        useRejoinDialog.getState().answer(true);
        await expect(p).resolves.toBe(true);
        const p2 = askToRejoin({ round: "R", endpointId: PEER });
        useRejoinDialog.getState().close();
        await expect(p2).resolves.toBe(false);
    });

    it("asks consent once and turns shared editing on", async () => {
        m.desktop.value = false;
        expect(await askToShare()).toBe(false);
        m.desktop.value = true;
        const p = askToShare();
        expect(useCollabConsent.getState().open).toBe(true);
        useCollabConsent.getState().answer(true);
        await expect(p).resolves.toBe(true);
        expect(useFlowStore.getState().collabEnabled).toBe(true);
        expect(await askToShare()).toBe(true);

        useFlowStore.setState({ collabEnabled: false });
        const p2 = askToShare();
        useCollabConsent.getState().close();
        await expect(p2).resolves.toBe(false);
        expect(useFlowStore.getState().collabEnabled).toBe(false);
    });

    it("drives the share sheet and stops the code when leaving it", async () => {
        openShareSheet("viewer", "warn");
        expect(useShareSheet.getState()).toMatchObject({ open: true, role: "viewer", warning: "warn", screen: "ready" });
        const stop = vi.fn(async () => {});
        showShareCode("ABCD", stop);
        expect(useShareSheet.getState()).toMatchObject({ screen: "code", code: "ABCD" });
        showShareGuest("Sam");
        expect(useShareSheet.getState()).toMatchObject({ screen: "joined", guest: "Sam" });
        closeShareSheet();
        expect(stop).toHaveBeenCalledTimes(1);
        expect(useShareSheet.getState().open).toBe(false);

        const stop2 = vi.fn(async () => {
            throw new Error("x");
        });
        showShareCode("EFGH", stop2);
        showShareFailure("relay down");
        expect(useShareSheet.getState()).toMatchObject({ screen: "failed", code: "", message: "relay down" });
        expect(stop2).toHaveBeenCalled();
    });
});

describe("machine name", () => {
    it("reads shell strings once and prefers the chosen name", async () => {
        m.invoke.mockImplementation(async (cmd: string) => (cmd === "machine_name" ? "box" : "id123"));
        expect(await myEndpointId()).toBe("id123");
        expect(await machineName()).toBe("box");
        expect(await machineName()).toBe("box");
        expect(m.invoke).toHaveBeenCalledTimes(2);
        expect(await broadcastName()).toBe("box");
        useFlowStore.setState({ collabName: "  Sam  " });
        expect(await broadcastName()).toBe("Sam");
    });

    it("answers empty off desktop or when the shell fails", async () => {
        m.desktop.value = false;
        expect(await machineName()).toBe("");
        clearShellStrings();
        m.desktop.value = true;
        m.invoke.mockRejectedValueOnce(new Error("x"));
        expect(await myEndpointId()).toBe("");
    });
});

describe("inbox", () => {
    const notice = { endpointId: PEER, roundId: "round-1", label: "Finals" };
    const nav = { openPath: vi.fn(), toStart: vi.fn() };

    it("announces a contact's invite with a Join action", () => {
        announceInvite(notice);
        expect(m.toast).not.toHaveBeenCalled();
        useFlowStore.setState({ contacts: { [PEER]: { name: "Sam" } } as never });
        announceInvite({ ...notice, roundId: "" });
        announceInvite({ ...notice, roundId: "x".repeat(200) });
        expect(m.toast).not.toHaveBeenCalled();
        announceInvite({ ...notice, label: "L".repeat(200) });
        expect(useCollabStore.getState().invites[0].label).toHaveLength(80);
        expect(m.toast).toHaveBeenCalledWith(expect.stringMatching(/^Sam shared/), expect.objectContaining({ duration: 30_000 }));
    });

    it("accepts an invite: joins, resumes and routes", async () => {
        setFlowNavigator(nav);
        useCollabStore.getState().pushInvite(notice);
        m.joinRound.mockResolvedValueOnce({ path: "/p.ebb", created: true });
        await acceptInvite(notice);
        expect(m.joinRound.mock.calls[0][0]).toMatchObject({ invite: { endpointId: PEER, roundId: "round-1" }, appVersion: "1.2.3" });
        expect(useCollabStore.getState().invites).toEqual([]);
        expect(m.toast.success).toHaveBeenCalledWith("Joined. The round is yours to keep.");
        expect(nav.openPath).toHaveBeenCalledWith("/p.ebb", undefined);
        m.joinRound.mockResolvedValueOnce({ path: "/p.ebb", created: false });
        await acceptInvite(notice);
        expect(m.toast.success).toHaveBeenLastCalledWith("Joined.");
        setFlowNavigator(null);
    });

    it("explains a refused or failed join", async () => {
        m.joinRound.mockResolvedValueOnce(null);
        await acceptInvite(notice);
        expect(m.toast.error).toHaveBeenCalledWith("Turn on shared editing in Settings first");
        useFlowStore.setState({ collabEnabled: true });
        m.joinRound.mockResolvedValueOnce(null);
        await acceptInvite(notice);
        expect(m.toast.error).toHaveBeenCalledTimes(1);
        m.joinRound.mockRejectedValueOnce(new Error("hung up"));
        await acceptInvite(notice);
        expect(m.toast.error).toHaveBeenLastCalledWith("hung up");
        m.joinRound.mockRejectedValueOnce(0);
        await acceptInvite(notice);
        expect(m.toast.error).toHaveBeenLastCalledWith("Could not join that round");
    });
});
