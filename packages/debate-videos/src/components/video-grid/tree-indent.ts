/**
 * @fileoverview The one indent rule the tree's rows share, so a group row's
 * chevron and the rows under it line up whichever component drew them.
 * @module components/video-grid/tree-indent
 */

import type { CSSProperties } from "react";

/** Left padding of the tree column's first cell, in rem. */
const BASE_INDENT_REM = 0.75;

/** Added per level of depth, in rem. */
const STEP_INDENT_REM = 1.1;

/**
 * Indent for a row at a given tree depth.
 *
 * @param depth - 0 for a root (season) row.
 * @returns Style holding the row's left padding.
 */
export function treeIndentStyle(depth: number): CSSProperties {
  return { paddingLeft: `${BASE_INDENT_REM + depth * STEP_INDENT_REM}rem` };
}
