"use client";

import React from "react";
import type { Flow } from "@/lib/flow/types";
import { cn } from "@/lib/utils";

interface FlowTabProps {
  flow: Flow;
  selected: boolean;
  onClick: () => void;
  onClose?: () => void;
}

export function FlowTab({ flow, selected, onClick, onClose }: FlowTabProps) {
  const palette = flow.invert ? "accent-secondary" : "accent";
  const displayName = flow.name || "no name";

  return (
    <div
      className={cn(
        "flow-tab relative flex items-center gap-2 px-3 py-2 rounded-t-lg cursor-pointer",
        "transition-colors duration-200",
        "border-b-2",
        palette === "accent"
          ? selected
            ? "bg-blue-100 dark:bg-blue-900/70 border-blue-500"
            : "bg-blue-50 dark:bg-blue-900/30 border-transparent hover:bg-blue-100 dark:hover:bg-blue-900/50"
          : selected
          ? "bg-orange-100 dark:bg-orange-900/70 border-orange-500"
          : "bg-orange-50 dark:bg-orange-900/30 border-transparent hover:bg-orange-100 dark:hover:bg-orange-900/50"
      )}
      onClick={onClick}
    >
      <span
        className={cn(
          "text-sm font-medium truncate max-w-[120px]",
          !flow.name && "text-muted-foreground"
        )}
      >
        {displayName}
      </span>

      {onClose && (
        <button
          className={cn(
            "close-button w-4 h-4 rounded-full",
            "flex items-center justify-center",
            "hover:bg-red-500 hover:text-white",
            "transition-colors text-xs"
          )}
          onClick={(e) => {
            e.stopPropagation();
            onClose();
          }}
        >
          ×
        </button>
      )}
    </div>
  );
}
