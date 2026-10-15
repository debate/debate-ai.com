import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`File Market`},r=`# File Market [#file-market]

Sell your research files to other debaters, or buy theirs. Anyone can read a
file's **table of contents** for free; buying it unlocks every card \u2014 cites,
card text and highlighting \u2014 and saves the whole file to your own files.

- **Route:** \`/research/market\` (every file for sale and your wallet) and
  \`/research/market/[id]\` (one file).
- **Package:** \`debate-file-market\` (outline preview, prices, top-ups, wire
  types, browser client, D1 migration), \`debate-webview\` (the pages and the
  Sell dialog), and \`apps/debate-ai.com\` (API, queries, Stripe webhook).
- **API:** \`GET /api/market\`; \`GET\`/\`POST /api/market/listings\`;
  \`GET\`/\`DELETE /api/market/listings/[id]\`;
  \`POST /api/market/listings/[id]/purchase\`;
  \`POST /api/market/listings/[id]/copy\`; \`POST /api/market/top-up\`.

## Your wallet [#your-wallet]

Every account has a wallet balance in US dollars. Add money with the **Add
$10** or **Add $20** buttons: they open Stripe's secure payment page, and the
money lands in your wallet as soon as Stripe confirms the payment. Money from
files you sell is added to the same wallet. Guest accounts have no wallet.

## Selling a file [#selling-a-file]

Right-click a file in the **Files** sidebar (or open its **\u2026** menu) and
choose **Sell\u2026**. The **Share with contacts** dialog has a **Sell\u2026** button
for the open file too. Set a price between $0.50 and $500 and check the free
preview \u2014 the file's pockets, hats, blocks and tags \u2014 then choose **Sell**.
Copy the link from the confirmation to share it.

- Buyers get a copy of the file as it was when you chose Sell. To give buyers
  a newer version, choose **Sell\u2026** again; that also changes the price.
- **Stop selling** in the same dialog takes it off the market. Anyone who
  already bought it keeps it.
- Folders can't be sold; sell the files inside them.

## Buying a file [#buying-a-file]

Open a file from the market to read its table of contents. **Buy** pays the
price from your wallet to the seller's, saves the full file to your files and
opens it in the editor. If your wallet doesn't cover the price, add money
from the same page. Each file can be bought once per account; **Open a copy
in my files** saves another copy any time.

## How it works [#how-it-works]

- The preview is the file's \`h1\`\u2013\`h4\` headings and nothing else. For an
  uploaded \`.cmir\` file the browser reads the headings with the CardMirror
  engine and sends them with the sell request; the server keeps at most 1,000
  headings of 200 characters each.
- A top-up is a one-off Stripe Checkout Session created with
  \`STRIPE_SECRET_KEY\` and tagged with the buyer's account. The wallet is
  credited only by the signed \`checkout.session.completed\` (or
  \`checkout.session.async_payment_succeeded\`) webhook, once per session, and
  never for more than the option's amount.
- Every balance change is a single guarded update and is also written to the
  \`wallet_transactions\` ledger.

## Known gaps [#known-gaps]

- Wallet balance can't be withdrawn yet; sellers' earnings stay in their
  wallet to spend on other files.
- No refunds from the site; a disputed purchase is handled in Stripe and by
  hand.
- The market lists the 200 most recently updated files, with no search yet.
`,i={contents:[{heading:`file-market`,content:`Sell your research files to other debaters, or buy theirs. Anyone can read a
file's **table of contents** for free; buying it unlocks every card \u2014 cites,
card text and highlighting \u2014 and saves the whole file to your own files.`},{heading:`file-market`,content:"**Route:** `/research/market` (every file for sale and your wallet) and\n`/research/market/[id]` (one file)."},{heading:`file-market`,content:"**Package:** `debate-file-market` (outline preview, prices, top-ups, wire\ntypes, browser client, D1 migration), `debate-webview` (the pages and the\nSell dialog), and `apps/debate-ai.com` (API, queries, Stripe webhook)."},{heading:`file-market`,content:"**API:** `GET /api/market`; `GET`/`POST /api/market/listings`;\n`GET`/`DELETE /api/market/listings/[id]`;\n`POST /api/market/listings/[id]/purchase`;\n`POST /api/market/listings/[id]/copy`; `POST /api/market/top-up`."},{heading:`your-wallet`,content:`Every account has a wallet balance in US dollars. Add money with the **Add
$10** or **Add $20** buttons: they open Stripe's secure payment page, and the
money lands in your wallet as soon as Stripe confirms the payment. Money from
files you sell is added to the same wallet. Guest accounts have no wallet.`},{heading:`selling-a-file`,content:`Right-click a file in the **Files** sidebar (or open its **\u2026** menu) and
choose **Sell\u2026**. The **Share with contacts** dialog has a **Sell\u2026** button
for the open file too. Set a price between $0.50 and $500 and check the free
preview \u2014 the file's pockets, hats, blocks and tags \u2014 then choose **Sell**.
Copy the link from the confirmation to share it.`},{heading:`selling-a-file`,content:`Buyers get a copy of the file as it was when you chose Sell. To give buyers
a newer version, choose **Sell\u2026** again; that also changes the price.`},{heading:`selling-a-file`,content:`**Stop selling** in the same dialog takes it off the market. Anyone who
already bought it keeps it.`},{heading:`selling-a-file`,content:`Folders can't be sold; sell the files inside them.`},{heading:`buying-a-file`,content:`Open a file from the market to read its table of contents. **Buy** pays the
price from your wallet to the seller's, saves the full file to your files and
opens it in the editor. If your wallet doesn't cover the price, add money
from the same page. Each file can be bought once per account; **Open a copy
in my files** saves another copy any time.`},{heading:`how-it-works`,content:"The preview is the file's `h1`\u2013`h4` headings and nothing else. For an\nuploaded `.cmir` file the browser reads the headings with the CardMirror\nengine and sends them with the sell request; the server keeps at most 1,000\nheadings of 200 characters each."},{heading:`how-it-works`,content:"A top-up is a one-off Stripe Checkout Session created with\n`STRIPE_SECRET_KEY` and tagged with the buyer's account. The wallet is\ncredited only by the signed `checkout.session.completed` (or\n`checkout.session.async_payment_succeeded`) webhook, once per session, and\nnever for more than the option's amount."},{heading:`how-it-works`,content:"Every balance change is a single guarded update and is also written to the\n`wallet_transactions` ledger."},{heading:`known-gaps`,content:`Wallet balance can't be withdrawn yet; sellers' earnings stay in their
wallet to spend on other files.`},{heading:`known-gaps`,content:`No refunds from the site; a disputed purchase is handled in Stripe and by
hand.`},{heading:`known-gaps`,content:`The market lists the 200 most recently updated files, with no search yet.`}],headings:[{id:`file-market`,content:`File Market`},{id:`your-wallet`,content:`Your wallet`},{id:`selling-a-file`,content:`Selling a file`},{id:`buying-a-file`,content:`Buying a file`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#file-market`,title:(0,t.jsx)(t.Fragment,{children:`File Market`})},{depth:2,url:`#your-wallet`,title:(0,t.jsx)(t.Fragment,{children:`Your wallet`})},{depth:2,url:`#selling-a-file`,title:(0,t.jsx)(t.Fragment,{children:`Selling a file`})},{depth:2,url:`#buying-a-file`,title:(0,t.jsx)(t.Fragment,{children:`Buying a file`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`file-market`,children:`File Market`}),`
`,(0,t.jsxs)(n.p,{children:[`Sell your research files to other debaters, or buy theirs. Anyone can read a
file's `,(0,t.jsx)(n.strong,{children:`table of contents`}),` for free; buying it unlocks every card \u2014 cites,
card text and highlighting \u2014 and saves the whole file to your own files.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/market`}),` (every file for sale and your wallet) and
`,(0,t.jsx)(n.code,{children:`/research/market/[id]`}),` (one file).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-file-market`}),` (outline preview, prices, top-ups, wire
types, browser client, D1 migration), `,(0,t.jsx)(n.code,{children:`debate-webview`}),` (the pages and the
Sell dialog), and `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),` (API, queries, Stripe webhook).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`API:`}),` `,(0,t.jsx)(n.code,{children:`GET /api/market`}),`; `,(0,t.jsx)(n.code,{children:`GET`}),`/`,(0,t.jsx)(n.code,{children:`POST /api/market/listings`}),`;
`,(0,t.jsx)(n.code,{children:`GET`}),`/`,(0,t.jsx)(n.code,{children:`DELETE /api/market/listings/[id]`}),`;
`,(0,t.jsx)(n.code,{children:`POST /api/market/listings/[id]/purchase`}),`;
`,(0,t.jsx)(n.code,{children:`POST /api/market/listings/[id]/copy`}),`; `,(0,t.jsx)(n.code,{children:`POST /api/market/top-up`}),`.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`your-wallet`,children:`Your wallet`}),`
`,(0,t.jsxs)(n.p,{children:[`Every account has a wallet balance in US dollars. Add money with the `,(0,t.jsx)(n.strong,{children:`Add
$10`}),` or `,(0,t.jsx)(n.strong,{children:`Add $20`}),` buttons: they open Stripe's secure payment page, and the
money lands in your wallet as soon as Stripe confirms the payment. Money from
files you sell is added to the same wallet. Guest accounts have no wallet.`]}),`
`,(0,t.jsx)(n.h2,{id:`selling-a-file`,children:`Selling a file`}),`
`,(0,t.jsxs)(n.p,{children:[`Right-click a file in the `,(0,t.jsx)(n.strong,{children:`Files`}),` sidebar (or open its `,(0,t.jsx)(n.strong,{children:`\u2026`}),` menu) and
choose `,(0,t.jsx)(n.strong,{children:`Sell\u2026`}),`. The `,(0,t.jsx)(n.strong,{children:`Share with contacts`}),` dialog has a `,(0,t.jsx)(n.strong,{children:`Sell\u2026`}),` button
for the open file too. Set a price between $0.50 and $500 and check the free
preview \u2014 the file's pockets, hats, blocks and tags \u2014 then choose `,(0,t.jsx)(n.strong,{children:`Sell`}),`.
Copy the link from the confirmation to share it.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`Buyers get a copy of the file as it was when you chose Sell. To give buyers
a newer version, choose `,(0,t.jsx)(n.strong,{children:`Sell\u2026`}),` again; that also changes the price.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Stop selling`}),` in the same dialog takes it off the market. Anyone who
already bought it keeps it.`]}),`
`,(0,t.jsx)(n.li,{children:`Folders can't be sold; sell the files inside them.`}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`buying-a-file`,children:`Buying a file`}),`
`,(0,t.jsxs)(n.p,{children:[`Open a file from the market to read its table of contents. `,(0,t.jsx)(n.strong,{children:`Buy`}),` pays the
price from your wallet to the seller's, saves the full file to your files and
opens it in the editor. If your wallet doesn't cover the price, add money
from the same page. Each file can be bought once per account; `,(0,t.jsx)(n.strong,{children:`Open a copy
in my files`}),` saves another copy any time.`]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`The preview is the file's `,(0,t.jsx)(n.code,{children:`h1`}),`\u2013`,(0,t.jsx)(n.code,{children:`h4`}),` headings and nothing else. For an
uploaded `,(0,t.jsx)(n.code,{children:`.cmir`}),` file the browser reads the headings with the CardMirror
engine and sends them with the sell request; the server keeps at most 1,000
headings of 200 characters each.`]}),`
`,(0,t.jsxs)(n.li,{children:[`A top-up is a one-off Stripe Checkout Session created with
`,(0,t.jsx)(n.code,{children:`STRIPE_SECRET_KEY`}),` and tagged with the buyer's account. The wallet is
credited only by the signed `,(0,t.jsx)(n.code,{children:`checkout.session.completed`}),` (or
`,(0,t.jsx)(n.code,{children:`checkout.session.async_payment_succeeded`}),`) webhook, once per session, and
never for more than the option's amount.`]}),`
`,(0,t.jsxs)(n.li,{children:[`Every balance change is a single guarded update and is also written to the
`,(0,t.jsx)(n.code,{children:`wallet_transactions`}),` ledger.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Wallet balance can't be withdrawn yet; sellers' earnings stay in their
wallet to spend on other files.`}),`
`,(0,t.jsx)(n.li,{children:`No refunds from the site; a disputed purchase is handled in Stripe and by
hand.`}),`
`,(0,t.jsx)(n.li,{children:`The market lists the 200 most recently updated files, with no search yet.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};