"use client";

import React, { createContext, useContext, useState, useCallback, useEffect, ReactNode } from "react";
import type { Flow } from "@/lib/flow/types";
import { newFlow } from "@/lib/flow/helpers";

interface FlowContextType {
  flows: Flow[];
  selectedIndex: number;
  setFlows: (flows: Flow[]) => void;
  setSelectedIndex: (index: number) => void;
  addFlow: (type: "primary" | "secondary") => void;
  deleteFlow: (index: number) => void;
  updateFlow: (index: number, flow: Flow) => void;
  moveFlow: (from: number, to: number) => void;
  flowsChanged: boolean;
  markFlowsSaved: () => void;
}

const FlowContext = createContext<FlowContextType | undefined>(undefined);

export function FlowProvider({ children }: { children: ReactNode }) {
  const [flows, setFlowsState] = useState<Flow[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [flowsChanged, setFlowsChanged] = useState(false);

  const setFlows = useCallback((newFlows: Flow[]) => {
    setFlowsState(newFlows);
    setFlowsChanged(true);
  }, []);

  const markFlowsSaved = useCallback(() => {
    setFlowsChanged(false);
  }, []);

  const addFlow = useCallback(
    (type: "primary" | "secondary") => {
      const newFlowData = newFlow(
        crypto.randomUUID(),
        `Flow ${flows.length + 1}`,
        flows.length,
        "Policy Debate",
        type
      );
      setFlows([...flows, newFlowData]);
      setSelectedIndex(flows.length);
    },
    [flows, setFlows]
  );

  const deleteFlow = useCallback(
    (index: number) => {
      const newFlows = flows.filter((_, i) => i !== index);
      // Update indices
      newFlows.forEach((flow, i) => {
        flow.index = i;
      });
      setFlows(newFlows);
      if (index === 0) {
        setSelectedIndex(0);
      } else {
        setSelectedIndex(Math.min(index - 1, newFlows.length - 1));
      }
    },
    [flows, setFlows]
  );

  const updateFlow = useCallback(
    (index: number, flow: Flow) => {
      const newFlows = [...flows];
      newFlows[index] = flow;
      setFlows(newFlows);
    },
    [flows, setFlows]
  );

  const moveFlow = useCallback(
    (from: number, to: number) => {
      const newFlows = [...flows];
      const [movedFlow] = newFlows.splice(from, 1);
      newFlows.splice(to, 0, movedFlow);
      // Update indices
      newFlows.forEach((flow, i) => {
        flow.index = i;
      });
      setFlows(newFlows);
      setSelectedIndex(to);
    },
    [flows, setFlows]
  );

  // Auto-save to localStorage
  useEffect(() => {
    if (flows.length > 0 && flowsChanged) {
      const timer = setTimeout(() => {
        localStorage.setItem("flows", JSON.stringify(flows));
        setFlowsChanged(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [flows, flowsChanged]);

  // Load from localStorage on mount
  useEffect(() => {
    const savedFlows = localStorage.getItem("flows");
    if (savedFlows) {
      try {
        const parsed = JSON.parse(savedFlows);
        setFlowsState(parsed);
      } catch (e) {
        console.error("Failed to load flows:", e);
      }
    }
  }, []);

  return (
    <FlowContext.Provider
      value={{
        flows,
        selectedIndex,
        setFlows,
        setSelectedIndex,
        addFlow,
        deleteFlow,
        updateFlow,
        moveFlow,
        flowsChanged,
        markFlowsSaved,
      }}
    >
      {children}
    </FlowContext.Provider>
  );
}

export function useFlowContext() {
  const context = useContext(FlowContext);
  if (!context) {
    throw new Error("useFlowContext must be used within a FlowProvider");
  }
  return context;
}
