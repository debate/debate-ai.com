"use client"

/**
 * @fileoverview Judges management section of the Round Editor dialog.
 *
 * Allows adding and removing judge email inputs dynamically.
 * At least one judge is always required.
 *
 * @module components/debate/dialogs/round-editor/JudgesSection
 */

import { Plus, Minus, Scale } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"

/** Props for {@link JudgesSection}. */
interface JudgesSectionProps {
  /** Current list of judge email values */
  judgeEmails: string[]
  /** Replace the entire judge emails list */
  setJudgeEmails: (v: string[]) => void
}

/**
 * Dynamic list of judge email inputs with add/remove controls.
 *
 * @param props - {@link JudgesSectionProps}
 * @returns The rendered section
 */
export function JudgesSection({ judgeEmails, setJudgeEmails }: JudgesSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold flex items-center gap-1.5">
          <Scale className="h-4 w-4" />
          Judges
        </h3>
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
  )
}
