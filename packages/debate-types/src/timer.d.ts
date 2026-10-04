/** Where a countdown is in its life. Shared by every timer's `state` field. */
export type TimerRunState =
  /** Stopped with time left on the clock; resuming continues from `time`. */
  | { name: "paused" }
  /** Counting down. */
  | {
      name: "running";
      /** Wall-clock time (epoch ms) the clock last started, used to work out elapsed time. */
      startTime: number;
    }
  /** Reached zero. */
  | { name: "done" };

/** A single countdown, such as one side's prep time. */
export type TimerState = {
  /** Seconds the timer returns to when reset. */
  resetTime: number;
  /** Seconds currently left. */
  time: number;
  /** Whether the timer is paused, running or finished. */
  state: TimerRunState;
};

/** The speech countdown, which steps through a format's list of speeches. */
export type SpeechTimerState = {
  /** Index into the format's `timerSpeeches` that a reset returns to. */
  resetTimeIndex: number;
  /** Seconds currently left in the speech. */
  time: number;
  /** Whether the speech clock is paused, running or finished. */
  state: TimerRunState;
};

/** One speech slot in a format, such as "1AC" or a cross-examination. */
export type TimerSpeech = {
  /** Short label shown on the timer, e.g. "1AC". */
  name: string;
  /** Length of the speech in seconds. */
  time: number;
  /** True for a cross-examination or other non-constructive period. */
  secondary: boolean;
  /** Which debater gives this speech, when the format assigns speakers. */
  speaker?: string;
  /** For a cross-examination, who asks and who answers. */
  cxRoles?: {
    /** Name of the debater asking the questions. */
    questioner: string;
    /** Name of the debater answering them. */
    answerer: string;
  };
};

/** The shape of the flow grid a format uses. */
export type DebateStyleFlow = {
  /** Display name of the flow layout, e.g. "Policy". */
  name: string;
  /** Column headings, one per speech, in speaking order. */
  columns: string[];
  /** Alternate column headings used after the sides switch. */
  columnsSwitch?: string[];
  /** True when the opposing side's columns are drawn first. */
  invert: boolean;
  /** Rows pre-filled in a new flow, such as "Observations". */
  starterBoxes?: string[];
};

/** A complete debate format: its flow layout, its speeches and its prep time. */
export type DebateStyle = {
  /** The main flow layout. */
  primary: DebateStyleFlow;
  /** A second flow layout, for formats that flow on two sheets. */
  secondary?: DebateStyleFlow;
  /** Every speech and cross-examination in speaking order. */
  timerSpeeches: TimerSpeech[];
  /** Prep time per side in seconds, when the format has any. */
  prepTime?: number;
};
