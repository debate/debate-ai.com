export type Box = {
  content: string
  children: Box[]
  index: number
  level: number
  focus: boolean
  empty?: boolean
  placeholder?: string
  crossed?: boolean
}

export type Flow = {
  content: string
  level: number
  columns: string[]
  invert: boolean
  focus: boolean
  index: number
  lastFocus: number[]
  children: Box[]
  id: number
  speechDocs?: Record<string, string>
  sharedSpeeches?: Record<string, { timestamp: number; emails: string[] }>
  archived?: boolean
  roundId?: number
  speechNumber?: number
  winner?: "aff" | "neg" | "undecided"
}

export type Round = {
  id: number
  tournamentName: string
  roundLevel: string
  debaters: {
    aff: [string, string]
    neg: [string, string]
  }
  schools?: {
    aff: [string, string]
    neg: [string, string]
  }
  judges: string[]
  spectators?: string[]
  flowIds: number[]
  timestamp: number
  status: "pending" | "active" | "completed"
  isPrivate?: boolean
  winner?: "aff" | "neg"
}
