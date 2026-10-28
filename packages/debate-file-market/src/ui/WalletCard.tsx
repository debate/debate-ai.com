"use client"

/**
 * @fileoverview The reader's wallet: their balance and the $10 / $20 top-up
 * buttons. Each button starts a Stripe Checkout (`POST /api/market/top-up`)
 * and sends the reader to Stripe's payment page; Stripe sends them back with
 * `?topup=success`, and the balance moves once Stripe's webhook lands.
 *
 * @module debate-file-market/ui/WalletCard
 */

import { useState } from "react"
import { Loader2, Wallet as WalletIcon } from "lucide-react"
import { toast } from "sonner"
import { formatCents, type TopUpId, type TopUpOption, type Wallet } from "../index"
import { startTopUp } from "../client"
import { Button } from "./primitives/button"

export interface WalletCardProps {
  /** `null` signed out or on a guest account. */
  wallet: Wallet | null
  topUps: TopUpOption[]
  topUpsEnabled: boolean
  /** Where Stripe sends the reader back to; defaults to this page. */
  returnTo?: string
}

export function WalletCard({ wallet, topUps, topUpsEnabled, returnTo }: WalletCardProps) {
  const [pending, setPending] = useState<TopUpId | null>(null)

  const topUp = async (id: TopUpId) => {
    setPending(id)
    try {
      const back = returnTo ?? `${window.location.pathname}${window.location.search}`
      const { url } = await startTopUp(id, back.replace(/[?&]topup=[^&]*/, ""))
      window.location.assign(url)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start the payment.")
      setPending(null)
    }
  }

  return (
    <section className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4 text-card-foreground shadow-sm">
      <header className="flex items-center gap-2">
        <WalletIcon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-base font-semibold leading-none">Your wallet</h2>
      </header>
      {wallet ? (
        <>
          <p className="text-3xl font-semibold tabular-nums" aria-label="Wallet balance">
            {formatCents(wallet.balanceCents)}
          </p>
          <div className="flex flex-wrap gap-2">
            {topUps.map((option) => (
              <Button
                key={option.id}
                type="button"
                variant="outline"
                disabled={!topUpsEnabled || pending !== null}
                onClick={() => void topUp(option.id)}
              >
                {pending === option.id ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Add {option.label}
              </Button>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {topUpsEnabled
              ? "Pay securely with Stripe. Your balance buys files here; sales of your own files are added to it."
              : "Adding money isn't available on this site yet."}
          </p>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">
          <a className="underline" href="/login">
            Sign in
          </a>{" "}
          with an account to fund a wallet and buy or sell files.
        </p>
      )}
    </section>
  )
}

/** Shows the "payment received" note once, when Stripe sends the reader back. */
export function topUpReturnMessage(search: string): "success" | "cancelled" | null {
  const value = new URLSearchParams(search).get("topup")
  return value === "success" || value === "cancelled" ? value : null
}
