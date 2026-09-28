"use client"

import { create } from "zustand"
import { History } from "./history"
import { addFlowHistoryEntry, flowFromHistoryEntry, readFlowHistory, writeFlowHistory } from "./flowHistoryEntries"
import type { Flow, Round } from "../types/flow"

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
  /** Restores a history entry as a new flow, selects it, and returns its index (null when the entry is gone). */
  loadFromHistory: (historyId: string) => number | null
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
      const history = readFlowHistory()
      const next = addFlowHistoryEntry(history, flow)
      if (next !== history) writeFlowHistory(next)
    } catch (error) {
      console.error("Failed to save to history:", error)
    }
  },
  getFlowHistory: () => {
    try {
      return readFlowHistory()
    } catch (error) {
      console.error("Failed to load history:", error)
      return []
    }
  },
  loadFromHistory: (historyId: string) => {
    const entry = get().getFlowHistory().find((h) => h.id === historyId)
    if (!entry) return null
    const flows = get().flows
    // Restored as a fresh, un-archived flow and opened right away.
    const newFlow = flowFromHistoryEntry(entry, flows.length)
    set({ flows: [...flows, newFlow], selected: flows.length })
    get().flowsChange(true)
    return flows.length
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
    // Date.now() alone can collide when two rounds are created within the
    // same millisecond (e.g. importing/creating several in a tight loop) —
    // guard against that so updateRound/deleteRound never match more than
    // the one round they're meant to.
    const existingIds = new Set(get().rounds.map((r) => r.id))
    let id = Date.now()
    while (existingIds.has(id)) {
      id += 1
    }
    const newRound: Round = {
      ...round,
      id,
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
      if (typeof window === "undefined") return []
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
