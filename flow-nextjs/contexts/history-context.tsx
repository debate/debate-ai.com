"use client";

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  ReactNode,
  useEffect,
} from "react";
import type { Flow } from "@/lib/flow/types";

interface HistoryState {
  past: Flow[][];
  present: Flow[];
  future: Flow[][];
}

interface HistoryContextType {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  pushHistory: (flows: Flow[]) => void;
  clearHistory: () => void;
}

const HistoryContext = createContext<HistoryContextType | undefined>(undefined);

export function useHistory() {
  const context = useContext(HistoryContext);
  if (!context) {
    throw new Error("useHistory must be used within a HistoryProvider");
  }
  return context;
}

interface HistoryProviderProps {
  children: ReactNode;
  flows: Flow[];
  onFlowsChange: (flows: Flow[]) => void;
}

export function HistoryProvider({
  children,
  flows,
  onFlowsChange,
}: HistoryProviderProps) {
  const [history, setHistory] = useState<HistoryState>({
    past: [],
    present: flows,
    future: [],
  });

  // Update present when flows change externally (not from undo/redo)
  useEffect(() => {
    setHistory((prev) => {
      // Only update if flows actually changed
      if (JSON.stringify(prev.present) !== JSON.stringify(flows)) {
        return {
          ...prev,
          present: flows,
        };
      }
      return prev;
    });
  }, [flows]);

  const canUndo = history.past.length > 0;
  const canRedo = history.future.length > 0;

  // Push new state to history
  const pushHistory = useCallback(
    (newFlows: Flow[]) => {
      // Don't push if flows haven't actually changed
      if (JSON.stringify(history.present) === JSON.stringify(newFlows)) {
        return;
      }

      setHistory((prev) => ({
        past: [...prev.past, prev.present],
        present: newFlows,
        future: [], // Clear future when new action is performed
      }));

      onFlowsChange(newFlows);
    },
    [history.present, onFlowsChange]
  );

  // Undo
  const undo = useCallback(() => {
    if (!canUndo) return;

    setHistory((prev) => {
      const newPast = [...prev.past];
      const newPresent = newPast.pop()!;

      onFlowsChange(newPresent);

      return {
        past: newPast,
        present: newPresent,
        future: [prev.present, ...prev.future],
      };
    });
  }, [canUndo, onFlowsChange]);

  // Redo
  const redo = useCallback(() => {
    if (!canRedo) return;

    setHistory((prev) => {
      const newFuture = [...prev.future];
      const newPresent = newFuture.shift()!;

      onFlowsChange(newPresent);

      return {
        past: [...prev.past, prev.present],
        present: newPresent,
        future: newFuture,
      };
    });
  }, [canRedo, onFlowsChange]);

  // Clear history
  const clearHistory = useCallback(() => {
    setHistory({
      past: [],
      present: flows,
      future: [],
    });
  }, [flows]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Undo: Ctrl+Z or Cmd+Z
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      }
      // Redo: Ctrl+Shift+Z, Cmd+Shift+Z, or Ctrl+Y, Cmd+Y
      else if (
        ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey) ||
        ((e.ctrlKey || e.metaKey) && e.key === "y")
      ) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [undo, redo]);

  return (
    <HistoryContext.Provider
      value={{
        canUndo,
        canRedo,
        undo,
        redo,
        pushHistory,
        clearHistory,
      }}
    >
      {children}
    </HistoryContext.Provider>
  );
}
