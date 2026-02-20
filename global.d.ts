export {};
declare global {
  type Flow = {
    content: string;
    level: number;
    columns: string[];
    invert: boolean;
    focus: boolean;
    index: number;
    lastFocus: number[];
    children: Box[];
    id: number;
    speechDocs?: Record<string, string>;
    sharedSpeeches?: Record<string, { timestamp: number; emails: string[] }>;
    archived?: boolean;
    roundId?: number;
    speechNumber?: number;
    winner?: "aff" | "neg" | "undecided";
  };

  type Round = {
    id: number;
    tournamentName: string;
    roundLevel: string;
    debaters: {
      aff: [string, string];
      neg: [string, string];
    };
    schools?: {
      aff: [string, string];
      neg: [string, string];
    };
    judges: string[];
    flowIds: number[];
    timestamp: number;
    status: "pending" | "active" | "completed";
    isPublic?: boolean;
    winner?: "aff" | "neg";
  };

  type Box = {
    content: string;
    children: Box[];
    index: number;
    level: number;
    focus: boolean;
    empty?: boolean;
    placeholder?: string;
    crossed?: boolean;
  };

  type TimerState = {
    resetTime: number;
    time: number;
    state:
      | { name: "paused" }
      | { name: "running"; startTime: number }
      | { name: "done" };
  };

  type SpeechTimerState = {
    resetTimeIndex: number;
    time: number;
    state:
      | { name: "paused" }
      | { name: "running"; startTime: number }
      | { name: "done" };
  };

  type TimerSpeech = {
    name: string;
    time: number;
    secondary: boolean;
  };

  type DebateStyleFlow = {
    name: string;
    columns: string[];
    columnsSwitch?: string[];
    invert: boolean;
    starterBoxes?: string[];
  };

  type DebateStyle = {
    primary: DebateStyleFlow;
    secondary?: DebateStyleFlow;
    timerSpeeches: TimerSpeech[];
    prepTime?: number;
  };

  type Setting = ToggleSetting | RadioSetting | SliderSetting;

  type SettingBasic<T> = {
    name: string;
    value: T;
    auto: T;
    type: string;
    info?: string;
  };

  type ToggleSetting = SettingBasic<boolean> & {
    type: "toggle";
  };

  type RadioSetting = SettingBasic<number> & {
    type: "radio";
    detail: {
      options: string[];
      customOption?: boolean;
      customOptionValue?: string;
    };
  };

  type SliderSetting = SettingBasic<number> & {
    type: "slider";
    detail: {
      min: number;
      max: number;
      step: number;
      hue?: boolean;
    };
  };

  // Flow Page Types
  /**
   * View modes for markdown content display
   * Controls how speech document content is rendered
   */
  type ViewMode =
    | "read"
    | "highlighted"
    | "underlined"
    | "headings"
    | "h1-only"
    | "h2-only"
    | "h3-only"
    | "summaries-only";

  /**
   * State for the debate flow page
   */
  interface DebateFlowState {
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
  interface DebateFlowActions {
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
}
