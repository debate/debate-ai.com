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
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { useFlowStore, type FlowHistory } from "@/lib/state/store"
import { Clock, FileText, Users, Edit, Gavel, Search } from "lucide-react"

/**
 * Round level ordering for sorting
 * Higher index = more important round (Finals = highest)
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
 * Get the rank of a round level for sorting purposes
 * @param roundLevel - The round level string
 * @returns The rank index, or -1 if not found
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
  dateKey: string
  entries: FlowHistory[]
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
  } = useFlowStore()

  // Local state
  const [history, setHistory] = useState<FlowHistory[]>([])
  const [rounds, setRounds] = useState<Round[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set())
  const [expandedRounds, setExpandedRounds] = useState<Set<number>>(new Set())
  const [activeTab, setActiveTab] = useState<"rounds" | "history">("rounds")
  const [searchQuery, setSearchQuery] = useState("")

  /**
   * Load history and rounds when dialog opens
   */
  useEffect(() => {
    if (open) {
      setHistory(getFlowHistory())
      setRounds(getRounds())
      setSearchQuery("") // Reset search when dialog opens
    }
  }, [open, getFlowHistory, getRounds])

  /**
   * Filter rounds based on search query
   * Searches in: tournament name, round level, debaters, schools, judges, flow names
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
   * Group history entries by date for organized display
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
   * Expand all date groups when dialog opens
   */
  useEffect(() => {
    if (open && dateGroups.length > 0) {
      setExpandedDates(new Set(dateGroups.map((g) => g.dateKey)))
    }
  }, [open, dateGroups.length])

  /**
   * Toggle expansion of a date group
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
   * Toggle expansion of a round's flows
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
   * Load all flows from a specific round
   * Archives other flows and shows only this round's flows
   */
  const handleLoadRoundFlows = (round: Round) => {
    const roundFlowIds = round.flowIds

    // Archive all flows except this round's flows
    const newFlows = flows.map((f) => {
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
   * Load a specific flow from history
   */
  const handleLoadFlow = () => {
    if (selectedId) {
      loadFromHistory(selectedId)
      onOpenChange(false)
    }
  }

  /**
   * Clear all flow history
   */
  const handleClearHistory = () => {
    if (confirm("Are you sure you want to clear all flow history?")) {
      localStorage.removeItem("flow-history")
      setHistory([])
      setSelectedId(null)
    }
  }

  /**
   * Format debater display with optional school name
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
              Rounds & History
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
          <ScrollArea className="h-[500px] border rounded-md">
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
                                <button
                                  key={flow.id}
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    const flowIndex = flows.findIndex((f) => f.id === flow.id)
                                    if (flowIndex !== -1) {
                                      setSelected(flowIndex)
                                      onOpenChange(false)
                                    }
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-secondary hover:bg-secondary/80 rounded-full text-xs transition-colors font-medium border"
                                  title={`Open ${flow.content}`}
                                >
                                  <FileText className="h-3 w-3" />
                                  <span>{flow.content || `Speech ${flow.speechNumber}`}</span>
                                </button>
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
        </div>
      </DialogContent>
    </Dialog>
  )
}
