"use client"

/**
 * @fileoverview The small info modal for an official camp publisher: where
 * the camp is, who to contact, its dates, cost and deadline, its website and
 * openev page, and Follow. Opened from a file's "Published by" line in the
 * "About this file" note and from a Topic Starters file's menu.
 *
 * The card itself is `CampPublisherDetails` from `@debate-ai/file-market/ui`,
 * which also renders the camp's page at `/research/publishers/camp-<code>`.
 *
 * @module docs/metadata/CampPublisherDialog
 */

import { publisherHref, type CampPublisher } from "@debate-ai/file-market"
import { CampPublisherDetails } from "@debate-ai/file-market/ui"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "../../ui/primitives/dialog"

export interface CampPublisherDialogProps {
  /** The camp to show; `null` keeps the modal closed. */
  camp: CampPublisher | null
  onClose: () => void
}

export function CampPublisherDialog({ camp, onClose }: CampPublisherDialogProps) {
  return (
    <Dialog open={camp !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col sm:max-w-lg">
        {camp && (
          <>
            <DialogHeader className="shrink-0 pr-6">
              <DialogTitle className="break-words">{camp.name}</DialogTitle>
              <DialogDescription>
                {camp.code} · {camp.host} ·{" "}
                <a href={publisherHref(camp.slug)} className="text-primary underline-offset-2 hover:underline">
                  Publisher page
                </a>
              </DialogDescription>
            </DialogHeader>
            <div className="-mx-1 min-h-0 flex-1 overflow-y-auto px-1">
              <CampPublisherDetails camp={camp} hideHeading />
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
