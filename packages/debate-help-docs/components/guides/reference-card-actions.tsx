"use client"
/**
 * @file reference-card-actions.tsx
 * @description The row of icon buttons at the top of every card in the
 * References side panel (`references-panel.tsx`):
 *
 * - **Reading mode**: opens the source article in reading mode
 *   (`reference-reading-mode.tsx`).
 * - **Copy**: copies the reference, its citation text and its link when it has
 *   one, and says "Copied" for a moment.
 * - **Favorite**: a star toggle that saves the reference to the reader's
 *   favorites (`@debate-ai/reading-mode/favorites`). They are kept in this
 *   browser and, for a signed-in reader, in their account, and are listed under
 *   Research → Library → Favorite References.
 */
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react"
import { Check, Copy, Star } from "lucide-react"
import {
  favoriteReferenceId,
  isFavoriteReference,
  subscribeFavoriteReferences,
  toFavoriteReference,
  toggleFavoriteReference,
} from "@debate-ai/reading-mode/favorites"
import type { ReferenceDescription } from "@debate-ai/reading-mode/references"
import { cn } from "../../lib/utils"
import { ReferenceIconButton } from "./reference-icon-button"
import { ReferenceReadingModeButton, describeItem } from "./reference-reading-mode"
import type { ReferenceItem } from "./references-panel-items"

/** Marks the Copy button, so tests and the panel can find it. */
export const REFERENCE_COPY_ATTRIBUTE = "data-reference-copy"
/** Marks the Favorite button. */
export const REFERENCE_FAVORITE_ATTRIBUTE = "data-reference-favorite"
/** How long "Copied" shows, in ms. */
export const COPIED_FEEDBACK_MS = 1800

/** What Copy puts on the clipboard: the citation, then its link on its own line when it has one. */
export function referenceCopyText(reference: Pick<ReferenceDescription, "citation" | "url">): string {
  const citation = reference.citation.trim()
  const url = reference.url.trim()
  return url && !citation.includes(url) ? `${citation}\n${url}` : citation
}

async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // Fall through to the selection-based copy (an insecure page or a denied permission).
  }
  try {
    const area = document.createElement("textarea")
    area.value = text
    area.setAttribute("readonly", "")
    area.style.cssText = "position:fixed;top:0;left:0;opacity:0"
    document.body.append(area)
    area.select()
    const ok = document.execCommand("copy")
    area.remove()
    return ok
  } catch {
    return false
  }
}

function whoOf(item: Pick<ReferenceItem, "authors" | "year">): string {
  return [item.authors, item.year].filter(Boolean).join(" ")
}

type CopyState = "idle" | "copied" | "failed"

function ReferenceCopyButton({ item }: { item: ReferenceItem }) {
  const [state, setState] = useState<CopyState>("idle")
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = useCallback(async () => {
    const ok = await writeClipboard(referenceCopyText(describeItem(item)))
    setState(ok ? "copied" : "failed")
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setState("idle"), COPIED_FEEDBACK_MS)
  }, [item])

  const who = whoOf(item)
  const label = state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : who ? `Copy reference: ${who}` : "Copy reference"
  return (
    <>
      <ReferenceIconButton
        {...{ [REFERENCE_COPY_ATTRIBUTE]: state }}
        label={label}
        tooltip={state === "idle" ? "Copy the citation and link" : label}
        className={cn(state === "copied" && "text-emerald-600 dark:text-emerald-400", state === "failed" && "text-red-600")}
        onClick={copy}
      >
        {state === "copied" ? <Check aria-hidden /> : <Copy aria-hidden />}
      </ReferenceIconButton>
      <span role="status" className="sr-only">
        {state === "copied" ? "Copied" : state === "failed" ? "Could not copy" : ""}
      </span>
    </>
  )
}

function ReferenceFavoriteButton({ item }: { item: ReferenceItem }) {
  const reference = describeItem(item)
  const id = favoriteReferenceId(reference)
  const favorite = useSyncExternalStore(
    subscribeFavoriteReferences,
    () => isFavoriteReference(id),
    () => false,
  )
  const who = whoOf(item)
  return (
    <ReferenceIconButton
      {...{ [REFERENCE_FAVORITE_ATTRIBUTE]: favorite ? "on" : "off" }}
      aria-pressed={favorite}
      label={favorite ? (who ? `Remove from favorites: ${who}` : "Remove from favorites") : who ? `Add to favorites: ${who}` : "Add to favorites"}
      tooltip={favorite ? "Remove from favorites" : "Save to favorites (Research, Library)"}
      className={cn(favorite && "text-amber-500 hover:text-amber-500 dark:text-amber-400")}
      onClick={() => toggleFavoriteReference(toFavoriteReference(reference, window.location.pathname))}
    >
      <Star className={cn(favorite && "fill-current")} aria-hidden />
    </ReferenceIconButton>
  )
}

/** The icon row for one References panel card. */
export function ReferenceCardActions({ item }: { item: ReferenceItem }) {
  return (
    <div className="flex items-center gap-0.5 border-b px-1.5 py-1" data-reference-card-toolbar="">
      <ReferenceReadingModeButton item={item} />
      <ReferenceCopyButton item={item} />
      <ReferenceFavoriteButton item={item} />
    </div>
  )
}
