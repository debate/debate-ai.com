"use client";

/**
 * Expandable table rows in the style of the video grid's tree
 * (`debate-videos`' `VideoTreeRows`): a row with a chevron button that opens
 * the rows under it, one tier inside the next — here a tournament opens onto
 * its formats, and a format onto its results. The look (muted header rows
 * that lighten with depth, rotating chevron, indent per level, `aria-expanded`
 * and an "Expand …/Collapse …" label) matches that grid; the indent numbers
 * are the same as its `tree-indent`.
 *
 * Rows open on their own state, seeded from `defaultOpen`. Children render only
 * while open, so whatever they load is not requested until a row is expanded.
 */

import { useState, type CSSProperties, type ReactNode } from "react";
import { ChevronRight, type LucideIcon } from "lucide-react";
import { cn } from "./primitives";

/** Left padding of a root row's first cell, in rem. */
const BASE_INDENT_REM = 0.75;
/** Added per level of depth, in rem. */
const STEP_INDENT_REM = 1.1;

/** Indent for a row at `depth` (0 for a root row), matching the video grid's tree. */
export function treeIndentStyle(depth: number): CSSProperties {
  return { paddingLeft: `${BASE_INDENT_REM + depth * STEP_INDENT_REM}rem` };
}

export function ExpandableGroupRow({
  depth,
  kind,
  label,
  icon: Icon,
  heading,
  cells,
  defaultOpen = false,
  onOpenChange,
  children,
}: {
  /** 0 for the outer tier, 1 for the tier inside it. */
  depth: number;
  /** What the rows below are called, for the screen-reader label ("tournament"). */
  kind: string;
  /** The row's plain-text name, for the screen-reader label. */
  label: string;
  icon?: LucideIcon;
  /** The name cell's content, beside the chevron. */
  heading: ReactNode;
  /** The row's remaining cells (`<td>`s), after the name cell. */
  cells: ReactNode;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  /** The rows (or a detail row) under this one, mounted only while open. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = () => {
    setOpen(!open);
    onOpenChange?.(!open);
  };
  return (
    <>
      <tr
        onClick={toggle}
        data-expandable-row=""
        data-depth={depth}
        className={cn(
          "cursor-pointer select-none border-b border-border transition-colors",
          depth === 0 ? "bg-muted/60 hover:bg-muted" : "bg-muted/25 hover:bg-muted/50",
        )}
      >
        <td className="py-2 pr-3 align-middle" style={treeIndentStyle(depth)}>
          <button
            type="button"
            aria-expanded={open}
            aria-label={`${open ? "Collapse" : "Expand"} ${kind} ${label}`}
            onClick={(event) => {
              event.stopPropagation();
              toggle();
            }}
            className="flex w-full items-center gap-2 text-left"
          >
            <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} aria-hidden />
            {Icon ? <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden /> : null}
            {heading}
          </button>
        </td>
        {cells}
      </tr>
      {open ? children : null}
    </>
  );
}

/** A full-width row holding an open group's content, indented to its tier. */
export function ExpandableDetailRow({ depth, colSpan, children }: { depth: number; colSpan: number; children: ReactNode }) {
  return (
    <tr className="border-b border-border bg-background" data-expandable-detail="">
      <td colSpan={colSpan} className="py-3 pr-3" style={treeIndentStyle(depth)}>
        {children}
      </td>
    </tr>
  );
}
