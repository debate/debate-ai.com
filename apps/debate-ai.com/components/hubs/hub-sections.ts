/**
 * @fileoverview Pure data shapes for the tabbed workspace hubs (`/research`
 * and `/coach`).
 *
 * A hub is a list of {@link HubSection}s; each section names the panels it
 * mounts and, where a panel also has its own standalone route, links to it.
 * `HubSectionNav.tsx` renders the navigation over these, and each hub
 * component owns its own section list (`ResearchHub.tsx`, `CoachHub.tsx`).
 *
 * Kept free of React so the section lists stay easy to reason about and
 * reuse (e.g. from the Fumadocs guides, which describe the same sections).
 *
 * @module components/hubs/hub-sections
 */

import type { LucideIcon } from "lucide-react"
import type { DocsGuide } from "@/lib/docs-links"

/** One panel mounted inside a hub section. */
export interface HubPanelLink {
  /** Panel name, as its own header titles it. */
  label: string
  /** The panel's standalone route, when it has one. */
  href?: string
  /** In-page anchor id the panel is wrapped in (see `HubPanelAnchor`). */
  anchor: string
}

/** One tab of a hub. */
export interface HubSection<Id extends string = string> {
  /** Stable id, also the `?section=` URL value. */
  id: Id
  /** Tab label. */
  label: string
  /** Tab icon. */
  icon: LucideIcon
  /** One sentence on what this stage of the workflow is for. */
  description: string
  /** Panels rendered in this section, in display order. */
  panels: HubPanelLink[]
  /** Docs guide covering this section. */
  guide?: DocsGuide
}

/**
 * Turns a panel label into a stable anchor id (`"Topic Coverage"` →
 * `"panel-topic-coverage"`).
 *
 * @param label - Panel label.
 */
export function panelAnchor(label: string): string {
  return `panel-${label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")}`
}

/**
 * Convenience for declaring a panel link: derives the anchor from the label.
 *
 * @param label - Panel label.
 * @param href - Standalone route, if any.
 */
export function panel(label: string, href?: string): HubPanelLink {
  return { label, href, anchor: panelAnchor(label) }
}

/**
 * Resolves a raw `?section=` value (or a saved one) to a known section id,
 * falling back to the first section.
 *
 * @param sections - The hub's sections.
 * @param candidate - Value to validate.
 */
export function resolveSectionId<Id extends string>(
  sections: readonly HubSection<Id>[],
  candidate: string | null | undefined,
): Id {
  const match = sections.find((section) => section.id === candidate)
  return (match ?? sections[0]).id
}
