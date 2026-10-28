"use client"

/**
 * @fileoverview The file market: research files people are selling, and the
 * reader's wallet.
 *
 * One read (`GET /api/market`) fills the page. Each listing links to its own
 * page (`/research/market/[id]`), which shows the free table-of-contents
 * preview and the Buy button. Files are put up for sale from the Files
 * sidebar's "Sell…" menu item. Rules and Stripe parsing are the
 * `debate-file-market` package; the routes are
 * `apps/debate-ai.com/app/api/market`.
 *
 * @module debate-file-market/ui/FileMarketPanel
 */

import { useCallback, useEffect, useState } from "react"
import { FileText, Loader2, ShoppingBag } from "lucide-react"
import { toast } from "sonner"
import { formatCents, type MarketBoardResponse } from "../index"
import { fetchMarketBoard } from "../client"
import { listingHref } from "./links"
import { WalletCard, topUpReturnMessage } from "./WalletCard"

/** After Stripe sends the reader back, how long to keep re-reading for the webhook's credit. */
const TOP_UP_POLLS = [2_000, 5_000, 10_000]

/** Handles `?topup=` once: a toast, then a few re-reads while the webhook lands. */
export function useTopUpReturn(reload: () => void) {
  useEffect(() => {
    const outcome = topUpReturnMessage(window.location.search)
    if (!outcome) return
    const url = new URL(window.location.href)
    url.searchParams.delete("topup")
    window.history.replaceState(null, "", url.toString())
    if (outcome === "cancelled") {
      toast("Payment cancelled — nothing was charged.")
      return
    }
    toast.success("Payment received. Your balance updates as soon as Stripe confirms it.")
    const timers = TOP_UP_POLLS.map((ms) => setTimeout(reload, ms))
    return () => timers.forEach(clearTimeout)
  }, [reload])
}

export function FileMarketPanel() {
  const [board, setBoard] = useState<MarketBoardResponse | null>(null)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(() => {
    fetchMarketBoard()
      .then((next) => {
        setBoard(next)
        setError(null)
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : "Could not load the market."))
  }, [])

  useEffect(load, [load])
  useTopUpReturn(load)

  if (!board) {
    return error ? (
      <p className="text-sm text-destructive">{error}</p>
    ) : (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
        <header className="flex items-start gap-2">
          <ShoppingBag className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
          <div>
            <h2 className="text-base font-semibold leading-none">Files for sale</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Open one to read its table of contents for free. To sell your own, right-click a file in the Files
              sidebar and choose Sell…
            </p>
          </div>
        </header>
        {board.listings.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing is for sale yet.</p>
        ) : (
          <ul className="divide-y divide-border">
            {board.listings.map((listing) => (
              <li key={listing.id}>
                <a
                  href={listingHref(listing.id)}
                  className="flex items-center gap-3 py-2.5 hover:bg-accent/40 sm:px-2"
                >
                  <FileText className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{listing.title}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {listing.seller.name} · {listing.headings} headings
                      {listing.sales > 0 ? ` · ${listing.sales} sold` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">{formatCents(listing.priceCents)}</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
      <div>
        <WalletCard wallet={board.wallet} topUps={board.topUps} topUpsEnabled={board.topUpsEnabled} />
      </div>
    </div>
  )
}
