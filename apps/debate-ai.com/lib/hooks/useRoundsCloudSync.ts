"use client"

/**
 * Cloud-persists FIAT rounds (packages/debate-round's zustand store, still
 * localStorage-backed at its core — see store.ts) to /api/rounds when signed
 * in. `useFlowStore` is exported from the `debate-round` package as a
 * bundle-wide singleton, so this hook reads/writes the exact same store
 * instance DebateRoundPanel uses internally — no prop drilling, no changes
 * needed inside packages/debate-round.
 *
 * Anonymous/offline behavior is unchanged: the store's own localStorage
 * persistence (setRounds) keeps working regardless of sign-in state; this
 * hook only adds a debounced mirror to SQL on top of it.
 */

import { useEffect, useRef, useState } from "react"
import { useFlowStore } from "debate-round"
import { useSession } from "./useSession"

export type RoundSyncStatus = "idle" | "saving" | "saved" | "error" | "signed-out"

const DEBOUNCE_MS = 500

interface CloudRoundSummary {
  id: number
  title: string
  format: string | null
}

export function useRoundsCloudSync(): { status: RoundSyncStatus } {
  const { isAuthenticated, isLoading } = useSession()
  const [status, setStatus] = useState<RoundSyncStatus>("idle")
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>())
  const hydrated = useRef(false)

  // One-time hydration: pull any cloud rounds this device doesn't have yet
  // (e.g. a round saved from another device, or before this browser's
  // localStorage was cleared) into the local store on sign-in.
  useEffect(() => {
    if (isLoading || !isAuthenticated || hydrated.current) return
    hydrated.current = true

    void (async () => {
      try {
        const res = await fetch("/api/rounds")
        if (!res.ok) return
        const cloudSummaries: CloudRoundSummary[] = await res.json()
        if (cloudSummaries.length === 0) return

        const store = useFlowStore.getState()
        const localRounds = store.getRounds()
        const localIds = new Set(localRounds.map((r) => r.id))
        const missing = cloudSummaries.filter((c) => !localIds.has(c.id))
        if (missing.length === 0) return

        const fetched = await Promise.all(
          missing.map(async (c) => {
            const r = await fetch(`/api/rounds/${c.id}`)
            return r.ok ? r.json() : null
          }),
        )

        const rows = fetched.filter((row): row is { data: { round: any; flows: any[] } } => !!row)
        if (rows.length === 0) return

        store.setRounds([...localRounds, ...rows.map((row) => row.data.round)])
        store.setFlows([...store.flows, ...rows.flatMap((row) => row.data.flows)])
      } catch {
        // Best-effort hydration — local data stays authoritative on failure.
      }
    })()
  }, [isAuthenticated, isLoading])

  // Debounced push: whenever a round's metadata or any of its flows change,
  // upsert that round's full snapshot to /api/rounds.
  useEffect(() => {
    if (!isAuthenticated) {
      setStatus(isLoading ? "idle" : "signed-out")
      return
    }
    setStatus("idle")

    const push = (round: any, flowsForRound: any[]) => {
      const existing = timers.current.get(round.id)
      if (existing) clearTimeout(existing)

      timers.current.set(
        round.id,
        setTimeout(async () => {
          setStatus("saving")
          try {
            const res = await fetch("/api/rounds", {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({
                id: round.id,
                title: round.title || round.tournamentName || "Untitled Round",
                format: round.roundLevel ?? null,
                data: { round, flows: flowsForRound },
              }),
            })
            setStatus(res.ok ? "saved" : "error")
          } catch {
            setStatus("error")
          } finally {
            timers.current.delete(round.id)
          }
        }, DEBOUNCE_MS),
      )
    }

    const unsubscribe = useFlowStore.subscribe((state, prevState) => {
      if (state.rounds === prevState.rounds && state.flows === prevState.flows) return

      const prevFlowsById = new Map(prevState.flows.map((f) => [f.id, f]))
      const prevRoundsById = new Map(prevState.rounds.map((r) => [r.id, r]))

      for (const round of state.rounds) {
        const roundChanged = prevRoundsById.get(round.id) !== round
        const flowsForRound = state.flows.filter((f) => round.flowIds?.includes(f.id))
        const flowsChanged = flowsForRound.some((f) => prevFlowsById.get(f.id) !== f)
        if (roundChanged || flowsChanged) push(round, flowsForRound)
      }
    })

    const timersAtCleanup = timers.current
    return () => {
      unsubscribe()
      timersAtCleanup.forEach(clearTimeout)
      timersAtCleanup.clear()
    }
  }, [isAuthenticated, isLoading])

  return { status }
}
