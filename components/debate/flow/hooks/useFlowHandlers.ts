/**
 * @fileoverview Handlers for flow page interactions
 * @module components/debate/flow/hooks/useFlowHandlers
 */

import { useCallback } from "react";
import { newFlow } from "@/lib/utils/flow-utils";
import { settings } from "@/lib/state/settings";

/**
 * Hook for flow manipulation handlers
 *
 * @param flows - Current flows array
 * @param setFlows - Function to update flows
 * @param setSelected - Function to update selected flow
 * @returns Handler functions
 */
export function useFlowHandlers(
  flows: Flow[],
  setFlows: (flows: Flow[]) => void,
  setSelected: (id: number) => void,
) {
  /**
   * Handler to add a new flow
   */
  const addFlow = useCallback(() => {
    const debateStyleIndex = settings.data.debateStyle.value as number;
    const flow = newFlow(flows.length, "primary", false, debateStyleIndex);

    if (!flow) {
      console.error("Failed to create new flow");
      return;
    }

    const updatedFlows = [...flows, flow];
    setFlows(updatedFlows);
    setSelected(flow.id);
    localStorage.setItem("flows", JSON.stringify(updatedFlows));
  }, [flows, setFlows, setSelected]);

  /**
   * Handler to delete a flow
   */
  const deleteFlow = useCallback(
    (id: number) => {
      const idx = flows.findIndex((f) => f.id === id);
      if (idx === -1) return;

      // Select adjacent flow
      if (flows.length > 1) {
        if (idx === flows.length - 1) {
          setSelected(flows[idx - 1].id);
        } else {
          setSelected(flows[idx + 1].id);
        }
      }

      // Remove the flow
      const updatedFlows = flows.filter((f) => f.id !== id);
      setFlows(updatedFlows);
      localStorage.setItem("flows", JSON.stringify(updatedFlows));
    },
    [flows, setFlows, setSelected],
  );

  /**
   * Handler to select a speech doc
   */
  const selectSpeech = useCallback(
    (
      speech: string,
      setSpeechPanelOpen: (open: boolean) => void,
      setSelectedSpeech: (speech: string) => void,
    ) => {
      setSelectedSpeech(speech);
      setSpeechPanelOpen(true);
    },
    [],
  );

  return {
    addFlow,
    deleteFlow,
    selectSpeech,
  };
}
