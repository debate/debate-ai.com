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
}: TeamSectionProps) {
  return (
    <div className="grid grid-cols-2 gap-4">
      {/* Affirmative Team */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-blue-500 flex items-center gap-1.5">
          <Image src="/icons/icon-aff-bubble.png" alt="" width={20} height={20} />
          Affirmative Team
        </h3>
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
        <h3 className="text-sm font-semibold text-red-500 flex items-center gap-1.5">
          <Image src="/icons/icon-neg-bubble.png" alt="" width={20} height={20} />
          Negative Team
        </h3>
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
  )
}
