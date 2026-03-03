"use client"

/**
 * @fileoverview Flow Tabs Component
 *
 * Horizontal tab bar for switching between flows.
 * Currently returns null as the primary navigation has moved to
 * the sidebar FlowTab components, but this component is kept
 * for potential future horizontal tab layouts.
 *
 * @module components/debate/flow/navigation/FlowTabs
 */

import { X } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Props for the FlowTabs component
 */
interface FlowTabsProps {
  /** Array of flows to display as tabs */
  flows: Flow[]
  /** Index of the currently selected flow */
  selected: number
  /** Callback when a tab is selected */
  onSelect: (index: number) => void
  /** Callback when a flow is deleted */
  onDelete: (index: number) => void
}

/**
 * FlowTabs - Horizontal tab bar for flow navigation
 *
 * This component is currently disabled (returns null) as the
 * primary flow navigation has moved to the sidebar. The component
 * is preserved for potential future use with horizontal layouts.
 *
 * @param props - Component props
 * @returns null (component is currently disabled)
 *
 * @example
 * ```tsx
 * // When enabled, would render horizontal tabs
 * <FlowTabs
 *   flows={flows}
 *   selected={selectedIndex}
 *   onSelect={setSelected}
 *   onDelete={handleDelete}
 * />
 * ```
 */
export function FlowTabs({ flows, selected, onSelect, onDelete }: FlowTabsProps) {
  // Return null if no flows
  if (flows.length === 0) return null

  // Currently disabled - sidebar tabs are primary navigation
  return null
}
