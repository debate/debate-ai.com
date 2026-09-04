"use client";

import { CaretLeft, CaretRight } from "@phosphor-icons/react";
import { LazyMotion, Reorder } from "motion/react";
import { useRef, useState, useEffect } from "react";
import { toast } from "sonner";

import InviteChip from "../collab/InviteChip";
import SessionChip from "../collab/SessionChip";
import ShareButton from "../collab/ShareButton";
import { loadFeatures } from "../MotionRoot";
import { Button } from "../ui/button";
import { Tip } from "../ui/tooltip";
import { sideLabels } from "../../lib/format/events";
import { focusActiveHot } from "../../lib/grid/hotInstance";
import { compareSheets, dropSheetRange, sheetRangeIds, type FlowSheet } from "../../lib/model/flow";
import { focusedSheetId, useFlowStore } from "../../lib/store/useFlowStore";
import { cn } from "../../lib/utils";

const EMPTY_SHEETS: FlowSheet[] = [];

/** Pointer travel, in px, past which a press was a drag rather than a click. */
const DRAG_SLOP = 4;

export default function Sidebar() {
    const sheets = useFlowStore((s) => s.round?.sheets ?? EMPTY_SHEETS);
    const sides = sideLabels(useFlowStore((s) => s.round?.event));

    // Highlight follows the focused pane's sheet, so in split view the marker
    // tracks Tab 1/Tab 2 focus rather than always sitting on pane 1.
    const focusedId = useFlowStore((s) => focusedSheetId(s));
    const setActiveSheet = useFlowStore((s) => s.setActiveSheet);
    const renamingSheetId = useFlowStore((s) => s.renamingSheetId);
    const setRenamingSheet = useFlowStore((s) => s.setRenamingSheet);
    const removeSheet = useFlowStore((s) => s.removeSheet);
    const restoreSheet = useFlowStore((s) => s.restoreSheet);
    const sidebarCollapsed = useFlowStore((s) => s.sidebarCollapsed);
    const setSidebarCollapsed = useFlowStore((s) => s.setSidebarCollapsed);
    const reorderSheets = useFlowStore((s) => s.reorderSheets);
    const sheetRange = useFlowStore((s) => s.sheetRange);
    const setSheetRange = useFlowStore((s) => s.setSheetRange);
    const addSheets = useFlowStore((s) => s.addSheets);
    // The drag in flight: the row the pointer picked up, the block that came
    // with it, and the ordering motion last proposed. A ref, not state - the
    // gesture reads what it wrote and nothing renders on it.
    const drag = useRef<{ id: string; block: string[]; landing: string[] } | null>(null);
    // Bulk count: empty (or junk) means one sheet, so the buttons stay single-add
    // by default and only fan out when the user types a number.
    const [bulkCount, setBulkCount] = useState("");

    if (sheets.length === 0) return null;

    function addGroup(group: "aff" | "neg") {
        const n = Math.max(1, Math.floor(Number(bulkCount)) || 1);
        addSheets(Array.from({ length: n }, () => ({ group })));
    }

    // Deleting a sheet wipes a whole column of a live round, so it must be
    // reversible at the point of action - not only via a keyboard Undo the user
    // may not know about. Mirror the dashboard's soft-delete + Undo toast.
    function deleteSheet(sheetId: string) {
        const removed = removeSheet(sheetId);
        if (!removed) return;
        toast(`Deleted “${removed.sheet.title}”`, {
            action: {
                label: "Undo",
                onClick: () => restoreSheet(removed),
            },
        });
    }

    const cxSheet = sheets.find((s) => s.kind === "cx") ?? null;

    if (sidebarCollapsed) {
        return (
            <>
                <nav
                    className="no-print border-border bg-card flex h-full w-9 shrink-0 flex-col items-center border-r pt-2"
                    aria-label="Sheets"
                    data-testid="sidebar"
                >
                    <Tip label="Expand sidebar" command="sidebar.toggle" side="right">
                        <button
                            type="button"
                            aria-label="Expand sidebar"
                            onClick={() => setSidebarCollapsed(false)}
                            className="text-muted-foreground hover:text-foreground hover:bg-accent rounded p-1 transition-colors"
                        >
                            <CaretRight size={16} />
                        </button>
                    </Tip>
                </nav>
                {/* No footer to sit in, so the chips float over the grid's left
                    edge, clear of the collapsed rail. */}
                <div className="no-print fixed bottom-3 left-11 z-30 flex flex-col items-start gap-1">
                    <InviteChip />
                    <SessionChip />
                    <ShareButton />
                </div>
            </>
        );
    }

    const flowSheets = sheets.filter((s) => s.kind !== "cx").sort(compareSheets);
    // Derived every render rather than stored: a sheet deleted out from under
    // a range resolves to no selection instead of a stale id in a list.
    const selectedIds = sheetRange
        ? sheetRangeIds(flowSheets, sheetRange.anchor, sheetRange.head)
        : [];
    const selected = new Set(selectedIds);

    /**
     * A plain click moves the cursor, which collapses the range. A shifted one
     * only paints: extending across nine sheets must fire no sheet switch, or
     * the grid scrolls away from the speech being flowed.
     */
    function selectSheet(sheetId: string, extend: boolean) {
        if (!extend) {
            setActiveSheet(sheetId);
            return;
        }
        const anchor = sheetRange?.anchor ?? focusedId;
        if (anchor == null) return;
        setSheetRange({ anchor, head: sheetId });
    }

    /** Records the row the pointer picked up, and the block that comes with it. */
    function handleGrab(sheetId: string) {
        const block = selected.has(sheetId) && selectedIds.length > 1 ? selectedIds : [];
        drag.current = { id: sheetId, block, landing: [] };
    }

    /**
     * Motion drags the single row under the pointer and proposes an ordering
     * for it on every frame. Every proposal is committed as it comes, which is
     * the contract Reorder.Group is built on - a remapped ordering handed back
     * here is not the one motion asked for, and its internal order fights the
     * difference for the rest of the gesture. The block the pointer picked up
     * gathers at the grabbed row on release instead.
     */
    function handleReorder(nextIds: string[]) {
        const gesture = drag.current;
        if (gesture) gesture.landing = nextIds;
        // A drag that began outside the range ends it; one that began inside
        // keeps it, so the block it named still has two edges to gather on.
        if (sheetRange && !gesture?.block.length) setSheetRange(null);
        reorderSheets(nextIds);
    }

    /** Lands a dragged block where its grabbed row was released. */
    function handleDrop() {
        const gesture = drag.current;
        drag.current = null;
        if (!gesture || gesture.block.length === 0 || gesture.landing.length === 0) return;
        reorderSheets(dropSheetRange(gesture.landing, gesture.block, gesture.id));
    }

    return (
        <nav
            className="no-print border-border bg-card flex h-full w-[220px] shrink-0 flex-col border-r"
            aria-label="Sheets"
            data-testid="sidebar"
        >
            <div className="flex shrink-0 items-center gap-1 p-2">
                <Tip label="Add sheet" command="sheet.newAff">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-aff text-aff dark:border-aff flex-1"
                        onClick={() => addGroup("aff")}
                        data-testid="add-aff"
                    >
                        + {sides.aff.label}
                    </Button>
                </Tip>
                <Tip label="Bulk add sheets">
                    <input
                        type="number"
                        min={1}
                        inputMode="numeric"
                        value={bulkCount}
                        onChange={(e) => setBulkCount(e.target.value)}
                        placeholder="1"
                        aria-label="Bulk add sheets"
                        data-testid="bulk-add-count"
                        data-editing-field
                        className="border-input text-foreground h-8 w-11 shrink-0 [appearance:textfield] rounded-md border bg-transparent px-1 text-center text-[13px] outline-none focus:placeholder-transparent [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                </Tip>
                <Tip label="Add sheet" command="sheet.newNeg">
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-neg text-neg dark:border-neg flex-1"
                        onClick={() => addGroup("neg")}
                        data-testid="add-neg"
                    >
                        + {sides.neg.label}
                    </Button>
                </Tip>
                <Tip label="Collapse sidebar" command="sidebar.toggle">
                    <button
                        type="button"
                        aria-label="Collapse sidebar"
                        onClick={() => setSidebarCollapsed(true)}
                        className="text-muted-foreground hover:text-foreground hover:bg-accent shrink-0 rounded p-1 transition-colors"
                    >
                        <CaretLeft size={16} />
                    </button>
                </Tip>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {cxSheet && (
                    <div className="mb-3">
                        <div
                            data-testid="cx-section-label"
                            className="text-muted-foreground px-2 pb-1 font-mono text-[9px] font-bold tracking-widest uppercase"
                        >
                            CX
                        </div>
                        <button
                            type="button"
                            onClick={() => setActiveSheet(cxSheet.id)}
                            aria-current={cxSheet.id === focusedId ? "true" : undefined}
                            data-testid="cx-sheet-row"
                            className={cn(
                                "flex w-full items-center rounded-md border px-2 py-1.5 text-left text-[13px] text-foreground transition-colors",
                                cxSheet.id === focusedId
                                    ? "border-border bg-accent font-semibold text-foreground"
                                    : "border-transparent hover:bg-accent/50",
                            )}
                        >
                            <span className="overflow-hidden text-ellipsis whitespace-nowrap">
                                {cxSheet.title}
                            </span>
                        </button>
                    </div>
                )}
                {/* The count is the affordance and the readable state at once.
                    A row is a role="button" div with a sibling delete button,
                    so role="option" would be invalid ARIA in exchange for
                    aria-selected. */}
                <div
                    data-testid="sheets-section-label"
                    className="text-muted-foreground px-2 pb-1 font-mono text-[9px] font-bold tracking-widest uppercase"
                >
                    {selectedIds.length > 1 ? `${selectedIds.length} selected` : "Sheets"}
                </div>
                {flowSheets.length === 0 ? (
                    <div className="text-muted-foreground px-2 py-1 text-xs">No sheets</div>
                ) : (
                    // Reorder is built on the full `motion` component; a nested,
                    // non-strict LazyMotion silences the app-wide strict warning
                    // while reusing the already-loaded feature chunk.
                    <LazyMotion features={loadFeatures}>
                        <Reorder.Group
                            as="div"
                            axis="y"
                            values={flowSheets.map((s) => s.id)}
                            onReorder={handleReorder}
                        >
                            {flowSheets.map((sheet) => (
                                <SheetRow
                                    key={sheet.id}
                                    sheet={sheet}
                                    active={sheet.id === focusedId}
                                    selected={selected.has(sheet.id)}
                                    onSelect={(extend) => selectSheet(sheet.id, extend)}
                                    onGrab={() => handleGrab(sheet.id)}
                                    onDrop={handleDrop}
                                    isRenaming={sheet.id === renamingSheetId}
                                    onStartRename={() => setRenamingSheet(sheet.id)}
                                    onDelete={() => deleteSheet(sheet.id)}
                                />
                            ))}
                        </Reorder.Group>
                    </LazyMotion>
                )}
            </div>
            {/* Footer, below the scrolling list, so a live session never covers
                a sheet name. Each chip carries its own rule and draws nothing
                when it has nothing, so an idle round shows no footer at all. */}
            <InviteChip className="border-border/60 shrink-0 border-t p-2" />
            <SessionChip className="border-border/60 shrink-0 border-t p-2" />
            <div className="border-border/60 shrink-0 border-t p-2">
                <ShareButton />
            </div>
        </nav>
    );
}

interface SheetRowProps {
    sheet: FlowSheet;
    active: boolean;
    /** Inside the sidebar's range, which the active row may also be. */
    selected: boolean;
    /** `extend` is the click's shift state: paint the range, do not move focus. */
    onSelect: (extend: boolean) => void;
    /** The pointer picked this row up; the block follows it if it is in one. */
    onGrab: () => void;
    /** The pointer let it go, which is where a dragged block lands. */
    onDrop: () => void;
    isRenaming: boolean;
    onStartRename: () => void;
    onDelete: () => void;
}

function SheetRow({
    sheet,
    active,
    selected,
    onSelect,
    onGrab,
    onDrop,
    isRenaming,
    onStartRename,
    onDelete,
}: SheetRowProps) {
    const renameSheet = useFlowStore((s) => s.renameSheet);
    const setRenamingSheet = useFlowStore((s) => s.setRenamingSheet);
    const sides = sideLabels(useFlowStore((s) => s.round?.event));
    const inputRef = useRef<HTMLInputElement>(null);
    const [value, setValue] = useState(sheet.title);
    // Where the pointer went down, so a click that merely ends a drag can be
    // told from one that asks for a sheet.
    const pressedAt = useRef<{ x: number; y: number } | null>(null);

    const titleRef = useRef<HTMLSpanElement>(null);
    const [titleTruncated, setTitleTruncated] = useState(false);

    useEffect(() => {
        const el = titleRef.current;
        if (!el) return;
        setTitleTruncated(el.scrollWidth > el.clientWidth);
    }, [sheet.title]);

    useEffect(() => {
        if (!isRenaming) return;
        setValue(sheet.title);
        // Two frames, not one: the rename command may open a collapsed sidebar in
        // the same tick, so the row is mounting while the command palette closes
        // over the grid. Focusing on the second frame lets that mount and the
        // palette's focus hand-off settle first, so the input isn't skipped.
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            });
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [isRenaming, sheet.title]);

    function commit() {
        renameSheet(sheet.id, value.trim() || sheet.title);
        setRenamingSheet(null);
        focusActiveHot();
    }

    function cancel() {
        setRenamingSheet(null);
    }

    if (isRenaming) {
        // A plain row while renaming: keeping it a Reorder.Item wraps the input in
        // a motion element that swallows the first keystroke. Dragging is moot mid-
        // rename, so the one non-draggable row costs nothing.
        return (
            <div className="border-aff bg-accent flex w-full items-center gap-1.5 rounded-md border px-2 py-1.5">
                <span
                    aria-hidden
                    className={cn(
                        "h-4 w-0.5 shrink-0 rounded-full",
                        sheet.group === "aff" ? "bg-aff" : "bg-neg",
                    )}
                />
                <input
                    ref={inputRef}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            e.stopPropagation();
                            commit();
                        }
                        if (e.key === "Escape") {
                            e.stopPropagation();
                            cancel();
                        }
                    }}
                    onBlur={commit}
                    data-editing-field
                    className="text-foreground min-w-0 flex-1 border-none bg-transparent p-0 font-[inherit] text-[13px] outline-none"
                    data-testid={`rename-input-${sheet.id}`}
                />
            </div>
        );
    }

    // relative so the dragged row's auto z-index lifts it above its neighbors.
    return (
        <Reorder.Item
            as="div"
            value={sheet.id}
            onDragStart={onGrab}
            onDragEnd={onDrop}
            className="group relative flex items-center"
        >
            <div
                role="button"
                tabIndex={0}
                onPointerDown={(e) => {
                    pressedAt.current = { x: e.clientX, y: e.clientY };
                }}
                onClick={(e) => {
                    // A drag ends in a click on the row the pointer captured.
                    // That is the browser finishing the gesture, not a debater
                    // asking for a sheet, and honoring it would move the cursor
                    // off the sheet being flowed and collapse the range the
                    // drag just moved.
                    const from = pressedAt.current;
                    if (from && Math.hypot(e.clientX - from.x, e.clientY - from.y) > DRAG_SLOP) {
                        return;
                    }
                    onSelect(e.shiftKey);
                }}
                onDoubleClick={onStartRename}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelect(e.shiftKey);
                    }
                }}
                aria-current={active ? "true" : undefined}
                data-testid={`sheet-${sheet.id}`}
                data-selected={selected ? "true" : undefined}
                className={cn(
                    "flex w-full flex-1 cursor-pointer items-center justify-between gap-1.5 rounded-md border px-2 py-1.5 text-left text-[13px] text-foreground transition-colors",
                    // The active row keeps the heavier treatment inside a
                    // range, so the anchor stays legible in the block rather
                    // than dissolving into it.
                    active
                        ? "border-border bg-accent font-semibold text-foreground"
                        : selected
                          ? "border-transparent bg-accent/60"
                          : "border-transparent hover:bg-accent/50",
                )}
            >
                <span
                    aria-hidden
                    data-testid={`sheet-marker-${sheet.id}`}
                    className={cn(
                        "h-4 w-0.5 shrink-0 rounded-full",
                        sheet.group === "aff" ? "bg-aff" : "bg-neg",
                    )}
                />
                <span className="sr-only">{sides[sheet.group].label}</span>
                {titleTruncated ? (
                    <Tip label={sheet.title}>
                        <span
                            ref={titleRef}
                            className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                        >
                            {sheet.title}
                        </span>
                    </Tip>
                ) : (
                    <span
                        ref={titleRef}
                        className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap"
                    >
                        {sheet.title}
                    </span>
                )}
            </div>
            <Tip label="Delete sheet">
                <button
                    type="button"
                    aria-label="Delete sheet"
                    data-testid={`delete-sheet-${sheet.id}`}
                    onClick={(e) => {
                        e.stopPropagation();
                        onDelete();
                    }}
                    className="text-muted-foreground hover:text-destructive cursor-pointer rounded px-1 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 focus-visible:opacity-100"
                >
                    ×
                </button>
            </Tip>
        </Reorder.Item>
    );
}
