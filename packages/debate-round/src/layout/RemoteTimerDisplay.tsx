"use client";

/**
 * @fileoverview Component to display timer states from other room participants
 * @module components/debate/flow/layout/RemoteTimerDisplay
 */

import { Clock, User, AlertCircle } from "lucide-react";
import { cn } from "../ui/lib/utils";
import type { RemoteTimerState } from "../hooks/useTimerSync";

interface RemoteTimerDisplayProps {
  /** Array of remote timer states */
  timers: RemoteTimerState[];
  /** Currently selected speech name to filter */
  currentSpeechName?: string;
  /** Whether to show all timers or just the current speech */
  showAll?: boolean;
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getStateColor(stateName: string): string {
  switch (stateName) {
    case "running":
      return "text-green-600 dark:text-green-400";
    case "done":
      return "text-red-600 dark:text-red-400";
    default:
      return "text-muted-foreground";
  }
}

function getStateIcon(stateName: string) {
  switch (stateName) {
    case "running":
      return <Clock className="h-3.5 w-3.5 animate-pulse" />;
    case "done":
      return <AlertCircle className="h-3.5 w-3.5" />;
    default:
      return <Clock className="h-3.5 w-3.5 opacity-50" />;
  }
}

export function RemoteTimerDisplay({ timers, currentSpeechName, showAll = false }: RemoteTimerDisplayProps) {
  const filteredTimers = showAll
    ? timers
    : timers.filter((t) => t.timerState.speechName === currentSpeechName);

  if (filteredTimers.length === 0) {
    return (
      <div className="text-center py-3 text-sm text-muted-foreground">
        <Clock className="mx-auto h-5 w-5 mb-1 opacity-50" />
        <p>No remote timers for this speech</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {filteredTimers.map((timer) => (
        <div
          key={timer.peerId}
          className="flex items-center gap-2 p-2 rounded-lg border border-border bg-background"
        >
          <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 text-xs">
              <span className="font-medium truncate">{timer.peerName}</span>
              <span className="text-muted-foreground px-1.5 py-0.5 bg-muted rounded">
                {timer.timerState.speechName}
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {getStateIcon(timer.timerState.state.name)}
              <span className={cn("font-mono font-medium", getStateColor(timer.timerState.state.name))}>
                {formatTime(timer.timerState.time)} / {formatTime(timer.timerState.resetTime)}
              </span>
              <span className={cn("text-xs capitalize", getStateColor(timer.timerState.state.name))}>
                {timer.timerState.state.name}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}