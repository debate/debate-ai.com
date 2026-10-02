/**
 * @fileoverview Kialo-style argument map for one round in the Argument Tree
 * panel: a view switcher (tiered tree, sunburst, mind map, bubble map,
 * sankey) over a d3 chart of every claim, and below it the focused claim
 * with its parent above and its Pros / Cons in two columns. Clicking a claim
 * anywhere (chart or column) focuses it; the arrow on the parent card walks
 * back up.
 *
 * The d3 chart is loaded with `React.lazy`, so d3 is only fetched once a
 * map view is actually on screen.
 *
 * @module panels/argument-map/ArgumentMapView
 */

"use client"

import { Suspense, lazy, useEffect, useMemo, useState } from "react"
import { ArrowUp, MessageSquare } from "lucide-react"
import type { ArgumentTreeNode } from "@debate/round/src/flow/argument-tree"
import {
  ARGUMENT_MAP_VIEW_MODES,
  argumentMapPath,
  buildArgumentMap,
  countDescendants,
  type ArgumentMapNode,
  type ArgumentMapViewMode,
  type ArgumentTreeViewMode,
} from "../../flow/argument-map"
import { STANCE_TEXT_CLASS, stanceStroke } from "./colors"

const ArgumentMapChart = lazy(() => import("./ArgumentMapChart"))

export type ArgumentMapViewProps = {
  /** The round's already-filtered outline tree. */
  tree: ArgumentTreeNode[]
  /** Label for the round-level claim at the root. */
  rootLabel: string
  mode: ArgumentMapViewMode
}

/** Segmented control for the panel's view: the plain outline list or one of the map views. */
export function ArgumentTreeViewSwitcher({
  mode,
  onChange,
}: {
  mode: ArgumentTreeViewMode
  onChange: (mode: ArgumentTreeViewMode) => void
}) {
  const options = [{ value: "outline" as const, label: "Outline" }, ...ARGUMENT_MAP_VIEW_MODES]
  return (
    <div role="radiogroup" aria-label="Argument tree view" className="inline-flex flex-wrap gap-1 rounded-md border border-border bg-muted/40 p-1">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={mode === option.value}
          onClick={() => onChange(option.value)}
          className={
            mode === option.value
              ? "rounded px-2.5 py-1 text-xs font-medium bg-background text-foreground shadow-sm"
              : "rounded px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground"
          }
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

/** Thin stance bar, like Kialo's colored line above each claim. */
function StanceBar({ node, wide = false }: { node: ArgumentMapNode; wide?: boolean }) {
  return (
    <div
      aria-hidden
      className={`mx-auto mb-2 h-1.5 rounded-full ${wide ? "w-40" : "w-24"}`}
      style={{ background: stanceStroke(node.stance) }}
    />
  )
}

function ClaimCard({ node, onFocus }: { node: ArgumentMapNode; onFocus: (id: string) => void }) {
  const responses = countDescendants(node)
  return (
    <button
      type="button"
      onClick={() => onFocus(node.id)}
      className="w-full rounded-lg border border-border bg-card p-3 text-left text-sm text-card-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-accent/40"
    >
      <div className="flex items-start gap-2">
        <div className="flex-1">
          <StanceBar node={node} />
        </div>
        <span className="flex items-center gap-1 text-xs text-muted-foreground" title={`${responses} responses`}>
          {responses > 0 && responses}
          <MessageSquare className="h-3.5 w-3.5" aria-hidden />
        </span>
      </div>
      {node.speech && <div className="text-xs text-muted-foreground">{node.speech}</div>}
      <p className="leading-snug">{node.label}</p>
    </button>
  )
}

/** The focused claim, its parent above it, and its Pros / Cons below in two columns. */
export function ArgumentFocusView({
  root,
  focusId,
  onFocus,
}: {
  root: ArgumentMapNode
  focusId: string
  onFocus: (id: string) => void
}) {
  const path = argumentMapPath(root, focusId)
  const focused = path[path.length - 1]
  const parent = path.length > 1 ? path[path.length - 2] : null
  const pros = focused.children.filter((child) => child.stance === "pro")
  const cons = focused.children.filter((child) => child.stance === "con")

  return (
    <div className="space-y-2">
      {parent && (
        <div className="relative mx-auto w-[92%] rounded-lg border border-primary/40 bg-card px-4 pb-4 pt-3 text-sm text-card-foreground">
          <StanceBar node={parent} />
          <p>{parent.label}</p>
          <button
            type="button"
            onClick={() => onFocus(parent.id)}
            aria-label="Go up to the parent claim"
            className="absolute -bottom-3 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-muted-foreground hover:text-foreground"
          >
            <ArrowUp className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
      <div className="rounded-lg border border-border bg-card p-4 text-card-foreground shadow-sm">
        <StanceBar node={focused} wide />
        {focused.speech && <div className="text-xs text-muted-foreground">{focused.speech}</div>}
        <p className="text-lg font-medium leading-snug">{focused.label}</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {(["pro", "con"] as const).map((stance) => {
          const claims = stance === "pro" ? pros : cons
          return (
            <div key={stance} className="space-y-2">
              <div className="rounded-lg border border-border bg-card px-4 py-2 text-center">
                <span className={`font-semibold ${STANCE_TEXT_CLASS[stance]}`}>
                  {stance === "pro" ? "Pros" : "Cons"}
                </span>
                <span className="ml-2 text-xs text-muted-foreground">{claims.length}</span>
              </div>
              {claims.length === 0 ? (
                <p className="px-1 text-xs text-muted-foreground">
                  No {stance === "pro" ? "supporting" : "opposing"} claims yet.
                </p>
              ) : (
                claims.map((child) => <ClaimCard key={child.id} node={child} onFocus={onFocus} />)
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function ArgumentMapView({ tree, rootLabel, mode }: ArgumentMapViewProps) {
  const root = useMemo(() => buildArgumentMap(tree, rootLabel), [tree, rootLabel])
  const [focusId, setFocusId] = useState(root.id)

  // A filter change can remove the focused claim; fall back to the root.
  useEffect(() => {
    if (argumentMapPath(root, focusId).at(-1)?.id !== focusId) setFocusId(root.id)
  }, [root, focusId])

  return (
    <div className="space-y-3">
      {root.children.length === 0 ? (
        <p className="text-center text-sm text-muted-foreground">No claims to map for the current filter.</p>
      ) : (
        <Suspense fallback={<div className="h-40 animate-pulse rounded-md bg-muted/40" aria-label="Loading chart" />}>
          <ArgumentMapChart root={root} mode={mode} focusId={focusId} onFocus={setFocusId} />
        </Suspense>
      )}
      <ArgumentFocusView root={root} focusId={focusId} onFocus={setFocusId} />
    </div>
  )
}
