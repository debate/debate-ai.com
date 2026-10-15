import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Tournaments`},r=`# Tournaments [#tournaments]

Tournament invitations, pairings and results, without leaving the app.
**Tournaments** at the top of **Coaching** in the sidebar (\`/tournaments\`) is this
app's own view, built with the site's theme: live Tabroom tournaments plus the
ones hosted here. Tabroom's own site, framed, is still reachable directly at
\`/practice/tabroom\`, but no longer has a sidebar row.

## Tournament addresses [#tournament-addresses]

Each tournament's pages live under the year it starts and its name, so
the Yale Invitational's results are at \`/tournaments/2026/yale-invitational/results\`
and its pairings at \`/tournaments/2026/yale-invitational/rounds\`. Links that
name a tournament by its Tabroom number (\`/tournaments/38436/results\`) still
work and settle on the named address once the tournament loads; so do old
\`/practice/tournaments/\u2026\` bookmarks, which redirect here.

An address that doesn't match a page sends you to the nearest one that does:
a mistyped section (\`/tournaments/2026/yale-invitational/nope\`) goes back to
the tournament, and a tournament name that matches nothing goes back to
\`/tournaments\`. Anywhere else on the site, a missing page sends you one level
up the address the same way.

## What you can see [#what-you-can-see]

- **Upcoming tournaments**, searchable by name, state, circuit or event.
  Tournaments hosted on this site, marked **Hosted here**, come first, then
  live Tabroom's. **Host Tournament** opens the creation form and **Demo
  admin** opens the demo tournament's admin view.
- **Invite**: dates, location, registration deadline, events with entry counts
  and fees, posted documents (each opens the file), contacts and the
  tournament's info pages.
- **Pairings**: every published round, grouped by event. Opening a round shows
  each room's entries (sides or speaker order) and judges.
- **Results**: every published result set, with places, entries, schools and
  the tiebreak columns Tabroom reports (wins, points, ranks\u2026).
- **Tabroom**: on a live Tabroom tournament, the last tab opens Tabroom's own
  page for it in a frame, so you can register or enter ballots there.
- **Admin**: on a tournament hosted here, the last tab is its admin view
  instead (see below).
- **Ballot**: judges submit a ballot for a round (see below).

## Submitting a ballot [#submitting-a-ballot]

The **Ballot** tab (\`/tournaments/2026/yale-invitational/ballot\`) is where a
judge files a ballot: event, round, room, the two entries, the winner (with a
low-point-win box), optional speaker points and the reason for decision.
Open it from the tab strip at the top of any tournament page and enter the
pairing there.

You must be signed in, and the **Tabroom account email** on the ballot must
match the email you are signed in to Debate AI with. The form shows whether it
matches as you type and won't submit until it does; the server checks again
and turns the ballot away if not.

**Send to** picks where the ballot goes:

- **Debate AI only** stores it here, at \`/api/judge-ballots\`. Your ballots for
  the tournament are listed under the form.
- **Tabroom** also sends it on to Tabroom using your own Tabroom API token,
  which is passed along and never saved. A copy is kept here either way, marked
  with whether Tabroom accepted it. This option is greyed out until the site
  sets \`TABROOM_BALLOT_URL\` to Tabroom's ballot endpoint; until then, use
  **Open my Tabroom ballots** to enter it on Tabroom directly.

AI agents can submit the same ballot as a tool call: \`GET
/api/judge-ballots/tool\` returns the \`submit_judge_ballot\` tool definition, and
calling it means posting those arguments to \`/api/judge-ballots\` under the
judge's session, with the same email rule.

## Hosting your own tournament [#hosting-your-own-tournament]

**Host Tournament** on the upcoming page (or \`/tournaments/host\`)
creates the tournament in this site's own hosting API (the Tabroom tables the
\`debate-tournaments\` package runs in the app's database, at \`/api/tabroom\`).
Nothing is created on Tabroom. You need to be signed in. Give it a name, dates,
where it is held, and pick the formats it runs:

- **Virtual** \u2014 fully remote, rounds run online via video.
- **In-Person** \u2014 at a single physical venue.
- **Long-Term Online** \u2014 online, scheduled across multiple days or weeks.

### Formats [#formats]

A tournament runs any combination of these formats, each of which becomes its
own division you can customize:

- **Policy** \u2014 1AC/2AC/1AR/2AR against 1NC/2NC/1NR/2NR, four cross-examination
  periods.
- **LD** \u2014 1AC/1AR against 1NC/2NR, one debater a side.
- **Public Forum** \u2014 CON/AFF/NS/AS/NAF/NEG with a shared grand
  cross-examination, where the flip decides who speaks first.
- **Parliamentary** \u2014 PMC/MG/PMR against LOC/MO/LOR, with points of
  information instead of cross-examination.
- **British Parliamentary** \u2014 four teams of two in each room, ranked first to
  fourth.
- **World Schools** \u2014 three speakers a side plus a reply speech, squads of up
  to five.
- **Asian Parliamentary** \u2014 three speakers a side plus a reply speech.
- **Big Questions** \u2014 constructive, rebuttal, consolidation and rationale on
  each side, with question segments.
- **IPDA** \u2014 one-on-one, with two cross-examination periods.
- **Congressional Debate** \u2014 a chamber of legislators, with authorship,
  alternating pro and con speeches and questioning.

Per format you choose the division it runs in (Open, Novice or JV), how entries
are written in pairings, a cap on entries per school, an entry fee, and a note
that appears on the public invite.

## The admin view [#the-admin-view]

Every hosted tournament has an admin web view at
\`/tournaments/<year>/<name>/admin\`, open to its owners and admins. It shows the
events with their entry counts, the whole schedule (including rounds that are
not published yet), every entry and its status, schools, judges, rooms and
result sets, each linked to its public page.

### The demo tournament [#the-demo-tournament]

The **Debate AI Demo Invitational** is a demo tournament anyone can browse as its
admin, signed in or not, under the mock username **demo.admin**. It is the
only demo, and it is a full-size tournament: Policy, Lincoln-Douglas, Public
Forum and Parliamentary debate plus Original Oratory, Extemp, Dramatic Interp
and Informative, with 40 entries in each from 32 schools. Every debate division
has six power-matched prelims and a 16-team break from octafinals to finals,
and speech has three prelims, semifinals and a final. Its results include
prelim seeds, final places, speaker awards and the elimination bracket. **Demo admin** on the upcoming page and **Try the demo admin** on the
host page both open it. The site loads it by itself when it is missing or over,
so its dates always stay current.

#### Editing the demo's mock data [#editing-the-demos-mock-data]

The demo's admin view ends with **Edit mock data**, where anyone can change
its entries (code, name, status), judges (name, code, active), rounds (label,
whether pairings are published and results posted), pairings (each section's
judges and, in debate, its winner) and result sets (label, published). Each
row saves on its own with **Save**. Edits only ever change the demo
tournament, never a hosted tournament or Tabroom's data; they are shared by
everyone browsing the demo and last until **Reset demo data** reloads the
original mock data (or the demo reloads itself once it is over).

#### Watching the demo's rounds live [#watching-the-demos-rounds-live]

The demo's pairings show simulated live rounds. Next to each room the
**Live** column shows the speech under way (for example **2NC \u00B7 Neg**) and how
far through the round it is, and each round on the **Pairings** tab shows the
same for its typical room. The **Results** tab lists the round each event is
debating right now under **Live now**.

**Tune in** opens a room's stream under it:

- live captions of the speech being given, with the time left in it;
- the speech order, with finished speeches greyed and the current one filling up;
- **Live updates**: when each speech, cross-ex and prep began and ended, then the decision;
- **Speech summaries**, one per finished speech, each with **Listen** to hear it read aloud;
- **Listen live**, which reads each speech aloud as it starts.

Rounds run at six times real speed and loop \u2014 check-in, the speeches, then the
decision \u2014 so there is always something on. The speeches and summaries are
generated filler, not real debates, and every viewer sees the same moment.
Read-aloud uses your browser's built-in voices.

## Good to know [#good-to-know]

- Pairings and results are refreshed at most once a minute, so reload during a
  tournament to see the latest round.
- Two tournaments with the same name in the same year can't share an address,
  so the second one keeps its Tabroom number in its links.
- You are recorded as the tournament's owner, and registered in every format it
  runs, so the first pairing has somebody in it.
- The admin view reads the tournament; adding schools, rooms, rounds and
  ballots from it is not built yet.
- Signing in to Tabroom happens on Tabroom, inside the **Tabroom** row's frame;
  live Tabroom tournaments show public information only.
`,i={contents:[{heading:`tournaments`,content:`Tournament invitations, pairings and results, without leaving the app.
**Tournaments** at the top of **Coaching** in the sidebar (\`/tournaments\`) is this
app's own view, built with the site's theme: live Tabroom tournaments plus the
ones hosted here. Tabroom's own site, framed, is still reachable directly at
\`/practice/tabroom\`, but no longer has a sidebar row.`},{heading:`tournament-addresses`,content:"Each tournament's pages live under the year it starts and its name, so\nthe Yale Invitational's results are at `/tournaments/2026/yale-invitational/results`\nand its pairings at `/tournaments/2026/yale-invitational/rounds`. Links that\nname a tournament by its Tabroom number (`/tournaments/38436/results`) still\nwork and settle on the named address once the tournament loads; so do old\n`/practice/tournaments/\u2026` bookmarks, which redirect here."},{heading:`tournament-addresses`,content:`An address that doesn't match a page sends you to the nearest one that does:
a mistyped section (\`/tournaments/2026/yale-invitational/nope\`) goes back to
the tournament, and a tournament name that matches nothing goes back to
\`/tournaments\`. Anywhere else on the site, a missing page sends you one level
up the address the same way.`},{heading:`what-you-can-see`,content:`**Upcoming tournaments**, searchable by name, state, circuit or event.
Tournaments hosted on this site, marked **Hosted here**, come first, then
live Tabroom's. **Host Tournament** opens the creation form and **Demo
admin** opens the demo tournament's admin view.`},{heading:`what-you-can-see`,content:`**Invite**: dates, location, registration deadline, events with entry counts
and fees, posted documents (each opens the file), contacts and the
tournament's info pages.`},{heading:`what-you-can-see`,content:`**Pairings**: every published round, grouped by event. Opening a round shows
each room's entries (sides or speaker order) and judges.`},{heading:`what-you-can-see`,content:`**Results**: every published result set, with places, entries, schools and
the tiebreak columns Tabroom reports (wins, points, ranks\u2026).`},{heading:`what-you-can-see`,content:`**Tabroom**: on a live Tabroom tournament, the last tab opens Tabroom's own
page for it in a frame, so you can register or enter ballots there.`},{heading:`what-you-can-see`,content:`**Admin**: on a tournament hosted here, the last tab is its admin view
instead (see below).`},{heading:`what-you-can-see`,content:`**Ballot**: judges submit a ballot for a round (see below).`},{heading:`submitting-a-ballot`,content:`The **Ballot** tab (\`/tournaments/2026/yale-invitational/ballot\`) is where a
judge files a ballot: event, round, room, the two entries, the winner (with a
low-point-win box), optional speaker points and the reason for decision.
Open it from the tab strip at the top of any tournament page and enter the
pairing there.`},{heading:`submitting-a-ballot`,content:`You must be signed in, and the **Tabroom account email** on the ballot must
match the email you are signed in to Debate AI with. The form shows whether it
matches as you type and won't submit until it does; the server checks again
and turns the ballot away if not.`},{heading:`submitting-a-ballot`,content:`**Send to** picks where the ballot goes:`},{heading:`submitting-a-ballot`,content:"**Debate AI only** stores it here, at `/api/judge-ballots`. Your ballots for\nthe tournament are listed under the form."},{heading:`submitting-a-ballot`,content:`**Tabroom** also sends it on to Tabroom using your own Tabroom API token,
which is passed along and never saved. A copy is kept here either way, marked
with whether Tabroom accepted it. This option is greyed out until the site
sets \`TABROOM_BALLOT_URL\` to Tabroom's ballot endpoint; until then, use
**Open my Tabroom ballots** to enter it on Tabroom directly.`},{heading:`submitting-a-ballot`,content:"AI agents can submit the same ballot as a tool call: `GET\n/api/judge-ballots/tool` returns the `submit_judge_ballot` tool definition, and\ncalling it means posting those arguments to `/api/judge-ballots` under the\njudge's session, with the same email rule."},{heading:`hosting-your-own-tournament`,content:"**Host Tournament** on the upcoming page (or `/tournaments/host`)\ncreates the tournament in this site's own hosting API (the Tabroom tables the\n`debate-tournaments` package runs in the app's database, at `/api/tabroom`).\nNothing is created on Tabroom. You need to be signed in. Give it a name, dates,\nwhere it is held, and pick the formats it runs:"},{heading:`hosting-your-own-tournament`,content:`**Virtual** \u2014 fully remote, rounds run online via video.`},{heading:`hosting-your-own-tournament`,content:`**In-Person** \u2014 at a single physical venue.`},{heading:`hosting-your-own-tournament`,content:`**Long-Term Online** \u2014 online, scheduled across multiple days or weeks.`},{heading:`formats`,content:`A tournament runs any combination of these formats, each of which becomes its
own division you can customize:`},{heading:`formats`,content:`**Policy** \u2014 1AC/2AC/1AR/2AR against 1NC/2NC/1NR/2NR, four cross-examination
periods.`},{heading:`formats`,content:`**LD** \u2014 1AC/1AR against 1NC/2NR, one debater a side.`},{heading:`formats`,content:`**Public Forum** \u2014 CON/AFF/NS/AS/NAF/NEG with a shared grand
cross-examination, where the flip decides who speaks first.`},{heading:`formats`,content:`**Parliamentary** \u2014 PMC/MG/PMR against LOC/MO/LOR, with points of
information instead of cross-examination.`},{heading:`formats`,content:`**British Parliamentary** \u2014 four teams of two in each room, ranked first to
fourth.`},{heading:`formats`,content:`**World Schools** \u2014 three speakers a side plus a reply speech, squads of up
to five.`},{heading:`formats`,content:`**Asian Parliamentary** \u2014 three speakers a side plus a reply speech.`},{heading:`formats`,content:`**Big Questions** \u2014 constructive, rebuttal, consolidation and rationale on
each side, with question segments.`},{heading:`formats`,content:`**IPDA** \u2014 one-on-one, with two cross-examination periods.`},{heading:`formats`,content:`**Congressional Debate** \u2014 a chamber of legislators, with authorship,
alternating pro and con speeches and questioning.`},{heading:`formats`,content:`Per format you choose the division it runs in (Open, Novice or JV), how entries
are written in pairings, a cap on entries per school, an entry fee, and a note
that appears on the public invite.`},{heading:`the-admin-view`,content:`Every hosted tournament has an admin web view at
\`/tournaments/<year>/<name>/admin\`, open to its owners and admins. It shows the
events with their entry counts, the whole schedule (including rounds that are
not published yet), every entry and its status, schools, judges, rooms and
result sets, each linked to its public page.`},{heading:`the-demo-tournament`,content:`The **Debate AI Demo Invitational** is a demo tournament anyone can browse as its
admin, signed in or not, under the mock username **demo.admin**. It is the
only demo, and it is a full-size tournament: Policy, Lincoln-Douglas, Public
Forum and Parliamentary debate plus Original Oratory, Extemp, Dramatic Interp
and Informative, with 40 entries in each from 32 schools. Every debate division
has six power-matched prelims and a 16-team break from octafinals to finals,
and speech has three prelims, semifinals and a final. Its results include
prelim seeds, final places, speaker awards and the elimination bracket. **Demo admin** on the upcoming page and **Try the demo admin** on the
host page both open it. The site loads it by itself when it is missing or over,
so its dates always stay current.`},{heading:`editing-the-demos-mock-data`,content:`The demo's admin view ends with **Edit mock data**, where anyone can change
its entries (code, name, status), judges (name, code, active), rounds (label,
whether pairings are published and results posted), pairings (each section's
judges and, in debate, its winner) and result sets (label, published). Each
row saves on its own with **Save**. Edits only ever change the demo
tournament, never a hosted tournament or Tabroom's data; they are shared by
everyone browsing the demo and last until **Reset demo data** reloads the
original mock data (or the demo reloads itself once it is over).`},{heading:`watching-the-demos-rounds-live`,content:`The demo's pairings show simulated live rounds. Next to each room the
**Live** column shows the speech under way (for example **2NC \u00B7 Neg**) and how
far through the round it is, and each round on the **Pairings** tab shows the
same for its typical room. The **Results** tab lists the round each event is
debating right now under **Live now**.`},{heading:`watching-the-demos-rounds-live`,content:`**Tune in** opens a room's stream under it:`},{heading:`watching-the-demos-rounds-live`,content:`live captions of the speech being given, with the time left in it;`},{heading:`watching-the-demos-rounds-live`,content:`the speech order, with finished speeches greyed and the current one filling up;`},{heading:`watching-the-demos-rounds-live`,content:`**Live updates**: when each speech, cross-ex and prep began and ended, then the decision;`},{heading:`watching-the-demos-rounds-live`,content:`**Speech summaries**, one per finished speech, each with **Listen** to hear it read aloud;`},{heading:`watching-the-demos-rounds-live`,content:`**Listen live**, which reads each speech aloud as it starts.`},{heading:`watching-the-demos-rounds-live`,content:`Rounds run at six times real speed and loop \u2014 check-in, the speeches, then the
decision \u2014 so there is always something on. The speeches and summaries are
generated filler, not real debates, and every viewer sees the same moment.
Read-aloud uses your browser's built-in voices.`},{heading:`good-to-know`,content:`Pairings and results are refreshed at most once a minute, so reload during a
tournament to see the latest round.`},{heading:`good-to-know`,content:`Two tournaments with the same name in the same year can't share an address,
so the second one keeps its Tabroom number in its links.`},{heading:`good-to-know`,content:`You are recorded as the tournament's owner, and registered in every format it
runs, so the first pairing has somebody in it.`},{heading:`good-to-know`,content:`The admin view reads the tournament; adding schools, rooms, rounds and
ballots from it is not built yet.`},{heading:`good-to-know`,content:`Signing in to Tabroom happens on Tabroom, inside the **Tabroom** row's frame;
live Tabroom tournaments show public information only.`}],headings:[{id:`tournaments`,content:`Tournaments`},{id:`tournament-addresses`,content:`Tournament addresses`},{id:`what-you-can-see`,content:`What you can see`},{id:`submitting-a-ballot`,content:`Submitting a ballot`},{id:`hosting-your-own-tournament`,content:`Hosting your own tournament`},{id:`formats`,content:`Formats`},{id:`the-admin-view`,content:`The admin view`},{id:`the-demo-tournament`,content:`The demo tournament`},{id:`editing-the-demos-mock-data`,content:`Editing the demo's mock data`},{id:`watching-the-demos-rounds-live`,content:`Watching the demo's rounds live`},{id:`good-to-know`,content:`Good to know`}]},a=[{depth:1,url:`#tournaments`,title:(0,t.jsx)(t.Fragment,{children:`Tournaments`})},{depth:2,url:`#tournament-addresses`,title:(0,t.jsx)(t.Fragment,{children:`Tournament addresses`})},{depth:2,url:`#what-you-can-see`,title:(0,t.jsx)(t.Fragment,{children:`What you can see`})},{depth:2,url:`#submitting-a-ballot`,title:(0,t.jsx)(t.Fragment,{children:`Submitting a ballot`})},{depth:2,url:`#hosting-your-own-tournament`,title:(0,t.jsx)(t.Fragment,{children:`Hosting your own tournament`})},{depth:3,url:`#formats`,title:(0,t.jsx)(t.Fragment,{children:`Formats`})},{depth:2,url:`#the-admin-view`,title:(0,t.jsx)(t.Fragment,{children:`The admin view`})},{depth:3,url:`#the-demo-tournament`,title:(0,t.jsx)(t.Fragment,{children:`The demo tournament`})},{depth:4,url:`#editing-the-demos-mock-data`,title:(0,t.jsx)(t.Fragment,{children:`Editing the demo's mock data`})},{depth:4,url:`#watching-the-demos-rounds-live`,title:(0,t.jsx)(t.Fragment,{children:`Watching the demo's rounds live`})},{depth:2,url:`#good-to-know`,title:(0,t.jsx)(t.Fragment,{children:`Good to know`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,h3:`h3`,h4:`h4`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`tournaments`,children:`Tournaments`}),`
`,(0,t.jsxs)(n.p,{children:[`Tournament invitations, pairings and results, without leaving the app.
`,(0,t.jsx)(n.strong,{children:`Tournaments`}),` at the top of `,(0,t.jsx)(n.strong,{children:`Coaching`}),` in the sidebar (`,(0,t.jsx)(n.code,{children:`/tournaments`}),`) is this
app's own view, built with the site's theme: live Tabroom tournaments plus the
ones hosted here. Tabroom's own site, framed, is still reachable directly at
`,(0,t.jsx)(n.code,{children:`/practice/tabroom`}),`, but no longer has a sidebar row.`]}),`
`,(0,t.jsx)(n.h2,{id:`tournament-addresses`,children:`Tournament addresses`}),`
`,(0,t.jsxs)(n.p,{children:[`Each tournament's pages live under the year it starts and its name, so
the Yale Invitational's results are at `,(0,t.jsx)(n.code,{children:`/tournaments/2026/yale-invitational/results`}),`
and its pairings at `,(0,t.jsx)(n.code,{children:`/tournaments/2026/yale-invitational/rounds`}),`. Links that
name a tournament by its Tabroom number (`,(0,t.jsx)(n.code,{children:`/tournaments/38436/results`}),`) still
work and settle on the named address once the tournament loads; so do old
`,(0,t.jsx)(n.code,{children:`/practice/tournaments/\u2026`}),` bookmarks, which redirect here.`]}),`
`,(0,t.jsxs)(n.p,{children:[`An address that doesn't match a page sends you to the nearest one that does:
a mistyped section (`,(0,t.jsx)(n.code,{children:`/tournaments/2026/yale-invitational/nope`}),`) goes back to
the tournament, and a tournament name that matches nothing goes back to
`,(0,t.jsx)(n.code,{children:`/tournaments`}),`. Anywhere else on the site, a missing page sends you one level
up the address the same way.`]}),`
`,(0,t.jsx)(n.h2,{id:`what-you-can-see`,children:`What you can see`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Upcoming tournaments`}),`, searchable by name, state, circuit or event.
Tournaments hosted on this site, marked `,(0,t.jsx)(n.strong,{children:`Hosted here`}),`, come first, then
live Tabroom's. `,(0,t.jsx)(n.strong,{children:`Host Tournament`}),` opens the creation form and `,(0,t.jsx)(n.strong,{children:`Demo
admin`}),` opens the demo tournament's admin view.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Invite`}),`: dates, location, registration deadline, events with entry counts
and fees, posted documents (each opens the file), contacts and the
tournament's info pages.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Pairings`}),`: every published round, grouped by event. Opening a round shows
each room's entries (sides or speaker order) and judges.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Results`}),`: every published result set, with places, entries, schools and
the tiebreak columns Tabroom reports (wins, points, ranks\u2026).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Tabroom`}),`: on a live Tabroom tournament, the last tab opens Tabroom's own
page for it in a frame, so you can register or enter ballots there.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Admin`}),`: on a tournament hosted here, the last tab is its admin view
instead (see below).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Ballot`}),`: judges submit a ballot for a round (see below).`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`submitting-a-ballot`,children:`Submitting a ballot`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Ballot`}),` tab (`,(0,t.jsx)(n.code,{children:`/tournaments/2026/yale-invitational/ballot`}),`) is where a
judge files a ballot: event, round, room, the two entries, the winner (with a
low-point-win box), optional speaker points and the reason for decision.
Open it from the tab strip at the top of any tournament page and enter the
pairing there.`]}),`
`,(0,t.jsxs)(n.p,{children:[`You must be signed in, and the `,(0,t.jsx)(n.strong,{children:`Tabroom account email`}),` on the ballot must
match the email you are signed in to Debate AI with. The form shows whether it
matches as you type and won't submit until it does; the server checks again
and turns the ballot away if not.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Send to`}),` picks where the ballot goes:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Debate AI only`}),` stores it here, at `,(0,t.jsx)(n.code,{children:`/api/judge-ballots`}),`. Your ballots for
the tournament are listed under the form.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Tabroom`}),` also sends it on to Tabroom using your own Tabroom API token,
which is passed along and never saved. A copy is kept here either way, marked
with whether Tabroom accepted it. This option is greyed out until the site
sets `,(0,t.jsx)(n.code,{children:`TABROOM_BALLOT_URL`}),` to Tabroom's ballot endpoint; until then, use
`,(0,t.jsx)(n.strong,{children:`Open my Tabroom ballots`}),` to enter it on Tabroom directly.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`AI agents can submit the same ballot as a tool call: `,(0,t.jsx)(n.code,{children:`GET /api/judge-ballots/tool`}),` returns the `,(0,t.jsx)(n.code,{children:`submit_judge_ballot`}),` tool definition, and
calling it means posting those arguments to `,(0,t.jsx)(n.code,{children:`/api/judge-ballots`}),` under the
judge's session, with the same email rule.`]}),`
`,(0,t.jsx)(n.h2,{id:`hosting-your-own-tournament`,children:`Hosting your own tournament`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Host Tournament`}),` on the upcoming page (or `,(0,t.jsx)(n.code,{children:`/tournaments/host`}),`)
creates the tournament in this site's own hosting API (the Tabroom tables the
`,(0,t.jsx)(n.code,{children:`debate-tournaments`}),` package runs in the app's database, at `,(0,t.jsx)(n.code,{children:`/api/tabroom`}),`).
Nothing is created on Tabroom. You need to be signed in. Give it a name, dates,
where it is held, and pick the formats it runs:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Virtual`}),` \u2014 fully remote, rounds run online via video.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`In-Person`}),` \u2014 at a single physical venue.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Long-Term Online`}),` \u2014 online, scheduled across multiple days or weeks.`]}),`
`]}),`
`,(0,t.jsx)(n.h3,{id:`formats`,children:`Formats`}),`
`,(0,t.jsx)(n.p,{children:`A tournament runs any combination of these formats, each of which becomes its
own division you can customize:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Policy`}),` \u2014 1AC/2AC/1AR/2AR against 1NC/2NC/1NR/2NR, four cross-examination
periods.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`LD`}),` \u2014 1AC/1AR against 1NC/2NR, one debater a side.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Public Forum`}),` \u2014 CON/AFF/NS/AS/NAF/NEG with a shared grand
cross-examination, where the flip decides who speaks first.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Parliamentary`}),` \u2014 PMC/MG/PMR against LOC/MO/LOR, with points of
information instead of cross-examination.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`British Parliamentary`}),` \u2014 four teams of two in each room, ranked first to
fourth.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`World Schools`}),` \u2014 three speakers a side plus a reply speech, squads of up
to five.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Asian Parliamentary`}),` \u2014 three speakers a side plus a reply speech.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Big Questions`}),` \u2014 constructive, rebuttal, consolidation and rationale on
each side, with question segments.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`IPDA`}),` \u2014 one-on-one, with two cross-examination periods.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Congressional Debate`}),` \u2014 a chamber of legislators, with authorship,
alternating pro and con speeches and questioning.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`Per format you choose the division it runs in (Open, Novice or JV), how entries
are written in pairings, a cap on entries per school, an entry fee, and a note
that appears on the public invite.`}),`
`,(0,t.jsx)(n.h2,{id:`the-admin-view`,children:`The admin view`}),`
`,(0,t.jsxs)(n.p,{children:[`Every hosted tournament has an admin web view at
`,(0,t.jsx)(n.code,{children:`/tournaments/<year>/<name>/admin`}),`, open to its owners and admins. It shows the
events with their entry counts, the whole schedule (including rounds that are
not published yet), every entry and its status, schools, judges, rooms and
result sets, each linked to its public page.`]}),`
`,(0,t.jsx)(n.h3,{id:`the-demo-tournament`,children:`The demo tournament`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Debate AI Demo Invitational`}),` is a demo tournament anyone can browse as its
admin, signed in or not, under the mock username `,(0,t.jsx)(n.strong,{children:`demo.admin`}),`. It is the
only demo, and it is a full-size tournament: Policy, Lincoln-Douglas, Public
Forum and Parliamentary debate plus Original Oratory, Extemp, Dramatic Interp
and Informative, with 40 entries in each from 32 schools. Every debate division
has six power-matched prelims and a 16-team break from octafinals to finals,
and speech has three prelims, semifinals and a final. Its results include
prelim seeds, final places, speaker awards and the elimination bracket. `,(0,t.jsx)(n.strong,{children:`Demo admin`}),` on the upcoming page and `,(0,t.jsx)(n.strong,{children:`Try the demo admin`}),` on the
host page both open it. The site loads it by itself when it is missing or over,
so its dates always stay current.`]}),`
`,(0,t.jsx)(n.h4,{id:`editing-the-demos-mock-data`,children:`Editing the demo's mock data`}),`
`,(0,t.jsxs)(n.p,{children:[`The demo's admin view ends with `,(0,t.jsx)(n.strong,{children:`Edit mock data`}),`, where anyone can change
its entries (code, name, status), judges (name, code, active), rounds (label,
whether pairings are published and results posted), pairings (each section's
judges and, in debate, its winner) and result sets (label, published). Each
row saves on its own with `,(0,t.jsx)(n.strong,{children:`Save`}),`. Edits only ever change the demo
tournament, never a hosted tournament or Tabroom's data; they are shared by
everyone browsing the demo and last until `,(0,t.jsx)(n.strong,{children:`Reset demo data`}),` reloads the
original mock data (or the demo reloads itself once it is over).`]}),`
`,(0,t.jsx)(n.h4,{id:`watching-the-demos-rounds-live`,children:`Watching the demo's rounds live`}),`
`,(0,t.jsxs)(n.p,{children:[`The demo's pairings show simulated live rounds. Next to each room the
`,(0,t.jsx)(n.strong,{children:`Live`}),` column shows the speech under way (for example `,(0,t.jsx)(n.strong,{children:`2NC \u00B7 Neg`}),`) and how
far through the round it is, and each round on the `,(0,t.jsx)(n.strong,{children:`Pairings`}),` tab shows the
same for its typical room. The `,(0,t.jsx)(n.strong,{children:`Results`}),` tab lists the round each event is
debating right now under `,(0,t.jsx)(n.strong,{children:`Live now`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Tune in`}),` opens a room's stream under it:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`live captions of the speech being given, with the time left in it;`}),`
`,(0,t.jsx)(n.li,{children:`the speech order, with finished speeches greyed and the current one filling up;`}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Live updates`}),`: when each speech, cross-ex and prep began and ended, then the decision;`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Speech summaries`}),`, one per finished speech, each with `,(0,t.jsx)(n.strong,{children:`Listen`}),` to hear it read aloud;`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Listen live`}),`, which reads each speech aloud as it starts.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`Rounds run at six times real speed and loop \u2014 check-in, the speeches, then the
decision \u2014 so there is always something on. The speeches and summaries are
generated filler, not real debates, and every viewer sees the same moment.
Read-aloud uses your browser's built-in voices.`}),`
`,(0,t.jsx)(n.h2,{id:`good-to-know`,children:`Good to know`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Pairings and results are refreshed at most once a minute, so reload during a
tournament to see the latest round.`}),`
`,(0,t.jsx)(n.li,{children:`Two tournaments with the same name in the same year can't share an address,
so the second one keeps its Tabroom number in its links.`}),`
`,(0,t.jsx)(n.li,{children:`You are recorded as the tournament's owner, and registered in every format it
runs, so the first pairing has somebody in it.`}),`
`,(0,t.jsx)(n.li,{children:`The admin view reads the tournament; adding schools, rooms, rounds and
ballots from it is not built yet.`}),`
`,(0,t.jsxs)(n.li,{children:[`Signing in to Tabroom happens on Tabroom, inside the `,(0,t.jsx)(n.strong,{children:`Tabroom`}),` row's frame;
live Tabroom tournaments show public information only.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};