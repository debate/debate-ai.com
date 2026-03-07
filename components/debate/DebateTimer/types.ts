export type TimerState = {
  resetTime: number
  time: number
  state:
    | { name: "paused" }
    | { name: "running"; startTime: number }
    | { name: "done" }
}

export type SpeechTimerState = {
  resetTimeIndex: number
  time: number
  state:
    | { name: "paused" }
    | { name: "running"; startTime: number }
    | { name: "done" }
}

export type TimerSpeech = {
  name: string
  time: number
  secondary: boolean
  speaker?: string
  cxRoles?: { questioner: string; answerer: string }
}

export type DebateStyleFlow = {
  name: string
  columns: string[]
  columnsSwitch?: string[]
  invert: boolean
  starterBoxes?: string[]
}

export type DebateStyle = {
  primary: DebateStyleFlow
  secondary?: DebateStyleFlow
  timerSpeeches: TimerSpeech[]
  prepTime?: number
}
