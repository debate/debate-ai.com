"use client"

/**
 * @fileoverview Speech Document Dialog Component
 *
 * A full-screen dialog for editing speech document notes.
 * Provides a larger editing area compared to the inline speech panel.
 *
 * @module components/debate/dialogs/SpeechDocDialog
 */

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useState, useEffect } from "react"

/**
 * Props for the SpeechDocDialog component
 */
interface SpeechDocDialogProps {
  /** Whether the dialog is open */
  open: boolean
  /** Callback to change dialog open state */
  onOpenChange: (open: boolean) => void
  /** Name of the speech being edited */
  speechName: string
  /** Current content of the speech document */
  content: string
  /** Callback invoked with the updated content when the user saves */
  onUpdate: (content: string) => void
}

/**
 * SpeechDocDialog - Full-screen speech document editor
 *
 * Provides a larger editing area for speech documents with
 * markdown support and save/cancel actions.
 *
 * @param props - Component props
 * @param props.open - Whether the dialog is open
 * @param props.onOpenChange - Callback to change dialog open state
 * @param props.speechName - Name of the speech being edited
 * @param props.content - Current content of the speech document
 * @param props.onUpdate - Callback invoked with updated content when the user saves
 * @returns The speech document dialog component
 *
 * @example
 * ```tsx
 * <SpeechDocDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   speechName="1AC"
 *   content={speechContent}
 *   onUpdate={(newContent) => saveSpeechDoc(newContent)}
 * />
 * ```
 */
export function SpeechDocDialog({ open, onOpenChange, speechName, content, onUpdate }: SpeechDocDialogProps) {
  // Local content state for editing
  const [localContent, setLocalContent] = useState(content)

  /**
   * Sync local content with prop changes.
   */
  useEffect(() => {
    setLocalContent(content)
  }, [content])

  /**
   * Save the current local content and close the dialog.
   */
  const handleSave = () => {
    onUpdate(localContent)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>{speechName}</DialogTitle>
        </DialogHeader>

        {/* Textarea for markdown content */}
        <div className="flex-1 overflow-hidden">
          <Textarea
            value={localContent}
            onChange={(e) => setLocalContent(e.target.value)}
            placeholder="Write your speech notes here using markdown..."
            className="h-full w-full resize-none font-mono"
          />
        </div>

        {/* Action buttons */}
        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 rounded bg-[var(--background)] hover:bg-[var(--background-hover)]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-2 rounded bg-[var(--accent-color)] text-[var(--accent-text)] hover:opacity-90"
          >
            Save
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
