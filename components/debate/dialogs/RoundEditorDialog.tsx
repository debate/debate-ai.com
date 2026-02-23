"use client"

/**
 * @fileoverview Round Editor Dialog Component
 *
 * A comprehensive dialog for creating and editing debate rounds. Handles:
 * - Tournament name with autocomplete from Tabroom
 * - Round level selection (Prelim, Quarters, Finals, etc.)
 * - Debater information with email validation
 * - Judge management with dynamic add/remove
 * - Public/private visibility toggle
 * - Winner selection for completed rounds
 *
 * When creating a new round, this component also:
 * - Generates initial flows based on the selected debate style
 * - Archives existing flows
 * - Persists round and flow data to localStorage
 *
 * @module components/debate/dialogs/RoundEditorDialog
 */

import { useState, useEffect } from "react"
import Image from "next/image"
import { Plus, Minus, Lock } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Component as ShatterButton } from "@/components/ui/shatter-button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { useFlowStore } from "@/lib/state/store"
import { settings } from "@/lib/state/settings"
import { debateStyles, debateStyleMap } from "@/lib/debate-data/debate-styles"

/**
 * Fetch tournament names from Tabroom for autocomplete.
 * Scrapes the Tabroom homepage for current tournament links.
 *
 * @returns Promise resolving to an array of tournament name strings
 */
async function getTournamentNames(): Promise<string[]> {
  try {
    const res = await fetch("https://www.tabroom.com/index/index.mhtml", {
      cache: "no-store",
    })

    if (!res.ok) {
      throw new Error(`Failed to fetch tabroom: ${res.status}`)
    }

    const html = await res.text()

    // Extract tournament names from links with tourn_id
    const linkMatches = html.match(/<a[^>]*href="[^"]*tourn_id=[^"]*"[^>]*>([^<]+)<\/a>/gi) || []

    const names = linkMatches
      .map((link) => {
        const match = link.match(/>([^<]+)<\/a>/i)
        if (!match) return ""
        const text = match[1].trim()
        return text
      })
      .filter((n) => {
        // Filter out dates, navigation links, and short text
        return (
          n.length > 5 &&
          !n.match(/^\d{1,2}\/\d{1,2}/) && // No dates like 01/15
          !n.match(/^\d{4}/) && // No years like 2024
          !n.match(/\d{4}$/) && // No years at end
          !n.includes("http") &&
          !n.match(/^(Home|Login|Help|About|Contact)$/i)
        )
      })

    // Remove duplicates
    const uniqueNames = Array.from(new Set(names))
    console.log(`Found ${uniqueNames.length} tournaments`)
    return uniqueNames.slice(0, 100)
  } catch (error) {
    console.error("Error fetching tournament names:", error)
    return []
  }
}

/**
 * Available round levels for selection
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
  "Triples",
  "Doubles",
  "Octas",
  "Quarters",
  "Semis",
  "Finals",
]

/**
 * Props for the RoundEditorDialog component
 */
interface RoundEditorDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change dialog open state */
  onOpenChange: (open: boolean) => void
  /** Optional round ID for editing existing rounds; omit to create a new round */
  roundId?: number
}

/**
 * RoundEditorDialog - Create and edit debate rounds
 *
 * This component provides a comprehensive form for managing debate rounds.
 * When creating a new round, it automatically generates flows based on
 * the selected debate style and archives existing flows.
 *
 * @param props - Component props
 * @param props.open - Whether the dialog is open
 * @param props.onOpenChange - Callback to change dialog open state
 * @param props.roundId - Optional round ID for editing an existing round
 * @returns The round editor dialog component
 *
 * @example
 * ```tsx
 * // Creating a new round
 * <RoundEditorDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 * />
 *
 * // Editing an existing round
 * <RoundEditorDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   roundId={123}
 * />
 * ```
 */
export function RoundEditorDialog({ open, onOpenChange, roundId }: RoundEditorDialogProps) {
  // ============================================================================
  // Form State
  // ============================================================================

  // Tournament info
  const [tournamentName, setTournamentName] = useState("")
  const [tournamentSuggestions, setTournamentSuggestions] = useState<string[]>([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [roundLevel, setRoundLevel] = useState("Prelim 1")
  const [debateStyleIndex, setDebateStyleIndex] = useState(0)

  // Debater info
  const [affDebater1, setAffDebater1] = useState("")
  const [affDebater2, setAffDebater2] = useState("")
  const [negDebater1, setNegDebater1] = useState("")
  const [negDebater2, setNegDebater2] = useState("")
  const [affSchool, setAffSchool] = useState("")
  const [negSchool, setNegSchool] = useState("")

  // Judges and settings
  const [judgeEmails, setJudgeEmails] = useState<string[]>([""])
  const [isPublic, setIsPublic] = useState(false)
  const [winner, setWinner] = useState<"aff" | "neg" | "none">("none")

  // Store access
  const { createRound, updateRound, flows, setFlows, rounds } = useFlowStore()

  // ============================================================================
  // Effects
  // ============================================================================

  /**
   * Load existing round data when editing, or reset form when dialog closes.
   */
  useEffect(() => {
    if (roundId && open) {
      // Editing mode - load existing round data
      const round = rounds.find((r) => r.id === roundId)
      if (round) {
        setTournamentName(round.tournamentName)
        setRoundLevel(round.roundLevel)
        setAffDebater1(round.debaters.aff[0])
        setAffDebater2(round.debaters.aff[1])
        setNegDebater1(round.debaters.neg[0])
        setNegDebater2(round.debaters.neg[1])
        setAffSchool(round.schools?.aff[0] || "")
        setNegSchool(round.schools?.neg[0] || "")
        setJudgeEmails(round.judges.length > 0 ? round.judges : [""])
        setIsPublic(round.isPublic || false)
        setWinner(round.winner || "none")
      }
    } else if (!open) {
      // Reset form when dialog closes
      setTournamentName("")
      setRoundLevel("Prelim 1")
      const debateStyleSetting = settings.data.debateStyle
      setDebateStyleIndex(debateStyleSetting.value as number)
      setAffDebater1("")
      setAffDebater2("")
      setNegDebater1("")
      setNegDebater2("")
      setAffSchool("")
      setNegSchool("")
      setJudgeEmails([""])
      setIsPublic(false)
      setWinner("none")
    }
  }, [roundId, open, rounds])

  /**
   * Initialize debate style and fetch tournament suggestions when dialog opens.
   */
  useEffect(() => {
    if (open) {
      const debateStyleSetting = settings.data.debateStyle
      setDebateStyleIndex(debateStyleSetting.value as number)

      getTournamentNames().then((names) => {
        console.log("Tournament suggestions:", names)
        setTournamentSuggestions(names)
      })
    }
  }, [open])

  /**
   * Filter tournament suggestions based on current input value.
   */
  useEffect(() => {
    if (tournamentName && tournamentSuggestions.length > 0) {
      const filtered = tournamentSuggestions.filter((name) =>
        name.toLowerCase().includes(tournamentName.toLowerCase())
      )
      setFilteredSuggestions(filtered.slice(0, 10))
      setShowAutocomplete(filtered.length > 0)
    } else {
      setFilteredSuggestions([])
      setShowAutocomplete(false)
    }
  }, [tournamentName, tournamentSuggestions])

  // ============================================================================
  // Validation
  // ============================================================================

  /**
   * Validate email format.
   *
   * @param email - Email string to validate
   * @returns True if the email is valid or empty, false otherwise
   */
  const validateEmail = (email: string): boolean => {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // ============================================================================
  // Form Submission
  // ============================================================================

  /**
   * Handle form submission for creating or updating a round.
   * Validates input, creates flows for new rounds, and persists data.
   */
  const handleCreateRound = () => {
    // Validate required fields
    if (!tournamentName.trim()) {
      alert("Please enter a tournament name")
      return
    }

    if (!roundLevel.trim()) {
      alert("Please select a round level")
      return
    }

    if (!affDebater1 || !negDebater1) {
      alert("Please enter emails for at least one debater per side")
      return
    }

    if (!judgeEmails[0]?.trim()) {
      alert("Please enter at least one judge email")
      return
    }

    // Validate all email formats
    const emails = [affDebater1, affDebater2, negDebater1, negDebater2, ...judgeEmails]
    for (const email of emails) {
      if (email && !validateEmail(email)) {
        alert(`Invalid email format: ${email}`)
        return
      }
    }

    const judges = judgeEmails.filter((j) => j.trim())

    // ========================================================================
    // Update Existing Round
    // ========================================================================
    if (roundId) {
      updateRound(roundId, {
        tournamentName,
        roundLevel,
        debaters: {
          aff: [affDebater1, affDebater2],
          neg: [negDebater1, negDebater2],
        },
        schools: {
          aff: [affSchool, affSchool],
          neg: [negSchool, negSchool],
        },
        judges,
        isPublic,
        winner: winner === "none" ? undefined : winner,
      })
      onOpenChange(false)
      return
    }

    // ========================================================================
    // Create New Round with Flows
    // ========================================================================

    const styleKey = debateStyleMap[debateStyleIndex]
    const styleConfig = debateStyles[styleKey]

    // Save debate style preference
    settings.setValue("debateStyle", debateStyleIndex)
    settings.saveToLocalStorage()

    const newFlows: Flow[] = []
    const newFlowIds: number[] = []

    const primaryFlow = styleConfig.primary
    const columns = primaryFlow.columns
    const firstColumn = columns.slice(0, 1)

    // Create flows for each column
    firstColumn.forEach((speechName: string, index: number) => {
      const flowId = Date.now() + index
      const newFlow: Flow = {
        id: flowId,
        content: `${tournamentName} - ${roundLevel} - ${speechName}`,
        level: 0,
        columns: columns,
        invert: primaryFlow.invert,
        focus: false,
        index: flows.length + index,
        lastFocus: [],
        children: (() => {
          const rows: Box[] = []
          if (!primaryFlow.starterBoxes) {
            // Create empty rows for freeform flowing
            for (let r = 0; r < 100; r++) {
              const rootBox: Box = {
                content: "",
                children: [],
                index: r,
                level: 1,
                focus: false,
                empty: columns.length > 1,
              }
              rows.push(rootBox)

              // Create child boxes for each column
              let currentBox = rootBox
              for (let c = 1; c < columns.length; c++) {
                const childBox: Box = {
                  content: "",
                  children: [],
                  index: 0,
                  level: c + 1,
                  focus: false,
                  empty: c < columns.length - 1,
                }
                currentBox.children.push(childBox)
                currentBox = childBox
              }
            }
            return rows
          }
          // Use predefined starter boxes if available
          return primaryFlow.starterBoxes.map((content: string, idx: number) => ({
            content,
            children: [],
            index: idx,
            level: 1,
            focus: false,
          }))
        })(),
        speechDocs: {},
        archived: false,
        speechNumber: index + 1,
      }
      newFlows.push(newFlow)
      newFlowIds.push(flowId)
    })

    // Create the round in the store
    const round = createRound({
      tournamentName,
      roundLevel,
      debaters: {
        aff: [affDebater1, affDebater2],
        neg: [negDebater1, negDebater2],
      },
      schools: {
        aff: [affSchool, affSchool],
        neg: [negSchool, negSchool],
      },
      judges,
      flowIds: newFlowIds,
      status: "active",
      isPublic,
    })

    // Archive existing flows
    const archivedFlows = flows.map((f) => ({ ...f, archived: true }))

    // Associate new flows with the round
    const updatedFlows = newFlows.map((flow) => ({ ...flow, roundId: round.id }))

    // Combine and save all flows
    const finalFlows = [...archivedFlows, ...updatedFlows]
    setFlows(finalFlows)
    localStorage.setItem("flows", JSON.stringify(finalFlows))

    // Reset form and close dialog
    setTournamentName("")
    setRoundLevel("Prelim 1")
    setAffDebater1("")
    setAffDebater2("")
    setNegDebater1("")
    setNegDebater2("")
    setAffSchool("")
    setNegSchool("")
    setJudgeEmails([""])

    onOpenChange(false)
  }

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Image src="/icons/icon-rounds.svg" alt="Rounds" width={64} height={64} />
            {roundId ? "Edit Round" : "Create New Round"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Tournament and Round Level Row */}
          <div className="grid grid-cols-4 gap-4 items-end">
            {/* Tournament Name with Autocomplete */}
            <div className="col-span-2 space-y-2 relative">
              <Input
                id="tournament-name"
                placeholder="e.g., Harvard Invitational"
                value={tournamentName}
                onChange={(e) => setTournamentName(e.target.value)}
                onFocus={() => {
                  if (tournamentName && filteredSuggestions.length > 0) {
                    setShowAutocomplete(true)
                  }
                }}
                onBlur={() => {
                  setTimeout(() => setShowAutocomplete(false), 200)
                }}
              />
              {showAutocomplete && filteredSuggestions.length > 0 && (
                <div className="absolute z-50 w-full mt-1 bg-background border border-border rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {filteredSuggestions.map((name, index) => (
                    <button
                      key={index}
                      type="button"
                      className="w-full text-left px-3 py-2 hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer text-sm"
                      onClick={() => {
                        setTournamentName(name)
                        setShowAutocomplete(false)
                      }}
                    >
                      {name}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Round Level Select */}
            <div className="space-y-2">
              <Select value={roundLevel} onValueChange={setRoundLevel}>
                <SelectTrigger id="round-level">
                  <SelectValue placeholder="Select round level" />
                </SelectTrigger>
                <SelectContent>
                  {ROUND_LEVELS.map((level) => (
                    <SelectItem key={level} value={level}>
                      {level}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Visibility Toggle */}
            <div className="space-y-3 flex flex-col items-center pb-2">
              <Label htmlFor="visibility-toggle" className="text-xs text-muted-foreground mb-1">
                {isPublic ? "Public" : "Private"}
              </Label>
              <div className="flex items-center gap-2">
                <Lock className={`h-4 w-4 ${!isPublic ? "text-primary" : "text-muted-foreground"}`} />
                <Switch
                  id="visibility-toggle"
                  checked={isPublic}
                  onCheckedChange={setIsPublic}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </div>
          </div>

          {/* Debate Style Select */}
          <div className="space-y-2">
            <Label htmlFor="debate-style">Debate Style</Label>
            <Select
              value={debateStyleIndex.toString()}
              onValueChange={(value) => setDebateStyleIndex(Number.parseInt(value))}
            >
              <SelectTrigger id="debate-style">
                <SelectValue placeholder="Select debate style" />
              </SelectTrigger>
              <SelectContent>
                {(settings.data.debateStyle as RadioSetting).detail.options.map((option: string, index: number) => (
                  <SelectItem key={index} value={index.toString()}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Team Information Grid */}
          <div className="grid grid-cols-2 gap-4">
            {/* Affirmative Team */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-blue-500">Affirmative Team</h3>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="aff-school">School (Optional)</Label>
                  <Input
                    id="aff-school"
                    type="text"
                    placeholder="School Name"
                    value={affSchool}
                    onChange={(e) => setAffSchool(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="aff-debater-1">1A Email</Label>
                  <Input
                    id="aff-debater-1"
                    type="email"
                    placeholder="debater1@example.com"
                    value={affDebater1}
                    onChange={(e) => setAffDebater1(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="aff-debater-2">2A Email (Optional)</Label>
                  <Input
                    id="aff-debater-2"
                    type="email"
                    placeholder="debater2@example.com"
                    value={affDebater2}
                    onChange={(e) => setAffDebater2(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Negative Team */}
            <div className="space-y-2">
              <h3 className="text-sm font-semibold text-red-500">Negative Team</h3>
              <div className="space-y-2">
                <div>
                  <Label htmlFor="neg-school">School (Optional)</Label>
                  <Input
                    id="neg-school"
                    type="text"
                    placeholder="School Name"
                    value={negSchool}
                    onChange={(e) => setNegSchool(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="neg-debater-1">1N Email</Label>
                  <Input
                    id="neg-debater-1"
                    type="email"
                    placeholder="debater3@example.com"
                    value={negDebater1}
                    onChange={(e) => setNegDebater1(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="neg-debater-2">2N Email (Optional)</Label>
                  <Input
                    id="neg-debater-2"
                    type="email"
                    placeholder="debater4@example.com"
                    value={negDebater2}
                    onChange={(e) => setNegDebater2(e.target.value)}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Judges Section */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Judges</h3>
              <div className="flex gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setJudgeEmails([...judgeEmails, ""])}
                  title="Add Judge"
                >
                  <Plus className="h-4 w-4" />
                </Button>
                {judgeEmails.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-red-500 hover:text-red-600 hover:bg-red-50"
                    onClick={() => {
                      if (judgeEmails.length > 1) {
                        setJudgeEmails(judgeEmails.slice(0, -1))
                      }
                    }}
                    title="Remove Judge"
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {judgeEmails.map((email, index) => (
                <div key={index}>
                  <Label htmlFor={`judge-${index}`}>Judge {index + 1} Email</Label>
                  <Input
                    id={`judge-${index}`}
                    type="email"
                    placeholder={`judge${index + 1}@example.com`}
                    value={email}
                    onChange={(e) => {
                      const newEmails = [...judgeEmails]
                      newEmails[index] = e.target.value
                      setJudgeEmails(newEmails)
                    }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Winner Selection (only for editing) */}
          {roundId && (
            <div className="space-y-2">
              <Label htmlFor="winner">Winner</Label>
              <Select value={winner} onValueChange={(value) => setWinner(value as "aff" | "neg" | "none")}>
                <SelectTrigger id="winner">
                  <SelectValue placeholder="Select winner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Undecided</SelectItem>
                  <SelectItem value="aff">Aff</SelectItem>
                  <SelectItem value="neg">Neg</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-4 pb-2">
            <ShatterButton
              onClick={handleCreateRound}
              className="w-full text-lg"
              shatterColor={roundId ? "#3b82f6" : "#00ffff"}
              shardCount={25}
            >
              {roundId ? "Update Round" : "Create Round & Invite"}
            </ShatterButton>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
