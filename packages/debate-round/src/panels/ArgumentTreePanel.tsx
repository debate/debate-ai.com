/**
 * @fileoverview Outline Filters and Argument Tree View panel — the "(a) a
 * React tree/outline panel in `debate-round` that renders the filtered tree
 * next to (or instead of) `FlowSpreadsheet` and reads/writes through the
 * persistence store" follow-up named under idea #10 ("Outline Filters and
 * Argument Tree View") in TODO.md.
 *
 * Reads every persisted argument tree via `state/argumentTrees.ts`'s
 * `buildArgumentTreesPanelView`, applies each round's persisted
 * `ArgumentTreeFilter` (from `state/argumentTreeFilters.ts`) with the
 * existing `filterArgumentTree`/`flattenArgumentTree` helpers, and renders
 * the filtered outline with speech/side/kind/unanswered-only controls that
 * save the chosen filter back through `saveArgumentTreeFilterSelection`. No
 * new tree-derivation or filtering logic is introduced here.
 *
 * A "Generate outline for current round" action reads the round workspace's
 * currently selected flow (`state/store.ts`'s `useFlowStore`, the same
 * mechanism `VulnerabilityChartsPanel`'s "Generate report for current
 * round" action uses) and derives+persists that round's outline via
 * `state/argumentTrees.ts`'s already-existing `buildAndSaveArgumentTree` —
 * closing this doc's "nothing in the live round-flowing page calls
 * `buildAndSaveArgumentTree` yet" Known gap. No new tree-derivation logic is
 * introduced here.
 *
 * @module panels/ArgumentTreePanel
 */

"use client"

import { useEffect, useState } from "react"
import { Badge } from "debate-ui/src/primitives/badge"
import { Button } from "debate-ui/src/primitives/button"
import { Label } from "debate-ui/src/primitives/label"
import { Switch } from "debate-ui/src/primitives/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-ui/src/primitives/select"
import { filterArgumentTree, flattenArgumentTree, type ArgumentTreeFilter } from "../flow/argument-tree"
import {
  buildAndSaveArgumentTree,
  buildArgumentTreesPanelView,
  deleteArgumentTree,
  type ArgumentTreeRecord,
} from "../state/argumentTrees"
import {
  getArgumentTreeFilterSelection,
  saveArgumentTreeFilterSelection,
} from "../state/argumentTreeFilters"
import { useFlowStore } from "../state/store"

const ANY_VALUE = "__any__"

/** Every distinct `originSpeech`/`lastSpeech` present in a tree's argument rows, in first-seen order. */
function collectSpeeches(record: ArgumentTreeRecord): string[] {
  const speeches: string[] = []
  for (const node of flattenArgumentTree(record.tree)) {
    if (node.isHeading) continue
    for (const speech of [node.originSpeech, node.lastSpeech]) {
      if (speech && !speeches.includes(speech)) speeches.push(speech)
    }
  }
  return speeches
}

/** Every distinct `sideKey` present in a tree's argument rows, in first-seen order. */
function collectSideKeys(record: ArgumentTreeRecord): string[] {
  const keys: string[] = []
  for (const node of flattenArgumentTree(record.tree)) {
    if (node.sideKey && !keys.includes(node.sideKey)) keys.push(node.sideKey)
  }
  return keys
}

/** Every distinct `argumentType` present in a tree's argument rows, in first-seen order. */
function collectArgumentTypes(record: ArgumentTreeRecord): NonNullable<ArgumentTreeFilter["argumentType"]>[] {
  const types: NonNullable<ArgumentTreeFilter["argumentType"]>[] = []
  for (const node of flattenArgumentTree(record.tree)) {
    if (node.argumentType && !types.includes(node.argumentType)) types.push(node.argumentType)
  }
  return types
}

/** Every distinct `authorId` present in a tree's argument rows, in first-seen order. */
function collectAuthorIds(record: ArgumentTreeRecord): string[] {
  const authorIds: string[] = []
  for (const node of flattenArgumentTree(record.tree)) {
    if (node.authorId && !authorIds.includes(node.authorId)) authorIds.push(node.authorId)
  }
  return authorIds
}

/**
 * Renders the Outline Filters and Argument Tree View panel: every persisted
 * `ArgumentTreeRecord`, one card per round, with speech/side/kind/
 * unanswered-only filter controls (persisted per round) and a "Clear"
 * action.
 *
 * Reads localStorage on mount only (client-side), so it renders a loading
 * state during SSR/hydration rather than throwing.
 */
export function ArgumentTreePanel() {
  const [records, setRecords] = useState<ArgumentTreeRecord[] | null>(null)
  const [filters, setFilters] = useState<Record<string, ArgumentTreeFilter>>({})
  const [mounted, setMounted] = useState(false)

  const flows = useFlowStore((state) => state.flows)
  const selected = useFlowStore((state) => state.selected)
  const currentFlow = mounted ? flows[selected] : undefined

  useEffect(() => {
    setMounted(true)
    const view = buildArgumentTreesPanelView()
    setRecords(view)
    setFilters(
      Object.fromEntries(
        view.map((record) => [record.roundId, getArgumentTreeFilterSelection(record.roundId)?.filter ?? {}]),
      ),
    )
  }, [])

  const refresh = () => setRecords(buildArgumentTreesPanelView())

  const updateFilter = (roundId: string, update: Partial<ArgumentTreeFilter>) => {
    const filter: ArgumentTreeFilter = { ...filters[roundId], ...update }
    setFilters((prev) => ({ ...prev, [roundId]: filter }))
    saveArgumentTreeFilterSelection({ roundId, filter })
  }

  const handleGenerate = () => {
    if (!currentFlow) return
    buildAndSaveArgumentTree(currentFlow, String(currentFlow.id))
    refresh()
  }

  const handleClear = (roundId: string) => {
    deleteArgumentTree(roundId)
    refresh()
  }

  if (records === null) {
    return <div className="p-6 text-sm text-muted-foreground">Loading argument outlines…</div>
  }

  return (
    <div className="p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="mb-1 text-xl font-semibold text-foreground">Outline Filters and Argument Tree</h1>
        <p className="text-sm text-muted-foreground">
          A filterable outline of each round's flow, grouped under its headings — filter by speech,
          side, unanswered status, or heading-vs-argument kind.
        </p>
      </div>

      <div className="rounded-lg border border-border p-4 space-y-3">
        <div>
          <Label className="text-sm font-medium text-foreground">Generate outline for current round</Label>
          <p className="text-xs text-muted-foreground">
            Uses the round workspace's currently selected flow.
          </p>
        </div>
        <Button size="sm" disabled={!currentFlow} onClick={handleGenerate}>
          Generate outline
        </Button>
        {!currentFlow && (
          <p className="text-sm text-muted-foreground">
            Select a round's flow in the round workspace to generate an outline for it.
          </p>
        )}
      </div>

      {records.length === 0 && (
        <div className="p-6 text-center text-sm text-muted-foreground">
          No argument outlines yet. An outline fills in once a round's flow is derived into a tree
          and saved.
        </div>
      )}
      {records.map((record) => {
        const filter = filters[record.roundId] ?? {}
        const speeches = collectSpeeches(record)
        const sideKeys = collectSideKeys(record)
        const argumentTypes = collectArgumentTypes(record)
        const authorIds = collectAuthorIds(record)
        const filtered = flattenArgumentTree(filterArgumentTree(record.tree, filter))

        return (
          <div key={record.roundId} className="rounded-lg border border-border p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-foreground">Round {record.roundId}</h2>
              <Button size="sm" variant="ghost" onClick={() => handleClear(record.roundId)}>
                Clear
              </Button>
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div className="space-y-1.5">
                <Label htmlFor={`kind-${record.roundId}`}>Kind</Label>
                <Select
                  value={filter.kind ?? ANY_VALUE}
                  onValueChange={(value) =>
                    updateFilter(record.roundId, { kind: value === ANY_VALUE ? undefined : (value as "heading" | "argument") })
                  }
                >
                  <SelectTrigger id={`kind-${record.roundId}`} className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>All</SelectItem>
                    <SelectItem value="heading">Headings only</SelectItem>
                    <SelectItem value="argument">Arguments only</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`side-${record.roundId}`}>Side</Label>
                <Select
                  value={filter.sideKey ?? ANY_VALUE}
                  onValueChange={(value) =>
                    updateFilter(record.roundId, { sideKey: value === ANY_VALUE ? undefined : value })
                  }
                >
                  <SelectTrigger id={`side-${record.roundId}`} className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>Any side</SelectItem>
                    {sideKeys.map((key) => (
                      <SelectItem key={key} value={key}>
                        {key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`speech-${record.roundId}`}>Speech</Label>
                <Select
                  value={filter.speech ?? ANY_VALUE}
                  onValueChange={(value) =>
                    updateFilter(record.roundId, { speech: value === ANY_VALUE ? undefined : value })
                  }
                >
                  <SelectTrigger id={`speech-${record.roundId}`} className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>Any speech</SelectItem>
                    {speeches.map((speech) => (
                      <SelectItem key={speech} value={speech}>
                        {speech}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`argument-type-${record.roundId}`}>Argument type</Label>
                <Select
                  value={filter.argumentType ?? ANY_VALUE}
                  onValueChange={(value) =>
                    updateFilter(record.roundId, {
                      argumentType:
                        value === ANY_VALUE ? undefined : (value as NonNullable<ArgumentTreeFilter["argumentType"]>),
                    })
                  }
                >
                  <SelectTrigger id={`argument-type-${record.roundId}`} className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>Any type</SelectItem>
                    {argumentTypes.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`contributor-${record.roundId}`}>Contributor</Label>
                <Select
                  value={filter.authorId ?? ANY_VALUE}
                  onValueChange={(value) =>
                    updateFilter(record.roundId, { authorId: value === ANY_VALUE ? undefined : value })
                  }
                >
                  <SelectTrigger id={`contributor-${record.roundId}`} className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>Any contributor</SelectItem>
                    {authorIds.map((authorId) => (
                      <SelectItem key={authorId} value={authorId}>
                        {authorId}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`evidence-status-${record.roundId}`}>Evidence status</Label>
                <Select
                  value={filter.evidenceStatus ?? ANY_VALUE}
                  onValueChange={(value) =>
                    updateFilter(record.roundId, {
                      evidenceStatus:
                        value === ANY_VALUE ? undefined : (value as NonNullable<ArgumentTreeFilter["evidenceStatus"]>),
                    })
                  }
                >
                  <SelectTrigger id={`evidence-status-${record.roundId}`} className="w-36">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>Any status</SelectItem>
                    <SelectItem value="cited">cited</SelectItem>
                    <SelectItem value="contested">contested</SelectItem>
                    <SelectItem value="unverified">unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <label className="flex items-center gap-2 pb-1.5 text-sm text-foreground">
                <Switch
                  checked={filter.onlyUnanswered ?? false}
                  onCheckedChange={(checked) =>
                    updateFilter(record.roundId, { onlyUnanswered: checked === true })
                  }
                />
                Unanswered only
              </label>
            </div>

            {filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground">No rows match the current filter.</p>
            ) : (
              <div className="space-y-1">
                {filtered.map((node) => (
                  <div
                    key={node.id}
                    className="flex items-start gap-2 rounded-md border border-border px-3 py-1.5 text-sm"
                    style={{ marginLeft: node.isHeading ? 0 : 16 }}
                  >
                    {node.isHeading ? (
                      <Badge variant="secondary" className="whitespace-nowrap">
                        Heading
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="whitespace-nowrap">
                        {node.originSpeech}
                      </Badge>
                    )}
                    {node.argumentType && (
                      <Badge variant="secondary" className="whitespace-nowrap">
                        {node.argumentType}
                      </Badge>
                    )}
                    <span className={node.isHeading ? "font-semibold text-foreground" : "text-foreground"}>
                      {node.content}
                    </span>
                    {node.authorId && (
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{node.authorId}</span>
                    )}
                    {node.evidenceStatus && (
                      <Badge
                        variant={node.evidenceStatus === "contested" ? "destructive" : "outline"}
                        className="whitespace-nowrap"
                      >
                        {node.evidenceStatus}
                      </Badge>
                    )}
                    {node.isUnanswered && (
                      <Badge variant="destructive" className="ml-auto whitespace-nowrap">
                        Unanswered
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
