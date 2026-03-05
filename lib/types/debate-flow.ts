/**
 * View modes for markdown content display
 * Controls how speech document content is rendered
 */
export type ViewMode =
    | "read"
    | "highlighted"
    | "underlined"
    | "headings"
    | "h1-only"
    | "h2-only"
    | "h3-only"
    | "summaries-only"
    | "quotes";

/**
 * State for the debate flow page
 */
export interface DebateFlowState {
    // Dialog visibility states
    settingsOpen: boolean;
    historyDialogOpen: boolean;
    roundDialogOpen: boolean;
    editingRoundId?: number;

    // Speech panel states
    speechPanelOpen: boolean;
    selectedSpeech: string;
    speechPanelViewMode: ViewMode;
    speechPanelQuoteView: boolean;

    // Mobile navigation state
    mobileMenuOpen: boolean;
    isMobile: boolean;

    // Split mode states
    splitMode: boolean;
    splitSpeech1: string;
    splitSpeech2: string;
    splitViewMode1: ViewMode;
    splitViewMode2: ViewMode;
    splitQuoteView1: boolean;
    splitQuoteView2: boolean;
    splitWidth: number;
}

/**
 * Actions for updating debate flow state
 */
export interface DebateFlowActions {
    setSettingsOpen: (open: boolean) => void;
    setHistoryDialogOpen: (open: boolean) => void;
    setRoundDialogOpen: (open: boolean) => void;
    setEditingRoundId: (id: number | undefined) => void;

    setSpeechPanelOpen: (open: boolean) => void;
    setSelectedSpeech: (speech: string) => void;
    setSpeechPanelViewMode: (mode: ViewMode) => void;
    setSpeechPanelQuoteView: (view: boolean) => void;

    setMobileMenuOpen: (open: boolean) => void;
    setIsMobile: (mobile: boolean) => void;

    setSplitMode: (mode: boolean) => void;
    setSplitSpeech1: (speech: string) => void;
    setSplitSpeech2: (speech: string) => void;
    setSplitViewMode1: (mode: ViewMode) => void;
    setSplitViewMode2: (mode: ViewMode) => void;
    setSplitQuoteView1: (view: boolean) => void;
    setSplitQuoteView2: (view: boolean) => void;
    setSplitWidth: (width: number) => void;
}
