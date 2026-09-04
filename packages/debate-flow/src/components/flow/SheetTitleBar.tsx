"use client";

import { useEffect, useRef, useState } from "react";

import { focusActiveHot } from "../../lib/grid/hotInstance";
import { useFlowStore } from "../../lib/store/useFlowStore";
import { cn } from "../../lib/utils";

/**
 * The strip above a pane's grid. Shows the sheet title always (so a collapsed
 * sidebar still names the sheet); the title wears its side color (aff blue,
 * neg red). In split view it also carries the pane's "Tab 1"/"Tab 2" label and
 * an accent on the focused pane. Double-click the title to rename in place.
 */
export default function SheetTitleBar({
    sheetId,
    title,
    side,
    tabLabel,
    focused,
}: {
    sheetId: string;
    title: string;
    side: "aff" | "neg";
    tabLabel?: string;
    focused?: boolean;
}) {
    const renameSheet = useFlowStore((s) => s.renameSheet);
    const inputRef = useRef<HTMLInputElement>(null);
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(title);

    useEffect(() => {
        if (editing) {
            setValue(title);
            requestAnimationFrame(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            });
        }
    }, [editing, title]);

    function commit() {
        renameSheet(sheetId, value.trim() || title);
        setEditing(false);
        focusActiveHot();
    }

    return (
        <div
            data-testid="sheet-title-bar"
            data-focused={focused ? "true" : undefined}
            onClick={editing ? undefined : () => setEditing(true)}
            className={cn(
                "border-border bg-card flex h-8 shrink-0 items-center gap-2 border-b px-3",
                focused && "border-b-foreground/40",
                !editing && "cursor-text",
            )}
        >
            {tabLabel && (
                <span className="text-muted-foreground font-mono text-[9px] font-bold tracking-widest uppercase">
                    {tabLabel}
                </span>
            )}
            {editing ? (
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
                            setEditing(false);
                        }
                    }}
                    onBlur={commit}
                    data-editing-field
                    className={cn(
                        "flex-1 border-none bg-transparent px-0.5 text-[13px] font-semibold",
                        side === "aff" ? "text-aff" : "text-neg",
                    )}
                    data-testid={`sheet-title-input-${sheetId}`}
                />
            ) : (
                <span
                    className={cn(
                        "truncate text-[13px] font-semibold",
                        side === "aff" ? "text-aff" : "text-neg",
                    )}
                >
                    {title}
                </span>
            )}
        </div>
    );
}
