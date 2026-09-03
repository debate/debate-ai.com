/**
 * @fileoverview Flows-in-this-round section of the Round Editor dialog.
 *
 * Only rendered when editing an existing round (a `roundId` was passed to
 * {@link RoundEditorDialog}) — a brand-new round has no flows yet, since
 * they're generated on submit.
 */

"use client"

import { FileText } from "lucide-react"
import type { Flow } from "../../types/flow"

/** Props for {@link RoundFlowsSection}. */
interface RoundFlowsSectionProps {
  /** Flows belonging to the round being edited. */
  flows: Flow[]
  /** Selects a flow tab and closes the dialog. */
  onSelectFlow: (flow: Flow) => void
}

/**
 * Lists every flow in the round being edited, as clickable chips that jump
 * straight to that flow tab.
 *
 * @param props - {@link RoundFlowsSectionProps}
 * @returns The rendered section, or `null` when the round has no flows.
 */
export function RoundFlowsSection({ flows, onSelectFlow }: RoundFlowsSectionProps) {
  if (flows.length === 0) return null

  return (
    <div className="space-y-2 pt-2 border-t border-border/50">
      <p className="text-sm font-semibold">Flows in this Round</p>
      <div className="flex flex-wrap gap-2">
        {flows.map((flow) => (
          <button
            key={flow.id}
            type="button"
            onClick={() => onSelectFlow(flow)}
            className="inline-flex items-center gap-1 pl-2.5 pr-2.5 py-1 bg-secondary hover:bg-secondary/80 rounded-full text-xs transition-colors font-medium border"
            title={`Open ${flow.content}`}
          >
            <FileText className="h-3 w-3" />
            <span>{flow.content || `Speech ${flow.speechNumber}`}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
