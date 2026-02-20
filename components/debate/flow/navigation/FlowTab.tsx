"use client"

/**
 * @fileoverview Flow Tab Component
 *
 * Represents a single flow tab in the sidebar navigation.
 * Provides:
 * - Selection highlighting
 * - Inline renaming with keyboard support
 * - Archive toggle
 * - Delete with confirmation dialog
 *
 * @module components/debate/flow/navigation/FlowTab
 */

import type React from "react"

import { useState } from "react"
import { cn } from "@/lib/utils"
import { Edit2, Archive, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

/**
 * Props for the FlowTab component
 */
interface FlowTabProps {
  /** The flow data to display */
  flow: Flow
  /** Whether this tab is currently selected */
  selected: boolean
  /** Callback when the tab is clicked */
  onClick: () => void
  /** Optional callback to rename the flow */
  onRename?: (newName: string) => void
  /** Optional callback to toggle archive status */
  onArchive?: () => void
  /** Optional callback to delete the flow */
  onDelete?: () => void
}

/**
 * FlowTab - Individual flow tab in sidebar navigation
 *
 * Displays a flow's name with hover actions for rename, archive, and delete.
 * Supports inline editing with Enter to confirm and Escape to cancel.
 * Archived flows are displayed with reduced opacity and an "(Archived)" suffix.
 *
 * @param props - Component props
 * @returns The flow tab component
 *
 * @example
 * ```tsx
 * <FlowTab
 *   flow={myFlow}
 *   selected={currentFlowId === myFlow.id}
 *   onClick={() => selectFlow(myFlow.id)}
 *   onRename={(name) => renameFlow(myFlow.id, name)}
 *   onArchive={() => toggleArchive(myFlow.id)}
 *   onDelete={() => deleteFlow(myFlow.id)}
 * />
 * ```
 */
export function FlowTab({ flow, selected, onClick, onRename, onArchive, onDelete }: FlowTabProps) {
  // Local state for hover, editing, and delete confirmation
  const [isHovered, setIsHovered] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(flow.content || "Untitled Flow")
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  /**
   * Enter edit mode for renaming
   */
  const handleRename = () => {
    setIsEditing(true)
  }

  /**
   * Submit the new name
   */
  const handleRenameSubmit = () => {
    onRename?.(editValue)
    setIsEditing(false)
  }

  /**
   * Cancel editing and revert to original name
   */
  const handleRenameCancel = () => {
    setEditValue(flow.content || "Untitled Flow")
    setIsEditing(false)
  }

  /**
   * Handle archive button click
   * Stops propagation to prevent selecting the tab
   */
  const handleArchive = (e: React.MouseEvent) => {
    e.stopPropagation()
    onArchive?.()
  }

  /**
   * Handle delete button click
   * Shows confirmation dialog
   */
  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    setShowDeleteConfirm(true)
  }

  /**
   * Confirm deletion after user approval
   */
  const handleDeleteConfirm = () => {
    onDelete?.()
    setShowDeleteConfirm(false)
  }

  return (
    <>
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={onClick}
        className={cn(
          "w-full text-left p-[var(--padding)] rounded-[var(--border-radius)]",
          "transition-colors duration-[var(--transition-speed)]",
          "hover:bg-[var(--background-indent)]",
          "flex items-center justify-between group cursor-pointer",
          selected && "bg-[var(--background-active)] font-bold",
          flow.archived && "opacity-50",
        )}
      >
        {/* Editable name input or display text */}
        {isEditing ? (
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRenameSubmit()
              } else if (e.key === "Escape") {
                handleRenameCancel()
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent border-none outline-none"
            autoFocus
          />
        ) : (
          <span className="flex-1 truncate">
            {flow.content || "Untitled Flow"}
            {flow.archived && " (Archived)"}
          </span>
        )}

        {/* Action buttons (visible on hover) */}
        {isHovered && !isEditing && (
          <div className="flex gap-1 ml-2" onClick={(e) => e.stopPropagation()}>
            {/* Rename button */}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleRename} title="Rename flow">
              <Edit2 className="h-3 w-3" />
            </Button>

            {/* Archive button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0"
              onClick={handleArchive}
              title={flow.archived ? "Unarchive flow" : "Archive flow"}
            >
              <Archive className="h-3 w-3" />
            </Button>

            {/* Delete button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-destructive hover:text-destructive-foreground"
              onClick={handleDelete}
              title="Delete flow"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Flow</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{flow.content || "Untitled Flow"}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteConfirm} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
