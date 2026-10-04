/** Shared fields of every setting in the round workspace's settings panel. */
export type SettingBasic<T> = {
  /** Label shown beside the control. */
  name: string;
  /** The value the user has chosen. */
  value: T;
  /** The value used when the user has not chosen one. */
  auto: T;
  /** Which control renders the setting: "toggle", "radio" or "slider". */
  type: string;
  /** Help text shown under the label. */
  info?: string;
};

/** An on/off setting. */
export type ToggleSetting = SettingBasic<boolean> & {
  type: "toggle";
};

/** A pick-one setting; `value` is the index of the chosen option. */
export type RadioSetting = SettingBasic<number> & {
  type: "radio";
  /** The options the control offers. */
  detail: {
    /** Option labels, in display order. */
    options: string[];
    /** True when the user may type their own option. */
    customOption?: boolean;
    /** The text of the user's own option, when they typed one. */
    customOptionValue?: string;
  };
};

/** A numeric range setting. */
export type SliderSetting = SettingBasic<number> & {
  type: "slider";
  /** The range the slider covers. */
  detail: {
    /** Lowest value. */
    min: number;
    /** Highest value. */
    max: number;
    /** Distance between selectable values. */
    step: number;
    /** True when the slider picks a colour hue rather than a plain number. */
    hue?: boolean;
  };
};

/** Any one setting. */
export type Setting = ToggleSetting | RadioSetting | SliderSetting;

/**
 * View modes for markdown content display
 * Controls how speech document content is rendered
 */
export type ViewMode =
  /** Show the whole document. */
  | "read"
  /** Show only highlighted text. */
  | "highlighted"
  /** Show only underlined text. */
  | "underlined"
  /** Show headings of every level. */
  | "headings"
  /** Show top-level headings only. */
  | "h1-only"
  /** Show headings down to the second level. */
  | "h2-only"
  /** Show headings down to the third level. */
  | "h3-only"
  /** Show only each card's summary line. */
  | "summaries-only"
  /** Show only the quoted card text. */
  | "quotes";

/** State for the debate flow page. */
export interface DebateFlowState {
  /** Whether the settings dialog is open. */
  settingsOpen: boolean;
  /** Whether the round-history dialog is open. */
  historyDialogOpen: boolean;
  /** Whether the create/edit round dialog is open. */
  roundDialogOpen: boolean;
  /** Id of the round being edited in the round dialog; absent when creating a new one. */
  editingRoundId?: number;

  /** Whether the speech-document panel is open. */
  speechPanelOpen: boolean;
  /** Name of the speech shown in the panel, e.g. "1AC". */
  selectedSpeech: string;
  /** How the panel renders the speech document. */
  speechPanelViewMode: ViewMode;
  /** Whether the panel shows quotes only. */
  speechPanelQuoteView: boolean;

  /** Whether the mobile navigation menu is open. */
  mobileMenuOpen: boolean;
  /** Whether the viewport is treated as a phone. */
  isMobile: boolean;

  /** Whether two speech panels show side by side. */
  splitMode: boolean;
  /** When true, split mode shows one speech at a time instead of both side-by-side. */
  singlePaneMode: boolean;
  /** Name of the speech in the left pane. */
  splitSpeech1: string;
  /** Name of the speech in the right pane. */
  splitSpeech2: string;
  /** View mode of the left pane. */
  splitViewMode1: ViewMode;
  /** View mode of the right pane. */
  splitViewMode2: ViewMode;
  /** Whether the left pane shows quotes only. */
  splitQuoteView1: boolean;
  /** Whether the right pane shows quotes only. */
  splitQuoteView2: boolean;
  /** Width of the left pane as a percentage of the split. */
  splitWidth: number;
}

/** Actions for updating debate flow state. */
export interface DebateFlowActions {
  /** Open or close the settings dialog. */
  setSettingsOpen: (open: boolean) => void;
  /** Open or close the round-history dialog. */
  setHistoryDialogOpen: (open: boolean) => void;
  /** Open or close the round dialog. */
  setRoundDialogOpen: (open: boolean) => void;
  /** Choose the round to edit, or `undefined` to create a new one. */
  setEditingRoundId: (id: number | undefined) => void;

  /** Open or close the speech panel. */
  setSpeechPanelOpen: (open: boolean) => void;
  /** Choose the speech shown in the panel. */
  setSelectedSpeech: (speech: string) => void;
  /** Choose how the panel renders the speech. */
  setSpeechPanelViewMode: (mode: ViewMode) => void;
  /** Toggle quote-only view in the panel. */
  setSpeechPanelQuoteView: (view: boolean) => void;

  /** Open or close the mobile menu. */
  setMobileMenuOpen: (open: boolean) => void;
  /** Record whether the viewport is a phone. */
  setIsMobile: (mobile: boolean) => void;

  /** Turn split mode on or off. */
  setSplitMode: (mode: boolean) => void;
  /** Switch between one pane and two in split mode. */
  setSinglePaneMode: (single: boolean) => void;
  /** Choose the speech in the left pane. */
  setSplitSpeech1: (speech: string) => void;
  /** Choose the speech in the right pane. */
  setSplitSpeech2: (speech: string) => void;
  /** Choose the left pane's view mode. */
  setSplitViewMode1: (mode: ViewMode) => void;
  /** Choose the right pane's view mode. */
  setSplitViewMode2: (mode: ViewMode) => void;
  /** Toggle quote-only view in the left pane. */
  setSplitQuoteView1: (view: boolean) => void;
  /** Toggle quote-only view in the right pane. */
  setSplitQuoteView2: (view: boolean) => void;
  /** Set the left pane's width. */
  setSplitWidth: (width: number) => void;
}
