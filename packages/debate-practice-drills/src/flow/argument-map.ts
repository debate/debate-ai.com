/**
 * @fileoverview Argument map — turns a round's (already filtered) outline
 * tree into the Kialo-style claim hierarchy the Argument Tree panel's visual
 * views draw: one root claim for the round, each flow heading as a
 * contention under it, each argument row under its heading, and each later
 * speech's entry on that row as a response to the entry before it.
 *
 * Every non-root claim carries a `stance` relative to its parent, the way
 * Kialo colors pros green and cons red: an argument row is `pro` the round
 * when its side is the affirmative/pro side and `con` otherwise, and a
 * response is `pro` its parent when it comes from the same side (an
 * extension) and `con` when it comes from the other side (an answer).
 * A heading takes the side of the majority of its rows.
 *
 * Pure data only — the d3 layouts that draw this live in
 * `panels/argument-map/ArgumentMapChart.tsx`.
 */

import type { ArgumentTreeNode } from "debate-round/src/flow/argument-tree"
import { getSpeechSideKey } from "debate-round/src/flow/argument-tree"

export type ArgumentStance = "root" | "pro" | "con"

export type ArgumentMapNode = {
  id: string
  label: string
  stance: ArgumentStance
  /** Side key of the speech that made this claim (`null` for the root and for headings). */
  sideKey: string | null
  /** Speech (column) the claim was made in, when it came from one. */
  speech?: string
  /** Depth below the root (root = 0). */
  depth: number
  parentId: string | null
  children: ArgumentMapNode[]
}

export type ArgumentMapViewMode = "tree" | "sunburst" | "mindmap" | "bubble" | "sankey"

/** The Argument Tree panel's view: the plain filterable outline list, or one of the map views. */
export type ArgumentTreeViewMode = "outline" | ArgumentMapViewMode

const ARGUMENT_TREE_VIEW_MODE_VALUES: ArgumentTreeViewMode[] = ["outline", "tree", "sunburst", "mindmap", "bubble", "sankey"]

/** Narrows a stored string back to a view mode, defaulting to the tiered tree. */
export function parseArgumentTreeViewMode(value: unknown): ArgumentTreeViewMode {
  return ARGUMENT_TREE_VIEW_MODE_VALUES.includes(value as ArgumentTreeViewMode) ? (value as ArgumentTreeViewMode) : "tree"
}

export const ARGUMENT_MAP_VIEW_MODES: { value: ArgumentMapViewMode; label: string }[] = [
  { value: "tree", label: "Tiered tree" },
  { value: "sunburst", label: "Sunburst" },
  { value: "mindmap", label: "Mind map" },
  { value: "bubble", label: "Bubble map" },
  { value: "sankey", label: "Sankey" },
]

/** Side letters that conventionally mean the affirmative/pro/proposition side across formats. */
const PRO_SIDE_LETTERS = new Set(["A", "P"])

/**
 * Picks which side key counts as "pro" for a round: an `A`/`P` side when one
 * is present (aff, pro, prop), otherwise whichever side spoke first.
 */
export function resolveProSideKey(nodes: ArgumentTreeNode[]): string | null {
  const keys: string[] = []
  const visit = (list: ArgumentTreeNode[]) => {
    for (const node of list) {
      for (const entry of node.entries) {
        const key = getSpeechSideKey(entry.speech)
        if (key && !keys.includes(key)) keys.push(key)
      }
      visit(node.children)
    }
  }
  visit(nodes)
  return keys.find((key) => PRO_SIDE_LETTERS.has(key)) ?? keys[0] ?? null
}

function stanceForSide(sideKey: string | null, proSideKey: string | null): "pro" | "con" {
  return sideKey !== null && sideKey === proSideKey ? "pro" : "con"
}

function argumentNode(
  node: ArgumentTreeNode,
  parentId: string,
  depth: number,
  proSideKey: string | null,
  parentSideKey: string | null,
): ArgumentMapNode {
  const first = node.entries[0]
  const sideKey = first ? getSpeechSideKey(first.speech) : node.sideKey
  const root: ArgumentMapNode = {
    id: node.id,
    label: node.content,
    stance: parentSideKey === null ? stanceForSide(sideKey, proSideKey) : sideKey === parentSideKey ? "pro" : "con",
    sideKey,
    speech: first?.speech ?? node.originSpeech,
    depth,
    parentId,
    children: [],
  }

  // Each later speech's entry on the row answers (or extends) the entry before it.
  let parent = root
  node.entries.slice(1).forEach((entry, index) => {
    const entrySide = getSpeechSideKey(entry.speech)
    const child: ArgumentMapNode = {
      id: `${node.id}-r${index + 1}`,
      label: entry.content,
      stance: entrySide !== null && entrySide === parent.sideKey ? "pro" : "con",
      sideKey: entrySide,
      speech: entry.speech,
      depth: parent.depth + 1,
      parentId: parent.id,
      children: [],
    }
    parent.children.push(child)
    parent = child
  })

  return root
}

/**
 * Builds the claim hierarchy for one round from its (already filtered)
 * outline tree. `rootLabel` is the round-level claim shown at the center
 * (the resolution, or a "Round …" fallback).
 */
export function buildArgumentMap(nodes: ArgumentTreeNode[], rootLabel: string): ArgumentMapNode {
  const proSideKey = resolveProSideKey(nodes)
  const root: ArgumentMapNode = {
    id: "root",
    label: rootLabel,
    stance: "root",
    sideKey: null,
    depth: 0,
    parentId: null,
    children: [],
  }

  for (const node of nodes) {
    if (!node.isHeading) {
      root.children.push(argumentNode(node, root.id, 1, proSideKey, null))
      continue
    }
    const sides = node.children.map((child) => getSpeechSideKey(child.entries[0]?.speech ?? child.originSpeech))
    const proCount = sides.filter((side) => side === proSideKey).length
    const headingIsPro = proCount * 2 >= sides.length
    const headingSide = headingIsPro ? proSideKey : sides.find((side) => side !== proSideKey) ?? null
    const heading: ArgumentMapNode = {
      id: node.id,
      label: node.content,
      stance: headingIsPro ? "pro" : "con",
      sideKey: headingSide,
      depth: 1,
      parentId: root.id,
      children: [],
    }
    heading.children = node.children.map((child) => argumentNode(child, heading.id, 2, proSideKey, headingSide))
    root.children.push(heading)
  }

  return root
}

/** Every node in the map keyed by id, for focus lookups. */
export function indexArgumentMap(root: ArgumentMapNode): Map<string, ArgumentMapNode> {
  const index = new Map<string, ArgumentMapNode>()
  const visit = (node: ArgumentMapNode) => {
    index.set(node.id, node)
    node.children.forEach(visit)
  }
  visit(root)
  return index
}

/** The chain of claims from the root down to `id` (inclusive), or just the root when `id` is unknown. */
export function argumentMapPath(root: ArgumentMapNode, id: string): ArgumentMapNode[] {
  const index = indexArgumentMap(root)
  const path: ArgumentMapNode[] = []
  let current = index.get(id)
  while (current) {
    path.unshift(current)
    current = current.parentId ? index.get(current.parentId) : undefined
  }
  return path.length > 0 ? path : [root]
}

/** Number of claims beneath a node (its whole subtree, excluding itself). */
export function countDescendants(node: ArgumentMapNode): number {
  return node.children.reduce((sum, child) => sum + 1 + countDescendants(child), 0)
}
