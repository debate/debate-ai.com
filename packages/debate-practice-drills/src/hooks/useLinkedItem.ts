/**
 * @fileoverview Shared `?<param>=<id>` deep-link handling for the panels that
 * Settings → Saved to your account links straight into (word-count rounds,
 * drill sets). Reads the id from the URL, reports whether an item with that id
 * is on this device, and scrolls the linked item into view once — after it
 * first renders, which can be after the account merge adopts it.
 *
 * The panel owns the markup: it passes the ids it currently holds, attaches
 * `ref` to the matching item, outlines it, and shows a note while
 * `missing` is true.
 *
 * @module hooks/useLinkedItem
 */

"use client"

import { useEffect, useRef, type RefObject } from "react"
import { useSearchParams } from "next/navigation"

/** What {@link useLinkedItem} returns. */
export interface LinkedItem<T extends HTMLElement> {
  /** The id named by the URL param (trimmed), or `null` when there is none. */
  linkedId: string | null
  /** True when `linkedId` is set but no item on this device has that id. */
  missing: boolean
  /** Attach to the linked item's element; it is scrolled into view once. */
  ref: RefObject<T | null>
}

/**
 * Deep-link state for one panel.
 *
 * @param param - The query param naming the item (`round`, `drillSet`).
 * @param ids - The ids of the items this panel currently shows, or `null` while they load.
 */
export function useLinkedItem<T extends HTMLElement = HTMLDivElement>(
  param: string,
  ids: readonly string[] | null,
): LinkedItem<T> {
  const searchParams = useSearchParams()
  const linkedId = searchParams?.get(param)?.trim() || null
  const found = linkedId !== null && ids !== null && ids.includes(linkedId)
  const ref = useRef<T | null>(null)
  const scrolledTo = useRef<string | null>(null)

  useEffect(() => {
    if (!found || !linkedId || scrolledTo.current === linkedId) return
    const node = ref.current
    if (!node) return
    scrolledTo.current = linkedId
    node.scrollIntoView?.({ block: "center" })
  }, [found, linkedId])

  return { linkedId, missing: linkedId !== null && ids !== null && !found, ref }
}
