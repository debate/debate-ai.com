/**
 * @fileoverview Overlay opened from the flow grid's "Tag argument…" context
 * menu entry — mirrors `PrepNotePopover`'s fixed-position,
 * click-outside/Escape-to-close pattern. Sets or clears a row's
 * `argumentType`/`authorId`/`evidenceStatus`, the three fields the Argument
 * Tree Outline panel (`/outline`) filters and badges on but which nothing in
 * the live flow UI could populate before.
 *
 * Also shows how the row's neighbours in the same section are already
 * tagged, and offers a "tag every other row in this section too" bulk
 * option — closing the two remaining Known gaps recorded in
 * `docs/features/argument-tree-outline.md`.
 */

"use client"

import { useEffect, useRef, useState } from "react"
import { Tags } from "lucide-react"
import type { ArgumentType, EvidenceStatus } from "debate-core/src/types/flow"
import { ARGUMENT_TYPES, EVIDENCE_STATUSES, formatArgumentTags } from "./argument-tagging"
import type { ArgumentTags, SectionRowPreview } from "./argument-tagging"

export interface ArgumentTagPopoverProps {
  x: number
  y: number
  /** The tags the row currently carries, used to seed the form. */
  tags: ArgumentTags
  /** Contributor ids already used elsewhere in this flow, offered as suggestions. */
  authorIdSuggestions: string[]
  /** Every *other* row in this row's section, with its own content and current tags. */
  sectionRows?: SectionRowPreview[]
  /** `applyToSection` is true when the "also tag these rows" checkbox was checked. */
  onSave: (tags: ArgumentTags, applyToSection: boolean) => void
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
  sectionRows = [],
  onSave,
  onClose,
}: ArgumentTagPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null)
  const [argumentType, setArgumentType] = useState<ArgumentType | undefined>(tags.argumentType)
  const [evidenceStatus, setEvidenceStatus] = useState<EvidenceStatus | undefined>(
    tags.evidenceStatus,
  )
  const [authorId, setAuthorId] = useState(tags.authorId ?? "")
  const [applyToSection, setApplyToSection] = useState(false)

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

      {sectionRows.length > 0 && (
        <div className="flex flex-col gap-1 rounded border border-input bg-muted/30 p-1.5 text-[11px]">
          <span className="font-medium text-muted-foreground">Other rows in this section</span>
          <ul className="flex max-h-24 flex-col gap-0.5 overflow-y-auto">
            {sectionRows.map((row) => (
              <li key={row.rowIndex} className="flex justify-between gap-2 text-muted-foreground">
                <span className="truncate">{row.label || "(empty)"}</span>
                <span className="shrink-0">{formatArgumentTags(row.tags) || "—"}</span>
              </li>
            ))}
          </ul>
          <label className="flex items-center gap-1.5 pt-1 text-muted-foreground">
            <input
              type="checkbox"
              checked={applyToSection}
              onChange={(e) => setApplyToSection(e.target.checked)}
            />
            Also tag {sectionRows.length === 1 ? "this row" : `these ${sectionRows.length} rows`}
          </label>
        </div>
      )}

      <button
        type="button"
        className="self-end rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:bg-primary/90"
        onClick={() => {
          onSave({ argumentType, evidenceStatus, authorId }, applyToSection)
          onClose()
        }}
      >
        Save tags
      </button>
    </div>
  )
}
