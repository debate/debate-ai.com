/**
 * @fileoverview Hook for managing AI analysis sidebar state and actions.
 *
 * The prompt starts prefilled with {@link FIND_FLAWS_AND_EXTENSIONS_PROMPT},
 * and selecting a card runs it automatically: `/api/card-ai-analysis` returns
 * the card's saved analysis, or generates and saves one the first time that
 * card is analyzed with that prompt, so every card keeps a saved version.
 * Results are also memoized for the session, so stepping back to a card is
 * instant.
 *
 * @module components/debate/DebateCardSearch/hooks/useAiAnalysis
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SearchResult } from "../types";
import {
  FIND_FLAWS_AND_EXTENSIONS_PROMPT,
  buildCardAnalysisContent,
  requestCardAiAnalysis,
} from "../lib/card-ai-analysis";

/** Session memo of finished analyses, keyed by card content + prompt. */
const sessionResults = new Map<string, string>();
const memoKey = (content: string, prompt: string) => `${prompt}\u0000${content}`;

/**
 * Manages AI analysis state: prompt editing, result generation, and clipboard copy.
 *
 * @param selectedResult - The currently selected search result to analyze.
 * @param options.autoGenerate - Analyze each card as soon as it is selected (default true).
 * @returns State values and action handlers for the AI analysis sidebar.
 */
export function useAiAnalysis(
  selectedResult: SearchResult | null,
  { autoGenerate = true }: { autoGenerate?: boolean } = {},
) {
  const [customPrompt, setCustomPrompt] = useState(FIND_FLAWS_AND_EXTENSIONS_PROMPT);
  const [aiResult, setAiResult] = useState("");
  const [generating, setGenerating] = useState(false);
  const requestId = useRef(0);
  // The prompt is read at generation time, not tracked as an effect
  // dependency — editing it should not re-run the analysis on every keystroke.
  const promptRef = useRef(customPrompt);
  promptRef.current = customPrompt;

  const generate = useCallback(async (card: SearchResult | null, prompt: string) => {
    const id = ++requestId.current;
    if (!card) {
      setAiResult("");
      setGenerating(false);
      return;
    }
    const content = buildCardAnalysisContent(card);
    const key = memoKey(content, prompt);
    const memo = sessionResults.get(key);
    if (memo !== undefined) {
      setAiResult(memo);
      setGenerating(false);
      return;
    }
    if (!content) {
      setAiResult("This card has no text to analyze.");
      setGenerating(false);
      return;
    }

    setGenerating(true);
    setAiResult("Analyzing...");
    try {
      const { result } = await requestCardAiAnalysis({ content, prompt, tag: card.tag });
      sessionResults.set(key, result);
      if (id === requestId.current) setAiResult(result);
    } catch (error) {
      if (id === requestId.current) {
        setAiResult(error instanceof Error ? error.message : "AI analysis failed.");
      }
    } finally {
      if (id === requestId.current) setGenerating(false);
    }
  }, []);

  useEffect(() => {
    if (autoGenerate) {
      void generate(selectedResult, promptRef.current);
    } else {
      requestId.current++;
      setAiResult("");
      setGenerating(false);
    }
  }, [selectedResult, autoGenerate, generate]);

  /** Analyze the selected card with the prompt as currently edited. */
  const handleGenerate = async () => {
    await generate(selectedResult, customPrompt);
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
