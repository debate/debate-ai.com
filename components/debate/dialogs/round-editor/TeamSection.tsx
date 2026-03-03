"use client"

/**
 * @fileoverview Team information section of the Round Editor dialog.
 *
 * Renders side-by-side columns for the Affirmative and Negative teams,
 * each with school name and debater email inputs.
 *
 * @module components/debate/dialogs/round-editor/TeamSection
 */

import Image from "next/image"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { debateStyles, debateStyleMap } from "@/components/debate/DebateRound/DebateTimer/debate-format-times"
import { IconAffBubble, IconNegBubble } from "@/components/icons"

/** Props for {@link TeamSection}. */
interface TeamSectionProps {
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
  debateStyleIndex: number
}

/**
 * Two-column grid showing Affirmative and Negative team inputs.
 *
 * @param props - {@link TeamSectionProps}
 * @returns The rendered section
 */
export function TeamSection({
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
  debateStyleIndex,
}: TeamSectionProps) {
  const styleKey = debateStyleMap[debateStyleIndex]
  const styleConfig = debateStyles[styleKey]
  const affNameRaw = styleConfig.primary.name
  const negNameRaw = styleConfig.secondary?.name || "neg"
  const isOnePerson = styleKey === "lincolnDouglas" || styleKey === "nofSpar"

  const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

  // Custom names for specific roles
  const getTeamName = (rawName: string) => {
    if (rawName === "aff") return "Affirmative"
    if (rawName === "neg") return "Negative"
    if (rawName === "prop") return "Proposition"
    if (rawName === "opp") return "Opposition"
    if (rawName === "pro") return "Pro"
    if (rawName === "con") return "Con"
    if (rawName === "bill") return "Bill Sponsor"
    return capitalize(rawName)
  }

  const affName = getTeamName(affNameRaw)
  const negName = getTeamName(negNameRaw)

  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Affirmative Team */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-blue-500 flex items-center gap-1.5">
          <Image src={IconAffBubble} alt="" width={20} height={20} />
          {affName}
        </h3>
        <div className="space-y-2">
          <Input
            id="aff-school"
            type="text"
            placeholder="School (Optional)"
            value={affSchool}
            onChange={(e) => setAffSchool(e.target.value)}
          />
          <Input
            id="aff-debater-1"
            type="email"
            placeholder="1A Email"
            value={affDebater1}
            onChange={(e) => setAffDebater1(e.target.value)}
          />
          {!isOnePerson && (
            <Input
              id="aff-debater-2"
              type="email"
              placeholder="2A Email (Optional)"
              value={affDebater2}
              onChange={(e) => setAffDebater2(e.target.value)}
            />
          )}
        </div>
      </div>

      {/* Negative Team */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
          <Image src={IconNegBubble} alt="" width={20} height={20} />
          {negName}
        </h3>
        <div className="space-y-2">
          <Input
            id="neg-school"
            type="text"
            placeholder="School (Optional)"
            value={negSchool}
            onChange={(e) => setNegSchool(e.target.value)}
          />
          <Input
            id="neg-debater-1"
            type="email"
            placeholder="1N Email"
            value={negDebater1}
            onChange={(e) => setNegDebater1(e.target.value)}
          />
          {!isOnePerson && (
            <Input
              id="neg-debater-2"
              type="email"
              placeholder="2N Email (Optional)"
              value={negDebater2}
              onChange={(e) => setNegDebater2(e.target.value)}
            />
          )}
        </div>
      </div>
    </div>
  )
}
