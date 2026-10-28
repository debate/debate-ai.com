"use client"

/**
 * @fileoverview "Sell…" on a file: put one of your own files up for sale.
 *
 * Opened from the Files sidebar's row menu (beside "Share…") and from the
 * share-with-contacts dialog. The seller sets a price; the dialog shows the
 * free preview buyers will see — the file's table of contents (pocket, hat,
 * block and tag headings) and none of the cards — and lists it through
 * `POST /api/market/listings`. Selling a file that is already listed reprices
 * it and refreshes the copy buyers get.
 *
 * The outline is worked out here because an uploaded `.cmir` file can only be
 * read with the Debate Editor engine, which lives in the browser.
 *
 * @module components/market/SellFileDialog
 */

import { useEffect, useMemo, useState } from "react"
import { Link2, Loader2, Tag } from "lucide-react"
import { toast } from "sonner"
import {
  MAX_PRICE_CENTS,
  MIN_PRICE_CENTS,
  dollarsToCents,
  formatCents,
  outlineFromHtml,
  validatePriceCents,
  type OutlineEntry,
} from "@debate-ai/file-market"
import { sellFile, stopSelling } from "@debate-ai/file-market/client"
import { Button } from "@debate-ai/ui/primitives/button"
import { Input } from "@debate-ai/ui/primitives/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@debate-ai/ui/primitives/dialog"
import { useSession } from "../../lib/hooks/useSession"
import { loadStoredCmir } from "../../lib/debate-editor/lazy-stored-cmir"
import { isCmirContent } from "../../lib/debate-editor/content-format"
import { useReasonDocs } from "../reason-docs/ReasonDocsProvider"
import { OutlinePreview, listingHref } from "@debate-ai/file-market/ui"

export interface SellFileDialogProps {
  /** The file to sell; `null` keeps the dialog closed. */
  documentId: number | null
  onClose: () => void
}

export function SellFileDialog({ documentId, onClose }: SellFileDialogProps) {
  const { isAuthenticated } = useSession()
  const { documents } = useReasonDocs()
  const doc = useMemo(() => documents.find((d) => d.id === documentId) ?? null, [documents, documentId])

  const [price, setPrice] = useState("5.00")
  const [outline, setOutline] = useState<OutlineEntry[] | null>(null)
  const [existing, setExisting] = useState<{ id: string; priceCents: number } | null>(null)
  const [busy, setBusy] = useState(false)

  // The current listing, if this file is already for sale.
  useEffect(() => {
    setExisting(null)
    if (documentId == null || !isAuthenticated) return
    let cancelled = false
    void fetch(`/api/market/listings?documentId=${documentId}`)
      .then((res) => (res.ok ? res.json() : { listing: null }))
      .then((body: { listing: { id: string; priceCents: number } | null }) => {
        if (cancelled || !body.listing) return
        setExisting(body.listing)
        setPrice((body.listing.priceCents / 100).toFixed(2))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [documentId, isAuthenticated])

  // The preview: the file's headings, read from its HTML.
  useEffect(() => {
    setOutline(null)
    if (!doc) return
    let cancelled = false
    void (async () => {
      let html = doc.content ?? ""
      if (isCmirContent(doc)) {
        try {
          html = (await loadStoredCmir()).storedContentToHtml(doc)
        } catch {
          html = ""
        }
      }
      if (!cancelled) setOutline(outlineFromHtml(html))
    })()
    return () => {
      cancelled = true
    }
  }, [doc])

  const cents = dollarsToCents(price)
  const priceCheck = validatePriceCents(cents)

  const submit = async () => {
    if (!doc || !priceCheck.ok) return
    setBusy(true)
    try {
      const { listing } = await sellFile({ documentId: doc.id, priceCents: priceCheck.value, outline: outline ?? [] })
      const url = `${window.location.origin}${listingHref(listing.id)}`
      toast.success(`"${listing.title}" is for sale at ${formatCents(listing.priceCents)}.`, {
        action: {
          label: "Copy link",
          onClick: () => void navigator.clipboard?.writeText(url).catch(() => {}),
        },
      })
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not list that file for sale.")
    } finally {
      setBusy(false)
    }
  }

  const stop = async () => {
    if (!existing) return
    setBusy(true)
    try {
      await stopSelling(existing.id)
      toast.success("No longer for sale. Anyone who bought it keeps it.")
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not stop selling that file.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={documentId != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Sell “{doc?.title || "Untitled"}”</DialogTitle>
          <DialogDescription>
            Anyone can see the table of contents below for free. Buyers pay from their wallet to unlock the cards,
            and the price goes to your wallet.
          </DialogDescription>
        </DialogHeader>

        {!isAuthenticated ? (
          <p className="text-sm text-muted-foreground">Sign in to sell your files.</p>
        ) : (
          <>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium">Price (USD)</span>
              <Input
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                aria-label="Price in US dollars"
                aria-invalid={!priceCheck.ok}
              />
              <span className={priceCheck.ok ? "text-xs text-muted-foreground" : "text-xs text-destructive"}>
                {priceCheck.ok
                  ? `Between ${formatCents(MIN_PRICE_CENTS)} and ${formatCents(MAX_PRICE_CENTS)}.`
                  : priceCheck.error}
              </span>
            </label>

            <div className="flex flex-col gap-1">
              <p className="text-sm font-medium">Free preview</p>
              {outline === null ? (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" /> Reading the file's headings…
                </p>
              ) : (
                <OutlinePreview outline={outline} className="max-h-48" />
              )}
            </div>

            {existing && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <Link2 className="h-3 w-3" />
                Already for sale at {formatCents(existing.priceCents)} —{" "}
                <a className="underline" href={listingHref(existing.id)}>
                  view listing
                </a>
                . Selling again updates the price and the copy buyers get.
              </p>
            )}
          </>
        )}

        <DialogFooter className="gap-2">
          {existing && (
            <Button type="button" variant="ghost" disabled={busy} onClick={() => void stop()}>
              Stop selling
            </Button>
          )}
          <Button
            type="button"
            disabled={!isAuthenticated || !doc || !priceCheck.ok || outline === null || busy}
            onClick={() => void submit()}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Tag className="h-4 w-4" />}
            {existing ? "Update listing" : "Sell"}
            {priceCheck.ok ? ` for ${formatCents(priceCheck.value)}` : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
