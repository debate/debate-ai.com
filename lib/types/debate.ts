export type Box = {
    content: string;
    children: Box[];
    index: number;
    level: number;
    focus: boolean;
    empty?: boolean;
    placeholder?: string;
    crossed?: boolean;
};

export type Flow = {
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

export type Round = {
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
    spectators?: string[];
    flowIds: number[];
    timestamp: number;
    status: "pending" | "active" | "completed";
    isPrivate?: boolean;
    winner?: "aff" | "neg";
};

export type TimerState = {
    resetTime: number;
    time: number;
    state:
    | { name: "paused" }
    | { name: "running"; startTime: number }
    | { name: "done" };
};

export type SpeechTimerState = {
    resetTimeIndex: number;
    time: number;
    state:
    | { name: "paused" }
    | { name: "running"; startTime: number }
    | { name: "done" };
};

export type TimerSpeech = {
    name: string;
    time: number;
    secondary: boolean;
    speaker?: string;
    cxRoles?: { questioner: string; answerer: string };
};

export type DebateStyleFlow = {
    name: string;
    columns: string[];
    columnsSwitch?: string[];
    invert: boolean;
    starterBoxes?: string[];
};

export type DebateStyle = {
    primary: DebateStyleFlow;
    secondary?: DebateStyleFlow;
    timerSpeeches: TimerSpeech[];
    prepTime?: number;
};
