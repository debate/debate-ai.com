"use client";

import React from "react";
import { MainFlow } from "./main-flow";
import { HistoryProvider } from "@/contexts/history-context";
import { useFlowContext } from "@/contexts/flow-context";

export function FlowWithHistory() {
  const { flows, setFlows } = useFlowContext();

  return (
    <HistoryProvider flows={flows} onFlowsChange={setFlows}>
      <MainFlow />
    </HistoryProvider>
  );
}
