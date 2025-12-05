"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { Undo, Redo } from "lucide-react";
import { useHistory } from "@/contexts/history-context";
import { useSettings } from "@/contexts/settings-context";
import { cn } from "@/lib/utils";

export function HistoryButtons() {
  const { canUndo, canRedo, undo, redo } = useHistory();
  const { settings } = useSettings();

  // Only show if setting is enabled
  if (!settings.showUndoRedoButtons.value) {
    return null;
  }

  return (
    <div className="history-buttons flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", !canUndo && "opacity-50 cursor-not-allowed")}
        onClick={undo}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <Undo className="h-4 w-4" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-8 w-8", !canRedo && "opacity-50 cursor-not-allowed")}
        onClick={redo}
        disabled={!canRedo}
        title="Redo (Ctrl+Y)"
      >
        <Redo className="h-4 w-4" />
      </Button>
    </div>
  );
}
