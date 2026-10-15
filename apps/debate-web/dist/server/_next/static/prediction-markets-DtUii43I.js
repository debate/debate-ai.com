import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Prediction Markets`},r=`# Prediction Markets [#prediction-markets]

Bet play-money points on who wins a debate, who wins a tournament, and whose
team rating goes up. Every account starts with **1,000 points**. Points
are play money: they can't be bought, sold or cashed out, and they have no
value outside the site.

- **Route:** \`/practice/predictions\`.
- **Package:** \`debate-predictions\` (pricing engine, settlement rules,
  validation, wire types, browser client, D1 migration), \`debate-webview\`
  (the page), and \`apps/debate-ai.com\` (API, queries).
- **API:** \`GET /api/predictions\`; \`GET /api/predictions/sources\`;
  \`POST /api/predictions/markets\`;
  \`POST /api/predictions/markets/[marketId]/bets\`;
  \`POST /api/predictions/markets/[marketId]/resolve\`

## What it shows [#what-it-shows]

- **Your points.** Your balance. The 1,000 starting points land the first
  time you open the page while signed in. Guest accounts can watch but get no
  points.
- **Top 5 teams.** Pick a division (Public Forum, Lincoln-Douglas, Policy,
  College Policy) and bet on whether each of its five highest-rated teams
  gains team rating by the end of the month. The site opens these itself,
  a fresh set each month, and they settle themselves at month end.
- **Major tournaments.** For the same division, a winner market for each of
  the season's fifteen biggest tournaments still ahead, in date order:
  Heart of Texas, Florida Blue Key, Apple Valley, Glenbrooks, Princeton,
  Blake, Harvard-Westlake, Emory, Stanford, Harvard, Cal, the NDT (College
  Policy only), NDCA, the TOC and NSDA Nationals. Each lists the division's
  eight top-rated teams plus "Anyone else". Betting closes when the
  tournament starts, and a moderator settles it from the published results.
  Dates not yet published are the tournament's usual weekend, marked
  "expected dates".
- **More open markets**: the ones members opened, closing soonest first, filterable by type. Each market
  lists its outcomes with the current price as a percentage (the market's
  implied odds), how many points are staked, how it settles, and your
  position. The bet form quotes how many shares a stake buys, what it pays if
  that outcome wins, and where it moves the price.
- **Open a market.** Three kinds:
  - **Debate**: who wins one round. Type the two sides in, or pick an
    undecided round from a tournament hosted on the site.
  - **Tournament winner**: type the field in (up to 32 entries), or pick an
    event hosted on the site and every entry becomes an outcome.
  - **Rating move**: pick a team from the team rankings. The market asks
    whether its rating is higher at close than it is now.
- **Settled**: recent results, with what you got back.
- **Top forecasters**: the ten biggest balances, shown as ranks and points only (no names; your own row reads "You").

## How it works [#how-it-works]

**Pricing.** Each market has an automated market maker using the
logarithmic market scoring rule (LMSR), so a bet never waits for someone to
take the other side. You stake whole points and receive shares; each share of
the winning outcome pays 1 point. Buying an outcome raises its price. The
engine is \`debate-predictions/src/lmsr.ts\`, which solves for the shares a
stake buys in closed form and works in log space so large balances never
overflow. The liquidity is \`DEFAULT_LIQUIDITY\` (150). The most a market can
pay out beyond what was staked is \`b \u00B7 ln(n)\` for \`n\` outcomes, which bounds
how many points any one market can create.

**Settling.** Payouts are rounded down once per person, not per bet.
Voiding a market refunds every stake. A market settles one of three ways:

- **Hosted round** (\`tabroom-panel\`): every judge on the round casts one
  vote, the entry their ballot's \`winloss\` score marks. Once all judges have
  voted, the majority wins. A bye, a forfeit or an even split voids it.
  Checked whether or not betting has closed, so a result that is in stops
  the betting.
- **Hosted event** (\`tabroom-event\`): the first-ranked entry in a published
  final result set (a bracket set, or one labelled final, champion, places or
  elim). Prelim seeds don't count.
- **Rating** (\`rating\`): once betting closes, the team's current rating is
  compared to the rating recorded when the market opened. Higher resolves
  "rises"; equal or lower resolves "doesn't rise". A team that has left the
  rankings voids it.
- **Typed-in markets** (\`manual\`) are settled by hand: by a moderator or
  admin, or by the creator while they hold no position in that market.
  Moderators can also settle or void any linked market whose data never
  arrives.

Hosted rounds and events are the \`debate-tournaments\` Tabroom tables in the
same D1 database. Ratings come from the \`debate-rankings\` CSVs bundled with
the build, read through \`debate-rankings-adapter\` on the site's scale.

**Preset markets.** \`debate-predictions/src/presets.ts\` holds the
tournament calendar (\`MAJOR_TOURNAMENTS\`) and \`planPresetMarkets\`, which
turns the rankings and the date into the markets that should be open. Their
ids are stable (\`preset:rating:<dataset>:<hash>:<YYYY-MM>\`,
\`preset:major:<slug>:<dataset>\`), so the board read
(\`apps/debate-ai.com/lib/predictions/presets.ts\`) inserts only the missing
ones and never reopens one that settled. They have no creator, so only
moderators settle the tournament ones. A rating market settles "doesn't
rise" when no rankings refresh ships during its month. Next season's
calendar is a new \`MAJOR_TOURNAMENTS\` list.

Auto-settlement runs on every board read (\`resolveDueMarkets\` in
\`apps/debate-ai.com/lib/predictions/queries.ts\`), up to 20 markets at a
time. Every bettor gets a \`prediction_market\` notification when a market
settles or is voided.

**Guarded writes.** D1 has no interactive transactions, so a bet is three
guarded statements. First the wallet is debited only if it holds the stake.
Then the market's share vector is written only if its \`version\` is still the
one the price was computed from. If another bet got there first, the stake is
refunded and the bettor is asked to retry at the new price. Finally the bet is
recorded. Settling claims the market (\`status = 'open'\`) before paying, so a
market pays out once even if a moderator and the auto-resolver race.

**Limits.** Accounts need a real (non-guest) login to bet or open a market.
Each account can have ten markets open at once. Betting closes between five
minutes and a year after a market opens.

**Tables.** \`prediction_wallets\` has one row per account (balance and when
the grant landed). \`prediction_markets\` has one row per market, with outcomes,
share vector and source stored as JSON. \`prediction_bets\` has one row per bet,
and its \`payout\` is filled in at settlement. They are declared in the app's
\`schema.ts\` and shipped as \`packages/debate-predictions/migrations/\`, which
the deploy's \`migrate-d1.ts\` applies.

## Known gaps [#known-gaps]

- You can't sell a position back before the market settles.
- Markets on rounds and tournaments that aren't hosted on the site (live
  Tabroom, round videos) must be typed in and settled by hand.
- Rankings only change when a deploy ships refreshed CSVs, so a rating market
  can only move when the site is redeployed with new rankings.
- Auto-settlement waits for someone to open the markets page; there's no
  scheduled job.
- A wallet never refills. Someone who loses every point can't bet again.

## Markets the site opens [#markets-the-site-opens]

Every Monday the site opens a rating market ("Will \u2026 gain rating?") on the top five teams in the Lincoln-Douglas and Public Forum rankings, each settling after 28 days. It also opens "Who wins \u2026?" markets for the season's biggest tournaments (Florida Blue Key, Glenbrooks, Barkley Forum, Harvard and Cal), listing the current top eight plus "Someone else". Betting closes when the tournament starts and a moderator settles it from the final results. A team or tournament that already has an open market isn't opened twice.
`,i={contents:[{heading:`prediction-markets`,content:`Bet play-money points on who wins a debate, who wins a tournament, and whose
team rating goes up. Every account starts with **1,000 points**. Points
are play money: they can't be bought, sold or cashed out, and they have no
value outside the site.`},{heading:`prediction-markets`,content:"**Route:** `/practice/predictions`."},{heading:`prediction-markets`,content:"**Package:** `debate-predictions` (pricing engine, settlement rules,\nvalidation, wire types, browser client, D1 migration), `debate-webview`\n(the page), and `apps/debate-ai.com` (API, queries)."},{heading:`prediction-markets`,content:"**API:** `GET /api/predictions`; `GET /api/predictions/sources`;\n`POST /api/predictions/markets`;\n`POST /api/predictions/markets/[marketId]/bets`;\n`POST /api/predictions/markets/[marketId]/resolve`"},{heading:`what-it-shows`,content:`**Your points.** Your balance. The 1,000 starting points land the first
time you open the page while signed in. Guest accounts can watch but get no
points.`},{heading:`what-it-shows`,content:`**Top 5 teams.** Pick a division (Public Forum, Lincoln-Douglas, Policy,
College Policy) and bet on whether each of its five highest-rated teams
gains team rating by the end of the month. The site opens these itself,
a fresh set each month, and they settle themselves at month end.`},{heading:`what-it-shows`,content:`**Major tournaments.** For the same division, a winner market for each of
the season's fifteen biggest tournaments still ahead, in date order:
Heart of Texas, Florida Blue Key, Apple Valley, Glenbrooks, Princeton,
Blake, Harvard-Westlake, Emory, Stanford, Harvard, Cal, the NDT (College
Policy only), NDCA, the TOC and NSDA Nationals. Each lists the division's
eight top-rated teams plus "Anyone else". Betting closes when the
tournament starts, and a moderator settles it from the published results.
Dates not yet published are the tournament's usual weekend, marked
"expected dates".`},{heading:`what-it-shows`,content:`**More open markets**: the ones members opened, closing soonest first, filterable by type. Each market
lists its outcomes with the current price as a percentage (the market's
implied odds), how many points are staked, how it settles, and your
position. The bet form quotes how many shares a stake buys, what it pays if
that outcome wins, and where it moves the price.`},{heading:`what-it-shows`,content:`**Open a market.** Three kinds:`},{heading:`what-it-shows`,content:`**Debate**: who wins one round. Type the two sides in, or pick an
undecided round from a tournament hosted on the site.`},{heading:`what-it-shows`,content:`**Tournament winner**: type the field in (up to 32 entries), or pick an
event hosted on the site and every entry becomes an outcome.`},{heading:`what-it-shows`,content:`**Rating move**: pick a team from the team rankings. The market asks
whether its rating is higher at close than it is now.`},{heading:`what-it-shows`,content:`**Settled**: recent results, with what you got back.`},{heading:`what-it-shows`,content:`**Top forecasters**: the ten biggest balances, shown as ranks and points only (no names; your own row reads "You").`},{heading:`how-it-works`,content:`**Pricing.** Each market has an automated market maker using the
logarithmic market scoring rule (LMSR), so a bet never waits for someone to
take the other side. You stake whole points and receive shares; each share of
the winning outcome pays 1 point. Buying an outcome raises its price. The
engine is \`debate-predictions/src/lmsr.ts\`, which solves for the shares a
stake buys in closed form and works in log space so large balances never
overflow. The liquidity is \`DEFAULT_LIQUIDITY\` (150). The most a market can
pay out beyond what was staked is \`b \u00B7 ln(n)\` for \`n\` outcomes, which bounds
how many points any one market can create.`},{heading:`how-it-works`,content:`**Settling.** Payouts are rounded down once per person, not per bet.
Voiding a market refunds every stake. A market settles one of three ways:`},{heading:`how-it-works`,content:`**Hosted round** (\`tabroom-panel\`): every judge on the round casts one
vote, the entry their ballot's \`winloss\` score marks. Once all judges have
voted, the majority wins. A bye, a forfeit or an even split voids it.
Checked whether or not betting has closed, so a result that is in stops
the betting.`},{heading:`how-it-works`,content:`**Hosted event** (\`tabroom-event\`): the first-ranked entry in a published
final result set (a bracket set, or one labelled final, champion, places or
elim). Prelim seeds don't count.`},{heading:`how-it-works`,content:`**Rating** (\`rating\`): once betting closes, the team's current rating is
compared to the rating recorded when the market opened. Higher resolves
"rises"; equal or lower resolves "doesn't rise". A team that has left the
rankings voids it.`},{heading:`how-it-works`,content:`**Typed-in markets** (\`manual\`) are settled by hand: by a moderator or
admin, or by the creator while they hold no position in that market.
Moderators can also settle or void any linked market whose data never
arrives.`},{heading:`how-it-works`,content:"Hosted rounds and events are the `debate-tournaments` Tabroom tables in the\nsame D1 database. Ratings come from the `debate-rankings` CSVs bundled with\nthe build, read through `debate-rankings-adapter` on the site's scale."},{heading:`how-it-works`,content:"**Preset markets.** `debate-predictions/src/presets.ts` holds the\ntournament calendar (`MAJOR_TOURNAMENTS`) and `planPresetMarkets`, which\nturns the rankings and the date into the markets that should be open. Their\nids are stable (`preset:rating:<dataset>:<hash>:<YYYY-MM>`,\n`preset:major:<slug>:<dataset>`), so the board read\n(`apps/debate-ai.com/lib/predictions/presets.ts`) inserts only the missing\nones and never reopens one that settled. They have no creator, so only\nmoderators settle the tournament ones. A rating market settles \"doesn't\nrise\" when no rankings refresh ships during its month. Next season's\ncalendar is a new `MAJOR_TOURNAMENTS` list."},{heading:`how-it-works`,content:"Auto-settlement runs on every board read (`resolveDueMarkets` in\n`apps/debate-ai.com/lib/predictions/queries.ts`), up to 20 markets at a\ntime. Every bettor gets a `prediction_market` notification when a market\nsettles or is voided."},{heading:`how-it-works`,content:`**Guarded writes.** D1 has no interactive transactions, so a bet is three
guarded statements. First the wallet is debited only if it holds the stake.
Then the market's share vector is written only if its \`version\` is still the
one the price was computed from. If another bet got there first, the stake is
refunded and the bettor is asked to retry at the new price. Finally the bet is
recorded. Settling claims the market (\`status = 'open'\`) before paying, so a
market pays out once even if a moderator and the auto-resolver race.`},{heading:`how-it-works`,content:`**Limits.** Accounts need a real (non-guest) login to bet or open a market.
Each account can have ten markets open at once. Betting closes between five
minutes and a year after a market opens.`},{heading:`how-it-works`,content:"**Tables.** `prediction_wallets` has one row per account (balance and when\nthe grant landed). `prediction_markets` has one row per market, with outcomes,\nshare vector and source stored as JSON. `prediction_bets` has one row per bet,\nand its `payout` is filled in at settlement. They are declared in the app's\n`schema.ts` and shipped as `packages/debate-predictions/migrations/`, which\nthe deploy's `migrate-d1.ts` applies."},{heading:`known-gaps`,content:`You can't sell a position back before the market settles.`},{heading:`known-gaps`,content:`Markets on rounds and tournaments that aren't hosted on the site (live
Tabroom, round videos) must be typed in and settled by hand.`},{heading:`known-gaps`,content:`Rankings only change when a deploy ships refreshed CSVs, so a rating market
can only move when the site is redeployed with new rankings.`},{heading:`known-gaps`,content:`Auto-settlement waits for someone to open the markets page; there's no
scheduled job.`},{heading:`known-gaps`,content:`A wallet never refills. Someone who loses every point can't bet again.`},{heading:`markets-the-site-opens`,content:`Every Monday the site opens a rating market ("Will \u2026 gain rating?") on the top five teams in the Lincoln-Douglas and Public Forum rankings, each settling after 28 days. It also opens "Who wins \u2026?" markets for the season's biggest tournaments (Florida Blue Key, Glenbrooks, Barkley Forum, Harvard and Cal), listing the current top eight plus "Someone else". Betting closes when the tournament starts and a moderator settles it from the final results. A team or tournament that already has an open market isn't opened twice.`}],headings:[{id:`prediction-markets`,content:`Prediction Markets`},{id:`what-it-shows`,content:`What it shows`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`},{id:`markets-the-site-opens`,content:`Markets the site opens`}]},a=[{depth:1,url:`#prediction-markets`,title:(0,t.jsx)(t.Fragment,{children:`Prediction Markets`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})},{depth:2,url:`#markets-the-site-opens`,title:(0,t.jsx)(t.Fragment,{children:`Markets the site opens`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`prediction-markets`,children:`Prediction Markets`}),`
`,(0,t.jsxs)(n.p,{children:[`Bet play-money points on who wins a debate, who wins a tournament, and whose
team rating goes up. Every account starts with `,(0,t.jsx)(n.strong,{children:`1,000 points`}),`. Points
are play money: they can't be bought, sold or cashed out, and they have no
value outside the site.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/predictions`}),`.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-predictions`}),` (pricing engine, settlement rules,
validation, wire types, browser client, D1 migration), `,(0,t.jsx)(n.code,{children:`debate-webview`}),`
(the page), and `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),` (API, queries).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`API:`}),` `,(0,t.jsx)(n.code,{children:`GET /api/predictions`}),`; `,(0,t.jsx)(n.code,{children:`GET /api/predictions/sources`}),`;
`,(0,t.jsx)(n.code,{children:`POST /api/predictions/markets`}),`;
`,(0,t.jsx)(n.code,{children:`POST /api/predictions/markets/[marketId]/bets`}),`;
`,(0,t.jsx)(n.code,{children:`POST /api/predictions/markets/[marketId]/resolve`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Your points.`}),` Your balance. The 1,000 starting points land the first
time you open the page while signed in. Guest accounts can watch but get no
points.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Top 5 teams.`}),` Pick a division (Public Forum, Lincoln-Douglas, Policy,
College Policy) and bet on whether each of its five highest-rated teams
gains team rating by the end of the month. The site opens these itself,
a fresh set each month, and they settle themselves at month end.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Major tournaments.`}),` For the same division, a winner market for each of
the season's fifteen biggest tournaments still ahead, in date order:
Heart of Texas, Florida Blue Key, Apple Valley, Glenbrooks, Princeton,
Blake, Harvard-Westlake, Emory, Stanford, Harvard, Cal, the NDT (College
Policy only), NDCA, the TOC and NSDA Nationals. Each lists the division's
eight top-rated teams plus "Anyone else". Betting closes when the
tournament starts, and a moderator settles it from the published results.
Dates not yet published are the tournament's usual weekend, marked
"expected dates".`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`More open markets`}),`: the ones members opened, closing soonest first, filterable by type. Each market
lists its outcomes with the current price as a percentage (the market's
implied odds), how many points are staked, how it settles, and your
position. The bet form quotes how many shares a stake buys, what it pays if
that outcome wins, and where it moves the price.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Open a market.`}),` Three kinds:`,`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Debate`}),`: who wins one round. Type the two sides in, or pick an
undecided round from a tournament hosted on the site.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Tournament winner`}),`: type the field in (up to 32 entries), or pick an
event hosted on the site and every entry becomes an outcome.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Rating move`}),`: pick a team from the team rankings. The market asks
whether its rating is higher at close than it is now.`]}),`
`]}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Settled`}),`: recent results, with what you got back.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Top forecasters`}),`: the ten biggest balances, shown as ranks and points only (no names; your own row reads "You").`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Pricing.`}),` Each market has an automated market maker using the
logarithmic market scoring rule (LMSR), so a bet never waits for someone to
take the other side. You stake whole points and receive shares; each share of
the winning outcome pays 1 point. Buying an outcome raises its price. The
engine is `,(0,t.jsx)(n.code,{children:`debate-predictions/src/lmsr.ts`}),`, which solves for the shares a
stake buys in closed form and works in log space so large balances never
overflow. The liquidity is `,(0,t.jsx)(n.code,{children:`DEFAULT_LIQUIDITY`}),` (150). The most a market can
pay out beyond what was staked is `,(0,t.jsx)(n.code,{children:`b \u00B7 ln(n)`}),` for `,(0,t.jsx)(n.code,{children:`n`}),` outcomes, which bounds
how many points any one market can create.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Settling.`}),` Payouts are rounded down once per person, not per bet.
Voiding a market refunds every stake. A market settles one of three ways:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Hosted round`}),` (`,(0,t.jsx)(n.code,{children:`tabroom-panel`}),`): every judge on the round casts one
vote, the entry their ballot's `,(0,t.jsx)(n.code,{children:`winloss`}),` score marks. Once all judges have
voted, the majority wins. A bye, a forfeit or an even split voids it.
Checked whether or not betting has closed, so a result that is in stops
the betting.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Hosted event`}),` (`,(0,t.jsx)(n.code,{children:`tabroom-event`}),`): the first-ranked entry in a published
final result set (a bracket set, or one labelled final, champion, places or
elim). Prelim seeds don't count.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Rating`}),` (`,(0,t.jsx)(n.code,{children:`rating`}),`): once betting closes, the team's current rating is
compared to the rating recorded when the market opened. Higher resolves
"rises"; equal or lower resolves "doesn't rise". A team that has left the
rankings voids it.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Typed-in markets`}),` (`,(0,t.jsx)(n.code,{children:`manual`}),`) are settled by hand: by a moderator or
admin, or by the creator while they hold no position in that market.
Moderators can also settle or void any linked market whose data never
arrives.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`Hosted rounds and events are the `,(0,t.jsx)(n.code,{children:`debate-tournaments`}),` Tabroom tables in the
same D1 database. Ratings come from the `,(0,t.jsx)(n.code,{children:`debate-rankings`}),` CSVs bundled with
the build, read through `,(0,t.jsx)(n.code,{children:`debate-rankings-adapter`}),` on the site's scale.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Preset markets.`}),` `,(0,t.jsx)(n.code,{children:`debate-predictions/src/presets.ts`}),` holds the
tournament calendar (`,(0,t.jsx)(n.code,{children:`MAJOR_TOURNAMENTS`}),`) and `,(0,t.jsx)(n.code,{children:`planPresetMarkets`}),`, which
turns the rankings and the date into the markets that should be open. Their
ids are stable (`,(0,t.jsx)(n.code,{children:`preset:rating:<dataset>:<hash>:<YYYY-MM>`}),`,
`,(0,t.jsx)(n.code,{children:`preset:major:<slug>:<dataset>`}),`), so the board read
(`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/predictions/presets.ts`}),`) inserts only the missing
ones and never reopens one that settled. They have no creator, so only
moderators settle the tournament ones. A rating market settles "doesn't
rise" when no rankings refresh ships during its month. Next season's
calendar is a new `,(0,t.jsx)(n.code,{children:`MAJOR_TOURNAMENTS`}),` list.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Auto-settlement runs on every board read (`,(0,t.jsx)(n.code,{children:`resolveDueMarkets`}),` in
`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/predictions/queries.ts`}),`), up to 20 markets at a
time. Every bettor gets a `,(0,t.jsx)(n.code,{children:`prediction_market`}),` notification when a market
settles or is voided.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Guarded writes.`}),` D1 has no interactive transactions, so a bet is three
guarded statements. First the wallet is debited only if it holds the stake.
Then the market's share vector is written only if its `,(0,t.jsx)(n.code,{children:`version`}),` is still the
one the price was computed from. If another bet got there first, the stake is
refunded and the bettor is asked to retry at the new price. Finally the bet is
recorded. Settling claims the market (`,(0,t.jsx)(n.code,{children:`status = 'open'`}),`) before paying, so a
market pays out once even if a moderator and the auto-resolver race.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Limits.`}),` Accounts need a real (non-guest) login to bet or open a market.
Each account can have ten markets open at once. Betting closes between five
minutes and a year after a market opens.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Tables.`}),` `,(0,t.jsx)(n.code,{children:`prediction_wallets`}),` has one row per account (balance and when
the grant landed). `,(0,t.jsx)(n.code,{children:`prediction_markets`}),` has one row per market, with outcomes,
share vector and source stored as JSON. `,(0,t.jsx)(n.code,{children:`prediction_bets`}),` has one row per bet,
and its `,(0,t.jsx)(n.code,{children:`payout`}),` is filled in at settlement. They are declared in the app's
`,(0,t.jsx)(n.code,{children:`schema.ts`}),` and shipped as `,(0,t.jsx)(n.code,{children:`packages/debate-predictions/migrations/`}),`, which
the deploy's `,(0,t.jsx)(n.code,{children:`migrate-d1.ts`}),` applies.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`You can't sell a position back before the market settles.`}),`
`,(0,t.jsx)(n.li,{children:`Markets on rounds and tournaments that aren't hosted on the site (live
Tabroom, round videos) must be typed in and settled by hand.`}),`
`,(0,t.jsx)(n.li,{children:`Rankings only change when a deploy ships refreshed CSVs, so a rating market
can only move when the site is redeployed with new rankings.`}),`
`,(0,t.jsx)(n.li,{children:`Auto-settlement waits for someone to open the markets page; there's no
scheduled job.`}),`
`,(0,t.jsx)(n.li,{children:`A wallet never refills. Someone who loses every point can't bet again.`}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`markets-the-site-opens`,children:`Markets the site opens`}),`
`,(0,t.jsx)(n.p,{children:`Every Monday the site opens a rating market ("Will \u2026 gain rating?") on the top five teams in the Lincoln-Douglas and Public Forum rankings, each settling after 28 days. It also opens "Who wins \u2026?" markets for the season's biggest tournaments (Florida Blue Key, Glenbrooks, Barkley Forum, Harvard and Cal), listing the current top eight plus "Someone else". Betting closes when the tournament starts and a moderator settles it from the final results. A team or tournament that already has an open market isn't opened twice.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};