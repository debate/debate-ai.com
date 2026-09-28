/**
 * @fileoverview Which docs sidebar panels there are, the order they stack in,
 * and how the height they share is divided between them.
 *
 * The panels (Files, Topic Starters, Open Tabs) used to hold sizes fixed in
 * CSS — the lower one capped at 40% of a 380px box. On `/cards`, where they
 * are the whole sidebar, they instead divide the column's own height and the
 * reader drags the seams, so a tree of forty files can have most of the column
 * and Open Tabs a couple of rows.
 *
 * Kept next to `route-selection.ts` and `sidebar-routes.ts` — the other pure
 * modules the docs sidebar is built on — so the normalizing and the parsing of
 * a stored layout can be unit-tested without rendering the sidebar. Reading
 * `localStorage` stays in the component, next to the panel-choice and
 * collapse-state reads it already does; {@link parseLayout} takes the raw
 * string those reads produce.
 *
 * @module lib/reason-docs/panel-layout
 */

/** One stackable panel in the docs sidebar. */
export type SidebarPanel = "files" | "topicStarters" | "openTabs"

/** Panel id -> percentage of the group, as `react-resizable-panels` reports
 *  and accepts a layout. */
export type PanelLayout = Record<string, number>

/** Top-to-bottom order the panels stack in, whatever order they were switched
 *  on in — the stack reads the same however you got to it. */
export const PANEL_ORDER: readonly SidebarPanel[] = ["files", "topicStarters", "openTabs"]

/** Each panel's accessible name, for the resize separator above it. */
export const PANEL_LABELS: Record<SidebarPanel, string> = {
  files: "Files",
  topicStarters: "Topic Starters",
  openTabs: "Open Tabs",
}

/** Relative share a panel opens at before anyone drags a separator. The 3:2
 *  between Files and Open Tabs is the 60/40 split the old `max-h-[40%]` cap
 *  gave them. */
export const PANEL_WEIGHTS: Record<SidebarPanel, number> = { files: 3, topicStarters: 2, openTabs: 2 }

/** Floor for a dragged panel, in pixels: a heading plus a row. Below that a
 *  panel is a sliver that says nothing and is too thin to aim at to drag
 *  back. */
export const PANEL_MIN_SIZE = 72

export function isPanel(value: unknown): value is SidebarPanel {
  return value === "files" || value === "topicStarters" || value === "openTabs"
}

/** The enabled panels in stack order: which panels are on is the reader's
 *  choice, the order they appear in is not. */
export function visiblePanelsOf(panels: readonly SidebarPanel[]): SidebarPanel[] {
  return PANEL_ORDER.filter((panel) => panels.includes(panel))
}

/**
 * The panel sizes held in a stored layout string, or `{}` when it holds none.
 *
 * Unknown panels and non-positive sizes are dropped rather than trusted: this
 * is storage anyone can edit, and a zero would open a panel with no height and
 * no separator wide enough to drag it back open.
 */
export function parseLayout(raw: string | null | undefined): PanelLayout {
  if (!raw) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return {}
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {}
  return Object.fromEntries(
    Object.entries(parsed as Record<string, unknown>).filter(
      ([panel, size]) => isPanel(panel) && typeof size === "number" && Number.isFinite(size) && size > 0,
    ),
  ) as PanelLayout
}

/**
 * The sizes to open the group at, as percentages over `visible` alone.
 *
 * The stored layout is used when it covers every visible panel, and
 * {@link PANEL_WEIGHTS} otherwise: a panel switched on since the last drag has
 * no stored size, and mixing the two would hand it whatever the others left
 * rather than a share of its own.
 *
 * @param visible - The panels on screen, in stack order.
 * @param stored - The reader's last dragged sizes, from {@link parseLayout}.
 */
export function layoutFor(visible: readonly SidebarPanel[], stored: PanelLayout): PanelLayout {
  const source: PanelLayout = visible.every((panel) => (stored[panel] ?? 0) > 0) ? stored : PANEL_WEIGHTS
  const total = visible.reduce((sum, panel) => sum + (source[panel] ?? 0), 0)
  if (total <= 0) return {}
  return Object.fromEntries(visible.map((panel) => [panel, ((source[panel] ?? 0) / total) * 100]))
}
