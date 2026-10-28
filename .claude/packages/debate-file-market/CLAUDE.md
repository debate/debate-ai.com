# CLAUDE.md — `debate-file-market`

Public (`@debate-ai/` scope). Selling research files for real-money wallet
balance. Entry `src/index.ts` (outline preview, prices, top-ups, types),
browser calls at `debate-file-market/client`, tests in `test/`. User doc:
`packages/debate-help-docs/content/docs/features/research-evidence/file-market.mdx`.

## What lives where

- **Here**: pure code only. `outline.ts` (the free preview: `h1`–`h4`
  headings, i.e. pocket/hat/block/tag, never card text), `pricing.ts`
  (price limits, `parseSellRequest`), `topups.ts` (the $10 / $20 options,
  the Stripe Checkout Session form body, `topUpForEvent`), `types.ts`,
  `client.ts`, and `migrations/` (the D1 tables).
- **`apps/debate-ai.com`**: `app/api/market/**` (routes),
  `lib/market/queries.ts` (wallets, ledger, listings, purchases), and the
  top-up branch of `app/api/stripe/webhook/route.ts`.
- **Here, `src/ui/`** (`@debate-ai/file-market/ui`): the market board,
  the listing view (the route passes `editorHref`, since the editor's URLs
  belong to `debate-webview`), the wallet card, the outline preview and
  `listingHref`. A copy of the shadcn `Button` sits in `src/ui/primitives/`.
- **`debate-webview`**: `components/market/SellFileDialog.tsx` (it reads the
  open documents from the REASON docs provider), `routes/market/` (`/research/market`,
  `/research/market/[id]`), the "Sell…" item in
  `components/reason-docs/file-manager/FileTree.tsx` and the Sell button in
  `components/reason-editor/ShareWithContacts.tsx`.

## Things that bite

- **This is real money.** Balances are US cents. A wallet is only ever
  credited by a verified Stripe webhook (`creditTopUp`, once per Checkout
  Session via the unique `wallet_transactions.ref`) or by a sale. Never add a
  route that credits a wallet from a client request.
- **Top-ups need `STRIPE_SECRET_KEY`** (to create the Checkout Session) and
  the existing `STRIPE_WEBHOOK_SECRET`. Without the key the buttons show as
  unavailable and `/api/market/top-up` answers 503.
- **The tables are declared twice**: in the app's `schema.ts` and in
  `migrations/`. Change both; `apps/debate-ai.com/lib/market/__tests__/queries.test.ts`
  fails when they drift. Never edit an applied migration; add `0002_…`.
- **Every balance write is guarded** (D1 has no interactive transactions):
  the debit only lands while `balance_cents >= price`, and a purchase that
  loses the `file_purchases` key race refunds itself.
- **A listing is a snapshot** of the seller's document at the time they chose
  "Sell…". Editing the original doesn't change what buyers get until the
  seller sells it again.
- **The outline of a `.cmir` upload is worked out in the browser** (only the
  Debate Editor engine can read it) and sent with the sell request; the server
  sanitizes it. HTML documents are read server-side when no outline is sent.
