// Flow Box - represents a node in the argument tree
export interface Box {
  content: string;
  children: Box[];
  index: number;
  level: number;
  focus?: boolean;
  empty?: boolean;
  crossed?: boolean;
  placeholder?: string;
}

// Flow - represents a complete debate flow
export interface Flow {
  id: string;
  name: string;
  content: string;
  level: number;
  columns: string[]; // Column headers
  invert: boolean; // Alternating colors
  focus: boolean;
  index: number;
  lastFocus: number[]; // Path to last focused box
  children: Box[];
  debateStyle?: string;
}

// Timer State
export type TimeState =
  | { name: "running"; startTime: number; ogTime: number }
  | { name: "paused" };

export interface TimerState {
  resetTime: number;
  time: number;
  state: TimeState;
}

export interface SpeechTimerState {
  resetTimeIndex: number;
  time: number;
  state: TimeState;
}

export interface TimerSpeech {
  name: string;
  time: number;
  secondary: boolean;
}

// Debate Styles
export interface DebateStyle {
  name: string;
  primary: SpeechFormat | null;
  secondary: SpeechFormat | null;
}

export interface SpeechFormat {
  columns: string[];
  columnsSwitch?: string[];
  invert: boolean;
  starterBoxes?: string[];
}

// Common debate formats
export const debateStyles: DebateStyle[] = [
  {
    name: "Policy Debate",
    primary: {
      columns: ["1AC", "1NC", "2AC", "2NC", "1AR", "2NR", "2AR"],
      invert: false,
      starterBoxes: ["Harm", "Inherency", "Solvency", "Advantage"],
    },
    secondary: {
      columns: ["1NC", "1AR", "2NR", "2AR"],
      invert: true,
    },
  },
  {
    name: "Lincoln-Douglas",
    primary: {
      columns: ["AC", "NC", "1AR", "1NR", "2AR", "2NR"],
      invert: false,
    },
    secondary: {
      columns: ["NC", "1AR", "1NR", "2AR"],
      invert: true,
    },
  },
  {
    name: "Public Forum",
    primary: {
      columns: ["Team A", "Team B", "Summary A", "Summary B", "Final A", "Final B"],
      invert: false,
    },
    secondary: {
      columns: ["Team B", "Summary A", "Summary B", "Final A", "Final B"],
      invert: true,
    },
  },
  {
    name: "Custom",
    primary: {
      columns: ["Speech 1", "Speech 2", "Speech 3"],
      invert: false,
    },
    secondary: null,
  },
];

// Speech timer presets
export const standardTimerPresets: Record<string, TimerSpeech[]> = {
  "Policy Debate": [
    { name: "1AC", time: 480, secondary: false },
    { name: "CX", time: 180, secondary: true },
    { name: "1NC", time: 480, secondary: false },
    { name: "CX", time: 180, secondary: true },
    { name: "2AC", time: 480, secondary: false },
    { name: "CX", time: 180, secondary: true },
    { name: "2NC", time: 480, secondary: false },
    { name: "CX", time: 180, secondary: true },
    { name: "1NR", time: 300, secondary: false },
    { name: "1AR", time: 300, secondary: false },
    { name: "2NR", time: 300, secondary: false },
    { name: "2AR", time: 300, secondary: false },
  ],
  "Lincoln-Douglas": [
    { name: "AC", time: 360, secondary: false },
    { name: "CX", time: 180, secondary: true },
    { name: "NC", time: 420, secondary: false },
    { name: "CX", time: 180, secondary: true },
    { name: "1AR", time: 240, secondary: false },
    { name: "1NR", time: 360, secondary: false },
    { name: "2AR", time: 180, secondary: false },
  ],
  "Public Forum": [
    { name: "Team A", time: 240, secondary: false },
    { name: "Team B", time: 240, secondary: false },
    { name: "Crossfire", time: 180, secondary: true },
    { name: "Summary A", time: 180, secondary: false },
    { name: "Summary B", time: 180, secondary: false },
    { name: "Grand Crossfire", time: 180, secondary: true },
    { name: "Final A", time: 120, secondary: false },
    { name: "Final B", time: 120, secondary: false },
  ],
};
