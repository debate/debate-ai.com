"use client"

/**
 * @fileoverview Winner selection section of the Round Editor dialog.
 *
 * Only rendered when editing an existing round (i.e. `roundId` is provided).
 * Allows setting the round outcome to Aff, Neg, or Undecided.
 *
 * @module components/debate/dialogs/round-editor/WinnerSection
 */

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

/** Props for {@link WinnerSection}. */
interface WinnerSectionProps {
  /** Currently selected winner */
  winner: "aff" | "neg" | "none"
  /** Update the winner selection */
  setWinner: (v: "aff" | "neg" | "none") => void
}

/**
 * Dropdown for selecting the round winner (Aff / Neg / Undecided).
 *
 * @param props - {@link WinnerSectionProps}
 * @returns The rendered section
 */
export function WinnerSection({ winner, setWinner }: WinnerSectionProps) {
  return (
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
  )
}
