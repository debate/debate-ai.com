import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Practice Partners`},r=`# Practice Partners [#practice-partners]

Lets debaters find each other for practice rounds between tournaments.
Volunteer to be challenged, volunteer to judge, or both, and say which
formats, styles, speed, and level you're comfortable with. Then get matched
\u2014 anonymously \u2014 with a compatible debater and send them a request for a
virtual round.

- **Route:** \`/practice/partners\`. Also the first panel in the Coach
  Workspace's Practice section (\`/coaching?stage=practice\`).
- **Package:** \`debate-webview\` (UI, wire types, action rules) and
  \`apps/debate-ai.com\` (API, queries).
- **API:** \`GET /api/practice-partners\`; \`PUT /api/practice-partners/profile\`;
  \`POST /api/practice-partners/match\`; \`POST /api/practice-partners/challenges\`;
  \`PATCH /api/practice-partners/challenges/[challengeId]\`

## What it shows [#what-it-shows]

- **Your practice profile.** This has two switches: **Open to challenges**
  lists you as a debater, and **Volunteer to judge** lists you as a judge.
  Under them you set formats (PF, LD, Policy, Parli, Worlds/BP, Congress),
  the styles you're comfortable with (traditional/lay, progressive/tech,
  plans/CPs/DAs, critiques, theory & T, philosophy/framework, truth-testing),
  speed, experience level, availability, and a note. Turning both switches
  off takes you out of matching and judging but keeps your preferences.
- **Your challenges.** They're grouped as *Waiting on you* (challenges to
  answer, judging invitations), *Upcoming rounds* (soonest first), *Sent*,
  and a few closed ones. An accepted round shows its **room code**. Debaters
  and the judge paste it into the round workspace's Cameras panel to join
  the same peer-to-peer webcam room.
- **Rounds needing a judge.** This only appears for judge volunteers. It
  lists accepted rounds with an empty judge seat, and picking one up
  notifies both debaters.
- **Find a practice partner.** There is no public list of volunteers.
  Pick a format (or any) and press **Find me a match**: the server scores
  everyone open to challenges against your profile \u2014 shared formats count
  most, then shared styles, then speed and level \u2014 and draws one of the five
  most compatible at random, weighted by score. The match is shown
  anonymously: level, speed, formats and styles (the ones you share
  highlighted), a compatibility percentage, and whether they also judge \u2014 no
  name, avatar, availability or note. **Send request** opens a short form
  with the format (shared formats first), resolution, optional start time and
  a message. **Find another** draws again, skipping everyone already shown
  and anyone you already have a request waiting on.

## How it works [#how-it-works]

A challenge moves through \`pending\` \u2192 \`accepted\` | \`declined\` (the opponent
answers), or \`cancelled\`. The challenger can cancel at any time before the
round. The opponent can call it off once they've accepted. The judge seat is
empty, \`invited\` (the challenger named a judge), or \`confirmed\` (the judge
said yes, or picked up an unjudged round). The judge can decline an invitation
or step down later.

Who may do what is one pure function,
\`applyChallengeAction\` in \`debate-webview/lib/practice-partners/challenge-actions.ts\`.
The PATCH route enforces it, and the board uses it to decide which buttons to
show. The write only lands if the challenge is still in the state the action
was computed from. So if two judges pick up the same round at the same time,
the second gets a 409 instead of overwriting the first.

Each change creates a \`practice_challenge\` row in the existing notifications
feed for everyone else in the round, linking back to \`/practice/partners\`.

**Anonymity.** The match endpoint never sends a name or account id. The
browser gets an opaque token instead (\`apps/debate-ai.com/lib/practice-partners/match-token.ts\`):
the matched debater's id, the viewer's id and a two-hour expiry, sealed with
AES-GCM under a key derived from the auth secret. \`POST \u2026/challenges\` accepts
it as \`matchToken\` and opens it server-side; a token opens only for the viewer
it was minted for. Until a challenge is accepted, each debater sees the other
as "Your practice match" (\`ANONYMOUS_PRACTICE_PERSON\`, applied in
\`toWireChallenges\`), and the notifications for sending, declining or calling
off a pending request don't name the sender. Accepting reveals both names.

**Safety rules.** Matching requires an account, and guest (anonymous)
accounts can't volunteer or send challenges. A block from Contacts in either
direction keeps each person out of the other's matches, stops them challenging
each other, and keeps the round off the other's "needing a judge" list. A
blocked challenge gets the same "not open to challenges" reply as a volunteer
who has switched off, so the reply doesn't reveal the block. Each debater can
have at most ten challenges waiting for an answer, and only one per opponent.

**Tables.** \`practice_profiles\` has one row per user: role flags plus a JSON
\`preferences\` payload. \`practice_challenges\` has one row per challenge. Rows
are never deleted by the feature; a closed challenge keeps its status.

## Judge Pool [#judge-pool]

Below the practice board, the same page has a **Judge Pool** (\`#judge-pool\`) for
tournament judging, as opposed to practice rounds.

- **Volunteer as a judge.** Pick up to three upcoming weekends from the
  circuit calendar's season weeks (the same A\u2013Y + Z weeks as the Debate
  Majors calendar). Each weekend row shows its week letter, dates and the
  majors running that Friday\u2013Sunday. Add the states you're in (up to five),
  switch on **Able to travel** if you'll judge out of state, pick the formats
  you judge, and write your judge philosophy. **List me for hire** off hides
  you without losing the listing. Weekends drop off once they pass; with
  none left you're out of the pool until you pick new ones.
- **Hire a judge.** Every listed judge, by name, with their weekends,
  states, travel, formats and philosophy. Filter by weekend, tournament state
  and format. A judge fits a state if they're in it or will travel; in-state
  judges come first. **Hire** sends a request: tournament name, one of the
  judge's weekends, a pay offer and a message.
- **Hire requests.** The judge accepts or declines; the organizer can cancel
  while it's waiting, and either side can call off an accepted one. Each
  change sends a \`judge_hire\` notification to the other side, linking to
  \`#judge-pool\`.

**Payment isn't connected.** The pay offer is text. Nothing is charged or
paid out on the site; the two sides settle pay directly once a request is
accepted. The site's Stripe setup only sells subscriptions through Payment
Links, which can't pay a judge.

**How it works.** The weekends come from \`SEASON_MAJORS\` in
\`debate-webview/lib/judge-pool/season-calendar.ts\`, a copy of the dated
events in \`packages/debate-tournaments/src/ui/majors/data.ts\`; a test fails
if the two drift. Validation and the hire rules (\`applyHireAction\`) are in
\`debate-webview/lib/judge-pool/validation.ts\`, and the pool filter is
\`filter.ts\` next to it. The API is \`GET /api/judge-pool\`,
\`PUT /api/judge-pool/listing\`, \`POST /api/judge-pool/hires\` and
\`PATCH /api/judge-pool/hires/[hireId]\`, over \`apps/debate-ai.com/lib/judge-pool/queries.ts\`.
Guests can't list or hire, blocks hide people from each other, an organizer
can have 20 requests waiting and one open request per judge per weekend.

**Tables.** \`judge_pool_listings\` (one row per user, lists as JSON) and
\`judge_hire_requests\` (one row per request, never deleted). They ship to D1
as \`packages/debate-webview/migrations/0001_judge_pool.sql\`.

## Known gaps [#known-gaps]

- There's no in-app messaging. Beyond the challenge message, debaters arrange
  details elsewhere, for example through [Contacts](/docs/features/team-collaboration/contacts).
- A proposed time is a single suggestion. There's no counter-proposal. To
  change it, decline and send a new challenge.
- Nothing links a finished practice round back to its challenge, so results
  and judge feedback aren't recorded here yet.
- Matching draws from the 200 most recently updated volunteers.
- Compatibility is a deterministic score over the profile fields; the free-text
  note and availability aren't read by the matcher (and aren't shown, since
  they could identify someone).
- A pending request's judge seat can't be filled by invitation any more \u2014
  the judge list isn't public \u2014 so judges pick up accepted rounds instead.
- A request that is called off after being accepted shows the other debater
  as anonymous again, since only \`accepted\` reveals names.
- The judge pool takes no payment, and has no contract or confirmation beyond
  the accepted request.
- Judge weekends are limited to the 2026\u201327 circuit calendar; next season's
  weekends need a new \`SEASON_MAJORS\` list.
- The pool lists the 200 most recently updated listings.
`,i={contents:[{heading:`practice-partners`,content:`Lets debaters find each other for practice rounds between tournaments.
Volunteer to be challenged, volunteer to judge, or both, and say which
formats, styles, speed, and level you're comfortable with. Then get matched
\u2014 anonymously \u2014 with a compatible debater and send them a request for a
virtual round.`},{heading:`practice-partners`,content:"**Route:** `/practice/partners`. Also the first panel in the Coach\nWorkspace's Practice section (`/coaching?stage=practice`)."},{heading:`practice-partners`,content:"**Package:** `debate-webview` (UI, wire types, action rules) and\n`apps/debate-ai.com` (API, queries)."},{heading:`practice-partners`,content:"**API:** `GET /api/practice-partners`; `PUT /api/practice-partners/profile`;\n`POST /api/practice-partners/match`; `POST /api/practice-partners/challenges`;\n`PATCH /api/practice-partners/challenges/[challengeId]`"},{heading:`what-it-shows`,content:`**Your practice profile.** This has two switches: **Open to challenges**
lists you as a debater, and **Volunteer to judge** lists you as a judge.
Under them you set formats (PF, LD, Policy, Parli, Worlds/BP, Congress),
the styles you're comfortable with (traditional/lay, progressive/tech,
plans/CPs/DAs, critiques, theory & T, philosophy/framework, truth-testing),
speed, experience level, availability, and a note. Turning both switches
off takes you out of matching and judging but keeps your preferences.`},{heading:`what-it-shows`,content:`**Your challenges.** They're grouped as *Waiting on you* (challenges to
answer, judging invitations), *Upcoming rounds* (soonest first), *Sent*,
and a few closed ones. An accepted round shows its **room code**. Debaters
and the judge paste it into the round workspace's Cameras panel to join
the same peer-to-peer webcam room.`},{heading:`what-it-shows`,content:`**Rounds needing a judge.** This only appears for judge volunteers. It
lists accepted rounds with an empty judge seat, and picking one up
notifies both debaters.`},{heading:`what-it-shows`,content:`**Find a practice partner.** There is no public list of volunteers.
Pick a format (or any) and press **Find me a match**: the server scores
everyone open to challenges against your profile \u2014 shared formats count
most, then shared styles, then speed and level \u2014 and draws one of the five
most compatible at random, weighted by score. The match is shown
anonymously: level, speed, formats and styles (the ones you share
highlighted), a compatibility percentage, and whether they also judge \u2014 no
name, avatar, availability or note. **Send request** opens a short form
with the format (shared formats first), resolution, optional start time and
a message. **Find another** draws again, skipping everyone already shown
and anyone you already have a request waiting on.`},{heading:`how-it-works`,content:"A challenge moves through `pending` \u2192 `accepted` | `declined` (the opponent\nanswers), or `cancelled`. The challenger can cancel at any time before the\nround. The opponent can call it off once they've accepted. The judge seat is\nempty, `invited` (the challenger named a judge), or `confirmed` (the judge\nsaid yes, or picked up an unjudged round). The judge can decline an invitation\nor step down later."},{heading:`how-it-works`,content:`Who may do what is one pure function,
\`applyChallengeAction\` in \`debate-webview/lib/practice-partners/challenge-actions.ts\`.
The PATCH route enforces it, and the board uses it to decide which buttons to
show. The write only lands if the challenge is still in the state the action
was computed from. So if two judges pick up the same round at the same time,
the second gets a 409 instead of overwriting the first.`},{heading:`how-it-works`,content:"Each change creates a `practice_challenge` row in the existing notifications\nfeed for everyone else in the round, linking back to `/practice/partners`."},{heading:`how-it-works`,content:`**Anonymity.** The match endpoint never sends a name or account id. The
browser gets an opaque token instead (\`apps/debate-ai.com/lib/practice-partners/match-token.ts\`):
the matched debater's id, the viewer's id and a two-hour expiry, sealed with
AES-GCM under a key derived from the auth secret. \`POST \u2026/challenges\` accepts
it as \`matchToken\` and opens it server-side; a token opens only for the viewer
it was minted for. Until a challenge is accepted, each debater sees the other
as "Your practice match" (\`ANONYMOUS_PRACTICE_PERSON\`, applied in
\`toWireChallenges\`), and the notifications for sending, declining or calling
off a pending request don't name the sender. Accepting reveals both names.`},{heading:`how-it-works`,content:`**Safety rules.** Matching requires an account, and guest (anonymous)
accounts can't volunteer or send challenges. A block from Contacts in either
direction keeps each person out of the other's matches, stops them challenging
each other, and keeps the round off the other's "needing a judge" list. A
blocked challenge gets the same "not open to challenges" reply as a volunteer
who has switched off, so the reply doesn't reveal the block. Each debater can
have at most ten challenges waiting for an answer, and only one per opponent.`},{heading:`how-it-works`,content:"**Tables.** `practice_profiles` has one row per user: role flags plus a JSON\n`preferences` payload. `practice_challenges` has one row per challenge. Rows\nare never deleted by the feature; a closed challenge keeps its status."},{heading:`judge-pool`,content:"Below the practice board, the same page has a **Judge Pool** (`#judge-pool`) for\ntournament judging, as opposed to practice rounds."},{heading:`judge-pool`,content:`**Volunteer as a judge.** Pick up to three upcoming weekends from the
circuit calendar's season weeks (the same A\u2013Y + Z weeks as the Debate
Majors calendar). Each weekend row shows its week letter, dates and the
majors running that Friday\u2013Sunday. Add the states you're in (up to five),
switch on **Able to travel** if you'll judge out of state, pick the formats
you judge, and write your judge philosophy. **List me for hire** off hides
you without losing the listing. Weekends drop off once they pass; with
none left you're out of the pool until you pick new ones.`},{heading:`judge-pool`,content:`**Hire a judge.** Every listed judge, by name, with their weekends,
states, travel, formats and philosophy. Filter by weekend, tournament state
and format. A judge fits a state if they're in it or will travel; in-state
judges come first. **Hire** sends a request: tournament name, one of the
judge's weekends, a pay offer and a message.`},{heading:`judge-pool`,content:"**Hire requests.** The judge accepts or declines; the organizer can cancel\nwhile it's waiting, and either side can call off an accepted one. Each\nchange sends a `judge_hire` notification to the other side, linking to\n`#judge-pool`."},{heading:`judge-pool`,content:`**Payment isn't connected.** The pay offer is text. Nothing is charged or
paid out on the site; the two sides settle pay directly once a request is
accepted. The site's Stripe setup only sells subscriptions through Payment
Links, which can't pay a judge.`},{heading:`judge-pool`,content:"**How it works.** The weekends come from `SEASON_MAJORS` in\n`debate-webview/lib/judge-pool/season-calendar.ts`, a copy of the dated\nevents in `packages/debate-tournaments/src/ui/majors/data.ts`; a test fails\nif the two drift. Validation and the hire rules (`applyHireAction`) are in\n`debate-webview/lib/judge-pool/validation.ts`, and the pool filter is\n`filter.ts` next to it. The API is `GET /api/judge-pool`,\n`PUT /api/judge-pool/listing`, `POST /api/judge-pool/hires` and\n`PATCH /api/judge-pool/hires/[hireId]`, over `apps/debate-ai.com/lib/judge-pool/queries.ts`.\nGuests can't list or hire, blocks hide people from each other, an organizer\ncan have 20 requests waiting and one open request per judge per weekend."},{heading:`judge-pool`,content:"**Tables.** `judge_pool_listings` (one row per user, lists as JSON) and\n`judge_hire_requests` (one row per request, never deleted). They ship to D1\nas `packages/debate-webview/migrations/0001_judge_pool.sql`."},{heading:`known-gaps`,content:`There's no in-app messaging. Beyond the challenge message, debaters arrange
details elsewhere, for example through Contacts.`},{heading:`known-gaps`,content:`A proposed time is a single suggestion. There's no counter-proposal. To
change it, decline and send a new challenge.`},{heading:`known-gaps`,content:`Nothing links a finished practice round back to its challenge, so results
and judge feedback aren't recorded here yet.`},{heading:`known-gaps`,content:`Matching draws from the 200 most recently updated volunteers.`},{heading:`known-gaps`,content:`Compatibility is a deterministic score over the profile fields; the free-text
note and availability aren't read by the matcher (and aren't shown, since
they could identify someone).`},{heading:`known-gaps`,content:`A pending request's judge seat can't be filled by invitation any more \u2014
the judge list isn't public \u2014 so judges pick up accepted rounds instead.`},{heading:`known-gaps`,content:"A request that is called off after being accepted shows the other debater\nas anonymous again, since only `accepted` reveals names."},{heading:`known-gaps`,content:`The judge pool takes no payment, and has no contract or confirmation beyond
the accepted request.`},{heading:`known-gaps`,content:"Judge weekends are limited to the 2026\u201327 circuit calendar; next season's\nweekends need a new `SEASON_MAJORS` list."},{heading:`known-gaps`,content:`The pool lists the 200 most recently updated listings.`}],headings:[{id:`practice-partners`,content:`Practice Partners`},{id:`what-it-shows`,content:`What it shows`},{id:`how-it-works`,content:`How it works`},{id:`judge-pool`,content:`Judge Pool`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#practice-partners`,title:(0,t.jsx)(t.Fragment,{children:`Practice Partners`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#judge-pool`,title:(0,t.jsx)(t.Fragment,{children:`Judge Pool`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`practice-partners`,children:`Practice Partners`}),`
`,(0,t.jsx)(n.p,{children:`Lets debaters find each other for practice rounds between tournaments.
Volunteer to be challenged, volunteer to judge, or both, and say which
formats, styles, speed, and level you're comfortable with. Then get matched
\u2014 anonymously \u2014 with a compatible debater and send them a request for a
virtual round.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/partners`}),`. Also the first panel in the Coach
Workspace's Practice section (`,(0,t.jsx)(n.code,{children:`/coaching?stage=practice`}),`).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-webview`}),` (UI, wire types, action rules) and
`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),` (API, queries).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`API:`}),` `,(0,t.jsx)(n.code,{children:`GET /api/practice-partners`}),`; `,(0,t.jsx)(n.code,{children:`PUT /api/practice-partners/profile`}),`;
`,(0,t.jsx)(n.code,{children:`POST /api/practice-partners/match`}),`; `,(0,t.jsx)(n.code,{children:`POST /api/practice-partners/challenges`}),`;
`,(0,t.jsx)(n.code,{children:`PATCH /api/practice-partners/challenges/[challengeId]`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Your practice profile.`}),` This has two switches: `,(0,t.jsx)(n.strong,{children:`Open to challenges`}),`
lists you as a debater, and `,(0,t.jsx)(n.strong,{children:`Volunteer to judge`}),` lists you as a judge.
Under them you set formats (PF, LD, Policy, Parli, Worlds/BP, Congress),
the styles you're comfortable with (traditional/lay, progressive/tech,
plans/CPs/DAs, critiques, theory & T, philosophy/framework, truth-testing),
speed, experience level, availability, and a note. Turning both switches
off takes you out of matching and judging but keeps your preferences.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Your challenges.`}),` They're grouped as `,(0,t.jsx)(n.em,{children:`Waiting on you`}),` (challenges to
answer, judging invitations), `,(0,t.jsx)(n.em,{children:`Upcoming rounds`}),` (soonest first), `,(0,t.jsx)(n.em,{children:`Sent`}),`,
and a few closed ones. An accepted round shows its `,(0,t.jsx)(n.strong,{children:`room code`}),`. Debaters
and the judge paste it into the round workspace's Cameras panel to join
the same peer-to-peer webcam room.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Rounds needing a judge.`}),` This only appears for judge volunteers. It
lists accepted rounds with an empty judge seat, and picking one up
notifies both debaters.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Find a practice partner.`}),` There is no public list of volunteers.
Pick a format (or any) and press `,(0,t.jsx)(n.strong,{children:`Find me a match`}),`: the server scores
everyone open to challenges against your profile \u2014 shared formats count
most, then shared styles, then speed and level \u2014 and draws one of the five
most compatible at random, weighted by score. The match is shown
anonymously: level, speed, formats and styles (the ones you share
highlighted), a compatibility percentage, and whether they also judge \u2014 no
name, avatar, availability or note. `,(0,t.jsx)(n.strong,{children:`Send request`}),` opens a short form
with the format (shared formats first), resolution, optional start time and
a message. `,(0,t.jsx)(n.strong,{children:`Find another`}),` draws again, skipping everyone already shown
and anyone you already have a request waiting on.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.p,{children:[`A challenge moves through `,(0,t.jsx)(n.code,{children:`pending`}),` \u2192 `,(0,t.jsx)(n.code,{children:`accepted`}),` | `,(0,t.jsx)(n.code,{children:`declined`}),` (the opponent
answers), or `,(0,t.jsx)(n.code,{children:`cancelled`}),`. The challenger can cancel at any time before the
round. The opponent can call it off once they've accepted. The judge seat is
empty, `,(0,t.jsx)(n.code,{children:`invited`}),` (the challenger named a judge), or `,(0,t.jsx)(n.code,{children:`confirmed`}),` (the judge
said yes, or picked up an unjudged round). The judge can decline an invitation
or step down later.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Who may do what is one pure function,
`,(0,t.jsx)(n.code,{children:`applyChallengeAction`}),` in `,(0,t.jsx)(n.code,{children:`debate-webview/lib/practice-partners/challenge-actions.ts`}),`.
The PATCH route enforces it, and the board uses it to decide which buttons to
show. The write only lands if the challenge is still in the state the action
was computed from. So if two judges pick up the same round at the same time,
the second gets a 409 instead of overwriting the first.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Each change creates a `,(0,t.jsx)(n.code,{children:`practice_challenge`}),` row in the existing notifications
feed for everyone else in the round, linking back to `,(0,t.jsx)(n.code,{children:`/practice/partners`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Anonymity.`}),` The match endpoint never sends a name or account id. The
browser gets an opaque token instead (`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/practice-partners/match-token.ts`}),`):
the matched debater's id, the viewer's id and a two-hour expiry, sealed with
AES-GCM under a key derived from the auth secret. `,(0,t.jsx)(n.code,{children:`POST \u2026/challenges`}),` accepts
it as `,(0,t.jsx)(n.code,{children:`matchToken`}),` and opens it server-side; a token opens only for the viewer
it was minted for. Until a challenge is accepted, each debater sees the other
as "Your practice match" (`,(0,t.jsx)(n.code,{children:`ANONYMOUS_PRACTICE_PERSON`}),`, applied in
`,(0,t.jsx)(n.code,{children:`toWireChallenges`}),`), and the notifications for sending, declining or calling
off a pending request don't name the sender. Accepting reveals both names.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Safety rules.`}),` Matching requires an account, and guest (anonymous)
accounts can't volunteer or send challenges. A block from Contacts in either
direction keeps each person out of the other's matches, stops them challenging
each other, and keeps the round off the other's "needing a judge" list. A
blocked challenge gets the same "not open to challenges" reply as a volunteer
who has switched off, so the reply doesn't reveal the block. Each debater can
have at most ten challenges waiting for an answer, and only one per opponent.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Tables.`}),` `,(0,t.jsx)(n.code,{children:`practice_profiles`}),` has one row per user: role flags plus a JSON
`,(0,t.jsx)(n.code,{children:`preferences`}),` payload. `,(0,t.jsx)(n.code,{children:`practice_challenges`}),` has one row per challenge. Rows
are never deleted by the feature; a closed challenge keeps its status.`]}),`
`,(0,t.jsx)(n.h2,{id:`judge-pool`,children:`Judge Pool`}),`
`,(0,t.jsxs)(n.p,{children:[`Below the practice board, the same page has a `,(0,t.jsx)(n.strong,{children:`Judge Pool`}),` (`,(0,t.jsx)(n.code,{children:`#judge-pool`}),`) for
tournament judging, as opposed to practice rounds.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Volunteer as a judge.`}),` Pick up to three upcoming weekends from the
circuit calendar's season weeks (the same A\u2013Y + Z weeks as the Debate
Majors calendar). Each weekend row shows its week letter, dates and the
majors running that Friday\u2013Sunday. Add the states you're in (up to five),
switch on `,(0,t.jsx)(n.strong,{children:`Able to travel`}),` if you'll judge out of state, pick the formats
you judge, and write your judge philosophy. `,(0,t.jsx)(n.strong,{children:`List me for hire`}),` off hides
you without losing the listing. Weekends drop off once they pass; with
none left you're out of the pool until you pick new ones.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Hire a judge.`}),` Every listed judge, by name, with their weekends,
states, travel, formats and philosophy. Filter by weekend, tournament state
and format. A judge fits a state if they're in it or will travel; in-state
judges come first. `,(0,t.jsx)(n.strong,{children:`Hire`}),` sends a request: tournament name, one of the
judge's weekends, a pay offer and a message.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Hire requests.`}),` The judge accepts or declines; the organizer can cancel
while it's waiting, and either side can call off an accepted one. Each
change sends a `,(0,t.jsx)(n.code,{children:`judge_hire`}),` notification to the other side, linking to
`,(0,t.jsx)(n.code,{children:`#judge-pool`}),`.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Payment isn't connected.`}),` The pay offer is text. Nothing is charged or
paid out on the site; the two sides settle pay directly once a request is
accepted. The site's Stripe setup only sells subscriptions through Payment
Links, which can't pay a judge.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`How it works.`}),` The weekends come from `,(0,t.jsx)(n.code,{children:`SEASON_MAJORS`}),` in
`,(0,t.jsx)(n.code,{children:`debate-webview/lib/judge-pool/season-calendar.ts`}),`, a copy of the dated
events in `,(0,t.jsx)(n.code,{children:`packages/debate-tournaments/src/ui/majors/data.ts`}),`; a test fails
if the two drift. Validation and the hire rules (`,(0,t.jsx)(n.code,{children:`applyHireAction`}),`) are in
`,(0,t.jsx)(n.code,{children:`debate-webview/lib/judge-pool/validation.ts`}),`, and the pool filter is
`,(0,t.jsx)(n.code,{children:`filter.ts`}),` next to it. The API is `,(0,t.jsx)(n.code,{children:`GET /api/judge-pool`}),`,
`,(0,t.jsx)(n.code,{children:`PUT /api/judge-pool/listing`}),`, `,(0,t.jsx)(n.code,{children:`POST /api/judge-pool/hires`}),` and
`,(0,t.jsx)(n.code,{children:`PATCH /api/judge-pool/hires/[hireId]`}),`, over `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/judge-pool/queries.ts`}),`.
Guests can't list or hire, blocks hide people from each other, an organizer
can have 20 requests waiting and one open request per judge per weekend.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Tables.`}),` `,(0,t.jsx)(n.code,{children:`judge_pool_listings`}),` (one row per user, lists as JSON) and
`,(0,t.jsx)(n.code,{children:`judge_hire_requests`}),` (one row per request, never deleted). They ship to D1
as `,(0,t.jsx)(n.code,{children:`packages/debate-webview/migrations/0001_judge_pool.sql`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`There's no in-app messaging. Beyond the challenge message, debaters arrange
details elsewhere, for example through `,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/contacts`,children:`Contacts`}),`.`]}),`
`,(0,t.jsx)(n.li,{children:`A proposed time is a single suggestion. There's no counter-proposal. To
change it, decline and send a new challenge.`}),`
`,(0,t.jsx)(n.li,{children:`Nothing links a finished practice round back to its challenge, so results
and judge feedback aren't recorded here yet.`}),`
`,(0,t.jsx)(n.li,{children:`Matching draws from the 200 most recently updated volunteers.`}),`
`,(0,t.jsx)(n.li,{children:`Compatibility is a deterministic score over the profile fields; the free-text
note and availability aren't read by the matcher (and aren't shown, since
they could identify someone).`}),`
`,(0,t.jsx)(n.li,{children:`A pending request's judge seat can't be filled by invitation any more \u2014
the judge list isn't public \u2014 so judges pick up accepted rounds instead.`}),`
`,(0,t.jsxs)(n.li,{children:[`A request that is called off after being accepted shows the other debater
as anonymous again, since only `,(0,t.jsx)(n.code,{children:`accepted`}),` reveals names.`]}),`
`,(0,t.jsx)(n.li,{children:`The judge pool takes no payment, and has no contract or confirmation beyond
the accepted request.`}),`
`,(0,t.jsxs)(n.li,{children:[`Judge weekends are limited to the 2026\u201327 circuit calendar; next season's
weekends need a new `,(0,t.jsx)(n.code,{children:`SEASON_MAJORS`}),` list.`]}),`
`,(0,t.jsx)(n.li,{children:`The pool lists the 200 most recently updated listings.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};