"use client"

/**
 * @fileoverview Flow History Dialog Component
 *
 * Displays a searchable list of past rounds and their associated flows.
 * Allows users to:
 * - Browse historical rounds with tournament info
 * - Search by tournament name, debaters, schools, or judges
 * - Load flows from a specific round
 * - Edit round details
 * - Create new rounds
 *
 * @module components/debate/dialogs/FlowHistoryDialog
 */

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/primitives/dialog"
import { Button } from "../ui/primitives/button"
import { ScrollArea } from "../ui/primitives/scroll-area"
import { Input } from "../ui/primitives/input"
import { useFlowStore, type FlowHistory } from "../state/store"
import type { Flow, Round } from "../types/flow"
import { Clock, FileText, Users, Edit, Gavel, Search, Cloud, UploadCloud, Download, Trash2, Loader2, CloudUpload } from "lucide-react"
import { deleteSavedFlow, fetchSavedFlow, listSavedFlows, saveFlowToAccount } from "../round/saved-flows-client"
import type { SavedFlowSummary } from "../state/savedFlows"
import { deleteSavedRound, fetchSavedRound, listSavedRounds, saveRoundToAccount } from "../round/saved-rounds-client"
import { deriveRoundLabel, type SavedRoundSummary } from "../state/savedRounds"
import {
  collectFlowsForRounds,
  collectUnreferencedFlows,
  mapFlowsToReferencingRound,
  summarizeBulkSaveOutcomes,
  type BulkSaveOutcome,
} from "../state/bulkRoundSave"
import { Badge } from "../ui/primitives/badge"

/** Load/error state for the "Saved to account" tab's flow list. */
type CloudListState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "loaded"; flows: SavedFlowSummary[] }
  | { kind: "error"; message: string }

/** Load/error state for the "Saved to account" tab's round list. */
type CloudRoundListState =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "loaded"; rounds: SavedRoundSummary[] }
  | { kind: "error"; message: string }

/** Per-flow/per-round save/load/remove status, keyed by the flow's/round's local `id`. */
type CloudActionStatus = "saving" | "saved" | "loading" | "removing" | "error"

/**
 * Round level ordering for sorting.
 * Higher index = more important round (Finals = highest).
 */
const ROUND_LEVELS = [
  "Prelim 1",
  "Prelim 2",
  "Prelim 3",
  "Prelim 4",
  "Prelim 5",
  "Prelim 6",
  "Prelim 7",
  "Prelim 8",
  "Triple Octafinals",
  "Double Octafinals",
  "Octafinals",
  "Quarterfinals",
  "Semifinals",
  "Finals",
]

/**
 * Get the rank of a round level for sorting purposes.
 *
 * @param roundLevel - The round level string to look up
 * @returns The rank index within ROUND_LEVELS, or -1 if not found
 */
function getRoundLevelRank(roundLevel: string): number {
  const index = ROUND_LEVELS.indexOf(roundLevel)
  return index === -1 ? -1 : index
}

/**
 * Props for the FlowHistoryDialog component
 */
interface FlowHistoryDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change dialog open state */
  onOpenChange: (open: boolean) => void
  /** Optional callback when user wants to edit a round */
  onEditRound?: (roundId: number) => void
  /** Optional callback when user wants to create a new round */
  onCreateRound?: () => void
}

/**
 * Structure for grouping history entries by date
 */
interface DateGroup {
  /** Formatted date string used as group key */
  dateKey: string
  /** History entries belonging to this date */
  entries: FlowHistory[]
  /** Whether this group is currently expanded */
  expanded: boolean
}

/**
 * FlowHistoryDialog - Browse and load historical rounds and flows
 *
 * Features:
 * - Search across tournament names, debaters, schools, judges, and flow names
 * - Visual display of team matchups with aff/neg color coding
 * - Quick access to individual flows within rounds
 * - Direct editing of round details
 *
 * @param props - Component props
 * @param props.open - Whether the dialog is open
 * @param props.onOpenChange - Callback to change dialog open state
 * @param props.onEditRound - Optional callback when user wants to edit a round
 * @param props.onCreateRound - Optional callback when user wants to create a new round
 * @returns The flow history dialog component
 *
 * @example
 * ```tsx
 * <FlowHistoryDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   onEditRound={(roundId) => openRoundEditor(roundId)}
 *   onCreateRound={() => openNewRoundDialog()}
 * />
 * ```
 */
export function FlowHistoryDialog({ open, onOpenChange, onEditRound, onCreateRound }: FlowHistoryDialogProps) {
  // Get store functions and state
  const {
    getFlowHistory,
    loadFromHistory,
    getRounds,
    flows,
    setFlows,
    setSelected,
    setRounds: updateRounds,
    deleteRound,
  } = useFlowStore()

  // Local state
  const [history, setHistory] = useState<FlowHistory[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<"rounds" | "cloud">("rounds")
  const [searchQuery, setSearchQuery] = useState("")
  const [cloudList, setCloudList] = useState<CloudListState>({ kind: "loading" })
  const [cloudActions, setCloudActions] = useState<Record<number, CloudActionStatus>>({})
  const [cloudRoundList, setCloudRoundList] = useState<CloudRoundListState>({ kind: "loading" })
  const [cloudRoundActions, setCloudRoundActions] = useState<Record<number, CloudActionStatus>>({})
  const [bulkSaveStatus, setBulkSaveStatus] = useState<"idle" | "saving" | "done">("idle")
  const [bulkSaveSummary, setBulkSaveSummary] = useState<{ savedCount: number; errorCount: number } | null>(null)
  const [bulkFlowSaveStatus, setBulkFlowSaveStatus] = useState<"idle" | "saving" | "done">("idle")
  const [bulkFlowSaveSummary, setBulkFlowSaveSummary] = useState<{ savedCount: number; errorCount: number } | null>(
    null,
  )

  /**
   * Load history and rounds when dialog opens.
   */
  useEffect(() => {
    if (open) {
      setHistory(getFlowHistory())
      setRounds(getRounds())
      setSearchQuery("") // Reset search when dialog opens
      setActiveTab("rounds")
      setCloudActions({})
      setCloudRoundActions({})
      setBulkSaveStatus("idle")
      setBulkSaveSummary(null)
      setBulkFlowSaveStatus("idle")
      setBulkFlowSaveSummary(null)
    }
  }, [open, getFlowHistory, getRounds])

  /**
   * Load the account's saved-flow summaries when the "Saved to account" tab
   * is opened. `listSavedFlows` resolves to `null` for a signed-out user
   * rather than throwing, which maps to the "signed-out" state below.
   */
  useEffect(() => {
    if (!open || activeTab !== "cloud") return
    let cancelled = false
    setCloudList({ kind: "loading" })

    listSavedFlows()
      .then((flows) => {
        if (cancelled) return
        setCloudList(flows === null ? { kind: "signed-out" } : { kind: "loaded", flows })
      })
      .catch((err) => {
        if (cancelled) return
        setCloudList({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to load your saved flows.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [open, activeTab])

  /**
   * Load the account's saved-round summaries when the "Saved to account"
   * tab is opened. Mirrors the `listSavedFlows` effect above.
   */
  useEffect(() => {
    if (!open || activeTab !== "cloud") return
    let cancelled = false
    setCloudRoundList({ kind: "loading" })

    listSavedRounds()
      .then((rounds) => {
        if (cancelled) return
        setCloudRoundList(rounds === null ? { kind: "signed-out" } : { kind: "loaded", rounds })
      })
      .catch((err) => {
        if (cancelled) return
        setCloudRoundList({
          kind: "error",
          message: err instanceof Error ? err.message : "Failed to load your saved rounds.",
        })
      })

    return () => {
      cancelled = true
    }
  }, [open, activeTab])

  /**
   * Saves a single flow to the signed-in user's account (upsert, keyed by
   * the flow's local `id`). A failed save is reported inline next to the
   * flow rather than blocking anything, since the flow already exists
   * locally either way.
   */
  const handleSaveFlowToAccount = async (flow: Flow) => {
    setCloudActions((prev) => ({ ...prev, [flow.id]: "saving" }))
    try {
      await saveFlowToAccount(flow)
      setCloudActions((prev) => ({ ...prev, [flow.id]: "saved" }))
    } catch {
      setCloudActions((prev) => ({ ...prev, [flow.id]: "error" }))
    }
  }

  /**
   * Loads a saved flow from the account into the local flow list —
   * replacing the local flow of the same id if one exists, or appending it
   * — then switches to it and closes the dialog.
   */
  const handleLoadCloudFlow = async (clientId: number) => {
    setCloudActions((prev) => ({ ...prev, [clientId]: "loading" }))
    try {
      const flow = await fetchSavedFlow(clientId)
      if (!flow) {
        setCloudActions((prev) => ({ ...prev, [clientId]: "error" }))
        return
      }
      const existingIndex = flows.findIndex((f) => f.id === flow.id)
      const newFlows = existingIndex === -1 ? [...flows, flow] : flows.map((f, i) => (i === existingIndex ? flow : f))
      setFlows(newFlows)
      setSelected(existingIndex === -1 ? newFlows.length - 1 : existingIndex)
      onOpenChange(false)
    } catch {
      setCloudActions((prev) => ({ ...prev, [clientId]: "error" }))
    }
  }

  /** Removes a saved flow from the account. Leaves the local flow untouched — this only deletes the cloud copy. */
  const handleRemoveCloudFlow = async (clientId: number) => {
    setCloudActions((prev) => ({ ...prev, [clientId]: "removing" }))
    try {
      await deleteSavedFlow(clientId)
      setCloudList((prev) =>
        prev.kind === "loaded" ? { kind: "loaded", flows: prev.flows.filter((f) => f.clientId !== clientId) } : prev,
      )
    } catch {
      setCloudActions((prev) => ({ ...prev, [clientId]: "error" }))
    }
  }

  /**
   * Saves a round to the account. A `Round` only references its flows
   * indirectly via `flowIds`, so this also saves each of the round's flows
   * that exist locally (reusing `handleSaveFlowToAccount`, which never
   * throws) before saving the round itself — otherwise a round loaded on
   * another device would have no flows to resolve `flowIds` against.
   */
  const handleSaveRoundToAccount = async (round: Round) => {
    setCloudRoundActions((prev) => ({ ...prev, [round.id]: "saving" }))
    const roundFlows = flows.filter((f) => round.flowIds.includes(f.id))
    await Promise.all(roundFlows.map((flow) => handleSaveFlowToAccount(flow)))
    try {
      await saveRoundToAccount(round)
      setCloudRoundActions((prev) => ({ ...prev, [round.id]: "saved" }))
    } catch {
      setCloudRoundActions((prev) => ({ ...prev, [round.id]: "error" }))
    }
  }

  /**
   * Saves every local round (and, transitively, every flow any of them
   * references) to the account in one action — closing the "no bulk 'save
   * all my rounds' action" gap `docs/features/round-cloud-save.md`
   * recorded, since before this a user had to click each round's own
   * cloud icon individually. Collects the deduplicated set of flows across
   * all rounds first (a flow shared by more than one round is only ever
   * PUT once) via `collectFlowsForRounds`, saves those, then saves each
   * round — both passes reuse the same per-flow/per-round status maps the
   * individual save buttons already render, so a round's icon updates in
   * place exactly as if it had been saved on its own. Best-effort per item:
   * one flow or round failing to save doesn't stop the others.
   */
  const handleSaveAllRoundsToAccount = async () => {
    if (rounds.length === 0 || bulkSaveStatus === "saving") return
    setBulkSaveStatus("saving")
    setBulkSaveSummary(null)

    const flowsToSave = collectFlowsForRounds(rounds, flows)
    await Promise.all(flowsToSave.map((flow) => handleSaveFlowToAccount(flow)))

    const outcomes: Record<number, BulkSaveOutcome> = {}
    await Promise.all(
      rounds.map(async (round) => {
        setCloudRoundActions((prev) => ({ ...prev, [round.id]: "saving" }))
        try {
          await saveRoundToAccount(round)
          setCloudRoundActions((prev) => ({ ...prev, [round.id]: "saved" }))
          outcomes[round.id] = "saved"
        } catch {
          setCloudRoundActions((prev) => ({ ...prev, [round.id]: "error" }))
          outcomes[round.id] = "error"
        }
      }),
    )

    setBulkSaveSummary(summarizeBulkSaveOutcomes(outcomes))
    setBulkSaveStatus("done")
  }

  /**
   * Saves every locally-available flow that no round references to the
   * account in one action — closing the "a flow with no round referencing
   * it still has no bulk path" gap `docs/features/flow-cloud-save.md`
   * recorded once "Save all rounds" (above) closed the common case. Mirrors
   * that action's shape exactly, just over `collectUnreferencedFlows`'s
   * result instead of `collectFlowsForRounds`'s.
   */
  const handleSaveUnreferencedFlowsToAccount = async () => {
    const unreferencedFlows = collectUnreferencedFlows(rounds, flows)
    if (unreferencedFlows.length === 0 || bulkFlowSaveStatus === "saving") return
    setBulkFlowSaveStatus("saving")
    setBulkFlowSaveSummary(null)

    const outcomes: Record<number, BulkSaveOutcome> = {}
    await Promise.all(
      unreferencedFlows.map(async (flow) => {
        setCloudActions((prev) => ({ ...prev, [flow.id]: "saving" }))
        try {
          await saveFlowToAccount(flow)
          setCloudActions((prev) => ({ ...prev, [flow.id]: "saved" }))
          outcomes[flow.id] = "saved"
        } catch {
          setCloudActions((prev) => ({ ...prev, [flow.id]: "error" }))
          outcomes[flow.id] = "error"
        }
      }),
    )

    setBulkFlowSaveSummary(summarizeBulkSaveOutcomes(outcomes))
    setBulkFlowSaveStatus("done")
  }

  /**
   * Loads a saved round from the account — upserting it into the local
   * rounds list — then resolves its `flowIds` against the account's saved
   * flows, merging in whichever of them aren't already present locally (a
   * flow referenced by `flowIds` that was never saved to the account is
   * simply skipped), then switches to the round's flows and closes the
   * dialog.
   */
  const handleLoadCloudRound = async (clientId: number) => {
    setCloudRoundActions((prev) => ({ ...prev, [clientId]: "loading" }))
    try {
      const round = await fetchSavedRound(clientId)
      if (!round) {
        setCloudRoundActions((prev) => ({ ...prev, [clientId]: "error" }))
        return
      }

      const missingFlowIds = round.flowIds.filter((id) => !flows.some((f) => f.id === id))
      const fetchedFlows = (await Promise.all(missingFlowIds.map((id) => fetchSavedFlow(id)))).filter(
        (f): f is Flow => f !== null,
      )
      const mergedFlows = fetchedFlows.length > 0 ? [...flows, ...fetchedFlows] : flows
      if (fetchedFlows.length > 0) setFlows(mergedFlows)

      const existingIndex = rounds.findIndex((r) => r.id === round.id)
      const newRounds =
        existingIndex === -1 ? [...rounds, round] : rounds.map((r, i) => (i === existingIndex ? round : r))
      setRounds(newRounds)
      updateRounds(newRounds)

      handleLoadRoundFlows(round, mergedFlows)
    } catch {
      setCloudRoundActions((prev) => ({ ...prev, [clientId]: "error" }))
    }
  }

  /** Removes a saved round from the account. Leaves the local round (and its flows) untouched. */
  const handleRemoveCloudRound = async (clientId: number) => {
    setCloudRoundActions((prev) => ({ ...prev, [clientId]: "removing" }))
    try {
      await deleteSavedRound(clientId)
      setCloudRoundList((prev) =>
        prev.kind === "loaded"
          ? { kind: "loaded", rounds: prev.rounds.filter((r) => r.clientId !== clientId) }
          : prev,
      )
    } catch {
      setCloudRoundActions((prev) => ({ ...prev, [clientId]: "error" }))
    }
  }

  /**
   * Deletes a round from this browser only, after a confirm prompt — the
   * store's `deleteRound` action already existed but had no caller anywhere
   * in the app (`docs/features/round-cloud-save.md`'s "no UI for deleting a
   * local round" Known gap). Mirrors `handleRemoveCloudRound`'s scope in
   * reverse: this never touches any cloud-saved copy of the round, and
   * never deletes the round's flows (a flow still exists locally, and
   * cloud-save-eligible via "Save flows not in a round", after its last
   * referencing round is deleted this way).
   */
  const handleDeleteLocalRound = (round: Round) => {
    const label = round.tournamentName ? `${round.tournamentName} — ${round.roundLevel}` : round.roundLevel
    if (!confirm(`Delete "${label}" from this browser? Any copy saved to your account is not affected.`)) return
    deleteRound(round.id)
    setRounds((prev) => prev.filter((r) => r.id !== round.id))
  }

  /** Count of locally-available flows no round references, for the "Save flows not in a round" button's visibility/label. */
  const unreferencedFlowCount = useMemo(() => collectUnreferencedFlows(rounds, flows).length, [rounds, flows])

  /** Maps a flow id to the local round that references it, so a cascade-saved flow can be badged with its round in the "Saved to account" tab. */
  const flowIdToReferencingRound = useMemo(() => mapFlowsToReferencingRound(rounds), [rounds])

  /**
   * Filter rounds based on search query.
   * Searches in: tournament name, round level, debaters, schools, judges, flow names.
   */
  const filteredRounds = useMemo(() => {
    if (!searchQuery.trim()) return rounds

    const query = searchQuery.toLowerCase()
    return rounds.filter((round) => {
      // Search in tournament name
      if (round.tournamentName.toLowerCase().includes(query)) return true

      // Search in round level
      if (round.roundLevel.toLowerCase().includes(query)) return true

      // Search in debater emails and schools
      const affDebaters = [...round.debaters.aff, ...(round.schools?.aff || [])].filter(Boolean).join(" ").toLowerCase()
      const negDebaters = [...round.debaters.neg, ...(round.schools?.neg || [])].filter(Boolean).join(" ").toLowerCase()
      if (affDebaters.includes(query) || negDebaters.includes(query)) return true

      // Search in judges
      const judges = round.judges.filter(Boolean).join(" ").toLowerCase()
      if (judges.includes(query)) return true

      // Search in flow names
      const roundFlows = flows.filter((f) => round.flowIds.includes(f.id))
      const flowNames = roundFlows.map((f) => f.content).join(" ").toLowerCase()
      if (flowNames.includes(query)) return true

      return false
    })
  }, [rounds, searchQuery, flows])

  /**
   * Group history entries by date for organized display.
   */
  const dateGroups = useMemo(() => {
    const groups: Record<string, FlowHistory[]> = {}

    history.forEach((entry) => {
      const date = new Date(entry.timestamp)
      const dateKey = date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })

      if (!groups[dateKey]) {
        groups[dateKey] = []
      }
      groups[dateKey].push(entry)
    })

    return Object.entries(groups).map(([dateKey, entries]) => ({
      dateKey,
      entries,
      expanded: expandedDates.has(dateKey),
    }))
  }, [history, expandedDates])

  /**
   * Expand all date groups when dialog opens.
   */
  useEffect(() => {
    if (open && dateGroups.length > 0) {
      setExpandedDates(new Set(dateGroups.map((g) => g.dateKey)))
    }
  }, [open, dateGroups.length])

  /**
   * Toggle expansion of a date group.
   *
   * @param dateKey - The date string key identifying the group to toggle
   */
  const toggleDate = (dateKey: string) => {
    setExpandedDates((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(dateKey)) {
        newSet.delete(dateKey)
      } else {
        newSet.add(dateKey)
      }
      return newSet
    })
  }

  /**
   * Toggle expansion of a round's flows.
   *
   * @param roundId - The numeric ID of the round to toggle
   */
  const toggleRound = (roundId: number) => {
    setExpandedRounds((prev) => {
      const newSet = new Set(prev)
      if (newSet.has(roundId)) {
        newSet.delete(roundId)
      } else {
        newSet.add(roundId)
      }
      return newSet
    })
  }

  /**
   * Load all flows from a specific round.
   * Archives other flows and shows only this round's flows.
   *
   * @param round - The round whose flows should be loaded
   * @param flowsOverride - The flow list to derive the archived/visible split from, defaulting to the
   *   store's current `flows`. Passed explicitly by `handleLoadCloudRound`, which merges freshly-fetched
   *   flows into `flows` in the same tick it calls this, before that update has re-rendered the closure.
   */
  const handleLoadRoundFlows = (round: Round, flowsOverride: Flow[] = flows) => {
    const roundFlowIds = round.flowIds

    // Archive all flows except this round's flows
    const newFlows = flowsOverride.map((f) => {
      if (roundFlowIds.includes(f.id)) {
        return { ...f, archived: false }
      } else {
        return { ...f, archived: true }
      }
    })

    setFlows(newFlows)

    const roundFlows = newFlows.filter((f) => roundFlowIds.includes(f.id))

    if (roundFlows.length > 0) {
      // Switch to the first flow of this round
      const firstFlowIndex = newFlows.findIndex((f) => f.id === roundFlows[0].id)
      if (firstFlowIndex !== -1) {
        setSelected(firstFlowIndex)
        onOpenChange(false)
      }
    }
  }

  /**
   * Load a specific flow from history by the currently selected ID.
   */
  const handleLoadFlow = () => {
    if (selectedId) {
      loadFromHistory(selectedId)
      onOpenChange(false)
    }
  }

  /**
   * Clear all flow history after user confirmation.
   */
  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all flow history?")) {
      localStorage.removeItem("flow-history")
      setHistory([])
      setSelectedId(null)
    }
  }

  /**
   * Format a debater's display name with optional school.
   *
   * @param email - The debater's email address
   * @param school - Optional school name to include in parentheses
   * @returns Formatted display string, or empty string if email is falsy
   */
  const formatDebater = (email: string, school?: string) => {
    if (!email) return ""
    const name = email.split("@")[0]
    return school ? `${name} (${school})` : name
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Debate Round History
            </DialogTitle>
            {onCreateRound && (
              <Button
                onClick={() => {
                  onOpenChange(false)
                  onCreateRound()
                }}
                size="sm"
                className="gap-2"
              >
                <Users className="h-4 w-4" />
                Create New Round
              </Button>
            )}
          </div>
        </DialogHeader>

        <div className="flex flex-col gap-4">
          {/* Tab switcher */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeTab === "rounds" ? "default" : "outline"}
              onClick={() => setActiveTab("rounds")}
              className="gap-1.5"
            >
              <Clock className="h-3.5 w-3.5" />
              Rounds
            </Button>
            <Button
              size="sm"
              variant={activeTab === "cloud" ? "default" : "outline"}
              onClick={() => setActiveTab("cloud")}
              className="gap-1.5"
            >
              <Cloud className="h-3.5 w-3.5" />
              Saved to account
            </Button>
          </div>

          {activeTab === "rounds" && (rounds.length > 0 || unreferencedFlowCount > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {rounds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveAllRoundsToAccount}
                    disabled={bulkSaveStatus === "saving"}
                    className="gap-1.5"
                    title="Save every round (and its flows) to your account"
                  >
                    {bulkSaveStatus === "saving" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5" />
                    )}
                    Save all rounds
                  </Button>
                  {bulkSaveStatus === "done" && bulkSaveSummary && (
                    <span className="text-xs text-muted-foreground">
                      {bulkSaveSummary.errorCount === 0
                        ? `Saved ${bulkSaveSummary.savedCount} round${bulkSaveSummary.savedCount === 1 ? "" : "s"}.`
                        : `Saved ${bulkSaveSummary.savedCount}, ${bulkSaveSummary.errorCount} failed.`}
                    </span>
                  )}
                </div>
              )}
              {unreferencedFlowCount > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveUnreferencedFlowsToAccount}
                    disabled={bulkFlowSaveStatus === "saving"}
                    className="gap-1.5"
                    title="Save every local flow not part of any round to your account"
                  >
                    {bulkFlowSaveStatus === "saving" ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <CloudUpload className="h-3.5 w-3.5" />
                    )}
                    Save flows not in a round ({unreferencedFlowCount})
                  </Button>
                  {bulkFlowSaveStatus === "done" && bulkFlowSaveSummary && (
                    <span className="text-xs text-muted-foreground">
                      {bulkFlowSaveSummary.errorCount === 0
                        ? `Saved ${bulkFlowSaveSummary.savedCount} flow${bulkFlowSaveSummary.savedCount === 1 ? "" : "s"}.`
                        : `Saved ${bulkFlowSaveSummary.savedCount}, ${bulkFlowSaveSummary.errorCount} failed.`}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}

          {activeTab === "cloud" ? (
            <ScrollArea className="h-[440px] border rounded-md">
              {cloudList.kind === "loading" && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                </div>
              )}
              {cloudList.kind === "signed-out" && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center p-8">
                    <Cloud className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>Sign in to save flows to your account</p>
                    <p className="text-xs mt-2">Saved flows follow you to any device you sign in on.</p>
                  </div>
                </div>
              )}
              {cloudList.kind === "error" && (
                <div className="flex items-center justify-center h-full text-muted-foreground">
                  <div className="text-center p-8">
                    <p className="text-destructive">{cloudList.message}</p>
                  </div>
                </div>
              )}
              {cloudList.kind === "loaded" && (
                <div className="p-2 space-y-1">
                  <div className="px-1 pt-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Flows
                  </div>
                {cloudList.flows.length > 0 ? (
                  <div className="space-y-1">
                    {cloudList.flows.map((flow) => {
                      const referencingRound = flowIdToReferencingRound.get(flow.clientId)
                      return (
                      <div
                        key={flow.clientId}
                        className="flex items-center justify-between gap-2 border rounded-md p-2.5 bg-card"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="text-sm font-medium truncate">{flow.label}</div>
                              {referencingRound && (
                                <Badge
                                  variant="outline"
                                  className="flex-shrink-0 text-[10px]"
                                  title={`Saved as part of "${deriveRoundLabel(referencingRound)}"`}
                                >
                                  via round
                                </Badge>
                              )}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              Saved {new Date(flow.updatedAt).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Load into this browser"
                            onClick={() => handleLoadCloudFlow(flow.clientId)}
                          >
                            {cloudActions[flow.clientId] === "loading" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            title="Remove from your account"
                            onClick={() => handleRemoveCloudFlow(flow.clientId)}
                          >
                            {cloudActions[flow.clientId] === "removing" ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p>No flows saved to your account yet</p>
                    <p className="text-xs mt-2">Use the cloud icon on a flow in the Rounds tab to save it here.</p>
                  </div>
                )}

                  <div className="px-1 pt-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Rounds
                  </div>
                  {cloudRoundList.kind === "loading" && (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {cloudRoundList.kind === "error" && (
                    <p className="text-center py-6 text-destructive text-sm">{cloudRoundList.message}</p>
                  )}
                  {cloudRoundList.kind === "loaded" &&
                    (cloudRoundList.rounds.length > 0 ? (
                      <div className="space-y-1">
                        {cloudRoundList.rounds.map((round) => (
                          <div
                            key={round.clientId}
                            className="flex items-center justify-between gap-2 border rounded-md p-2.5 bg-card"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <Users className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{round.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  Saved {new Date(round.updatedAt).toLocaleString()}
                                </div>
                              </div>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title="Load into this browser"
                                onClick={() => handleLoadCloudRound(round.clientId)}
                              >
                                {cloudRoundActions[round.clientId] === "loading" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Download className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 w-8 p-0"
                                title="Remove from your account"
                                onClick={() => handleRemoveCloudRound(round.clientId)}
                              >
                                {cloudRoundActions[round.clientId] === "removing" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-muted-foreground">
                        <p>No rounds saved to your account yet</p>
                        <p className="text-xs mt-2">
                          Use the cloud icon on a round in the Rounds tab to save it (and its flows) here.
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </ScrollArea>
          ) : (
            <>
              {/* Search input */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search rounds by tournament, debaters, schools, judges, or flows..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>

              {/* Rounds list */}
              <ScrollArea className="h-[440px] border rounded-md">
            {filteredRounds.length > 0 ? (
              <div className="p-2 space-y-2">
                {filteredRounds
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((round) => {
                    const roundFlows = flows.filter((f) => round.flowIds.includes(f.id))

                    return (
                      <div
                        key={round.id}
                        className="border rounded-md overflow-hidden bg-card hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => handleLoadRoundFlows(round)}
                      >
                        <div className="p-3">
                          {/* Round header */}
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <Users className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                              <div>
                                <div className="font-semibold text-base">{round.tournamentName}</div>
                                <div className="text-sm text-muted-foreground">{round.roundLevel}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground">
                                {new Date(round.timestamp).toLocaleDateString()}
                              </span>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleSaveRoundToAccount(round)
                                }}
                                title={
                                  cloudRoundActions[round.id] === "saved"
                                    ? "Saved to your account"
                                    : "Save this round (and its flows) to your account"
                                }
                                className="h-8 w-8 p-0"
                              >
                                {cloudRoundActions[round.id] === "saving" ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : cloudRoundActions[round.id] === "error" ? (
                                  <UploadCloud className="h-4 w-4 text-destructive" />
                                ) : cloudRoundActions[round.id] === "saved" ? (
                                  <Cloud className="h-4 w-4 text-primary" />
                                ) : (
                                  <UploadCloud className="h-4 w-4" />
                                )}
                              </Button>
                              {onEditRound && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    onEditRound(round.id)
                                    onOpenChange(false)
                                  }}
                                  title="Edit round details"
                                  className="h-8 w-8 p-0"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleDeleteLocalRound(round)
                                }}
                                title="Delete this round from this browser"
                                className="h-8 w-8 p-0 hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>

                          {/* Team matchup display */}
                          <div className="mt-2 text-sm text-muted-foreground pl-8 space-y-1">
                            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1">
                              {/* Affirmative team */}
                              <span className="font-medium text-blue-500">Aff:</span>
                              <span className="truncate text-blue-500">
                                {formatDebater(round.debaters.aff[0], round.schools?.aff[0])}
                                {round.debaters.aff[1] &&
                                  `, ${formatDebater(round.debaters.aff[1], round.schools?.aff[1])}`}
                              </span>

                              {/* Negative team */}
                              <span className="font-medium text-red-500">Neg:</span>
                              <span className="truncate text-red-500">
                                {formatDebater(round.debaters.neg[0], round.schools?.neg[0])}
                                {round.debaters.neg[1] &&
                                  `, ${formatDebater(round.debaters.neg[1], round.schools?.neg[1])}`}
                              </span>

                              {/* Judges */}
                              {round.judges.length > 0 && (
                                <>
                                  <span className="font-medium flex items-center gap-1">
                                    <Gavel className="h-3 w-3" />
                                    Judges:
                                  </span>
                                  <span className="truncate">
                                    {round.judges
                                      .filter((j) => j)
                                      .map((j) => j.split("@")[0])
                                      .join(", ")}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Flow chips */}
                          {roundFlows.length > 0 && (
                            <div className="mt-3 pl-8 flex flex-wrap gap-2">
                              {roundFlows.map((flow) => (
                                <span
                                  key={flow.id}
                                  className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 bg-secondary hover:bg-secondary/80 rounded-full text-xs transition-colors font-medium border"
                                >
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      const flowIndex = flows.findIndex((f) => f.id === flow.id)
                                      if (flowIndex !== -1) {
                                        setSelected(flowIndex)
                                        onOpenChange(false)
                                      }
                                    }}
                                    className="inline-flex items-center gap-1"
                                    title={`Open ${flow.content}`}
                                  >
                                    <FileText className="h-3 w-3" />
                                    <span>{flow.content || `Speech ${flow.speechNumber}`}</span>
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      handleSaveFlowToAccount(flow)
                                    }}
                                    className="p-0.5 rounded-full hover:bg-background/60"
                                    title={
                                      cloudActions[flow.id] === "saved"
                                        ? "Saved to your account"
                                        : "Save this flow to your account"
                                    }
                                  >
                                    {cloudActions[flow.id] === "saving" ? (
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                    ) : cloudActions[flow.id] === "error" ? (
                                      <UploadCloud className="h-3 w-3 text-destructive" />
                                    ) : cloudActions[flow.id] === "saved" ? (
                                      <Cloud className="h-3 w-3 text-primary" />
                                    ) : (
                                      <UploadCloud className="h-3 w-3" />
                                    )}
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )
                  })}
              </div>
            ) : (
              // Empty state
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center p-8">
                  <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No rounds recorded</p>
                  <p className="text-xs mt-2">Start a new round to see it here</p>
                </div>
              </div>
            )}
              </ScrollArea>
            </>
          )}

          {/* Debate timer illustration */}
          <div className="flex justify-center">
            <Image
              src="https://i.imgur.com/mSUuj7v.mp4"
              alt="Debate timer"
              width={320}
              height={80}
              unoptimized
              className="rounded-md opacity-80"
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
