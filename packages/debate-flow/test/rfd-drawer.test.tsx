// @vitest-environment jsdom
/**
 * The RFD drawer: a CodeMirror editor bound to the round's decision, a
 * rendered preview with each peer's notes in its own section, theme and vim
 * swaps in place, the resize handle and closing back to the grid.
 */
import { EditorView } from "@codemirror/view";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hot = vi.hoisted(() => ({ focusActiveHot: vi.fn() }));
vi.mock("../src/lib/grid/hotInstance", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    focusActiveHot: hot.focusActiveHot,
}));

import RfdDrawer from "../src/components/flow/RfdDrawer";
import { makeFlowRound } from "../src/lib/model/flow";
import { useFlowStore } from "../src/lib/store/useFlowStore";

import { click, flush, mount, type Mounted } from "./helpers/mount";

const PEER = "f".repeat(64);

let mounted: Mounted | undefined;
const $ = (testid: string) => document.querySelector<HTMLElement>(`[data-testid=${testid}]`);
const editor = () => EditorView.findFromDOM(document.querySelector<HTMLElement>(".cm-editor")!)!;

beforeEach(async () => {
    vi.clearAllMocks();
    const round = makeFlowRound({ event: "ld" });
    round.scouting = { ...round.scouting, decision: { rfd: "**Aff** wins", peerNotes: { [PEER]: "Neg *dropped* it", blank: "  " } } };
    useFlowStore.setState({ round, rfdOpen: true, rfdVim: false, contacts: {} });
    document.documentElement.classList.remove("dark");
    mounted = await mount(<RfdDrawer />);
});

afterEach(async () => {
    await mounted?.unmount();
    mounted = undefined;
    document.body.innerHTML = "";
});

describe("RfdDrawer", () => {
    it("opens in edit mode on the round's RFD", () => {
        expect($("rfd-drawer")).not.toBeNull();
        expect(editor().state.doc.toString()).toBe("**Aff** wins");
        expect($("rfd-preview")).toBeNull();
    });

    it("writes edits back into the round's decision", async () => {
        await flush(() => editor().dispatch({ changes: { from: 0, insert: "Close round. " } }));
        expect(useFlowStore.getState().round!.scouting.decision?.rfd).toBe("Close round. **Aff** wins");
        expect(useFlowStore.getState().round!.scouting.decision?.peerNotes?.[PEER]).toBe("Neg *dropped* it");
    });

    it("previews the markdown with each non-blank peer's notes", async () => {
        await click($("rfd-preview-toggle")!);
        const preview = $("rfd-preview")!;
        expect(preview.querySelector("strong")?.textContent).toBe("Aff");
        const notes = document.querySelectorAll("[data-testid=rfd-peer-note]");
        expect(notes).toHaveLength(1);
        expect(notes[0].querySelector("h3")?.textContent).toBe(PEER.slice(0, 8));
        expect(notes[0].querySelector("em")?.textContent).toBe("dropped");

        const editTab = Array.from(document.querySelectorAll<HTMLElement>("[role=tab]")).find((t) => t.textContent === "Edit")!;
        await click(editTab);
        expect($("rfd-preview")).toBeNull();
    });

    it("swaps theme and vim in place without rebuilding the editor", async () => {
        const view = editor();
        await flush(() => document.documentElement.classList.add("dark"));
        await flush(() => useFlowStore.setState({ rfdVim: true }));
        expect(editor()).toBe(view);
        await flush(() => useFlowStore.setState({ rfdVim: false }));
        expect(editor()).toBe(view);
    });

    it("resizes from the handle, within bounds", async () => {
        const drawer = $("rfd-drawer")!;
        const start = parseInt(drawer.style.height, 10);
        const handle = document.querySelector<HTMLElement>("[role=separator]")!;
        await flush(() => {
            handle.dispatchEvent(Object.assign(new MouseEvent("pointerdown", { bubbles: true, clientY: 500 }), { pointerId: 1 }));
        });
        await flush(() => window.dispatchEvent(new MouseEvent("pointermove", { clientY: 450 })));
        expect(parseInt(drawer.style.height, 10)).toBe(Math.max(120, start + 50));
        await flush(() => window.dispatchEvent(new MouseEvent("pointermove", { clientY: 100_000 })));
        expect(parseInt(drawer.style.height, 10)).toBe(120);
        await flush(() => window.dispatchEvent(new MouseEvent("pointerup")));
        await flush(() => window.dispatchEvent(new MouseEvent("pointermove", { clientY: 0 })));
        expect(parseInt(drawer.style.height, 10)).toBe(120);
    });

    it("closes and hands focus back to the grid on unmount", async () => {
        await click($("rfd-close")!);
        expect(useFlowStore.getState().rfdOpen).toBe(false);
        await mounted!.unmount();
        mounted = undefined;
        expect(hot.focusActiveHot).toHaveBeenCalled();
    });
});
