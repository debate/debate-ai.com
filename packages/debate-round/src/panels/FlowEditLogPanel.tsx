/**
 * @fileoverview Flow Edit Log panel — the data-source half of follow-up (b)
 * under idea #16 ("Shared, Ai-Generated Debate Flow") in TODO.md.
 *
 * `SharedFlowSyncPanel` already merges and flags conflicts in whatever
 * `FlowEdit[]` it's handed, but until now nothing produced one — every
 * caller passed an empty array. This panel lets a contributor log a
 * proposed edit to a box (their own, or one they're relaying from a
 * teammate) against `state/flowEdits.ts`, so the merge preview has real
 * edits to reconcile. There is still no live transport pushing a
 * teammate's edits here automatically — a contributor types theirs in, the
 * same way `FlowAnnotationsPanel`'s drop-annotation form works.
 *
 * @module panels/FlowEditLogPanel
 */

"use client"

import { useEffect, useState } from "react"
import { GitCommitHorizontal } from "lucide-react"

import {
  EmptyState,
  LabeledField,
  PanelRow,
  PanelSection,
  PanelShell,
  Pill,
} from "debate-ui/src/panels/panel-shell"
import { Button } from "debate-ui/src/primitives/button"
import { Input } from "debate-ui/src/primitives/input"
import { Textarea } from "debate-ui/src/primitives/textarea"

import { createFlowEdit, type FlowEdit } from "../flow/shared-flow-sync"
import { clearFlowEditsForFlow, listFlowEdits, saveFlowEdit } from "../state/flowEdits"
import { parseBoxPathInput } from "../flow/flow-annotations"

function newFlowEditId(): string {
  return `edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Props for {@link FlowEditLogPanel}. */
export interface FlowEditLogPanelProps {
  /**
   * Called after an edit is logged or a flow's edits are cleared, so a
   * composing screen reading `state/flowEdits.ts` through its own snapshot
   * (e.g. `CoachHub`'s `SharedFlowSyncPanel`) can refresh in step.
   */
  onChange?: () => void
}

/**
 * Renders the Flow Edit Log panel: a form to log a proposed edit to a box
 * on a flow, and every persisted edit grouped by flow, newest first, with a
 * "Clear this flow's edits" action per group.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function FlowEditLogPanel({ onChange }: FlowEditLogPanelProps = {}) {
  const [edits, setEdits] = useState<FlowEdit[] | null>(null)
  const [flowId, setFlowId] = useState("")
  const [authorId, setAuthorId] = useState("")
  const [boxPathInput, setBoxPathInput] = useState("")
  const [content, setContent] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setEdits(listFlowEdits())
  }, [])

  const refresh = () => {
    setEdits(listFlowEdits())
    onChange?.()
  }

  const handleLog = () => {
    const trimmedFlowId = flowId.trim()
    const parsedFlowId = Number(trimmedFlowId)
    if (!trimmedFlowId || !Number.isFinite(parsedFlowId) || !Number.isInteger(parsedFlowId)) {
      setError("Flow ID must be a whole number.")
      return
    }
    const boxPath = parseBoxPathInput(boxPathInput)
    if (boxPath === null) {
      setError("Box path must be comma-separated whole numbers (e.g. \"0, 1\").")
      return
    }

    try {
      const edit = createFlowEdit({
        id: newFlowEditId(),
        flowId: parsedFlowId,
        boxPath,
        authorId,
        content,
        timestampMs: Date.now(),
      })
      saveFlowEdit(edit)
      setContent("")
      setError(null)
      refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not log this edit.")
    }
  }

  const handleClearFlow = (id: number) => {
    clearFlowEditsForFlow(id)
    refresh()
  }

  if (edits === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading flow edits…</div>
  }

  const groups = new Map<number, FlowEdit[]>()
  for (const edit of edits) {
    const group = groups.get(edit.flowId)
    if (group) {
      group.push(edit)
    } else {
      groups.set(edit.flowId, [edit])
    }
  }
  const flowIds = Array.from(groups.keys()).sort((a, b) => b - a)

  return (
    <PanelShell
      title="Flow Edit Log"
      description="Log a proposed edit so the Shared Flow Sync preview has real edits to merge."
      icon={<GitCommitHorizontal className="h-4 w-4" />}
      data-testid="flow-edit-log-panel"
    >
      <PanelSection title="Log an edit">
        <div className="flex flex-wrap gap-3">
          <LabeledField label="Flow ID" className="w-24">
            <Input value={flowId} onChange={(e) => setFlowId(e.target.value)} placeholder="7" />
          </LabeledField>
          <LabeledField label="Author ID" className="w-32">
            <Input value={authorId} onChange={(e) => setAuthorId(e.target.value)} placeholder="alice" />
          </LabeledField>
          <LabeledField label="Box path" hint="comma-separated, e.g. 0, 1" className="w-32">
            <Input value={boxPathInput} onChange={(e) => setBoxPathInput(e.target.value)} placeholder="0, 1" />
          </LabeledField>
        </div>
        <LabeledField label="Content">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="New box content…"
            className="min-h-16"
          />
        </LabeledField>
        <Button size="sm" onClick={handleLog}>
          Log edit
        </Button>
        {error ? <p className="text-destructive text-xs">{error}</p> : null}
      </PanelSection>

      <PanelSection title="Logged edits">
        {flowIds.length === 0 ? (
          <EmptyState title="No flow edits yet" message="Log one above to see it here." />
        ) : (
          <div className="flex flex-col gap-3">
            {flowIds.map((id) => {
              const flowEdits = [...(groups.get(id) ?? [])].sort((a, b) => b.timestampMs - a.timestampMs)
              return (
                <PanelSection
                  key={id}
                  title={`Flow ${id}`}
                  actions={
                    <Button size="sm" variant="ghost" onClick={() => handleClearFlow(id)}>
                      Clear
                    </Button>
                  }
                >
                  <div className="flex flex-col gap-2">
                    {flowEdits.map((edit) => (
                      <PanelRow
                        key={edit.id}
                        leading={edit.boxPath.join(".")}
                        title={edit.content || "(cleared)"}
                        subtitle={edit.authorId}
                        trailing={<Pill>{new Date(edit.timestampMs).toLocaleTimeString()}</Pill>}
                      />
                    ))}
                  </div>
                </PanelSection>
              )
            })}
          </div>
        )}
      </PanelSection>
    </PanelShell>
  )
}
