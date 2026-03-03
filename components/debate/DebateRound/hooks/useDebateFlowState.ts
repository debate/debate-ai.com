/**
 * @fileoverview Custom hook for managing debate flow page state
 * @module components/debate/flow/hooks/useDebateFlowState
 */

import { useState, useRef } from "react";

/**
 * Hook for managing all debate flow page state.
 * Centralizes state management for the entire flow page, including dialogs,
 * speech panel, mobile navigation, and split mode.
 *
 * @returns Combined state and action setters for the debate flow page
 */
export function useDebateFlowState(): DebateFlowState & DebateFlowActions {
  // Dialog visibility states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [roundDialogOpen, setRoundDialogOpen] = useState(false);
  const [editingRoundId, setEditingRoundId] = useState<number | undefined>(
    undefined,
  );

  // Speech panel states
  const [speechPanelOpen, setSpeechPanelOpen] = useState(false);
  const [selectedSpeech, setSelectedSpeech] = useState<string>("");
  const [speechPanelViewMode, setSpeechPanelViewMode] =
    useState<ViewMode>("read");
  const [speechPanelQuoteView, setSpeechPanelQuoteView] = useState(false);

  // Mobile navigation state
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Split mode states
  const [splitMode, setSplitMode] = useState(true);
  const [splitSpeech1, setSplitSpeech1] = useState<string>("");
  const [splitSpeech2, setSplitSpeech2] = useState<string>("");
  const [splitViewMode1, setSplitViewMode1] = useState<ViewMode>("read");
  const [splitViewMode2, setSplitViewMode2] = useState<ViewMode>("read");
  const [splitQuoteView1, setSplitQuoteView1] = useState(false);
  const [splitQuoteView2, setSplitQuoteView2] = useState(false);
  const [splitWidth, setSplitWidth] = useState(50);

  return {
    // State
    settingsOpen,
    historyDialogOpen,
    roundDialogOpen,
    editingRoundId,
    speechPanelOpen,
    selectedSpeech,
    speechPanelViewMode,
    speechPanelQuoteView,
    mobileMenuOpen,
    isMobile,
    splitMode,
    splitSpeech1,
    splitSpeech2,
    splitViewMode1,
    splitViewMode2,
    splitQuoteView1,
    splitQuoteView2,
    splitWidth,

    // Actions
    setSettingsOpen,
    setHistoryDialogOpen,
    setRoundDialogOpen,
    setEditingRoundId,
    setSpeechPanelOpen,
    setSelectedSpeech,
    setSpeechPanelViewMode,
    setSpeechPanelQuoteView,
    setMobileMenuOpen,
    setIsMobile,
    setSplitMode,
    setSplitSpeech1,
    setSplitSpeech2,
    setSplitViewMode1,
    setSplitViewMode2,
    setSplitQuoteView1,
    setSplitQuoteView2,
    setSplitWidth,
  };
}

/**
 * Hook for managing a mutable reference to the AG Grid API instance.
 * Provides access to AG Grid API for programmatic control of the spreadsheet.
 *
 * @returns A React ref object whose `.current` holds the AG Grid API or null
 */
export function useGridApiRef() {
  return useRef<any>(null);
}
