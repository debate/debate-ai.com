"use client";

import React, { useRef, useEffect, useCallback } from "react";
import { TextInput, TextInputRef } from "./text-input";
import { BoxControl } from "./box-control";
import type { Box as BoxType } from "@/lib/flow/types";
import { newBox } from "@/lib/flow/helpers";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

interface BoxProps {
  box: BoxType;
  parentPath?: number[];
  level: number;
  columnCount: number;
  invert: boolean;
  isRoot?: boolean;
  onUpdate: (box: BoxType) => void;
  onFocusChange?: (path: number[]) => void;
}

export function Box({
  box,
  parentPath = [],
  level,
  columnCount,
  invert,
  isRoot = false,
  onUpdate,
  onFocusChange,
}: BoxProps) {
  const textRef = useRef<TextInputRef>(null);
  const path = isRoot ? [] : [...parentPath, box.index];

  // Determine palette based on level and invert
  const getPalette = (lvl: number) => {
    if (invert) {
      return lvl % 2 === 0 ? "accent-secondary" : "accent";
    } else {
      return lvl % 2 === 0 ? "accent" : "accent-secondary";
    }
  };

  const palette = getPalette(level);
  const outsidePalette = getPalette(level + 1);

  // Auto-focus when box.focus is true
  useEffect(() => {
    if (box.focus && textRef.current) {
      textRef.current.focus();
    }
  }, [box.focus]);

  // Handle content change
  const handleContentChange = (newContent: string) => {
    onUpdate({
      ...box,
      content: newContent,
    });
  };

  // Handle focus
  const handleFocus = () => {
    if (!box.focus) {
      onUpdate({
        ...box,
        focus: true,
      });
      onFocusChange?.(path);
    }
  };

  // Handle blur
  const handleBlur = () => {
    if (box.focus) {
      onUpdate({
        ...box,
        focus: false,
      });
    }
  };

  // Add child
  const addChild = useCallback(() => {
    if (level < columnCount) {
      const newChild = newBox(box.children.length, level + 1, true);
      const updatedBox = {
        ...box,
        children: [...box.children, newChild],
      };
      onUpdate(updatedBox);
    }
  }, [box, level, columnCount, onUpdate]);

  // Add sibling (above or below)
  const addSibling = useCallback(
    (direction: "above" | "below") => {
      // This would be handled by parent
      // For now, just focus this box
      handleFocus();
    },
    [handleFocus]
  );

  // Delete self
  const handleDelete = useCallback(() => {
    if (box.content.length === 0 && box.children.length === 0) {
      // Signal to parent to delete this box
      // For now, just clear it
      onUpdate({
        ...box,
        content: "",
      });
    }
  }, [box, onUpdate]);

  // Update child
  const updateChild = useCallback(
    (childIndex: number, updatedChild: BoxType) => {
      const newChildren = [...box.children];
      newChildren[childIndex] = updatedChild;
      onUpdate({
        ...box,
        children: newChildren,
      });
    },
    [box, onUpdate]
  );

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const textarea = e.currentTarget;
    const cursorAtStart = textarea.selectionStart === 0;
    const cursorAtEnd = textarea.selectionStart === textarea.value.length;

    // Arrow Up: Focus previous sibling (only if cursor at start)
    if (e.key === "ArrowUp" && cursorAtStart && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // This would require parent to handle sibling navigation
      // For now, just prevent default
      e.preventDefault();
    }
    // Arrow Down: Focus next sibling (only if cursor at end)
    else if (e.key === "ArrowDown" && cursorAtEnd && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // This would require parent to handle sibling navigation
      // For now, just prevent default
      e.preventDefault();
    }
    // Arrow Right: Focus first child (only if cursor at end)
    else if (e.key === "ArrowRight" && cursorAtEnd && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      if (box.children.length > 0) {
        e.preventDefault();
        // Focus first child by updating it
        const updatedChildren = [...box.children];
        updatedChildren[0] = { ...updatedChildren[0], focus: true };
        onUpdate({ ...box, focus: false, children: updatedChildren });
      }
    }
    // Arrow Left: Focus parent (only if cursor at start)
    else if (e.key === "ArrowLeft" && cursorAtStart && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
      // Signal to parent that we want to focus it
      // For now, just prevent default
      e.preventDefault();
    }
    // Enter: Add sibling below
    else if (e.key === "Enter" && !e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey) {
      e.preventDefault();
      addSibling("below");
    }
    // Shift+Enter: Add child
    else if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      addChild();
    }
    // Backspace on empty: Delete
    else if (e.key === "Backspace" && box.content.length === 0 && box.children.length === 0) {
      e.preventDefault();
      handleDelete();
    }
    // Ctrl/Cmd+Shift+X: Cross out
    else if (
      e.key === "x" &&
      (e.ctrlKey || e.metaKey) &&
      e.shiftKey
    ) {
      e.preventDefault();
      onUpdate({
        ...box,
        crossed: !box.crossed,
      });
    }
  };

  return (
    <div className={cn("box-container", isRoot && "root-box")}>
      {!box.empty && (
        <div className="flex gap-0">
          {/* Box content */}
          <div
            className={cn(
              "box-content group relative",
              "transition-colors duration-200",
              palette === "accent" && "bg-blue-50 dark:bg-blue-950/20",
              palette === "accent-secondary" && "bg-orange-50 dark:bg-orange-950/20",
              box.focus && "ring-2 ring-blue-500 dark:ring-blue-400"
            )}
            style={{ width: "var(--column-width, 160px)" }}
          >
            {/* Add line above */}
            <div
              className={cn(
                "line-above h-1 cursor-pointer",
                "hover:bg-blue-400 dark:hover:bg-blue-600",
                "transition-colors"
              )}
              onClick={() => addSibling("above")}
            />

            {/* Text content with BoxControl */}
            <div className="relative">
              <div className={cn("p-2", box.crossed && "line-through")}>
                <TextInput
                  ref={textRef}
                  value={box.content}
                  onChange={handleContentChange}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                  onKeyDown={handleKeyDown}
                  placeholder={box.placeholder}
                  strikethrough={box.crossed}
                  autoFocus={box.focus}
                />
              </div>

              {/* Box Control Buttons */}
              <div className="absolute top-1 right-1">
                <BoxControl
                  onAddAbove={() => addSibling("above")}
                  onAddBelow={() => addSibling("below")}
                  onAddChild={level < columnCount ? addChild : undefined}
                  onDelete={handleDelete}
                  onCrossOut={() => onUpdate({ ...box, crossed: !box.crossed })}
                  isCrossedOut={box.crossed}
                  canAddChild={level < columnCount}
                  canDelete={box.content.length === 0 && box.children.length === 0}
                />
              </div>
            </div>

            {/* Add line below */}
            <div
              className={cn(
                "line-below h-1 cursor-pointer",
                "hover:bg-blue-400 dark:hover:bg-blue-600",
                "transition-colors"
              )}
              onClick={() => addSibling("below")}
            />

            {/* Add child button (when no children and not at max level) */}
            {box.children.length === 0 && level < columnCount && (
              <Button
                variant="ghost"
                size="icon"
                className={cn(
                  "absolute -right-8 top-1/2 -translate-y-1/2",
                  "w-6 h-6 opacity-0 group-hover:opacity-100",
                  "transition-opacity"
                )}
                onClick={addChild}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Children */}
          {box.children.length > 0 && (
            <ul className="children-list flex flex-col">
              {box.children.map((child, index) => (
                <li key={index} className="child-item">
                  <Box
                    box={child}
                    parentPath={path}
                    level={level + 1}
                    columnCount={columnCount}
                    invert={invert}
                    onUpdate={(updatedChild) => updateChild(index, updatedChild)}
                    onFocusChange={onFocusChange}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
