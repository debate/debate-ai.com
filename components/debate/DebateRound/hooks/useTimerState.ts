/**
 * @fileoverview Custom hook for managing debate timer state at the page level.
 */

"use client";


import { useState, useEffect, useCallback } from "react";
import { settings } from "@/lib/state/settings";
import {
  debateStyles,
  debateStyleMap,
} from "@/components/debate/DebateTimer/debate-format-times";
import type { DebateStyle, SpeechTimerState, TimerState } from "@/components/debate/DebateTimer/types";

/** Describes the currently running timer (if any) for the header display. */
export type ActiveTimerInfo = {
  label: string;
  totalTime: number;
  startTime: number;
} | null;

/** Per-speech timer state stored in the map. */
export type SpeechTimerEntry = {
  time: number;
  resetTime: number;
  state: SpeechTimerState["state"];
};

/**
 * Hook that owns all debate timer state (speech + prep timers).
 *
 * Call this at the DebateFlowPage level and pass the returned values
 * down to TimersPanel (via FlowPageSidebar) and FlowPageHeader.
 */
export function useTimerState() {
  const [debateStyleIndex, setDebateStyleIndex] = useState(
    settings.data.debateStyle.value as number,
  );
  const [debateStyle, setDebateStyle] = useState<DebateStyle>(
    debateStyles[debateStyleMap[debateStyleIndex]],
  );

  // Speech timer state
  const [speechState, setSpeechState] = useState<SpeechTimerState>({
    resetTimeIndex: 0,
    time: debateStyle.timerSpeeches[0].time * 60 * 1000,
    state: { name: "paused" },
  });

  // Per-speech timer states keyed by speech name (for SpeechHeaderBar tabs)
  const [perSpeechTimerStates, setPerSpeechTimerStates] = useState<Record<string, SpeechTimerEntry>>({});

  // Prep timer states (one per team)
  const [prepState, setPrepState] = useState<TimerState | null>(
    debateStyle.prepTime
      ? {
        resetTime: debateStyle.prepTime * 60 * 1000,
        time: debateStyle.prepTime * 60 * 1000,
        state: { name: "paused" },
      }
      : null,
  );

  const [prepSecondaryState, setPrepSecondaryState] =
    useState<TimerState | null>(
      debateStyle.prepTime
        ? {
          resetTime: debateStyle.prepTime * 60 * 1000,
          time: debateStyle.prepTime * 60 * 1000,
          state: { name: "paused" },
        }
        : null,
    );

  // Subscribe to debate style changes and reset all timers
  useEffect(() => {
    const unsubscribe = settings.subscribe(["debateStyle"], (key: string) => {
      const newIndex = settings.data[key].value as number;
      if (newIndex !== debateStyleIndex) {
        setDebateStyleIndex(newIndex);
        const newStyle = debateStyles[debateStyleMap[newIndex]];
        setDebateStyle(newStyle);

        setSpeechState({
          resetTimeIndex: 0,
          time: newStyle.timerSpeeches[0].time * 60 * 1000,
          state: { name: "paused" },
        });

        // Reset per-speech timer states when debate style changes
        setPerSpeechTimerStates({});

        if (newStyle.prepTime) {
          setPrepState({
            resetTime: newStyle.prepTime * 60 * 1000,
            time: newStyle.prepTime * 60 * 1000,
            state: { name: "paused" },
          });
          setPrepSecondaryState({
            resetTime: newStyle.prepTime * 60 * 1000,
            time: newStyle.prepTime * 60 * 1000,
            state: { name: "paused" },
          });
        } else {
          setPrepState(null);
          setPrepSecondaryState(null);
        }
      }
    });

    return unsubscribe;
  }, [debateStyleIndex]);

  /**
   * Get timer state for a specific speech by name.
   * Initializes to the speech's default time if not yet set.
   */
  const getSpeechTimerState = useCallback(
    (speechName: string): SpeechTimerEntry => {
      if (perSpeechTimerStates[speechName]) return perSpeechTimerStates[speechName];
      const idx = debateStyle.timerSpeeches.findIndex(
        (s) => s.name.toUpperCase() === speechName.toUpperCase()
      );
      const safeIdx = idx !== -1 ? idx : 0;
      const defaultTime = (debateStyle.timerSpeeches[safeIdx]?.time ?? 0) * 60 * 1000;
      return { time: defaultTime, resetTime: defaultTime, state: { name: "paused" } };
    },
    [perSpeechTimerStates, debateStyle]
  );

  /**
   * Update timer state for a specific speech by name.
   */
  const setSpeechTimerState = useCallback(
    (speechName: string, updates: Partial<SpeechTimerEntry>) => {
      setPerSpeechTimerStates((prev) => ({
        ...prev,
        [speechName]: { ...getSpeechTimerState(speechName), ...updates },
      }));
    },
    [getSpeechTimerState]
  );

  // Compute which timer is currently running (for header display)
  let activeTimer: ActiveTimerInfo = null;
  if (speechState.state.name === "running") {
    const speech = debateStyle.timerSpeeches[speechState.resetTimeIndex];
    activeTimer = {
      label: speech.name,
      totalTime: speech.time * 60 * 1000,
      startTime: speechState.state.startTime,
    };
  } else if (prepState?.state.name === "running") {
    activeTimer = {
      label: "Prep",
      totalTime: prepState.resetTime,
      startTime: prepState.state.startTime,
    };
  } else if (prepSecondaryState?.state.name === "running") {
    activeTimer = {
      label: "Prep",
      totalTime: prepSecondaryState.resetTime,
      startTime: prepSecondaryState.state.startTime,
    };
  }

  return {
    debateStyle,
    speechState,
    setSpeechState,
    prepState,
    setPrepState,
    prepSecondaryState,
    setPrepSecondaryState,
    activeTimer,
    perSpeechTimerStates,
    getSpeechTimerState,
    setSpeechTimerState,
  };
}
