/**
 * @fileoverview Handlers for flow page interactions
 * @module components/debate/flow/hooks/useFlowHandlers
 */

import { useCallback } from "react";
import { newFlow } from "@/lib/utils/flow-utils";
import { settings } from "@/lib/state/settings";

/**
 * Hook that provides memoized handlers for creating, deleting, and selecting flows.
 *
 * @param flows - Current flows array
 * @param setFlows - State setter for the flows array
 * @param setSelected - Callback to set the currently selected flow by id
 * @returns Object containing `addFlow`, `deleteFlow`, and `selectSpeech` handlers
 */
export function useFlowHandlers(
  flows: Flow[],
  setFlows: (flows: Flow[]) => void,
  setSelected: (id: number) => void,
) {
  /**
   * Create a new flow using the current debate style setting and append it to the list.
   * Automatically selects the newly created flow and persists the updated list.
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
   * Remove the flow with the given id and select an adjacent flow if one exists.
   * Persists the updated list to localStorage.
   *
   * @param id - The id of the flow to delete
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
   * Set the given speech as the active selection and open the speech panel.
   *
   * @param speech - Name of the speech document to open
   * @param setSpeechPanelOpen - State setter to control speech panel visibility
   * @param setSelectedSpeech - State setter to update the selected speech name
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
