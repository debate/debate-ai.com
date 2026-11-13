// @vitest-environment jsdom
/**
 * The editor's small chrome components: the autosave indicator, the sheet
 * title strip and the new-flow chooser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const session = vi.hoisted(() => ({
    overwriteFlow: vi.fn(async () => {}),
    saveFlowNow: vi.fn(async () => {}),
    createFlowFile: vi.fn(async () => "/flows/new.flow"),
}));
vi.mock("../src/lib/persistence/flowSession", () => session);

const nav = vi.hoisted(() => ({ navigateToFlow: vi.fn() }));
vi.mock("../src/lib/commands/flowNav", () => nav);

const toast = vi.hoisted(() => ({ error: vi.fn(), success: vi.fn() }));
vi.mock("sonner", () => ({ toast }));

const hot = vi.hoisted(() => ({ focusActiveHot: vi.fn() }));
vi.mock("../src/lib/grid/hotInstance", async (importOriginal) => ({
    ...(await importOriginal<object>()),
    focusActiveHot: hot.focusActiveHot,
}));

import SaveStatus from "../src/components/flow/header/SaveStatus";
import SheetTitleBar from "../src/components/flow/header/SheetTitleBar";
import NewFlowDialog from "../src/components/start/NewFlowDialog";
import { useFlowStore } from "../src/lib/store/useFlowStore";
import { useSaveStatus } from "../src/lib/store/useSaveStatus";

import { click, flush, key, mount, typeInto, type Mounted } from "./helpers/mount";

let mounted: Mounted | undefined;
const show = async (element: React.ReactElement) => {
    mounted = await mount(element);
    return mounted.container;
};

beforeEach(() => {
    vi.clearAllMocks();
    useSaveStatus.getState().reset();
});

afterEach(async () => {
    await mounted?.unmount();
    mounted = undefined;
    document.body.innerHTML = "";
    vi.useRealTimers();
});

describe("SaveStatus", () => {
    it("renders nothing until there is something to report", async () => {
        const container = await show(<SaveStatus />);
        expect(container.querySelector("[data-testid=save-status]")).toBeNull();
    });

    it("shows saving, then a relative saved time", async () => {
        const container = await show(<SaveStatus />);
        await flush(() => useSaveStatus.getState().report("saving"));
        const status = () => container.querySelector("[data-testid=save-status]")!;
        expect(status().getAttribute("data-state")).toBe("saving");
        expect(status().textContent).toContain("Saving…");

        await flush(() => useSaveStatus.getState().report("saved"));
        expect(status().getAttribute("data-state")).toBe("saved");
        expect(status().textContent).toContain("Saved just now");
    });

    it.each([
        [30_000, "30s ago"],
        [5 * 60_000, "5m ago"],
        [3 * 3_600_000, "3h ago"],
    ])("describes a save %ims old as %s", async (age, label) => {
        const container = await show(<SaveStatus />);
        await flush(() => useSaveStatus.setState({ state: "saved", savedAt: Date.now() - age }));
        expect(container.textContent).toContain(`Saved ${label}`);
    });

    it("shows a bare Saved without a timestamp", async () => {
        const container = await show(<SaveStatus />);
        await flush(() => useSaveStatus.setState({ state: "saved", savedAt: null }));
        expect(container.textContent).toContain("Saved");
        expect(container.querySelector("[data-testid=save-status]")!.hasAttribute("tabindex")).toBe(false);
    });

    it("retries a failed save of the open round", async () => {
        const round = { id: "r" } as never;
        useFlowStore.setState({ round, docPath: "/flows/a.flow" } as never);
        const container = await show(<SaveStatus />);
        await flush(() => useSaveStatus.getState().report("error"));
        expect(container.textContent).toContain("Not saved");
        await click(container.querySelector("[data-testid=save-retry]")!);
        expect(session.saveFlowNow).toHaveBeenCalledWith("/flows/a.flow", round, expect.any(Function));
    });

    it("keeps the user's round over a changed file", async () => {
        const round = { id: "r" } as never;
        useFlowStore.setState({ round, docPath: "/flows/b.flow" } as never);
        const container = await show(<SaveStatus />);
        await flush(() => useSaveStatus.getState().report("conflict"));
        expect(container.textContent).toContain("Changed on disk");
        await click(container.querySelector("[data-testid=save-overwrite]")!);
        expect(session.overwriteFlow).toHaveBeenCalledWith("/flows/b.flow", round, expect.any(Function));
    });

    it("does nothing on retry when no round is open", async () => {
        useFlowStore.setState({ round: null, docPath: null } as never);
        const container = await show(<SaveStatus />);
        await flush(() => useSaveStatus.getState().report("error"));
        await click(container.querySelector("[data-testid=save-retry]")!);
        await flush(() => useSaveStatus.getState().report("conflict"));
        await click(container.querySelector("[data-testid=save-overwrite]")!);
        expect(session.saveFlowNow).not.toHaveBeenCalled();
        expect(session.overwriteFlow).not.toHaveBeenCalled();
    });
});

describe("SheetTitleBar", () => {
    const renameSheet = vi.fn();
    beforeEach(() => {
        renameSheet.mockReset();
        useFlowStore.setState({ renameSheet } as never);
    });

    it("shows the title in its side's color with the pane label", async () => {
        const container = await show(<SheetTitleBar sheetId="s1" title="1AC" side="aff" tabLabel="Tab 1" focused />);
        const bar = container.querySelector("[data-testid=sheet-title-bar]")!;
        expect(bar.getAttribute("data-focused")).toBe("true");
        expect(bar.textContent).toContain("Tab 1");
        expect(container.querySelector(".text-aff")!.textContent).toBe("1AC");
    });

    it("renames on Enter and refocuses the grid", async () => {
        const container = await show(<SheetTitleBar sheetId="s1" title="1NC" side="neg" />);
        await click(container.querySelector("[data-testid=sheet-title-bar]")!);
        const input = container.querySelector<HTMLInputElement>("[data-testid=sheet-title-input-s1]")!;
        expect(input.className).toContain("text-neg");
        await typeInto(input, "  T  ");
        await key(input, { key: "Enter" });
        expect(renameSheet).toHaveBeenCalledWith("s1", "T");
        expect(hot.focusActiveHot).toHaveBeenCalled();
        expect(container.querySelector("input")).toBeNull();
    });

    it("keeps the old title for a blank name and cancels on Escape", async () => {
        const container = await show(<SheetTitleBar sheetId="s2" title="Case" side="aff" />);
        await click(container.querySelector("[data-testid=sheet-title-bar]")!);
        let input = container.querySelector<HTMLInputElement>("input")!;
        await typeInto(input, "   ");
        await flush(() => input.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
        expect(renameSheet).toHaveBeenCalledWith("s2", "Case");

        await click(container.querySelector("[data-testid=sheet-title-bar]")!);
        input = container.querySelector<HTMLInputElement>("input")!;
        await key(input, { key: "Escape" });
        expect(container.querySelector("input")).toBeNull();
        expect(renameSheet).toHaveBeenCalledTimes(1);
    });
});

describe("NewFlowDialog", () => {
    const open = async () => {
        useFlowStore.setState({ newFlowOpen: true });
        await show(<NewFlowDialog />);
        return document.querySelector<HTMLElement>("[data-testid=new-flow-dialog]")!;
    };
    const choices = () => document.querySelector<HTMLElement>("[data-testid=new-flow-policy]")!.parentElement!;

    it("lists every format and creates a flow on click", async () => {
        const dialog = await open();
        expect(dialog.textContent).toContain("New flow");
        expect(dialog.querySelectorAll("button[data-testid^=new-flow-]")).toHaveLength(5);
        await click(dialog.querySelector("[data-testid=new-flow-ld]")!);
        await flush();
        expect(useFlowStore.getState().newFlowOpen).toBe(false);
        expect(session.createFlowFile).toHaveBeenCalledWith(expect.objectContaining({ event: "ld" }));
        expect(nav.navigateToFlow).toHaveBeenCalledWith("/flows/new.flow", { isNew: true });
    });

    it("picks by letter, ignoring modified keys", async () => {
        await open();
        await key(choices(), { key: "n", ctrlKey: true });
        expect(session.createFlowFile).not.toHaveBeenCalled();
        await key(choices(), { key: "N" });
        await flush();
        const round = (session.createFlowFile.mock.calls[0] as unknown[])[0] as { event: string };
        expect(round.event).toBe("pf");
    });

    it("moves a cursor with arrows and j/k, and picks with Enter", async () => {
        await open();
        const list = choices();
        await key(list, { key: "ArrowDown" });
        await key(list, { key: "j" });
        await key(list, { key: "k" });
        await key(list, { key: "ArrowUp" });
        await key(list, { key: "ArrowUp" });
        expect(document.querySelector("[data-testid=new-flow-parli]")!.className).toContain("bg-accent");
        await key(list, { key: "x" });
        await key(list, { key: "Enter" });
        await flush();
        expect(session.createFlowFile).toHaveBeenCalledWith(expect.objectContaining({ event: "parli" }));
    });

    it("reports a flow it could not create", async () => {
        session.createFlowFile.mockRejectedValueOnce(new Error("disk full"));
        await open();
        await key(choices(), { key: "p" });
        await flush();
        expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("disk full"));
    });
});
