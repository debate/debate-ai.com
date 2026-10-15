import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Practice Round Simulator`},r=`# Practice Round Simulator [#practice-round-simulator]

Lets a debater configure and track a simulated tournament round \u2014 format,
side, AI judge paradigm, and AI opponent persona/difficulty.

Merged into [Practice vs AI](/docs/features/rounds/practice-vs-ai): \`/practice\`
now redirects to \`/practice/versus-ai\`, where this panel and the team
matchup simulator sit in the collapsed **Round simulator** section below the
round setup.

- **Route:** \`/practice/versus-ai#round-simulator\` (\`/practice\` redirects there)
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A setup form, plus every persisted round as its own card: judge-paradigm/
opponent-persona/difficulty badges, submitted-speech progress, a "Generate
AI opponent speech" action, a "Generate post-round feedback" form, and a
"Get AI judge decision" action, next to which a **Scoring rubric** card
checks the round's own judge paradigm's voting priorities (\u2705/\u2B1C) against the
rendered decision. A **Compare your past attempts** section shows a
chronological win/loss trend across a debater's rounds.

When a round's setup carried an AI opponent persona, its post-round
feedback gets an extra "Facing the \`<persona name>\` persona again" section \u2014
a short, numbered list of what to prep before facing that style again (e.g.
pre-writing a framework defense before a Critique opponent, or drilling
efficient tagline-first responses before a Fast Flow one). A custom persona
gets a generic tip pointing back at its own described style notes, since its
free-form \`instructions\` can't be turned into structured, style-specific
advice the way a built-in persona's can.

The "AI opponent persona" picker now also reuses the AI Practice Opponent
idea's custom-persona library: a "Custom opponent persona" option opens a
name/style-notes form with "Save to my persona library"/"Share with my
team" checkboxes, and "My persona library"/"Shared by your team" sections
below it let a saved or team-shared entry prefill that form with one click
\u2014 the same \`useCustomOpponentPersonaLibrary\` hook the AI Practice Opponent
setup already uses.

## Data flow [#data-flow]

\`\`\`
opponent/opponent-personas.ts (debate-speech-writer)
  \u2192 buildOpponentPersonaFeedbackTips(persona)
  \u2192 buildCustomOpponentPersona({ name, notes })

round/practice-round-simulator.ts
  \u2192 resolvePracticeRoundOpponentPersonaChoice({ kind: "none" | "builtin" | "custom", ... })
  \u2192 buildPracticeRoundSetup({ styleKey, userSide, judgeParadigm, opponentPersona, opponentDifficulty })
  \u2192 buildPracticeRoundFeedback(flow, sideKey, judgeParadigm, { opponentPersona })

state/practiceRounds.ts (localStorage: practiceRounds)
  \u2192 buildAndSavePracticeRoundFeedback(flow, roundId, sideKey) passes the
    round's own saved setup.opponentPersona through automatically
  \u2192 buildPracticeRoundsPanelView()
  \u2192 panels/PracticeRoundSimulatorPanel.tsx
  \u2192 apps/debate-ai.com/app/practice-round/page.tsx
\`\`\`

## Matchup simulator [#matchup-simulator]

Pair any two ranked teams in a division and see who the ratings favour. The
simulator reads each division's full-season rankings
(\`<division>_full_rankings.csv\`), so every ranked team can be picked \u2014 filter
by name or school, or hit **Random opponent**.

It shows the single-round win probability for each side, the odds of taking a
3- or 5-judge elim panel, and a **Simulate 1,000 rounds** button that plays
the matchup out to show the spread a percentage hides.

The probability is Glicko-2's expected score, the same formula as upstream's
\`simulate_round.py\` (skelo's \`Glicko2Model.compute_prob\`): ratings are
converted back to Glicko-2's 1500 scale, and the result is
\`1 / (1 + exp(\u2212g(\u03C6_opp) \u00B7 (\u03BC \u2212 \u03BC_opp)))\`. Panel odds assume each ballot is
independent at that probability.

It appears in two places:

- **Practice round** (\`/practice\`): both sides are free to pick.
- **Every team profile** (\`/teams/<team>\`): that team is locked in as side A,
  across each division it is ranked in, and any other ranked team can be its
  opponent.

The math lives in \`@debate/rankings-adapter\`'s \`match-simulation.ts\`; the UI
is \`debate-videos\`' \`MatchupSimulator\`, composed on the practice page by
\`debate-practice-rounds\`' \`TeamMatchupSimulatorPanel\`.

## Known gaps [#known-gaps]

None open. One open Next item remains in TODO.md beyond this feature: a
round replay/playback view.
`,i={contents:[{heading:`practice-round-simulator`,content:`Lets a debater configure and track a simulated tournament round \u2014 format,
side, AI judge paradigm, and AI opponent persona/difficulty.`},{heading:`practice-round-simulator`,content:"Merged into Practice vs AI: `/practice`\nnow redirects to `/practice/versus-ai`, where this panel and the team\nmatchup simulator sit in the collapsed **Round simulator** section below the\nround setup."},{heading:`practice-round-simulator`,content:"**Route:** `/practice/versus-ai#round-simulator` (`/practice` redirects there)"},{heading:`practice-round-simulator`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:`A setup form, plus every persisted round as its own card: judge-paradigm/
opponent-persona/difficulty badges, submitted-speech progress, a "Generate
AI opponent speech" action, a "Generate post-round feedback" form, and a
"Get AI judge decision" action, next to which a **Scoring rubric** card
checks the round's own judge paradigm's voting priorities (\u2705/\u2B1C) against the
rendered decision. A **Compare your past attempts** section shows a
chronological win/loss trend across a debater's rounds.`},{heading:`what-it-shows`,content:`When a round's setup carried an AI opponent persona, its post-round
feedback gets an extra "Facing the \`<persona name>\` persona again" section \u2014
a short, numbered list of what to prep before facing that style again (e.g.
pre-writing a framework defense before a Critique opponent, or drilling
efficient tagline-first responses before a Fast Flow one). A custom persona
gets a generic tip pointing back at its own described style notes, since its
free-form \`instructions\` can't be turned into structured, style-specific
advice the way a built-in persona's can.`},{heading:`what-it-shows`,content:`The "AI opponent persona" picker now also reuses the AI Practice Opponent
idea's custom-persona library: a "Custom opponent persona" option opens a
name/style-notes form with "Save to my persona library"/"Share with my
team" checkboxes, and "My persona library"/"Shared by your team" sections
below it let a saved or team-shared entry prefill that form with one click
\u2014 the same \`useCustomOpponentPersonaLibrary\` hook the AI Practice Opponent
setup already uses.`},{heading:`matchup-simulator`,content:`Pair any two ranked teams in a division and see who the ratings favour. The
simulator reads each division's full-season rankings
(\`<division>_full_rankings.csv\`), so every ranked team can be picked \u2014 filter
by name or school, or hit **Random opponent**.`},{heading:`matchup-simulator`,content:`It shows the single-round win probability for each side, the odds of taking a
3- or 5-judge elim panel, and a **Simulate 1,000 rounds** button that plays
the matchup out to show the spread a percentage hides.`},{heading:`matchup-simulator`,content:"The probability is Glicko-2's expected score, the same formula as upstream's\n`simulate_round.py` (skelo's `Glicko2Model.compute_prob`): ratings are\nconverted back to Glicko-2's 1500 scale, and the result is\n`1 / (1 + exp(\u2212g(\u03C6_opp) \u00B7 (\u03BC \u2212 \u03BC_opp)))`. Panel odds assume each ballot is\nindependent at that probability."},{heading:`matchup-simulator`,content:`It appears in two places:`},{heading:`matchup-simulator`,content:"**Practice round** (`/practice`): both sides are free to pick."},{heading:`matchup-simulator`,content:`**Every team profile** (\`/teams/<team>\`): that team is locked in as side A,
across each division it is ranked in, and any other ranked team can be its
opponent.`},{heading:`matchup-simulator`,content:"The math lives in `@debate/rankings-adapter`'s `match-simulation.ts`; the UI\nis `debate-videos`' `MatchupSimulator`, composed on the practice page by\n`debate-practice-rounds`' `TeamMatchupSimulatorPanel`."},{heading:`known-gaps`,content:`None open. One open Next item remains in TODO.md beyond this feature: a
round replay/playback view.`}],headings:[{id:`practice-round-simulator`,content:`Practice Round Simulator`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`matchup-simulator`,content:`Matchup simulator`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#practice-round-simulator`,title:(0,t.jsx)(t.Fragment,{children:`Practice Round Simulator`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#matchup-simulator`,title:(0,t.jsx)(t.Fragment,{children:`Matchup simulator`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`practice-round-simulator`,children:`Practice Round Simulator`}),`
`,(0,t.jsx)(n.p,{children:`Lets a debater configure and track a simulated tournament round \u2014 format,
side, AI judge paradigm, and AI opponent persona/difficulty.`}),`
`,(0,t.jsxs)(n.p,{children:[`Merged into `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/practice-vs-ai`,children:`Practice vs AI`}),`: `,(0,t.jsx)(n.code,{children:`/practice`}),`
now redirects to `,(0,t.jsx)(n.code,{children:`/practice/versus-ai`}),`, where this panel and the team
matchup simulator sit in the collapsed `,(0,t.jsx)(n.strong,{children:`Round simulator`}),` section below the
round setup.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/versus-ai#round-simulator`}),` (`,(0,t.jsx)(n.code,{children:`/practice`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A setup form, plus every persisted round as its own card: judge-paradigm/
opponent-persona/difficulty badges, submitted-speech progress, a "Generate
AI opponent speech" action, a "Generate post-round feedback" form, and a
"Get AI judge decision" action, next to which a `,(0,t.jsx)(n.strong,{children:`Scoring rubric`}),` card
checks the round's own judge paradigm's voting priorities (\u2705/\u2B1C) against the
rendered decision. A `,(0,t.jsx)(n.strong,{children:`Compare your past attempts`}),` section shows a
chronological win/loss trend across a debater's rounds.`]}),`
`,(0,t.jsxs)(n.p,{children:[`When a round's setup carried an AI opponent persona, its post-round
feedback gets an extra "Facing the `,(0,t.jsx)(n.code,{children:`<persona name>`}),` persona again" section \u2014
a short, numbered list of what to prep before facing that style again (e.g.
pre-writing a framework defense before a Critique opponent, or drilling
efficient tagline-first responses before a Fast Flow one). A custom persona
gets a generic tip pointing back at its own described style notes, since its
free-form `,(0,t.jsx)(n.code,{children:`instructions`}),` can't be turned into structured, style-specific
advice the way a built-in persona's can.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The "AI opponent persona" picker now also reuses the AI Practice Opponent
idea's custom-persona library: a "Custom opponent persona" option opens a
name/style-notes form with "Save to my persona library"/"Share with my
team" checkboxes, and "My persona library"/"Shared by your team" sections
below it let a saved or team-shared entry prefill that form with one click
\u2014 the same `,(0,t.jsx)(n.code,{children:`useCustomOpponentPersonaLibrary`}),` hook the AI Practice Opponent
setup already uses.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`opponent/opponent-personas.ts (debate-speech-writer)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildOpponentPersonaFeedbackTips(persona)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildCustomOpponentPersona({ name, notes })`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`round/practice-round-simulator.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 resolvePracticeRoundOpponentPersonaChoice({ kind: "none" | "builtin" | "custom", ... })`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPracticeRoundSetup({ styleKey, userSide, judgeParadigm, opponentPersona, opponentDifficulty })`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPracticeRoundFeedback(flow, sideKey, judgeParadigm, { opponentPersona })`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/practiceRounds.ts (localStorage: practiceRounds)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildAndSavePracticeRoundFeedback(flow, roundId, sideKey) passes the`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`    round's own saved setup.opponentPersona through automatically`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPracticeRoundsPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/PracticeRoundSimulatorPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/practice-round/page.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`matchup-simulator`,children:`Matchup simulator`}),`
`,(0,t.jsxs)(n.p,{children:[`Pair any two ranked teams in a division and see who the ratings favour. The
simulator reads each division's full-season rankings
(`,(0,t.jsx)(n.code,{children:`<division>_full_rankings.csv`}),`), so every ranked team can be picked \u2014 filter
by name or school, or hit `,(0,t.jsx)(n.strong,{children:`Random opponent`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`It shows the single-round win probability for each side, the odds of taking a
3- or 5-judge elim panel, and a `,(0,t.jsx)(n.strong,{children:`Simulate 1,000 rounds`}),` button that plays
the matchup out to show the spread a percentage hides.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The probability is Glicko-2's expected score, the same formula as upstream's
`,(0,t.jsx)(n.code,{children:`simulate_round.py`}),` (skelo's `,(0,t.jsx)(n.code,{children:`Glicko2Model.compute_prob`}),`): ratings are
converted back to Glicko-2's 1500 scale, and the result is
`,(0,t.jsx)(n.code,{children:`1 / (1 + exp(\u2212g(\u03C6_opp) \u00B7 (\u03BC \u2212 \u03BC_opp)))`}),`. Panel odds assume each ballot is
independent at that probability.`]}),`
`,(0,t.jsx)(n.p,{children:`It appears in two places:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Practice round`}),` (`,(0,t.jsx)(n.code,{children:`/practice`}),`): both sides are free to pick.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Every team profile`}),` (`,(0,t.jsx)(n.code,{children:`/teams/<team>`}),`): that team is locked in as side A,
across each division it is ranked in, and any other ranked team can be its
opponent.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`The math lives in `,(0,t.jsx)(n.code,{children:`@debate/rankings-adapter`}),`'s `,(0,t.jsx)(n.code,{children:`match-simulation.ts`}),`; the UI
is `,(0,t.jsx)(n.code,{children:`debate-videos`}),`' `,(0,t.jsx)(n.code,{children:`MatchupSimulator`}),`, composed on the practice page by
`,(0,t.jsx)(n.code,{children:`debate-practice-rounds`}),`' `,(0,t.jsx)(n.code,{children:`TeamMatchupSimulatorPanel`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`None open. One open Next item remains in TODO.md beyond this feature: a
round replay/playback view.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};