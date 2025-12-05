"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Plus, Minus, CornerDownRight, X } from "lucide-react";
import { useSettings } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";

interface BoxControlProps {
  onAddAbove?: () => void;
  onAddBelow?: () => void;
  onAddChild?: () => void;
  onDelete?: () => void;
  onCrossOut?: () => void;
  isCrossedOut?: boolean;
  canAddChild?: boolean;
  canDelete?: boolean;
  showAbove?: boolean;
  showBelow?: boolean;
}

export function BoxControl({
  onAddAbove,
  onAddBelow,
  onAddChild,
  onDelete,
  onCrossOut,
  isCrossedOut = false,
  canAddChild = true,
  canDelete = true,
  showAbove = true,
  showBelow = true,
}: BoxControlProps) {
  const { settings } = useSettings();

  const showCreationButtons = settings.showBoxCreationButtons.value;
  const showFormatButtons = settings.showBoxFormatButtons.value;
  const buttonSize = settings.buttonSize.value;

  // Don't render anything if all buttons are hidden
  if (!showCreationButtons && !showFormatButtons) {
    return null;
  }

  return (
    <div className="box-control flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
      {/* Creation Buttons */}
      {showCreationButtons && (
        <>
          {showAbove && onAddAbove && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-6 w-6")}
              style={{
                height: `${buttonSize}px`,
                width: `${buttonSize}px`
              }}
              onClick={onAddAbove}
              title="Add box above (Enter)"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}

          {showBelow && onAddBelow && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-6 w-6")}
              style={{
                height: `${buttonSize}px`,
                width: `${buttonSize}px`
              }}
              onClick={onAddBelow}
              title="Add box below (Enter)"
            >
              <Plus className="h-3 w-3" />
            </Button>
          )}

          {canAddChild && onAddChild && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-6 w-6")}
              style={{
                height: `${buttonSize}px`,
                width: `${buttonSize}px`
              }}
              onClick={onAddChild}
              title="Add child box (Shift+Enter)"
            >
              <CornerDownRight className="h-3 w-3" />
            </Button>
          )}
        </>
      )}

      {/* Format Buttons */}
      {showFormatButtons && (
        <>
          {onCrossOut && (
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "h-6 w-6",
                isCrossedOut && "bg-red-100 dark:bg-red-900/30"
              )}
              style={{
                height: `${buttonSize}px`,
                width: `${buttonSize}px`
              }}
              onClick={onCrossOut}
              title="Cross out (Ctrl+Shift+X)"
            >
              <X className="h-3 w-3" />
            </Button>
          )}

          {canDelete && onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className={cn("h-6 w-6 hover:bg-red-100 hover:text-red-600")}
              style={{
                height: `${buttonSize}px`,
                width: `${buttonSize}px`
              }}
              onClick={onDelete}
              title="Delete box (Backspace on empty)"
            >
              <Minus className="h-3 w-3" />
            </Button>
          )}
        </>
      )}
    </div>
  );
}
