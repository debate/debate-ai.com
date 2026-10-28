"use client"

/**
 * @fileoverview One file for sale: the free preview (title, seller, price and
 * table of contents — no cards) and the Buy button.
 *
 * Buying pays the price from the reader's wallet (`POST
 * /api/market/listings/[id]/purchase`) and saves the full file to their own
 * files, which then opens in the editor. A wallet that doesn't cover the
 * price gets the top-up buttons right there. The seller and past buyers see
 * "Open a copy" instead.
 *
 * @module debate-file-market/ui/ListingView
 */

import { useCallback, useEffect, useState } from "react"
import { FileText, Loader2, Lock, ShoppingCart, Unlock } from "lucide-react"
import { toast } from "sonner"
import { formatCents, type ListingDetail, type MarketBoardResponse } from "../index"
import { copyListing, fetchListing, fetchMarketBoard, purchaseListing } from "../client"
import { Button } from "./primitives/button"
import { OutlinePreview } from "./OutlinePreview"
import { WalletCard } from "./WalletCard"
import { useTopUpReturn } from "./FileMarketPanel"

export interface ListingViewProps {
  /** The listing's id, from the route. */
  id: string
  /** The editor URL that opens one of the reader's own files. */
  editorHref: (documentId: number) => string
}

export function ListingView({ id, editorHref }: ListingViewProps) {
  const openInEditor = (documentId: number) => {
    // A full load, so the editor's file list includes the copy just made.
    window.location.assign(editorHref(documentId))
  }

  const [listing, setListing] = useState<ListingDetail | null>(null)
  const [board, setBoard] = useState<MarketBoardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => {
    fetchListing(id)
      .then(setListing)
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load that file."))
    fetchMarketBoard()
      .then(setBoard)
      .catch(() => {})
  }, [id])

  useEffect(load, [load])
  useTopUpReturn(load)

  const buy = async () => {
    setBusy(true)
    try {
      const result = await purchaseListing(id)
      setListing(result.listing)
      setBoard((prev) => (prev ? { ...prev, wallet: result.wallet } : prev))
      toast.success(`Bought "${result.listing.title}". Opening it now.`)
      openInEditor(result.documentId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not buy that file.")
      load()
    } finally {
      setBusy(false)
    }
  }

  const openCopy = async () => {
    setBusy(true)
    try {
      openInEditor((await copyListing(id)).documentId)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not save a copy of that file.")
      setBusy(false)
    }
  }

  if (!listing) {
    return error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const wallet = board?.wallet ?? null
  const short = wallet !== null && wallet.balanceCents < listing.priceCents

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="flex flex-col gap-4 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <header className="flex items-start gap-2">
          <FileText className="mt-1 h-5 w-5 text-muted-foreground" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold leading-tight">{listing.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Sold by {listing.seller.name}
              {listing.sales > 0 ? ` · ${listing.sales} sold` : ""}
              {!listing.active ? " · no longer for sale" : ""}
            </p>
          </div>
          <span className="text-xl font-semibold tabular-nums">{formatCents(listing.priceCents)}</span>
        </header>

        <div className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-sm font-medium">
            {listing.owned ? <Unlock className="h-4 w-4" /> : <Lock className="h-4 w-4" />}
            Table of contents
          </p>
          <OutlinePreview outline={listing.outline} className="max-h-[60vh]" />
          {!listing.owned && (
            <p className="text-xs text-muted-foreground">
              The preview shows the headings only. Buy the file to get every card — cites, card text and highlighting —
              saved to your own files.
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {listing.owned ? (
            <Button type="button" disabled={busy} onClick={() => void openCopy()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
              {listing.isSeller ? "Open a copy" : "Open a copy in my files"}
            </Button>
          ) : (
            <Button type="button" disabled={busy || wallet === null || short || !listing.active} onClick={() => void buy()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShoppingCart className="h-4 w-4" />}
              Buy for {formatCents(listing.priceCents)}
            </Button>
          )}
          {short && !listing.owned && (
            <span className="text-xs text-muted-foreground">
              Your wallet has {formatCents(wallet!.balanceCents)}. Add money to buy this file.
            </span>
          )}
        </div>
      </section>
      <div>
        {board && <WalletCard wallet={board.wallet} topUps={board.topUps} topUpsEnabled={board.topUpsEnabled} />}
      </div>
    </div>
  )
}
