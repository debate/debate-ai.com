"use client";

import React, { useRef } from "react";
import { Box } from "./box";
import type { Flow } from "@/lib/flow/types";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { newBox } from "@/lib/flow/helpers";
import { cn } from "@/lib/utils";

interface FlowDisplayProps {
  flow: Flow;
  onUpdate: (flow: Flow) => void;
}

export function FlowDisplay({ flow, onUpdate }: FlowDisplayProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Add empty box to column
  const addEmptyBox = (columnIndex: number) => {
    const newChild = newBox(flow.children.length, 1, true);
    // Add placeholder based on column
    if (columnIndex === 0 && flow.children.length === 0) {
      newChild.placeholder = "type here";
    }

    onUpdate({
      ...flow,
      children: [...flow.children, newChild],
    });
  };

  // Update root box (flow content)
  const handleRootUpdate = (updatedChildren: typeof flow.children) => {
    onUpdate({
      ...flow,
      children: updatedChildren,
    });
  };

  // Handle focus changes
  const handleFocusChange = (path: number[]) => {
    onUpdate({
      ...flow,
      lastFocus: path,
    });
  };

  const columnCount = flow.columns.length;

  return (
    <div className="flow-display relative w-full h-full overflow-hidden">
      {/* Column Headers */}
      <div
        className="column-headers sticky top-0 z-10 flex gap-0 bg-background"
        style={{
          width: `calc(${columnCount} * var(--column-width, 160px))`,
        }}
      >
        {flow.columns.map((column, index) => {
          const isAccent = (index % 2 === 0) !== flow.invert;
          return (
            <div
              key={index}
              className={cn(
                "column-header flex items-center justify-between p-2 rounded-t-lg",
                isAccent
                  ? "bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-100"
                  : "bg-orange-100 dark:bg-orange-900/50 text-orange-900 dark:text-orange-100"
              )}
              style={{ width: "var(--column-width, 160px)" }}
            >
              <span className="font-medium text-sm truncate">{column}</span>
              <Button
                variant="ghost"
                size="icon"
                className="w-5 h-5"
                onClick={() => addEmptyBox(index)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </div>
          );
        })}
      </div>

      {/* Column Backgrounds */}
      <div
        className="column-backgrounds absolute top-0 left-0 right-0 bottom-0 flex gap-0 pointer-events-none -z-10"
        style={{
          width: `calc(${columnCount} * var(--column-width, 160px))`,
        }}
      >
        {flow.columns.map((_, index) => {
          const isAccent = (index % 2 === 0) !== flow.invert;
          return (
            <div
              key={index}
              className={cn(
                "column-bg rounded-lg",
                isAccent
                  ? "bg-blue-50/50 dark:bg-blue-950/20"
                  : "bg-orange-50/50 dark:bg-orange-950/20"
              )}
              style={{ width: "var(--column-width, 160px)" }}
            />
          );
        })}
      </div>

      {/* Flow Content - Scrollable */}
      <div
        ref={scrollRef}
        className="flow-content overflow-auto pb-[60vh] pt-2"
        style={{
          width: `calc(${columnCount} * var(--column-width, 160px))`,
          height: "calc(100vh - 200px)",
        }}
      >
        {/* Root Box - renders all children recursively */}
        <Box
          box={{
            content: flow.content,
            children: flow.children,
            index: 0,
            level: 0,
            focus: flow.focus,
          }}
          level={0}
          columnCount={columnCount}
          invert={flow.invert}
          isRoot={true}
          onUpdate={(updatedBox) => {
            onUpdate({
              ...flow,
              content: updatedBox.content,
              children: updatedBox.children,
              focus: updatedBox.focus,
            });
          }}
          onFocusChange={handleFocusChange}
        />
      </div>
    </div>
  );
}
