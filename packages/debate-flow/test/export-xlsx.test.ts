// @vitest-environment jsdom
import ExcelJS from "exceljs";
import { afterEach, describe, expect, it, vi } from "vitest";

import { exportFilename, isoDate, MIME_BY_EXT, saveBlob } from "../src/lib/export/download";
import { applyInfoWorksheet, maybeAddRfdWorksheet } from "../src/lib/export/infoSheet";
import { addFlowWorksheet, downloadXlsx, fillWorkbook } from "../src/lib/export/xlsx";
import { makeFlowRound, type FlowRound } from "../src/lib/model/flow";

const PEER = "b".repeat(64);

function round(): FlowRound {
    const r = makeFlowRound({ event: "policy" });
    r.createdAt = Date.UTC(2026, 2, 4);
    r.scouting = {
        ...r.scouting,
        tournament: "State",
        round: "Octas",
        flight: "B",
        judge: "Lee",
        affSchool: "North",
        negSchool: "South",
        aff: { first: { first: "Ann", last: "A" }, second: { first: "Bo", last: "" } },
        decision: { vote: "neg", rfd: "Neg won on the DA", peerNotes: { [PEER]: "My notes", zzz: "  " } },
    } as never;
    const flow = r.sheets[1];
    flow.title = "Econ: DA?";
    flow.data = [
        ["tag", "answer"],
        [null, "kicked"],
    ];
    flow.meta = {
        "0,0": { bold: true, highlight: true, card: true },
        "0,1": { group: true },
        "1,1": { kicked: true },
        "1,0": { bold: true },
    };
    const cx = r.sheets[0];
    cx.data = [["q?", "a"]];
    return r;
}

describe("download helpers", () => {
    afterEach(() => {
        delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
    });

    it("formats dates and filenames", () => {
        const ts = Date.UTC(2026, 0, 9);
        expect(isoDate(ts)).toBe("2026-01-09");
        expect(exportFilename(ts, "xlsx")).toBe("debate-flow-20260109.xlsx");
    });

    it("saves through the picker when there is one", async () => {
        const written: unknown[] = [];
        const close = vi.fn();
        const picker = vi.fn(async () => ({
            createWritable: async () => ({ write: async (b: unknown) => written.push(b), close }),
        }));
        (window as unknown as Record<string, unknown>).showSaveFilePicker = picker;
        const blob = new Blob(["x"]);
        await saveBlob(blob, "a.xlsx");
        expect(picker).toHaveBeenCalledWith({
            suggestedName: "a.xlsx",
            types: [{ accept: { [MIME_BY_EXT[".xlsx"]]: [".xlsx"] } }],
        });
        expect(written).toEqual([blob]);
        expect(close).toHaveBeenCalled();

        await saveBlob(blob, "a.bin");
        expect(picker).toHaveBeenLastCalledWith({ suggestedName: "a.bin", types: undefined });

        picker.mockRejectedValueOnce(new DOMException("cancel", "AbortError"));
        await expect(saveBlob(blob, "a.csv")).resolves.toBeUndefined();
        picker.mockRejectedValueOnce(new Error("denied"));
        await expect(saveBlob(blob, "a.csv")).rejects.toThrow("denied");
    });

    it("falls back to an anchor download", async () => {
        const create = vi.fn(() => "blob:x");
        const revoke = vi.fn();
        Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
        const clicks: string[] = [];
        const spy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
            clicks.push(this.download);
        });
        await saveBlob(new Blob(["x"]), "f.json");
        expect(clicks).toEqual(["f.json"]);
        expect(revoke).toHaveBeenCalledWith("blob:x");
        expect(document.querySelector("a")).toBeNull();
        spy.mockRestore();
    });
});

describe("info and rfd worksheets", () => {
    it("labels the scouting fields", () => {
        const wb = new ExcelJS.Workbook();
        applyInfoWorksheet(wb, round());
        const ws = wb.getWorksheet("Info")!;
        expect(ws.getCell(2, 2).value).toBe("State");
        expect(ws.getCell(3, 2).value).toBe("Octas Flight B");
        expect(ws.getCell(4, 2).value).toBe("2026-03-04");
        expect(ws.getCell(8, 2).value).toBe("Ann A");
        expect(ws.getCell(9, 2).value).toBe("Bo");
        expect(ws.getCell(12, 2).value).toBeNull();
        expect(ws.getCell(15, 2).value).toBe("NEG");
    });

    it("adds an rfd sheet with peer notes, and none for an empty decision", () => {
        const wb = new ExcelJS.Workbook();
        maybeAddRfdWorksheet(wb, round(), { [PEER]: { name: "Sam" } } as never);
        const ws = wb.getWorksheet("RFD")!;
        expect(ws.getCell("B1").value).toBe("NEG");
        expect(ws.getCell(2, 1).value).toBe("Neg won on the DA");
        expect(ws.getCell(4, 1).value).toBe("Notes from Sam");
        expect(ws.getCell(5, 1).value).toBe("My notes");

        const empty = new ExcelJS.Workbook();
        maybeAddRfdWorksheet(empty, makeFlowRound());
        expect(empty.worksheets).toHaveLength(0);

        const onlyNotes = makeFlowRound();
        onlyNotes.scouting.decision = { peerNotes: { [PEER]: "x" } } as never;
        const wb2 = new ExcelJS.Workbook();
        maybeAddRfdWorksheet(wb2, onlyNotes);
        expect(wb2.getWorksheet("RFD")!.getCell(3, 1).value).toMatch(/^Notes from /);
    });
});

describe("flow worksheets", () => {
    it("writes headers, text and decorations", () => {
        const r = round();
        const wb = new ExcelJS.Workbook();
        const ws = addFlowWorksheet(wb, r, r.sheets[1], new Set());
        expect(ws.name).toBe("Econ DA");
        expect(ws.getCell(1, 1).value).toBe("1AC");
        expect(ws.getCell(1, 2).value).toBe("1NC");
        const tag = ws.getCell(2, 1);
        expect(tag.value).toBe("tag");
        expect(tag.font).toMatchObject({ bold: true });
        expect(tag.fill).toMatchObject({ pattern: "solid" });
        expect(tag.border.bottom).toMatchObject({ style: "medium" });
        expect(ws.getCell(2, 2).border.left).toMatchObject({ style: "medium" });
        expect(ws.getCell(3, 2).border.diagonal).toMatchObject({ up: true });
        expect(ws.getCell(3, 1).value).toBeNull();
        expect(ws.getCell(3, 1).font).toMatchObject({ bold: true });
    });

    it("gives the cx sheet a merged group header row", () => {
        const r = round();
        const wb = new ExcelJS.Workbook();
        const ws = addFlowWorksheet(wb, r, r.sheets[0], new Set());
        expect(ws.views[0]).toMatchObject({ ySplit: 2 });
        expect(ws.getCell(1, 1).value).toBeTruthy();
        expect(ws.getCell(2, 1).value).toBeTruthy();
        expect(ws.getCell(3, 1).value).toBe("q?");
    });

    it("fills a whole workbook with unique names", () => {
        const r = round();
        r.sheets.push({ ...r.sheets[1], id: "dup", order: 5, title: "Info" });
        const wb = new ExcelJS.Workbook();
        fillWorkbook(wb, r);
        const names = wb.worksheets.map((w) => w.name);
        expect(names[0]).toBe("Info");
        expect(names).toContain("RFD");
        expect(names).toContain("Info (2)");
        expect(new Set(names.map((n) => n.toLowerCase())).size).toBe(names.length);
    });

    it("downloads the workbook as a blob", async () => {
        const picker = vi.fn(async () => ({ createWritable: async () => ({ write: async () => {}, close: async () => {} }) }));
        (window as unknown as Record<string, unknown>).showSaveFilePicker = picker;
        try {
            await downloadXlsx(round());
            expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: "debate-flow-20260304.xlsx" }));
        } finally {
            delete (window as unknown as Record<string, unknown>).showSaveFilePicker;
        }
    });
});
