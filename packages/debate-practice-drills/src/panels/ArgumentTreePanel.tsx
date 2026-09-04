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
 * Each round card also has a "Filter presets" row (idea #10's "Save and
 * reuse named filter presets instead of re-picking filters each visit"
 * follow-up, `state/outlineFilterPresets.ts`/`hooks/useOutlineFilterPresets`)
 * — a dropdown of every named preset the signed-in-or-local user has saved,
 * plus a "Save current as preset…" action. Presets are global (not scoped
 * to one round), so the same saved combination can be applied to any
 * round's outline; applying one just writes that round's existing
 * `ArgumentTreeFilter` selection, identically to picking each control by
 * hand.
 *
 * A "Generate outline for current round" action reads the round workspace's
 * currently selected flow (`state/store.ts`'s `useFlowStore`, the same
 * mechanism `VulnerabilityChartsPanel`'s "Generate report for current
 * round" action uses) and derives+persists that round's outline via
 * `state/argumentTrees.ts`'s `buildAndSaveArgumentTreeFromCurrentFlow` (which
 * wraps `buildAndSaveArgumentTree`, keying the tree by the flow's own id) —
 * closing this doc's "nothing in the live round-flowing page calls
 * `buildAndSaveArgumentTree` yet" Known gap. No new tree-derivation logic is
 * introduced here.
 *
 * Each round card also has a "Download outline" action — idea #10's
 * "Export the filtered tree to a Speech Document or outline file"
 * follow-up (`flow/argument-tree-export.ts#buildArgumentTreeOutlineText`),
 * exporting exactly the flattened, filtered rows currently rendered for
 * that round as a plain-text outline file, mirroring
 * `PreRoundBriefingsPanel.tsx`'s anchor+Blob download pattern.
 *
 * @module panels/ArgumentTreePanel
 */

"use client"

import { useEffect, useState } from "react"
import { X } from "lucide-react"
import { Badge } from "debate-round/src/ui/primitives/badge"
import { Button } from "debate-round/src/ui/primitives/button"
import { Input } from "debate-round/src/ui/primitives/input"
import { Label } from "debate-round/src/ui/primitives/label"
import { EmptyState } from "debate-round/src/ui/panels/panel-shell"
import { Switch } from "debate-round/src/ui/primitives/switch"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "debate-round/src/ui/primitives/select"
import { filterArgumentTree, flattenArgumentTree, type ArgumentTreeFilter, type ArgumentTreeNode } from "debate-round/src/flow/argument-tree"
import { argumentTreeOutlineFilename, buildArgumentTreeOutlineText } from "../flow/argument-tree-export"
import {
  buildAndSaveArgumentTreeFromCurrentFlow,
  buildArgumentTreesPanelView,
  deleteArgumentTree,
  type ArgumentTreeRecord,
} from "debate-round/src/state/argumentTrees"
import {
  getArgumentTreeFilterSelection,
  saveArgumentTreeFilterSelection,
} from "../state/argumentTreeFilters"
import { useOutlineFilterPresets } from "../hooks/useOutlineFilterPresets"
import { useFlowStore } from "debate-round/src/state/store"

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
  const { presets, addPreset, removePreset } = useOutlineFilterPresets()
  const [presetNameDrafts, setPresetNameDrafts] = useState<Record<string, string>>({})
  const [presetErrors, setPresetErrors] = useState<Record<string, string>>({})

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

  /** Applies a saved preset's filter combination wholesale, replacing (not merging into) the round's current filter — so a field the preset leaves unset is cleared, matching what re-picking every control by hand would produce. */
  const applyPreset = (roundId: string, filter: ArgumentTreeFilter) => {
    setFilters((prev) => ({ ...prev, [roundId]: filter }))
    saveArgumentTreeFilterSelection({ roundId, filter })
  }

  const handleSavePreset = (roundId: string) => {
    const name = (presetNameDrafts[roundId] ?? "").trim()
    if (!name) {
      setPresetErrors((prev) => ({ ...prev, [roundId]: "Enter a name for this preset." }))
      return
    }
    if (!addPreset(name, filters[roundId] ?? {})) {
      setPresetErrors((prev) => ({
        ...prev,
        [roundId]: `A preset named "${name}" already exists, or the preset limit has been reached.`,
      }))
      return
    }
    setPresetErrors((prev) => ({ ...prev, [roundId]: "" }))
    setPresetNameDrafts((prev) => ({ ...prev, [roundId]: "" }))
  }

  const handleGenerate = () => {
    if (!currentFlow) return
    buildAndSaveArgumentTreeFromCurrentFlow(currentFlow)
    refresh()
  }

  const handleClear = (roundId: string) => {
    deleteArgumentTree(roundId)
    refresh()
  }

  /** Mirrors `PreRoundBriefingsPanel.tsx`'s anchor+Blob download pattern. */
  const handleDownload = (roundId: string, filtered: ArgumentTreeNode[]) => {
    const text = buildArgumentTreeOutlineText(filtered, roundId)
    const blob = new Blob([text], { type: "text/plain" })
    const url = URL.createObjectURL(blob)

    const link = document.createElement("a")
    link.href = url
    link.download = argumentTreeOutlineFilename(roundId)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
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

      {presets.length > 0 && (
        <div className="rounded-lg border border-border p-4 space-y-2">
          <Label className="text-sm font-medium text-foreground">Saved filter presets</Label>
          <p className="text-xs text-muted-foreground">
            Apply one from any round's "Filter presets" row below, or remove it here.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            {presets.map((preset) => (
              <Badge key={preset.name} variant="outline" className="gap-1 pr-1">
                {preset.name}
                <button
                  type="button"
                  aria-label={`Remove the ${preset.name} filter preset`}
                  className="ml-1 rounded-sm hover:bg-muted"
                  onClick={() => removePreset(preset.name)}
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {records.length === 0 && (
        <EmptyState
          title="No argument outlines yet."
          message="An outline fills in once a round's flow is derived into a tree and saved."
        />
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
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={filtered.length === 0}
                  onClick={() => handleDownload(record.roundId, filtered)}
                >
                  Download outline
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleClear(record.roundId)}>
                  Clear
                </Button>
              </div>
            </div>

            <div className="flex flex-wrap items-end gap-2 rounded-md border border-dashed border-border bg-muted/30 p-2">
              <div className="space-y-1.5">
                <Label htmlFor={`preset-apply-${record.roundId}`} className="text-xs">
                  Filter presets
                </Label>
                <Select
                  value={ANY_VALUE}
                  onValueChange={(value) => {
                    if (value === ANY_VALUE) return
                    const preset = presets.find((entry) => entry.name === value)
                    if (preset) applyPreset(record.roundId, preset.filter)
                  }}
                >
                  <SelectTrigger id={`preset-apply-${record.roundId}`} className="h-8 w-52 text-xs">
                    <SelectValue placeholder="Apply a saved preset…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ANY_VALUE}>Apply a saved preset…</SelectItem>
                    {presets.map((preset) => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {preset.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`preset-name-${record.roundId}`} className="text-xs">
                  Save current filter as…
                </Label>
                <div className="flex gap-1.5">
                  <Input
                    id={`preset-name-${record.roundId}`}
                    value={presetNameDrafts[record.roundId] ?? ""}
                    onChange={(e) =>
                      setPresetNameDrafts((prev) => ({ ...prev, [record.roundId]: e.target.value }))
                    }
                    placeholder="Preset name"
                    className="h-8 w-40 text-xs"
                  />
                  <Button size="sm" variant="outline" onClick={() => handleSavePreset(record.roundId)}>
                    Save preset
                  </Button>
                </div>
              </div>
              {presetErrors[record.roundId] && (
                <p className="w-full text-xs text-destructive">{presetErrors[record.roundId]}</p>
              )}
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
