/**
 * @fileoverview Hook for managing AI analysis sidebar state and actions.
 *
 * Handles the custom prompt, generated analysis result, generation status,
 * and clipboard copy for the AI analysis panel. Currently uses a placeholder
 * timeout to simulate AI generation.
 *
 * @module components/debate/DebateCardSearch/hooks/useAiAnalysis
 */

"use client";

import { useState } from "react";
import type { SearchResult } from "@/components/debate/DebateCardSearch/types";

/**
 * Manages AI analysis state: prompt editing, result generation, and clipboard copy.
 *
 * @param selectedResult - The currently selected search result to analyze.
 * @returns State values and action handlers for the AI analysis sidebar.
 */
export function useAiAnalysis(selectedResult: SearchResult | null) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [generating, setGenerating] = useState(false);

  /**
   * Trigger AI analysis of the selected result.
   * Currently a placeholder that simulates a 2-second generation delay.
   */
  const handleGenerate = async () => {
    if (!selectedResult) return;
    setGenerating(true);
    setAiResult("Analyzing...");

    setTimeout(() => {
      setAiResult(
        `Analysis of "${selectedResult.tag}":\n\nThis research card discusses ${selectedResult.summary}`,
      );
      setGenerating(false);
    }, 2000);
  };

  /** Copy the selected result's content (with custom prompt) to the clipboard. */
  const handleCopy = () => {
    if (!selectedResult) return;
    const content = `${customPrompt}\n\n${selectedResult.tag}\n${selectedResult.cite}\n${selectedResult.summary}`;
    navigator.clipboard.writeText(content);
  };

  return {
    customPrompt,
    setCustomPrompt,
    aiResult,
    generating,
    handleGenerate,
    handleCopy,
  };
}
