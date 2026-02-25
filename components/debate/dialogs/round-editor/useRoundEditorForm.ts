"use client"

/**
 * @fileoverview Custom hook that manages all form state and submission logic
 * for the Round Editor dialog.
 *
 * Encapsulates:
 * - Form field state (tournament, debaters, judges, etc.)
 * - Tournament name autocomplete with Tabroom suggestions
 * - Round data loading for edit mode
 * - Form validation and submission (create/update)
 * - Flow generation for new rounds
 *
 * @module components/debate/dialogs/round-editor/useRoundEditorForm
 */

import { useState, useEffect } from "react"
import { useFlowStore } from "@/lib/state/store"
import { settings } from "@/lib/state/settings"
import { debateStyles, debateStyleMap } from "@/lib/debate-data/debate-styles"
import { fetchTournamentNames } from "@/app/actions"

/** Return type of the {@link useRoundEditorForm} hook. */
export interface RoundEditorFormState {
  // Tournament
  tournamentName: string
  setTournamentName: (v: string) => void
  tournamentSuggestions: string[]
  showAutocomplete: boolean
  setShowAutocomplete: (v: boolean) => void
  filteredSuggestions: string[]
  roundLevel: string
  setRoundLevel: (v: string) => void
  debateStyleIndex: number
  setDebateStyleIndex: (v: number) => void

  // Debaters
  affDebater1: string
  setAffDebater1: (v: string) => void
  affDebater2: string
  setAffDebater2: (v: string) => void
  negDebater1: string
  setNegDebater1: (v: string) => void
  negDebater2: string
  setNegDebater2: (v: string) => void
  affSchool: string
  setAffSchool: (v: string) => void
  negSchool: string
  setNegSchool: (v: string) => void

  // Judges
  judgeEmails: string[]
  setJudgeEmails: (v: string[]) => void

  // Settings
  isPrivate: boolean
  setIsPrivate: (v: boolean) => void
  winner: "aff" | "neg" | "none"
  setWinner: (v: "aff" | "neg" | "none") => void

  /** Submit handler – validates and creates/updates the round. */
  handleSubmit: () => void
}

/**
 * Manages all state and logic for the round editor form.
 *
 * @param open - Whether the dialog is currently open
 * @param onOpenChange - Callback to toggle the dialog
 * @param roundId - If provided, the form operates in edit mode for this round
 * @returns All form state, setters, and the submit handler
 */
export function useRoundEditorForm(
  open: boolean,
  onOpenChange: (open: boolean) => void,
  roundId?: number
): RoundEditorFormState {
  // --------------------------------------------------------------------------
  // Form state
  // --------------------------------------------------------------------------
  const [tournamentName, setTournamentName] = useState("")
  const [tournamentSuggestions, setTournamentSuggestions] = useState<string[]>([])
  const [showAutocomplete, setShowAutocomplete] = useState(false)
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const [roundLevel, setRoundLevel] = useState("Prelim 1")
  const [debateStyleIndex, setDebateStyleIndex] = useState(0)

  const [affDebater1, setAffDebater1] = useState("")
  const [affDebater2, setAffDebater2] = useState("")
  const [negDebater1, setNegDebater1] = useState("")
  const [negDebater2, setNegDebater2] = useState("")
  const [affSchool, setAffSchool] = useState("")
  const [negSchool, setNegSchool] = useState("")

  const [judgeEmails, setJudgeEmails] = useState<string[]>([""])
  const [isPrivate, setIsPrivate] = useState(false)
  const [winner, setWinner] = useState<"aff" | "neg" | "none">("none")

  const { createRound, updateRound, flows, setFlows, rounds } = useFlowStore()

  // --------------------------------------------------------------------------
  // Effects
  // --------------------------------------------------------------------------

  /** Load existing round data when editing, or reset the form when closed. */
  useEffect(() => {
    if (roundId && open) {
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
        setIsPrivate(round.isPrivate || false)
        setWinner(round.winner || "none")
      }
    } else if (!open) {
      resetForm()
    }
  }, [roundId, open, rounds])

  /** Initialize debate style and fetch tournament suggestions on open. */
  useEffect(() => {
    if (open) {
      const debateStyleSetting = settings.data.debateStyle
      setDebateStyleIndex(debateStyleSetting.value as number)

      fetchTournamentNames().then((names) => {
        setTournamentSuggestions(names)
      })
    }
  }, [open])

  /** Filter tournament suggestions as the user types. */
  useEffect(() => {
    if (tournamentSuggestions.length > 0) {
      if (tournamentName) {
        const filtered = tournamentSuggestions.filter((name) =>
          name.toLowerCase().includes(tournamentName.toLowerCase())
        )
        setFilteredSuggestions(filtered.slice(0, 10))
      } else {
        setFilteredSuggestions(tournamentSuggestions.slice(0, 10))
      }
    } else {
      setFilteredSuggestions([])
    }
  }, [tournamentName, tournamentSuggestions])

  // --------------------------------------------------------------------------
  // Helpers
  // --------------------------------------------------------------------------

  /** Reset every field to its default value. */
  function resetForm() {
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
    setIsPrivate(false)
    setWinner("none")
  }

  /**
   * Validate an email address format.
   *
   * @param email - The email string to check
   * @returns `true` when the email is valid **or** empty
   */
  function validateEmail(email: string): boolean {
    if (!email) return true
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  }

  // --------------------------------------------------------------------------
  // Submission
  // --------------------------------------------------------------------------

  /**
   * Validate the form and either update an existing round or create a new one
   * with generated flows.
   */
  function handleSubmit() {
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

    const emails = [affDebater1, affDebater2, negDebater1, negDebater2, ...judgeEmails]
    for (const email of emails) {
      if (email && !validateEmail(email)) {
        alert(`Invalid email format: ${email}`)
        return
      }
    }

    const judges = judgeEmails.filter((j) => j.trim())

    // -- Update existing round --
    if (roundId) {
      updateRound(roundId, {
        tournamentName,
        roundLevel,
        debaters: { aff: [affDebater1, affDebater2], neg: [negDebater1, negDebater2] },
        schools: { aff: [affSchool, affSchool], neg: [negSchool, negSchool] },
        judges,
        isPrivate,
        winner: winner === "none" ? undefined : winner,
      })
      onOpenChange(false)
      return
    }

    // -- Create new round with flows --
    const styleKey = debateStyleMap[debateStyleIndex]
    const styleConfig = debateStyles[styleKey]

    settings.setValue("debateStyle", debateStyleIndex)
    settings.saveToLocalStorage()

    const newFlows: Flow[] = []
    const newFlowIds: number[] = []

    const primaryFlow = styleConfig.primary
    const columns = primaryFlow.columns
    const firstColumn = columns.slice(0, 1)

    firstColumn.forEach((speechName: string, index: number) => {
      const flowId = Date.now() + index
      const newFlow: Flow = {
        id: flowId,
        content: `${tournamentName} - ${roundLevel} - ${speechName}`,
        level: 0,
        columns,
        invert: primaryFlow.invert,
        focus: false,
        index: flows.length + index,
        lastFocus: [],
        children: (() => {
          const rows: Box[] = []
          if (!primaryFlow.starterBoxes) {
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

    const round = createRound({
      tournamentName,
      roundLevel,
      debaters: { aff: [affDebater1, affDebater2], neg: [negDebater1, negDebater2] },
      schools: { aff: [affSchool, affSchool], neg: [negSchool, negSchool] },
      judges,
      flowIds: newFlowIds,
      status: "active",
      isPrivate,
    })

    const archivedFlows = flows.map((f) => ({ ...f, archived: true }))
    const updatedFlows = newFlows.map((flow) => ({ ...flow, roundId: round.id }))
    const finalFlows = [...archivedFlows, ...updatedFlows]
    setFlows(finalFlows)
    localStorage.setItem("flows", JSON.stringify(finalFlows))

    resetForm()
    onOpenChange(false)
  }

  return {
    tournamentName,
    setTournamentName,
    tournamentSuggestions,
    showAutocomplete,
    setShowAutocomplete,
    filteredSuggestions,
    roundLevel,
    setRoundLevel,
    debateStyleIndex,
    setDebateStyleIndex,
    affDebater1,
    setAffDebater1,
    affDebater2,
    setAffDebater2,
    negDebater1,
    setNegDebater1,
    negDebater2,
    setNegDebater2,
    affSchool,
    setAffSchool,
    negSchool,
    setNegSchool,
    judgeEmails,
    setJudgeEmails,
    isPrivate,
    setIsPrivate,
    winner,
    setWinner,
    handleSubmit,
  }
}
