"use client"

import { create } from "zustand"
import { History } from "./history"

const historyMap = new Map<number, History>()

export interface FlowHistory {
  id: string
  flow: Flow
  timestamp: number
  label: string
}

interface FlowStore {
  flows: Flow[]
  selected: number
  activeMouse: boolean
  rounds: Round[]
  setFlows: (flows: Flow[]) => void
  setSelected: (selected: number) => void
  setActiveMouse: (active: boolean) => void
  flowsChange: (saveToHistory?: boolean) => void
  getHistory: (flowId: number) => History
  saveToHistory: (flow: Flow) => void
  getFlowHistory: () => FlowHistory[]
  loadFromHistory: (historyId: string) => void
  setRounds: (rounds: Round[]) => void
  createRound: (round: Omit<Round, "id" | "timestamp">) => Round
  updateRound: (id: number, updates: Partial<Round>) => void
  deleteRound: (id: number) => void
  getRounds: () => Round[]
}

export const useFlowStore = create<FlowStore>((set, get) => ({
  flows: [],
  selected: 0,
  activeMouse: true,
  rounds: [],
  setFlows: (flows) => set({ flows }),
  setSelected: (selected) => {
    set({ selected })
    const flow = get().flows[selected]
    if (flow) {
      get().saveToHistory(flow)
    }
  },
  setActiveMouse: (activeMouse) => set({ activeMouse }),
  flowsChange: (saveToHistory = true) => {
    // Only save to history, don't trigger re-renders
    const current = get().flows[get().selected]
    if (current && saveToHistory) {
      get().saveToHistory(current)
    }
  },
  getHistory: (flowId: number) => {
    if (!historyMap.has(flowId)) {
      const flow = get().flows.find((f) => f.id === flowId)
      if (flow) {
        historyMap.set(flowId, new History(flow))
      }
    }
    return historyMap.get(flowId)!
  },
  saveToHistory: (flow: Flow) => {
    try {
      const historyKey = "flow-history"
      const existingHistory = localStorage.getItem(historyKey)
      const history: FlowHistory[] = existingHistory ? JSON.parse(existingHistory) : []

      const historyEntry: FlowHistory = {
        id: `${flow.id}-${Date.now()}`,
        flow: JSON.parse(JSON.stringify(flow)),
        timestamp: Date.now(),
        label: flow.content || "Untitled Flow",
      }

      history.unshift(historyEntry)

      // Keep only last 20 entries (reduced from 50 to save storage)
      const MAX_HISTORY_ENTRIES = 20
      const trimmedHistory = history.slice(0, MAX_HISTORY_ENTRIES)

      try {
        localStorage.setItem(historyKey, JSON.stringify(trimmedHistory))
      } catch (storageError) {
        if (storageError instanceof DOMException && storageError.name === "QuotaExceededError") {
          // If quota exceeded, try with even fewer entries
          console.warn("Flow history quota exceeded, reducing to 10 entries...")
          const reducedHistory = history.slice(0, 10)
          try {
            localStorage.setItem(historyKey, JSON.stringify(reducedHistory))
          } catch (retryError) {
            // If still failing, clear history entirely
            console.error("Unable to save flow history, clearing all history...")
            localStorage.removeItem(historyKey)
          }
        } else {
          throw storageError
        }
      }
    } catch (error) {
      console.error("Failed to save to history:", error)
    }
  },
  getFlowHistory: () => {
    try {
      const historyKey = "flow-history"
      const existingHistory = localStorage.getItem(historyKey)
      return existingHistory ? JSON.parse(existingHistory) : []
    } catch (error) {
      console.error("Failed to load history:", error)
      return []
    }
  },
  loadFromHistory: (historyId: string) => {
    const history = get().getFlowHistory()
    const entry = history.find((h) => h.id === historyId)
    if (entry) {
      const flows = get().flows
      const newFlow = { ...entry.flow, id: Date.now(), index: flows.length }
      set({ flows: [...flows, newFlow], selected: flows.length })
      get().flowsChange(true)
    }
  },
  setRounds: (rounds) => {
    set({ rounds })
    try {
      localStorage.setItem("rounds", JSON.stringify(rounds))
    } catch (error) {
      if (error instanceof DOMException && error.name === "QuotaExceededError") {
        console.error("Quota exceeded when saving rounds. Please free up storage space.")
        alert("Storage quota exceeded! Unable to save round data. Please delete some old flows or history.")
      } else {
        console.error("Failed to save rounds:", error)
      }
    }
  },
  createRound: (round) => {
    const newRound: Round = {
      ...round,
      id: Date.now(),
      timestamp: Date.now(),
    }
    const rounds = [...get().rounds, newRound]
    get().setRounds(rounds)
    return newRound
  },
  updateRound: (id, updates) => {
    const rounds = get().rounds.map((r) => (r.id === id ? { ...r, ...updates } : r))
    get().setRounds(rounds)
  },
  deleteRound: (id) => {
    const rounds = get().rounds.filter((r) => r.id !== id)
    get().setRounds(rounds)
  },
  getRounds: () => {
    try {
      const storedRounds = localStorage.getItem("rounds")
      return storedRounds ? JSON.parse(storedRounds) : []
    } catch (error) {
      console.error("Failed to load rounds:", error)
      return []
    }
  },
}))

export const clearHistory = (flowId: number) => {
  historyMap.delete(flowId)
}
