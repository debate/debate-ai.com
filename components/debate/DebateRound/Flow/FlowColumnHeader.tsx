/**
 * @fileoverview Custom AG Grid column header component for Flow spreadsheet
 */

"use client"

import { FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { FlowColumnHeaderProps } from "./types"

/**
 * Simplified AG Grid column header — speech name + speech-doc icon only.
 */
export const FlowColumnHeader = (props: FlowColumnHeaderProps) => {
  if (!props.displayName) return null
  const name = props.displayName
  const hasN = name.toUpperCase().includes("N")
  const hasA = name.toUpperCase().includes("A")
  const textColor = hasN
    ? "text-red-600 dark:text-red-400"
    : hasA
      ? "text-blue-600 dark:text-blue-400"
      : ""

  return (
    <div className="flex items-center justify-between w-full px-2">
      <span className={`text-sm font-semibold ${textColor}`}>{name}</span>
      {props.onOpenSpeechPanel && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0"
          onClick={(e) => {
            e.stopPropagation()
            props.onOpenSpeechPanel!(name)
          }}
          title={`Open ${name} speech document`}
        >
          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      )}
    </div>
  )
}
