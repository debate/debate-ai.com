/**
 * @fileoverview Outline filters and argument tree view — UI over
 * `flow/argument-tree.ts` with the filter selection persisted per round in
 * `state/argumentTreeFilters.ts`.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { Network } from "lucide-react";

import {
  EmptyState,
  PanelSection,
  PanelShell,
  Pill,
  StatGrid,
  StatTile,
} from "debate-ui/src/panels/panel-shell";
import { Button } from "debate-ui/src/primitives/button";
import type { Flow } from "debate-core/src/types/flow";

import {
  buildArgumentTree,
  filterArgumentTree,
  flattenArgumentTree,
  getFlowSideKeys,
  type ArgumentTreeFilter,
  type ArgumentTreeNode,
} from "../flow/argument-tree";
import {
  deleteArgumentTreeFilterSelection,
  getArgumentTreeFilterSelection,
  saveArgumentTreeFilterSelection,
} from "../state/argumentTreeFilters";

/** Props for {@link ArgumentTreePanel}. */
export interface ArgumentTreePanelProps {
  /** The flow the tree is built from. */
  flow: Pick<Flow, "children" | "columns">;
  /**
   * Round id the filter selection is stored under. Omit to keep the filter
   * in component state only.
   */
  roundId?: string;
  /** Invoked when an argument row is clicked. */
  onSelectNode?: (node: ArgumentTreeNode) => void;
  /** Extra classes for the panel. */
  className?: string;
}

/**
 * Heading-grouped argument tree with speech/side/unanswered filters.
 *
 * @param props - See {@link ArgumentTreePanelProps}.
 * @returns The argument tree panel.
 */
export function ArgumentTreePanel({
  flow,
  roundId,
  onSelectNode,
  className,
}: ArgumentTreePanelProps) {
  const [filter, setFilter] = useState<ArgumentTreeFilter>({});
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  // Restore the round's saved filter after mount so SSR markup stays stable.
  useEffect(() => {
    if (!roundId) return;
    const saved = getArgumentTreeFilterSelection(roundId);
    if (saved) setFilter(saved.filter);
  }, [roundId]);

  const updateFilter = (next: ArgumentTreeFilter) => {
    setFilter(next);
    if (!roundId) return;
    if (Object.keys(next).length === 0) deleteArgumentTreeFilterSelection(roundId);
    else saveArgumentTreeFilterSelection({ roundId, filter: next });
  };

  const tree = useMemo(() => buildArgumentTree(flow), [flow]);
  const filtered = useMemo(() => filterArgumentTree(tree, filter), [tree, filter]);
  const flat = useMemo(() => flattenArgumentTree(filtered), [filtered]);
  const sideKeys = useMemo(() => getFlowSideKeys(flow), [flow]);

  const unanswered = flat.filter((node) => node.isUnanswered && !node.isHeading).length;

  const toggleCollapse = (id: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <PanelShell
      title="Argument Tree"
      description="The flow grouped under its headings, with outline filters."
      icon={<Network className="h-4 w-4" />}
      className={className}
      data-testid="argument-tree-panel"
      actions={
        Object.keys(filter).length > 0 ? (
          <Button variant="ghost" size="sm" onClick={() => updateFilter({})}>
            Clear filters
          </Button>
        ) : null
      }
    >
      <StatGrid columns={3}>
        <StatTile label="Rows" value={flat.length} />
        <StatTile label="Headings" value={flat.filter((node) => node.isHeading).length} />
        <StatTile
          label="Unanswered"
          value={unanswered}
          tone={unanswered > 0 ? "warning" : "positive"}
        />
      </StatGrid>

      <PanelSection title="Filters">
        <div className="flex flex-wrap gap-1.5">
          {flow.columns.map((speech) => (
            <button
              key={speech}
              type="button"
              onClick={() =>
                updateFilter({
                  ...filter,
                  speech: filter.speech === speech ? undefined : speech,
                })
              }
            >
              <Pill tone={filter.speech === speech ? "info" : "neutral"}>{speech}</Pill>
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {sideKeys.map((sideKey) => (
            <button
              key={sideKey}
              type="button"
              onClick={() =>
                updateFilter({
                  ...filter,
                  sideKey: filter.sideKey === sideKey ? undefined : sideKey,
                })
              }
            >
              <Pill tone={filter.sideKey === sideKey ? "positive" : "neutral"}>{sideKey}</Pill>
            </button>
          ))}
          <button
            type="button"
            onClick={() =>
              updateFilter({
                ...filter,
                onlyUnanswered: filter.onlyUnanswered ? undefined : true,
              })
            }
          >
            <Pill tone={filter.onlyUnanswered ? "warning" : "neutral"}>only unanswered</Pill>
          </button>
          {(["heading", "argument"] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              onClick={() =>
                updateFilter({ ...filter, kind: filter.kind === kind ? undefined : kind })
              }
            >
              <Pill tone={filter.kind === kind ? "info" : "neutral"}>{kind}</Pill>
            </button>
          ))}
        </div>
      </PanelSection>

      <PanelSection title="Tree">
        {filtered.length === 0 ? (
          <EmptyState
            title="Nothing matches"
            message="Clear a filter, or flow an argument to populate the tree."
          />
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((node) => (
              <TreeNodeRow
                key={node.id}
                node={node}
                depth={0}
                collapsed={collapsed}
                onToggleCollapse={toggleCollapse}
                onSelect={onSelectNode}
              />
            ))}
          </ul>
        )}
      </PanelSection>
    </PanelShell>
  );
}

function TreeNodeRow({
  node,
  depth,
  collapsed,
  onToggleCollapse,
  onSelect,
}: {
  node: ArgumentTreeNode;
  depth: number;
  collapsed: Set<string>;
  onToggleCollapse: (id: string) => void;
  onSelect?: (node: ArgumentTreeNode) => void;
}) {
  const isCollapsed = collapsed.has(node.id);
  const hasChildren = node.children.length > 0;
  return (
    <li>
      <div
        className="hover:bg-muted/60 flex items-center justify-between gap-2 rounded px-2 py-1 text-xs"
        style={{ paddingLeft: `${depth * 12 + 8}px` }}
      >
        <span className="flex min-w-0 items-center gap-1">
          {hasChildren ? (
            <button
              type="button"
              aria-expanded={!isCollapsed}
              aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${node.content}`}
              onClick={() => onToggleCollapse(node.id)}
            >
              {isCollapsed ? "▸" : "▾"}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <button
            type="button"
            className={`truncate text-left ${node.isHeading ? "font-semibold" : ""}`}
            onClick={() => onSelect?.(node)}
          >
            {node.content || "(empty)"}
          </button>
        </span>
        <span className="flex flex-shrink-0 items-center gap-1">
          {node.sideKey ? <Pill>{node.sideKey}</Pill> : null}
          {node.isUnanswered && !node.isHeading ? <Pill tone="warning">unanswered</Pill> : null}
          <span className="text-muted-foreground">{node.lastSpeech}</span>
        </span>
      </div>
      {hasChildren && !isCollapsed ? (
        <ul className="flex flex-col gap-1">
          {node.children.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              collapsed={collapsed}
              onToggleCollapse={onToggleCollapse}
              onSelect={onSelect}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
