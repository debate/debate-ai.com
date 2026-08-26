/**
 * Excel exporter, written directly with ExcelJS. Worksheet order is Info,
 * RFD (when there is a decision), then the round's sheets in ebb order (the
 * cross-ex sheet sorts first at order -1). Each flow worksheet mirrors the
 * on-screen grid in its light theme: a frozen speech-title header row,
 * side-colored ink, and the bold/highlight/card/group/kicked cell decorations
 * - no gridlines, no fills beyond the highlight, no sheet protection. (In
 * export code, "sheet" is the app's FlowSheet; Excel tabs are worksheets.)
 */

import type ExcelJS from "exceljs";

import type { Contacts } from "../collab/contacts";
import { gridWidth } from "../grid/codec";
import { columnsForFlowSheet } from "../grid/flowColumns";
import { sortedSheets, type FlowRound, type FlowSheet } from "../model/flow";
import type { Side } from "../model/types";

import { exportFilename, MIME_BY_EXT, saveBlob } from "./download";
import { applyInfoWorksheet, maybeAddRfdWorksheet } from "./infoSheet";
import { safeSheetName } from "./sheetNames";

/** Light-theme inks and markers from globals.css. */
const SIDE_INK: Record<Side, string> = { aff: "FF1D4ED8", neg: "FFC0271F" };
const HIGHLIGHT_FILL = "FFFDE047";
const CARD_EDGE = "FF2563EB";
const GROUP_EDGE = "FF6B7280";
/** The kicked slash. Its own constant, so retuning the group bar leaves it be. */
const KICKED_EDGE = "FF6B7280";
const COL_WIDTH = 36;

export function addFlowWorksheet(
    workbook: ExcelJS.Workbook,
    round: FlowRound,
    sheet: FlowSheet,
    used: Set<string>,
): ExcelJS.Worksheet {
    const cols = columnsForFlowSheet(round, sheet);
    // Pad to the wider of the derived columns and the stored data so overflow
    // columns from a narrowed orientation still export.
    const width = gridWidth(cols, sheet.data);
    const headerRows = sheet.kind === "cx" ? 2 : 1;
    const ws = workbook.addWorksheet(safeSheetName(sheet.title, used), {
        views: [{ showGridLines: false, state: "frozen", ySplit: headerRows }],
        // The cross-ex sheet holds both sides, so only flow tabs wear a side color.
        ...(sheet.kind !== "cx" && {
            properties: { tabColor: { argb: SIDE_INK[sheet.group] } },
        }),
    });
    for (let c = 0; c < width; c++) ws.getColumn(c + 1).width = COL_WIDTH;

    if (sheet.kind === "cx") {
        // Period tier above the Question/Response (or Aff/Neg) columns,
        // merged across each period's pair.
        for (let c = 0; c < cols.length; ) {
            let end = c;
            while (end + 1 < cols.length && cols[end + 1].group === cols[c].group) end++;
            const cell = ws.getCell(1, c + 1);
            cell.value = cols[c].group ?? "";
            cell.font = { bold: true };
            cell.alignment = { horizontal: "center" };
            if (end > c) ws.mergeCells(1, c + 1, 1, end + 1);
            c = end + 1;
        }
    }
    cols.forEach((col, c) => {
        const cell = ws.getCell(headerRows, c + 1);
        cell.value = sheet.kind === "cx" ? col.name : col.short;
        cell.font = { bold: true, color: { argb: SIDE_INK[col.side] } };
        cell.alignment = { horizontal: "center" };
    });

    sheet.data.forEach((row, r) => {
        for (let c = 0; c < width; c++) {
            const text = row[c];
            const meta = sheet.meta[`${r},${c}`];
            if (!text && !meta) continue;
            const cell = ws.getCell(headerRows + 1 + r, c + 1);
            if (text) cell.value = text;
            cell.alignment = { wrapText: true, vertical: "top" };
            const side = cols[c]?.side;
            if (side || meta?.bold) {
                cell.font = {
                    ...(meta?.bold && { bold: true }),
                    ...(side && { color: { argb: SIDE_INK[side] } }),
                };
            }
            if (meta?.highlight) {
                cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: HIGHLIGHT_FILL },
                };
            }
            if (meta?.card || meta?.group || meta?.kicked) {
                cell.border = {
                    ...(meta?.card && {
                        bottom: { style: "medium" as const, color: { argb: CARD_EDGE } },
                    }),
                    ...(meta?.group && {
                        left: { style: "medium" as const, color: { argb: GROUP_EDGE } },
                    }),
                    // Thin, unlike the edge markers: the diagonal crosses the
                    // text, and a medium stroke through the words is the
                    // interference the on-screen slash is drawn to avoid.
                    ...(meta?.kicked && {
                        diagonal: {
                            up: true,
                            style: "thin" as const,
                            color: { argb: KICKED_EDGE },
                        },
                    }),
                };
            }
        }
    });
    return ws;
}

/** Fill an empty workbook with every worksheet for the round, in tab order. */
export function fillWorkbook(
    workbook: ExcelJS.Workbook,
    round: FlowRound,
    contacts: Contacts = {},
): void {
    applyInfoWorksheet(workbook, round);
    maybeAddRfdWorksheet(workbook, round, contacts);
    const used = new Set(workbook.worksheets.map((ws) => ws.name.toLowerCase()));
    for (const sheet of sortedSheets(round)) addFlowWorksheet(workbook, round, sheet, used);
}

/** Contacts name the authors of any peer notes on the RFD worksheet. */
export async function downloadXlsx(round: FlowRound, contacts: Contacts = {}): Promise<void> {
    const { default: ExcelJS } = await import("exceljs");
    const workbook = new ExcelJS.Workbook();
    fillWorkbook(workbook, round, contacts);
    const out = await workbook.xlsx.writeBuffer();
    await saveBlob(
        new Blob([out], { type: MIME_BY_EXT[".xlsx"] }),
        exportFilename(round.createdAt, "xlsx"),
    );
}
