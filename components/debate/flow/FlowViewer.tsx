"use client"

/**
 * @fileoverview Flow Viewer Component
 *
 * Wrapper component that dynamically loads the FlowSpreadsheet.
 * Uses Next.js dynamic imports to prevent SSR issues with AG Grid.
 *
 * @module components/debate/flow/FlowViewer
 */

import dynamic from "next/dynamic"

/**
 * Dynamically imported FlowSpreadsheet component
 * SSR is disabled because AG Grid requires browser APIs
 */
const FlowSpreadsheet = dynamic(() => import("./editor/FlowSpreadsheet").then((mod) => mod.FlowSpreadsheet), {
  ssr: false,
  loading: () => <div className="w-full h-full flex items-center justify-center">Loading spreadsheet...</div>,
})

/**
 * Props for the FlowViewer component
 */
interface FlowViewerProps {
  /** The flow to display */
  flow: Flow
  /** Callback when flow is updated */
  onUpdate: (updates: Partial<Flow>) => void
  /** Optional callback when speech panel should open */
  onOpenSpeechPanel?: (speechName: string) => void
}

/**
 * FlowViewer - Container for the flow spreadsheet view
 *
 * This component serves as a wrapper around the FlowSpreadsheet,
 * handling dynamic loading and providing consistent styling.
 *
 * @param props - Component props
 * @returns The flow viewer component
 *
 * @example
 * ```tsx
 * <FlowViewer
 *   flow={currentFlow}
 *   onUpdate={(updates) => updateFlow(flowIndex, updates)}
 *   onOpenSpeechPanel={(speech) => openSpeechPanel(speech)}
 * />
 * ```
 */
export function FlowViewer({ flow, onUpdate, onOpenSpeechPanel }: FlowViewerProps) {
  return (
    <div className="w-full h-full bg-background rounded-md overflow-hidden">
      <FlowSpreadsheet flow={flow} onUpdate={onUpdate} onOpenSpeechPanel={onOpenSpeechPanel} />
    </div>
  )
}
