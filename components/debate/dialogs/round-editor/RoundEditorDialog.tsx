"use client"

/**
 * @fileoverview Round Editor Dialog — top-level component.
 *
 * A comprehensive dialog for creating and editing debate rounds. Delegates
 * form state to {@link useRoundEditorForm} and renders composable section
 * components for tournament info, debate style, teams, judges, and winner.
 *
 * @module components/debate/dialogs/round-editor/RoundEditorDialog
 */

import Image from "next/image"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Component as ShatterButton } from "@/components/ui/shatter-button"
import { useRoundEditorForm } from "./useRoundEditorForm"
import { TournamentSection } from "./TournamentSection"
import { DebateStyleSection } from "./DebateStyleSection"
import { TeamSection } from "./TeamSection"
import { JudgesSection } from "./JudgesSection"
import { WinnerSection } from "./WinnerSection"

/**
 * Props for the {@link RoundEditorDialog} component.
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
 * Dialog for creating or editing a debate round.
 *
 * When creating a new round the component generates initial flows based on
 * the selected debate style, archives existing flows, and persists everything
 * to localStorage.
 *
 * @param props - {@link RoundEditorDialogProps}
 * @returns The round editor dialog
 *
 * @example
 * ```tsx
 * // Creating a new round
 * <RoundEditorDialog open={isOpen} onOpenChange={setIsOpen} />
 *
 * // Editing an existing round
 * <RoundEditorDialog open={isOpen} onOpenChange={setIsOpen} roundId={123} />
 * ```
 */
export function RoundEditorDialog({ open, onOpenChange, roundId }: RoundEditorDialogProps) {
  const form = useRoundEditorForm(open, onOpenChange, roundId)

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
          <TournamentSection
            tournamentName={form.tournamentName}
            setTournamentName={form.setTournamentName}
            filteredSuggestions={form.filteredSuggestions}
            tournamentSuggestions={form.tournamentSuggestions}
            showAutocomplete={form.showAutocomplete}
            setShowAutocomplete={form.setShowAutocomplete}
            roundLevel={form.roundLevel}
            setRoundLevel={form.setRoundLevel}
            isPrivate={form.isPrivate}
            setIsPrivate={form.setIsPrivate}
          />

          <DebateStyleSection
            debateStyleIndex={form.debateStyleIndex}
            setDebateStyleIndex={form.setDebateStyleIndex}
          />

          <TeamSection
            affDebater1={form.affDebater1}
            setAffDebater1={form.setAffDebater1}
            affDebater2={form.affDebater2}
            setAffDebater2={form.setAffDebater2}
            negDebater1={form.negDebater1}
            setNegDebater1={form.setNegDebater1}
            negDebater2={form.negDebater2}
            setNegDebater2={form.setNegDebater2}
            affSchool={form.affSchool}
            setAffSchool={form.setAffSchool}
            negSchool={form.negSchool}
            setNegSchool={form.setNegSchool}
          />

          <JudgesSection
            judgeEmails={form.judgeEmails}
            setJudgeEmails={form.setJudgeEmails}
          />

          {roundId && (
            <WinnerSection
              winner={form.winner}
              setWinner={form.setWinner}
            />
          )}

          <div className="pt-4 pb-2">
            <ShatterButton
              onClick={form.handleSubmit}
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
