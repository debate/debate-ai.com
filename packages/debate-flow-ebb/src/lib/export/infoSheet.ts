/**
 * Info and RFD worksheets, written with ExcelJS after the grid export. (In
 * export code, "sheet" is the app's FlowSheet; Excel tabs are worksheets.)
 */

import type ExcelJS from "exceljs";

import type { Contacts } from "../collab/contacts";
import { sideLabels } from "../format/events";
import type { FlowRound } from "../model/flow";
import type { Debater } from "../model/types";
import { authoredPeerNotes } from "../rfd/peerNotes";

import { isoDate } from "./download";

const fullName = (d: Debater): string => [d.first, d.last].filter(Boolean).join(" ");

/** Label in column A (bold), value in column B, on the given row. */
function labeled(ws: ExcelJS.Worksheet, row: number, label: string, value?: string): void {
    ws.getCell(row, 1).value = label;
    ws.getCell(row, 1).font = { bold: true };
    if (value && value.trim()) ws.getCell(row, 2).value = value;
}

export function applyInfoWorksheet(workbook: ExcelJS.Workbook, round: FlowRound): void {
    const ws = workbook.addWorksheet("Info", { views: [{ showGridLines: false }] });
    ws.getColumn(1).width = 16;
    ws.getColumn(2).width = 36;
    const sc = round.scouting;
    labeled(ws, 2, "Tournament", sc.tournament);
    labeled(
        ws,
        3,
        "Round",
        [sc.round, sc.flight && `Flight ${sc.flight}`].filter(Boolean).join(" "),
    );
    labeled(ws, 4, "Date", sc.date || isoDate(round.createdAt));
    labeled(ws, 5, "Judge", sc.judge);
    const sides = sideLabels(round.event);
    labeled(ws, 7, `${sides.aff.label} School`, sc.affSchool);
    labeled(ws, 8, sides.aff.speakers[0], fullName(sc.aff.first));
    labeled(ws, 9, sides.aff.speakers[1], fullName(sc.aff.second));
    labeled(ws, 11, `${sides.neg.label} School`, sc.negSchool);
    labeled(ws, 12, sides.neg.speakers[0], fullName(sc.neg.first));
    labeled(ws, 13, sides.neg.speakers[1], fullName(sc.neg.second));
    const vote = sc.decision?.vote;
    labeled(ws, 15, "Decision", vote && sides[vote].label.toUpperCase());
}

/** Body cell holding an author's notes, wrapped and top-aligned. */
function notes(ws: ExcelJS.Worksheet, row: number, text: string): void {
    ws.getCell(row, 1).value = text;
    ws.getCell(row, 1).alignment = { wrapText: true, vertical: "top" };
}

/**
 * RFD worksheet, only when there is a vote, local notes, or a peer's notes.
 *
 * Peers follow the local author in the order the preview pane shows them, each
 * under a label, because an EndpointId alone names nobody.
 */
export function maybeAddRfdWorksheet(
    workbook: ExcelJS.Workbook,
    round: FlowRound,
    contacts: Contacts = {},
): void {
    const decision = round.scouting.decision;
    const rfd = decision?.rfd?.trim() ?? "";
    const peers = authoredPeerNotes(decision, contacts);
    if (!decision?.vote && !rfd && peers.length === 0) return;
    const ws = workbook.addWorksheet("RFD", { views: [{ showGridLines: false }] });
    ws.getColumn(1).width = 100;
    ws.getCell("A1").value = "Decision";
    ws.getCell("A1").font = { bold: true };
    if (decision?.vote) {
        ws.getCell("B1").value = sideLabels(round.event)[decision.vote].label.toUpperCase();
    }
    if (rfd) notes(ws, 2, rfd);
    // Tracks the last written row so each author lands below the decision
    // block and below whichever author precedes them.
    let row = rfd ? 2 : 1;
    for (const peer of peers) {
        // A blank row separates one author's section from the last.
        row += 2;
        ws.getCell(row, 1).value = `Notes from ${peer.author}`;
        ws.getCell(row, 1).font = { bold: true };
        notes(ws, row + 1, peer.text);
        row += 1;
    }
}
