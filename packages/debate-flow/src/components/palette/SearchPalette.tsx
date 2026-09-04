"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { Dialog, DialogContent, DialogTitle } from "../ui/dialog";
import { Kbd } from "../ui/kbd";
import { executeCommand } from "../../lib/commands/commands";
import { getEvent, speechOrder } from "../../lib/format/events";
import { keyHintFor } from "../../lib/keymap/displayChord";
import { searchCells } from "../../lib/search/cellSearch";
import { searchCommands, searchSpeechCommands } from "../../lib/search/commandSearch";
import { useFlowStore } from "../../lib/store/useFlowStore";

/**
 * The command/search palette: search every filled cell in the flow, or prefix
 * the query with ">" to search commands instead. Matching is order-independent
 * multi-token AND (see lib/search/match.ts); a cell is also findable by its
 * sheet title or column name. Enter jumps the grid cursor to a cell, or runs
 * the selected command.
 */
export default function SearchPalette() {
    const open = useFlowStore((s) => s.quickSwitcherOpen);
    if (!open) return null;
    return <SearchPaletteInner />;
}

/** A palette row, unified across the cell and command modes. */
type Row =
    | {
          kind: "cell";
          id: string;
          text: string;
          badge: string;
          side: "aff" | "neg";
          meta: string;
          run: () => void;
      }
    | {
          kind: "command";
          id: string;
          text: string;
          hint: string | null;
          run: () => void;
      };

/** Rows shown per page; "show more" extends the window by another page. */
const PAGE_SIZE = 12;

function SearchPaletteInner() {
    const open = useFlowStore((s) => s.quickSwitcherOpen);
    const seed = useFlowStore((s) => s.paletteSeed);
    const round = useFlowStore((s) => s.round);
    const revealCell = useFlowStore((s) => s.revealCell);
    const switchSpeech = useFlowStore((s) => s.switchSpeech);
    const setOpen = useFlowStore((s) => s.setQuickSwitcherOpen);

    const [query, setQuery] = useState(seed);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
    const inputRef = useRef<HTMLInputElement>(null);

    // Re-seed when the palette is reopened in a different mode without first
    // closing (e.g. Cmd+Shift+P while the search palette is already open).
    useEffect(() => {
        setQuery(seed);
        setSelectedIndex(0);
        setVisibleCount(PAGE_SIZE);
    }, [seed]);

    const isCommandMode = query.startsWith(">");

    const allRows = useMemo<Row[]>(() => {
        if (isCommandMode) {
            const q = query.slice(1);
            const commands: Row[] = searchCommands(q)
                .filter(
                    (c) =>
                        c.id !== "round.swapOrder" ||
                        (round != null && getEvent(round.event).variableOrder),
                )
                .map((c) => ({
                    kind: "command",
                    id: c.id,
                    text: c.label,
                    hint: keyHintFor(c.id),
                    run: () => executeCommand(c.id),
                }));
            if (!round) return commands;
            const speeches = searchSpeechCommands(
                q,
                speechOrder(getEvent(round.event), round.firstSide ?? "aff"),
            ).map<Row>((s) => ({
                kind: "command",
                id: `speech:${s.speechId}`,
                text: s.label,
                hint: null,
                run: () => switchSpeech(s.speechId),
            }));
            return [...commands, ...speeches];
        }
        if (!round) return [];
        return searchCells(round, query).map((hit) => ({
            kind: "cell",
            id: `${hit.sheetId}-${hit.row}-${hit.col}`,
            text: hit.text,
            badge: hit.colName,
            side: hit.side,
            meta: hit.card ? `${hit.sheetTitle} · Card` : hit.sheetTitle,
            run: () => revealCell(hit.sheetId, hit.row, hit.col),
        }));
    }, [isCommandMode, query, round, revealCell, switchSpeech]);

    const rows = visibleCount < allRows.length ? allRows.slice(0, visibleCount) : allRows;

    useEffect(() => {
        setSelectedIndex(0);
        setVisibleCount(PAGE_SIZE);
    }, [query]);

    // Keep the highlighted row visible when arrowing past the viewport edge.
    useEffect(() => {
        if (!open) return;
        document.getElementById(`sp-row-${selectedIndex}`)?.scrollIntoView?.({ block: "nearest" });
    }, [open, selectedIndex, rows]);

    if (!open) return null;

    function select(row: Row) {
        // Run first, then close: a self-listed command (e.g. "Command palette")
        // reopens the palette, and closing afterwards leaves it dismissed.
        row.run();
        setOpen(false);
    }

    function onKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Escape") {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
            return;
        }
        const down = e.key === "ArrowDown" || (e.ctrlKey && e.key === "n");
        const up = e.key === "ArrowUp" || (e.ctrlKey && e.key === "p");
        if (down) {
            e.preventDefault();
            setSelectedIndex((i) => Math.min(i + 1, Math.max(rows.length - 1, 0)));
            return;
        }
        if (up) {
            e.preventDefault();
            setSelectedIndex((i) => Math.max(i - 1, 0));
            return;
        }
        if (e.key === "Enter") {
            e.preventDefault();
            e.stopPropagation();
            const row = rows[selectedIndex];
            if (row) select(row);
        }
    }

    const activeId = rows[selectedIndex] ? `sp-row-${selectedIndex}` : undefined;
    const label = isCommandMode ? "Run command" : "Search cells";

    return (
        <Dialog
            open={open}
            onOpenChange={(o) => {
                if (!o) setOpen(false);
            }}
        >
            {/* Hosted on the shared Dialog primitive for a real focus trap +
                scroll lock (Tab can't walk into the grid behind it), but
                top-anchored and chromeless to keep the command-palette feel. */}
            <DialogContent
                showCloseButton={false}
                animated={false}
                aria-label={label}
                data-testid="search-palette"
                onKeyDown={onKeyDown}
                initialFocus={() => {
                    // Own focus so the caret lands past the ">" seed instead of
                    // selecting it (the default autofocus selects the input).
                    const el = inputRef.current;
                    el?.focus();
                    el?.setSelectionRange(seed.length, seed.length);
                    return false;
                }}
                className="bg-popover top-[12vh] w-full max-w-[560px] translate-y-0 gap-0 overflow-hidden rounded-md border p-0 shadow-2xl"
            >
                <DialogTitle className="sr-only">{label}</DialogTitle>
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    // Suppress the browser's form-history dropdown: otherwise the
                    // first Escape only dismisses that native suggestion popup,
                    // and it takes a second Escape to close the palette itself.
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    placeholder={
                        isCommandMode ? "Run a command…" : "Search cells, or > for commands…"
                    }
                    // outline-none! wins over the global keyboard-first :focus-visible
                    // ring (unlayered, so it outranks layered utilities); the caret
                    // carries focus - the bar itself is the chrome.
                    className="text-foreground placeholder:text-muted-foreground w-full border-none bg-transparent px-3 py-2.5 text-[13px] outline-none!"
                    data-testid="search-palette-input"
                    aria-label={label}
                    role="combobox"
                    aria-expanded
                    aria-controls="search-palette-list"
                    aria-activedescendant={activeId}
                />
                <div
                    id="search-palette-list"
                    role="listbox"
                    aria-label="Results"
                    className="border-border max-h-[320px] overflow-y-auto border-t p-1"
                >
                    {rows.length === 0 ? (
                        <div className="text-muted-foreground px-2 py-1.5 text-[13px]">
                            {isCommandMode ? "No commands" : "No results"}
                        </div>
                    ) : (
                        <ul className="m-0 list-none p-0">
                            {rows.map((row, i) => (
                                <li key={row.id} role="presentation">
                                    <button
                                        type="button"
                                        id={`sp-row-${i}`}
                                        role="option"
                                        aria-selected={i === selectedIndex}
                                        className={`flex w-full cursor-pointer items-center gap-2 rounded-sm border-none px-2 py-1.5 text-left text-[13px] ${
                                            i === selectedIndex ? "bg-accent" : "bg-transparent"
                                        }`}
                                        onClick={() => select(row)}
                                        // Hover moves the real selection; mousemove (not
                                        // mouseenter) so a keyboard scroll sliding rows
                                        // under a resting pointer doesn't hijack it.
                                        onMouseMove={() => {
                                            if (i !== selectedIndex) setSelectedIndex(i);
                                        }}
                                        data-testid={`sp-row-${i}`}
                                    >
                                        {row.kind === "cell" && row.badge && (
                                            <span
                                                className={`shrink-0 rounded-xs border border-current px-1 py-px text-[10px] font-semibold tracking-wide uppercase ${
                                                    row.side === "aff" ? "text-aff" : "text-neg"
                                                }`}
                                            >
                                                {row.badge}
                                            </span>
                                        )}
                                        {row.kind === "command" && (
                                            <span className="text-muted-foreground border-border shrink-0 rounded-xs border px-1 py-px text-[10px] font-semibold tracking-wide uppercase">
                                                CMD
                                            </span>
                                        )}
                                        <span className="text-foreground min-w-0 flex-1 truncate font-medium">
                                            {row.text}
                                        </span>
                                        {row.kind === "cell" ? (
                                            <span className="text-muted-foreground max-w-[45%] shrink-0 truncate text-[11px]">
                                                {row.meta}
                                            </span>
                                        ) : (
                                            row.hint && <Kbd className="shrink-0">{row.hint}</Kbd>
                                        )}
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    {allRows.length > rows.length && (
                        // A div, not a button, so clicking it can't steal focus
                        // from the input, which owns the keyboard.
                        <div
                            role="button"
                            className="text-muted-foreground hover:text-foreground cursor-pointer px-2 py-1.5 text-center text-[12px] select-none"
                            onClick={() => setVisibleCount((n) => n + PAGE_SIZE)}
                            data-testid="sp-show-more"
                        >
                            Showing {rows.length} of {allRows.length} - show more
                        </div>
                    )}
                </div>
                <div className="border-border text-muted-foreground flex flex-wrap gap-x-3 gap-y-1 border-t px-3 py-1.5 text-[11px]">
                    <span>Up/Down navigate</span>
                    <span>Enter {isCommandMode ? "run" : "jump"}</span>
                    <span>Esc close</span>
                </div>
            </DialogContent>
        </Dialog>
    );
}
