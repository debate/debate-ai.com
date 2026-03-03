"use client"

/**
 * @fileoverview Debate style selector section of the Round Editor dialog.
 *
 * Renders a dropdown populated from the user's debate style settings,
 * allowing them to choose which format (e.g. Policy, LD, PF) the round uses.
 *
 * @module components/debate/dialogs/round-editor/DebateStyleSection
 */

import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { settings } from "@/lib/state/settings"

/** Props for {@link DebateStyleSection}. */
interface DebateStyleSectionProps {
  /** Index of the currently selected debate style */
  debateStyleIndex: number
  /** Update the selected debate style index */
  setDebateStyleIndex: (v: number) => void
}

/**
 * Debate style selector backed by the user's configured style options.
 *
 * @param props - {@link DebateStyleSectionProps}
 * @returns The rendered section
 */
export function DebateStyleSection({ debateStyleIndex, setDebateStyleIndex }: DebateStyleSectionProps) {
  return (
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
  )
}
