import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Practice tools`,description:`Debate between tournaments \u2014 practice rounds against other debaters, rounds against the AI, the practice round simulator, judge paradigms, opponent personas, and word-count speeches`,icon:`Swords`},r=`# Practice tools [#practice-tools]

The practice tools let you debate when there's no tournament: against another debater, against an AI opponent, in a simulated round
with a timer and an AI judge, or as a single speech under a word count. They're the *Practice* section of the
**[Coach Workspace](https://debate-ai.com/coach?section=practice)** and each has its own page. Unlike the
[training tools](/docs/features/tournaments-judge/training-tools), most of them don't need a flowed round to start from.

## Run a round against the AI [#run-a-round-against-the-ai]

**[Practice vs AI](https://debate-ai.com/practice/versus-ai)** (\`/practice/versus-ai\`, [feature spec](/docs/features/rounds/practice-vs-ai)) is a full,
timed round against an AI opponent in real turn order. Choose a difficulty, a topic and your side, and one of
the opponents at that difficulty. Your opponent then finds cards and caselist outlines on the topic and
summarizes the arguments for both sides before you start. Debate through timed opening, cross-examination,
and closing phases; at the end an AI judge scores the round and explains its decision. It's also on the dock
as **Practice vs AI**, and a round in progress can be resumed on the same account.

The **Practice Round Simulator** ([feature spec](/docs/features/rounds/practice-round-simulator)) is on the
same page now, in the collapsed **Round simulator** section (its old address, \`/practice\`, redirects there).
It recreates a tournament round's *conditions* \u2014 format, side, a timer, an AI judge paradigm, and an AI
opponent persona \u2014 and keeps your past attempts so you can compare them.

## Practice against real people [#practice-against-real-people]

**[Practice Partners](https://debate-ai.com/practice-partners)** (\`/practice/partners\`, [feature spec](/docs/features/team-collaboration/practice-partners))
is where you find a human opponent or judge. Set up a practice profile \u2014 switch on **Open to
challenges**, **Volunteer to judge**, or both, and pick the formats, styles, speed, and level you're
comfortable with. Then press **Find me a match**: you're paired at random with one of the most compatible
debaters for your profile, shown anonymously (level, speed, formats, styles, and how well you fit \u2014 never
who it is). **Send request** proposes a format, resolution, and time; they get a notification and can
accept or decline, and you both see who the other is once they accept. **Find another** draws again.
Accepted rounds get a webcam room code that both debaters and the
judge paste into the round workspace's Cameras panel. If you volunteer to judge, accepted rounds that still
need a judge are listed for you to pick up. It's the first panel in the Coach Workspace's Practice section.

**[Prediction Markets](https://debate-ai.com/practice/predictions)** (\`/practice/predictions\`, [feature spec](/docs/features/ai-coaching/prediction-markets))
lets you bet play-money points (everyone starts with 1,000) on who wins a debate, who wins a tournament, or
whether a team's team rating goes up. Prices move with every bet, and markets tied to rounds and events
hosted on the site, or to the rankings, settle themselves.

## Setting the judge and the opponent [#setting-the-judge-and-the-opponent]

Both round tools take their judge paradigm and opponent persona at setup time, from the same six built-in
AI judge paradigms and four built-in opponent styles, or from one you describe yourself.

| Tool | Route | What it does |
| --- | --- | --- |
| AI Judge Decision | \`/practice/judge-decision\` | Generate an AI decision for a round under its saved paradigm, grounded in the same flow summary the Argument Tree Outline shows. |

## Word-count speeches [#word-count-speeches]

**[Word-Count Speeches](https://debate-ai.com/word-count)** (\`/word-count\`, [feature spec](/docs/features/rounds/word-count-rounds))
replaces the clock with a maximum word count: one text area per speech in the chosen format, with a live
word-count badge recomputed on every keystroke. It's the right tool for written practice, for formats where
you'd rather cap length than time, and for drafting speeches you'll later deliver against the timer. Rounds
are saved to your account when signed in.

## Suggested loop [#suggested-loop]

1. **Scout** the judge and opponent you're preparing for in the
   [Prep Workspace](/docs/features/rounds/prep-workspace) (\`/practice/prep\`), which keeps briefings, scout-to-strategy,
   opponent and judge profiles, and prep notes on one page, and turn them into a paradigm and a persona.
2. **Rehearse** in the Practice Round Simulator under that paradigm and persona.
3. **Pressure-test** by playing the same side in Practice vs AI at a higher difficulty tier.
4. **Flow the practice round** in the round workspace and run the [training tools](/docs/features/tournaments-judge/training-tools)
   on it \u2014 drills and coaching prompts work on practice rounds exactly as on tournament rounds.

## Tips [#tips]

- **Sharing a section:** \`/coaching?stage=practice\` opens the Coach Workspace on the practice tools.
- **Signed out?** Every practice tool except Practice Partners works without an account; signing in is what
  makes rounds, attempts, and word-count speeches follow you across devices. Practice Partners matches real
  people, so it needs a (non-guest) account.
`,i={contents:[{heading:`practice-tools`,content:`The practice tools let you debate when there's no tournament: against another debater, against an AI opponent, in a simulated round
with a timer and an AI judge, or as a single speech under a word count. They're the *Practice* section of the
**Coach Workspace** and each has its own page. Unlike the
training tools, most of them don't need a flowed round to start from.`},{heading:`run-a-round-against-the-ai`,content:`**Practice vs AI** (\`/practice/versus-ai\`, feature spec) is a full,
timed round against an AI opponent in real turn order. Choose a difficulty, a topic and your side, and one of
the opponents at that difficulty. Your opponent then finds cards and caselist outlines on the topic and
summarizes the arguments for both sides before you start. Debate through timed opening, cross-examination,
and closing phases; at the end an AI judge scores the round and explains its decision. It's also on the dock
as **Practice vs AI**, and a round in progress can be resumed on the same account.`},{heading:`run-a-round-against-the-ai`,content:`The **Practice Round Simulator** (feature spec) is on the
same page now, in the collapsed **Round simulator** section (its old address, \`/practice\`, redirects there).
It recreates a tournament round's *conditions* \u2014 format, side, a timer, an AI judge paradigm, and an AI
opponent persona \u2014 and keeps your past attempts so you can compare them.`},{heading:`practice-against-real-people`,content:`**Practice Partners** (\`/practice/partners\`, feature spec)
is where you find a human opponent or judge. Set up a practice profile \u2014 switch on **Open to
challenges**, **Volunteer to judge**, or both, and pick the formats, styles, speed, and level you're
comfortable with. Then press **Find me a match**: you're paired at random with one of the most compatible
debaters for your profile, shown anonymously (level, speed, formats, styles, and how well you fit \u2014 never
who it is). **Send request** proposes a format, resolution, and time; they get a notification and can
accept or decline, and you both see who the other is once they accept. **Find another** draws again.
Accepted rounds get a webcam room code that both debaters and the
judge paste into the round workspace's Cameras panel. If you volunteer to judge, accepted rounds that still
need a judge are listed for you to pick up. It's the first panel in the Coach Workspace's Practice section.`},{heading:`practice-against-real-people`,content:`**Prediction Markets** (\`/practice/predictions\`, feature spec)
lets you bet play-money points (everyone starts with 1,000) on who wins a debate, who wins a tournament, or
whether a team's team rating goes up. Prices move with every bet, and markets tied to rounds and events
hosted on the site, or to the rankings, settle themselves.`},{heading:`setting-the-judge-and-the-opponent`,content:`Both round tools take their judge paradigm and opponent persona at setup time, from the same six built-in
AI judge paradigms and four built-in opponent styles, or from one you describe yourself.`},{heading:`setting-the-judge-and-the-opponent`,content:`| Tool              | Route                      | What it does                                                                                                                     |
| ----------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| AI Judge Decision | \`/practice/judge-decision\` | Generate an AI decision for a round under its saved paradigm, grounded in the same flow summary the Argument Tree Outline shows. |`,table:`table-0`},{heading:`word-count-speeches`,content:`**Word-Count Speeches** (\`/word-count\`, feature spec)
replaces the clock with a maximum word count: one text area per speech in the chosen format, with a live
word-count badge recomputed on every keystroke. It's the right tool for written practice, for formats where
you'd rather cap length than time, and for drafting speeches you'll later deliver against the timer. Rounds
are saved to your account when signed in.`},{heading:`suggested-loop`,content:`**Scout** the judge and opponent you're preparing for in the
Prep Workspace (\`/practice/prep\`), which keeps briefings, scout-to-strategy,
opponent and judge profiles, and prep notes on one page, and turn them into a paradigm and a persona.`},{heading:`suggested-loop`,content:`**Rehearse** in the Practice Round Simulator under that paradigm and persona.`},{heading:`suggested-loop`,content:`**Pressure-test** by playing the same side in Practice vs AI at a higher difficulty tier.`},{heading:`suggested-loop`,content:`**Flow the practice round** in the round workspace and run the training tools
on it \u2014 drills and coaching prompts work on practice rounds exactly as on tournament rounds.`},{heading:`tips`,content:"**Sharing a section:** `/coaching?stage=practice` opens the Coach Workspace on the practice tools."},{heading:`tips`,content:`**Signed out?** Every practice tool except Practice Partners works without an account; signing in is what
makes rounds, attempts, and word-count speeches follow you across devices. Practice Partners matches real
people, so it needs a (non-guest) account.`}],headings:[{id:`practice-tools`,content:`Practice tools`},{id:`run-a-round-against-the-ai`,content:`Run a round against the AI`},{id:`practice-against-real-people`,content:`Practice against real people`},{id:`setting-the-judge-and-the-opponent`,content:`Setting the judge and the opponent`},{id:`word-count-speeches`,content:`Word-count speeches`},{id:`suggested-loop`,content:`Suggested loop`},{id:`tips`,content:`Tips`}]},a=[{depth:1,url:`#practice-tools`,title:(0,t.jsx)(t.Fragment,{children:`Practice tools`})},{depth:2,url:`#run-a-round-against-the-ai`,title:(0,t.jsx)(t.Fragment,{children:`Run a round against the AI`})},{depth:2,url:`#practice-against-real-people`,title:(0,t.jsx)(t.Fragment,{children:`Practice against real people`})},{depth:2,url:`#setting-the-judge-and-the-opponent`,title:(0,t.jsx)(t.Fragment,{children:`Setting the judge and the opponent`})},{depth:2,url:`#word-count-speeches`,title:(0,t.jsx)(t.Fragment,{children:`Word-count speeches`})},{depth:2,url:`#suggested-loop`,title:(0,t.jsx)(t.Fragment,{children:`Suggested loop`})},{depth:2,url:`#tips`,title:(0,t.jsx)(t.Fragment,{children:`Tips`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,ol:`ol`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`practice-tools`,children:`Practice tools`}),`
`,(0,t.jsxs)(n.p,{children:[`The practice tools let you debate when there's no tournament: against another debater, against an AI opponent, in a simulated round
with a timer and an AI judge, or as a single speech under a word count. They're the `,(0,t.jsx)(n.em,{children:`Practice`}),` section of the
`,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/coach?section=practice`,children:`Coach Workspace`})}),` and each has its own page. Unlike the
`,(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/training-tools`,children:`training tools`}),`, most of them don't need a flowed round to start from.`]}),`
`,(0,t.jsx)(n.h2,{id:`run-a-round-against-the-ai`,children:`Run a round against the AI`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/practice/versus-ai`,children:`Practice vs AI`})}),` (`,(0,t.jsx)(n.code,{children:`/practice/versus-ai`}),`, `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/practice-vs-ai`,children:`feature spec`}),`) is a full,
timed round against an AI opponent in real turn order. Choose a difficulty, a topic and your side, and one of
the opponents at that difficulty. Your opponent then finds cards and caselist outlines on the topic and
summarizes the arguments for both sides before you start. Debate through timed opening, cross-examination,
and closing phases; at the end an AI judge scores the round and explains its decision. It's also on the dock
as `,(0,t.jsx)(n.strong,{children:`Practice vs AI`}),`, and a round in progress can be resumed on the same account.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Practice Round Simulator`}),` (`,(0,t.jsx)(n.a,{href:`/docs/features/rounds/practice-round-simulator`,children:`feature spec`}),`) is on the
same page now, in the collapsed `,(0,t.jsx)(n.strong,{children:`Round simulator`}),` section (its old address, `,(0,t.jsx)(n.code,{children:`/practice`}),`, redirects there).
It recreates a tournament round's `,(0,t.jsx)(n.em,{children:`conditions`}),` \u2014 format, side, a timer, an AI judge paradigm, and an AI
opponent persona \u2014 and keeps your past attempts so you can compare them.`]}),`
`,(0,t.jsx)(n.h2,{id:`practice-against-real-people`,children:`Practice against real people`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/practice-partners`,children:`Practice Partners`})}),` (`,(0,t.jsx)(n.code,{children:`/practice/partners`}),`, `,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/practice-partners`,children:`feature spec`}),`)
is where you find a human opponent or judge. Set up a practice profile \u2014 switch on `,(0,t.jsx)(n.strong,{children:`Open to
challenges`}),`, `,(0,t.jsx)(n.strong,{children:`Volunteer to judge`}),`, or both, and pick the formats, styles, speed, and level you're
comfortable with. Then press `,(0,t.jsx)(n.strong,{children:`Find me a match`}),`: you're paired at random with one of the most compatible
debaters for your profile, shown anonymously (level, speed, formats, styles, and how well you fit \u2014 never
who it is). `,(0,t.jsx)(n.strong,{children:`Send request`}),` proposes a format, resolution, and time; they get a notification and can
accept or decline, and you both see who the other is once they accept. `,(0,t.jsx)(n.strong,{children:`Find another`}),` draws again.
Accepted rounds get a webcam room code that both debaters and the
judge paste into the round workspace's Cameras panel. If you volunteer to judge, accepted rounds that still
need a judge are listed for you to pick up. It's the first panel in the Coach Workspace's Practice section.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/practice/predictions`,children:`Prediction Markets`})}),` (`,(0,t.jsx)(n.code,{children:`/practice/predictions`}),`, `,(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/prediction-markets`,children:`feature spec`}),`)
lets you bet play-money points (everyone starts with 1,000) on who wins a debate, who wins a tournament, or
whether a team's team rating goes up. Prices move with every bet, and markets tied to rounds and events
hosted on the site, or to the rankings, settle themselves.`]}),`
`,(0,t.jsx)(n.h2,{id:`setting-the-judge-and-the-opponent`,children:`Setting the judge and the opponent`}),`
`,(0,t.jsx)(n.p,{children:`Both round tools take their judge paradigm and opponent persona at setup time, from the same six built-in
AI judge paradigms and four built-in opponent styles, or from one you describe yourself.`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tool`}),(0,t.jsx)(n.th,{children:`Route`}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsx)(n.tbody,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`AI Judge Decision`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/judge-decision`})}),(0,t.jsx)(n.td,{children:`Generate an AI decision for a round under its saved paradigm, grounded in the same flow summary the Argument Tree Outline shows.`})]})})]}),`
`,(0,t.jsx)(n.h2,{id:`word-count-speeches`,children:`Word-count speeches`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`https://debate-ai.com/word-count`,children:`Word-Count Speeches`})}),` (`,(0,t.jsx)(n.code,{children:`/word-count`}),`, `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/word-count-rounds`,children:`feature spec`}),`)
replaces the clock with a maximum word count: one text area per speech in the chosen format, with a live
word-count badge recomputed on every keystroke. It's the right tool for written practice, for formats where
you'd rather cap length than time, and for drafting speeches you'll later deliver against the timer. Rounds
are saved to your account when signed in.`]}),`
`,(0,t.jsx)(n.h2,{id:`suggested-loop`,children:`Suggested loop`}),`
`,(0,t.jsxs)(n.ol,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Scout`}),` the judge and opponent you're preparing for in the
`,(0,t.jsx)(n.a,{href:`/docs/features/rounds/prep-workspace`,children:`Prep Workspace`}),` (`,(0,t.jsx)(n.code,{children:`/practice/prep`}),`), which keeps briefings, scout-to-strategy,
opponent and judge profiles, and prep notes on one page, and turn them into a paradigm and a persona.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Rehearse`}),` in the Practice Round Simulator under that paradigm and persona.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Pressure-test`}),` by playing the same side in Practice vs AI at a higher difficulty tier.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Flow the practice round`}),` in the round workspace and run the `,(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/training-tools`,children:`training tools`}),`
on it \u2014 drills and coaching prompts work on practice rounds exactly as on tournament rounds.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`tips`,children:`Tips`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Sharing a section:`}),` `,(0,t.jsx)(n.code,{children:`/coaching?stage=practice`}),` opens the Coach Workspace on the practice tools.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Signed out?`}),` Every practice tool except Practice Partners works without an account; signing in is what
makes rounds, attempts, and word-count speeches follow you across devices. Practice Partners matches real
people, so it needs a (non-guest) account.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};