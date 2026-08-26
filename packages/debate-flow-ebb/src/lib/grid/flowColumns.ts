/**
 * Speech columns with stable ids. Columns are never stored on a round; a
 * sheet's visible columns derive from the round's event definition plus the
 * sheet's startSpeechId, and the cross-examination sheet's columns derive
 * from the event's period list.
 */

import type Handsontable from "handsontable";

import {
    EVENTS,
    getEvent,
    sideLabels,
    speechOrder,
    type EventDef,
    type SpeechDef,
} from "../format/events";
import type { FlowRound, FlowSheet } from "../model/flow";
import type { Side } from "../model/types";

export interface SpeechCol extends SpeechDef {
    /** Cross-ex period label; groups render as a second header tier. */
    group?: string;
}

const other = (side: Side): Side => (side === "aff" ? "neg" : "aff");

/**
 * A pair of columns per cross-ex period. Directional CX (Policy) labels them
 * Question/Response, the question side being the questioner; shared crossfire
 * (PF) labels each column by its side. An event with no cross-examination
 * (Parliamentary) has no periods and so no columns.
 */
export function crossExColumns(event: EventDef, firstSide: Side): SpeechCol[] {
    const sides = sideLabels(event.id);
    return (event.crossEx?.periods ?? []).flatMap((p, i) => {
        const qSide = p.q === "first" ? firstSide : other(firstSide);
        const rSide = other(qSide);
        if (event.crossEx?.shared) {
            return [
                {
                    id: `cx-${i}-q`,
                    name: sides[qSide].label,
                    short: sides[qSide].label,
                    side: qSide,
                    group: p.label,
                },
                {
                    id: `cx-${i}-r`,
                    name: sides[rSide].label,
                    short: sides[rSide].label,
                    side: rSide,
                    group: p.label,
                },
            ];
        }
        return [
            { id: `cx-${i}-q`, name: "Question", short: "Question", side: qSide, group: p.label },
            { id: `cx-${i}-r`, name: "Response", short: "Response", side: rSide, group: p.label },
        ];
    });
}

/**
 * The round's speaking order.
 *
 * A round's `firstSide` is a replicated register, so it holds whatever a peer
 * put on the wire, and it indexes a static table. Anything that is not the one
 * named side is the other, which is the fallback a file that predates the
 * field gets.
 */
function orderOf(round: FlowRound): SpeechDef[] {
    return speechOrder(getEvent(round.event), round.firstSide === "neg" ? "neg" : "aff");
}

/**
 * Where a sheet's leftmost column falls in the round's speaking order, or -1
 * when the order does not hold it. A sheet's `group` is a replicated register
 * too, and gets the same treatment as `firstSide`.
 */
function startIndex(round: FlowRound, sheet: FlowSheet): number {
    const group: Side = sheet.group === "neg" ? "neg" : "aff";
    const startId = sheet.startSpeechId ?? getEvent(round.event)[group][0].id;
    return orderOf(round).findIndex((c) => c.id === startId);
}

/**
 * The columns a sheet shows: cross-ex sheets pair Question/Response per
 * event period; flow sheets show from their leftmost speech (startSpeechId,
 * else the side's first speech in the round's event) onward.
 */
export function columnsForFlowSheet(round: FlowRound, sheet: FlowSheet): SpeechCol[] {
    const event = getEvent(round.event);
    if (sheet.kind === "cx") {
        return crossExColumns(event, round.firstSide === "neg" ? "neg" : "aff");
    }
    const order = orderOf(round);
    const idx = startIndex(round, sheet);
    return idx === -1 ? order : order.slice(idx);
}

/**
 * How many of the round's speeches sit left of a sheet's leftmost column.
 *
 * Exactly the columns `columnsForFlowSheet` drops, so the two always sum to
 * the round's full order. A cross-ex sheet drops none, because its columns are
 * periods and have no place in that order, and neither does a startSpeechId
 * the order does not hold, which falls back to the whole order there.
 */
export function speechOffset(round: FlowRound, sheet: FlowSheet): number {
    if (sheet.kind === "cx") return 0;
    const idx = startIndex(round, sheet);
    return idx === -1 ? 0 : idx;
}

/**
 * The speeches left of a sheet's leftmost column, in speaking order.
 *
 * Exactly what `columnsForFlowSheet` drops, so the two partition the round's
 * order. Each carries its own speech's side rather than the sheet's: a 1AC
 * slot is aff on a neg sheet the same way a 2AC column already is.
 */
export function spacerColumns(round: FlowRound, sheet: FlowSheet): SpeechCol[] {
    return orderOf(round).slice(0, speechOffset(round, sheet));
}

/**
 * A pane's inert leading column count: how many spacers the sheet named by
 * `sheetId` takes, or none while alignment is off or the round does not hold
 * that sheet.
 *
 * One derivation for both readers of it. The pane renders the spacers and the
 * bridge converts against them, and a bridge that counted differently would
 * land a CardMirror send one column off on padded sheets alone, which is the
 * hardest kind of wrong to see.
 */
export function spacerCount(
    round: FlowRound | null | undefined,
    sheetId: string | null | undefined,
    aligned: boolean,
): number {
    if (!aligned || !round || !sheetId) return 0;
    const sheet = round.sheets.find((s) => s.id === sheetId);
    return sheet ? speechOffset(round, sheet) : 0;
}

/**
 * The widest `columnsForFlowSheet` ever returns: the most columns any event
 * derives, over its speeches and over its cross-examination periods.
 *
 * The widest of every event rather than of one round's, because the event, the
 * side that speaks first, a sheet's group and its own leftmost speech are all
 * replicated registers, and a sheet holds the columns of whatever orientation
 * wrote it: `gridWidth` pads to the wider of the derived columns and the stored
 * data so a speaking-order swap does not truncate a column the debater typed
 * in. A bound read off this round would narrow with those registers and drop
 * that column instead.
 */
export const MAX_FLOW_COLS = Math.max(
    ...Object.values(EVENTS).map((event) =>
        Math.max(speechOrder(event, "aff").length, crossExColumns(event, "aff").length),
    ),
);

/**
 * Header settings per sheet: cross-ex gets a period tier above
 * Question/Response. `width` is the grid's actual column count, which can
 * exceed the derived columns when a sheet stores overflow columns from a
 * wider orientation; those extra columns render unlabeled so their text
 * stays visible instead of being dropped.
 */
export function headerSettings(sheet: FlowSheet, cols: SpeechCol[], width = cols.length) {
    if (sheet.kind === "cx") {
        const groups: { label: string; colspan: number }[] = [];
        for (const col of cols) {
            const last = groups[groups.length - 1];
            if (last && last.label === col.group) last.colspan++;
            else groups.push({ label: col.group ?? "", colspan: 1 });
        }
        if (width > cols.length) groups.push({ label: "", colspan: width - cols.length });
        return {
            colHeaders: true,
            nestedHeaders: [groups, Array.from({ length: width }, (_, i) => cols[i]?.name ?? "")],
        } satisfies Partial<Handsontable.GridSettings>;
    }
    return {
        colHeaders: Array.from({ length: width }, (_, i) => cols[i]?.short ?? ""),
        nestedHeaders: undefined,
    } satisfies Partial<Handsontable.GridSettings>;
}
