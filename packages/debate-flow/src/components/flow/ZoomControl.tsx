"use client";

import { MagnifyingGlassMinus, MagnifyingGlassPlus } from "@phosphor-icons/react";
import { useState } from "react";

import { Button } from "../ui/button";
import { Slider } from "../ui/slider";
import { Tip } from "../ui/tooltip";
import { useFlowStore, ZOOM_MAX, ZOOM_MIN, ZOOM_STEP } from "../../lib/store/useFlowStore";

/**
 * Header zoom control: minus, slider, plus, and a click-to-edit percentage.
 * As the header runs out of room it gives up the slider, then the readout,
 * then itself; every piece is a convenience over `view.zoomIn/Out`.
 */
export default function ZoomControl() {
    const gridZoom = useFlowStore((s) => s.gridZoom);
    const setGridZoom = useFlowStore((s) => s.setGridZoom);
    const zoomGrid = useFlowStore((s) => s.zoomGrid);
    const pct = Math.round(gridZoom * 100);

    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState("");

    function commit() {
        const n = parseInt(draft, 10);
        if (!Number.isNaN(n)) setGridZoom(n / 100);
        setEditing(false);
    }

    return (
        <div className="ribbon-tight:flex hidden items-center gap-1.5" data-testid="zoom-control">
            <Tip label="Zoom out" command="view.zoomOut">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => zoomGrid(-ZOOM_STEP)}
                    aria-label="Zoom out"
                    data-testid="zoom-out-btn"
                >
                    <MagnifyingGlassMinus className="size-4.5" />
                </Button>
            </Tip>
            <Slider
                value={[gridZoom]}
                min={ZOOM_MIN}
                max={ZOOM_MAX}
                step={0.05}
                onValueChange={(v) => setGridZoom(Array.isArray(v) ? v[0] : v)}
                aria-label="Zoom"
                data-testid="zoom-slider"
                className="ribbon-wide:flex hidden w-24"
            />
            <Tip label="Zoom in" command="view.zoomIn">
                <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => zoomGrid(ZOOM_STEP)}
                    aria-label="Zoom in"
                    data-testid="zoom-in-btn"
                >
                    <MagnifyingGlassPlus className="size-4.5" />
                </Button>
            </Tip>
            {editing ? (
                <input
                    autoFocus
                    type="text"
                    inputMode="numeric"
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onFocus={(e) => e.target.select()}
                    onBlur={commit}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") commit();
                        else if (e.key === "Escape") setEditing(false);
                    }}
                    aria-label="Zoom percentage"
                    data-testid="zoom-input"
                    className="border-input focus-visible:border-ring ribbon:block hidden h-6 w-12 rounded-md border bg-transparent px-1 text-right text-[13px] tabular-nums outline-none"
                />
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        setDraft(String(pct));
                        setEditing(true);
                    }}
                    aria-label="Edit zoom percentage"
                    data-testid="zoom-pct"
                    className="text-muted-foreground hover:text-foreground ribbon:block hidden w-12 rounded px-1 py-0.5 text-right text-[13px] tabular-nums transition-colors"
                >
                    {pct}%
                </button>
            )}
        </div>
    );
}
