/**
 * @fileoverview Overlay opened from the flow grid's "Tag argument…" context
 * menu entry — mirrors `PrepNotePopover`'s fixed-position,
 * click-outside/Escape-to-close pattern. Sets or clears a row's
 * `argumentType`/`authorId`/`evidenceStatus`, the three fields the Argument
 * Tree Outline panel (`/outline`) filters and badges on but which nothing in
 * the live flow UI could populate before.
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { Tags } from "lucide-react"
import type { ArgumentType, EvidenceStatus } from "debate-core/src/types/flow"
import { ARGUMENT_TYPES, EVIDENCE_STATUSES } from "./argument-tagging"
import type { ArgumentTags } from "./argument-tagging"

export interface ArgumentTagPopoverProps {
  x: number
  y: number
  /** The tags the row currently carries, used to seed the form. */
  tags: ArgumentTags
  /** Contributor ids already used elsewhere in this flow, offered as suggestions. */
  authorIdSuggestions: string[]
  onSave: (tags: ArgumentTags) => void
  onClose: () => void
}

const NONE_VALUE = "__none__"

const POPOVER_WIDTH = 260
const POPOVER_MAX_HEIGHT = 260

export function ArgumentTagPopover({
  x,
  y,
  tags,
  authorIdSuggestions,
  onSave,
  onClose,
}: ArgumentTagPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [argumentType, setArgumentType] = useState<ArgumentType | undefined>(tags.argumentType)
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus | undefined>(
    tags.evidenceStatus,
  )
  const [authorId, setAuthorId] = useState(tags.authorId ?? "")

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", handleClickOutside)
    document.addEventListener("keydown", handleEsc)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
      document.removeEventListener("keydown", handleEsc)
    }
  }, [onClose])

  const style = {
    left: Math.min(x, window.innerWidth - POPOVER_WIDTH - 8),
    top: Math.min(y, window.innerHeight - POPOVER_MAX_HEIGHT - 8),
  }

  const selectClass = "rounded border border-input bg-background px-1.5 py-1 text-xs"

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 flex w-[260px] flex-col gap-2 rounded-md border bg-popover p-2 text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95"
      style={style}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex items-center gap-1 text-xs font-medium">
        <Tags className="h-3 w-3" />
        Tag this argument
      </div>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Argument type
        <select
          className={selectClass}
          value={argumentType ?? NONE_VALUE}
          onChange={(e) =>
            setArgumentType(
              e.target.value === NONE_VALUE ? undefined : (e.target.value as ArgumentType),
            )
          }
        >
          <option value={NONE_VALUE}>None</option>
          {ARGUMENT_TYPES.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Evidence status
        <select
          className={selectClass}
          value={evidenceStatus ?? NONE_VALUE}
          onChange={(e) =>
            setEvidenceStatus(
              e.target.value === NONE_VALUE ? undefined : (e.target.value as EvidenceStatus),
            )
          }
        >
          <option value={NONE_VALUE}>None</option>
          {EVIDENCE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        Contributor
        <input
          className={selectClass}
          list="flow-argument-author-ids"
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          placeholder="Author ID"
        />
        <datalist id="flow-argument-author-ids">
          {authorIdSuggestions.map((id) => (
            <option key={id} value={id} />
          ))}
        </datalist>
      </label>

      <button
        type="button"
        className="self-end rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        onClick={() => {
          onSave({ argumentType, evidenceStatus, authorId })
          onClose()
        }}
      >
        Save tags
      </button>
    </div>
  )
}
