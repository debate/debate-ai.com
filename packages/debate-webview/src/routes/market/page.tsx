import { FileMarketPanel } from "@debate-ai/file-market/ui"
import { ToolPage, ToolPageHeader } from "../../components/tools/ToolPageHeader"

/**
 * File Market: research files people sell for wallet balance. Each file's
 * table of contents is a free preview; buying unlocks the cards. Wallets are
 * funded with $10 or $20 Stripe top-ups. Files are listed from the Files
 * sidebar's "Sell…" menu item.
 */
export default function FileMarketPage() {
  return (
    <ToolPage>
      <ToolPageHeader
        href="/research/market"
        backHref="/research"
        backLabel="research"
        title="File Market"
        description="Buy research files from other debaters, or sell your own. Every file's table of contents is free to read."
      />
      <FileMarketPanel />
    </ToolPage>
  )
}
