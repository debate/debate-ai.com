"use client";

/**
 * PrintView - renders all sheets as static read-only tables for printing.
 *
 * Rendered from FlowSheet data, never from the Handsontable widget: the
 * widget's DOM is virtualized and only contains the visible rows. Shown in
 * the DOM alongside the workspace so window.print() captures it; the
 * workspace hides via .no-print, this shows via .print-only.
 */

import { gridWidth, metaToClassName, trimGrid } from "../../lib/grid/codec";
import { columnsForFlowSheet } from "../../lib/grid/flowColumns";
import { sortedSheets } from "../../lib/model/flow";
import { renderRfdHtml } from "../../lib/rfd/markdown";
import { authoredPeerNotes } from "../../lib/rfd/peerNotes";
import { useFlowStore } from "../../lib/store/useFlowStore";

/**
 * Reasons for decision, printed after the sheets so the flow reads first.
 *
 * The owner's notes lead and each peer follows under their own label, in the
 * order the preview pane lists them. Every section is rendered on its own, so
 * one author's markdown cannot run into the next author's.
 */
function PrintRfd() {
    const decision = useFlowStore((s) => s.round?.scouting.decision);
    const contacts = useFlowStore((s) => s.contacts);
    const rfd = decision?.rfd?.trim() ?? "";
    const peers = authoredPeerNotes(decision, contacts);
    if (!rfd && peers.length === 0) return null;

    return (
        <section className="print-rfd" data-testid="print-rfd">
            <h2>RFD</h2>
            {rfd && <div dangerouslySetInnerHTML={{ __html: renderRfdHtml(rfd) }} />}
            {peers.map((note) => (
                <section key={note.endpointId} data-testid="print-rfd-peer-note">
                    <h3>{note.author}</h3>
                    <div dangerouslySetInnerHTML={{ __html: renderRfdHtml(note.text) }} />
                </section>
            ))}
        </section>
    );
}

export default function PrintView() {
    const round = useFlowStore((s) => s.round);

    if (!round) return null;

    return (
        <div className="print-only print-flow" data-testid="print-view">
            {sortedSheets(round).map((sheet) => {
                const cols = columnsForFlowSheet(round, sheet);
                const rows = trimGrid(sheet.data);
                // Stored data can outrun the derived columns after a
                // speaking-order swap; render the wider count with blank
                // headers so overflow text still prints.
                const width = gridWidth(cols, rows);
                const columns = Array.from({ length: width }, (_, i) => cols[i]);
                return (
                    <section key={sheet.id} className="print-sheet">
                        <h2 data-testid={`print-sheet-title-${sheet.id}`}>{sheet.title}</h2>
                        <table>
                            <thead>
                                <tr>
                                    {columns.map((c, i) => (
                                        <th key={i}>
                                            {c ? (c.group ? `${c.group} ${c.name}` : c.name) : ""}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row, r) => (
                                    <tr key={r}>
                                        {columns.map((_, c) => {
                                            const m = sheet.meta[`${r},${c}`];
                                            return (
                                                <td key={c} className={metaToClassName(m)}>
                                                    {row[c] ?? ""}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                );
            })}
            <PrintRfd />
        </div>
    );
}
