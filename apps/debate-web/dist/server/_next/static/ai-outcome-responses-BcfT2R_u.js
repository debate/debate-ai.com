import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`AI Outcome Responses`},r=`# AI Outcome Responses [#ai-outcome-responses]

During a live round, the speech timer's menu (the \u22EE next to the timer) has
an **AI Outcome Responses** item. It reads the whole round so far and
suggests three ways to give the speech you are on, then plays each one
forward.

- **Where:** live round workspace, speech timer menu
- **Package:** \`debate-round\` (UI and context), \`debate-speech-writer\` (prompt)

## What it shows [#what-it-shows]

Three candidate approaches side by side. Each one has:

- a **success rate**: the AI's estimate that this approach wins the round
  for your side, with the best bet marked;
- a speech-ready **outline** that extends cards already read and answers
  the opponent's newest arguments (copy button included);
- the **opponent's likely answers** in their next speech;
- the **judge decision**: who the predicted judge votes for on that path,
  and why;
- the **issues** that could lose it (drops, missing evidence, judge fit);
- **cards to find**: search queries that run against CARDS in place and
  show the highlighted text of the top hits, with a copy button and a link
  to open the full search.

You can override the judge paradigm and add an optional focus ("go for the
DA") before regenerating.

## Where the context comes from [#where-the-context-comes-from]

- **Prior speeches:** every speech column before the current one. Each
  speech's linked editor document is used when it has one, otherwise the
  flow's own speech doc. Highlighted card text is kept marked so the model
  can tell what was read aloud.
- **Flow:** every flow sheet in the round, one line per argument row with
  each speech's entry, unanswered rows flagged.
- **Judge:** the round judge with the most ballots in
  [Judge Profiles](/docs/features/tournaments-judge/judge-profiles), voting under that profile's most-tagged
  paradigm. With no saved profile for the round's judges, the paradigm most
  common across your saved profiles is used, else a flow judge.

## Data flow [#data-flow]

\`\`\`
SpeechRecordingMenu (debate-timer) actions prop
  \u2192 dialogs/AiOutcomeResponsesDialog.tsx
round/outcome-responses-context.ts   (prior speeches, flow text, likely judge)
round/outcome-responses-client.ts    (linked docs, /api/reason-ai, /api/search)
debate-speech-writer prompts/speech-outcome-responses.ts
  \u2192 SPEECH_OUTCOME_RESPONSES_SYSTEM_PROMPT (built on speechToResponsePrompt)
  \u2192 buildSpeechOutcomeResponsesUserPrompt / parseSpeechOutcomeResponsesResponse
\`\`\`

## Known gaps [#known-gaps]

- Results are not saved; closing the dialog keeps them only until you
  switch speeches.
- Success rates are model estimates, not calibrated against real ballots.
- On the free plan the AI reply is capped at 2,048 tokens, which can cut a
  long three-candidate reply short; the dialog then shows a parse error.
- Long rounds are trimmed to about 60,000 characters of speech text, oldest
  speeches first.
`,i={contents:[{heading:`ai-outcome-responses`,content:`During a live round, the speech timer's menu (the \u22EE next to the timer) has
an **AI Outcome Responses** item. It reads the whole round so far and
suggests three ways to give the speech you are on, then plays each one
forward.`},{heading:`ai-outcome-responses`,content:`**Where:** live round workspace, speech timer menu`},{heading:`ai-outcome-responses`,content:"**Package:** `debate-round` (UI and context), `debate-speech-writer` (prompt)"},{heading:`what-it-shows`,content:`Three candidate approaches side by side. Each one has:`},{heading:`what-it-shows`,content:`a **success rate**: the AI's estimate that this approach wins the round
for your side, with the best bet marked;`},{heading:`what-it-shows`,content:`a speech-ready **outline** that extends cards already read and answers
the opponent's newest arguments (copy button included);`},{heading:`what-it-shows`,content:`the **opponent's likely answers** in their next speech;`},{heading:`what-it-shows`,content:`the **judge decision**: who the predicted judge votes for on that path,
and why;`},{heading:`what-it-shows`,content:`the **issues** that could lose it (drops, missing evidence, judge fit);`},{heading:`what-it-shows`,content:`**cards to find**: search queries that run against CARDS in place and
show the highlighted text of the top hits, with a copy button and a link
to open the full search.`},{heading:`what-it-shows`,content:`You can override the judge paradigm and add an optional focus ("go for the
DA") before regenerating.`},{heading:`where-the-context-comes-from`,content:`**Prior speeches:** every speech column before the current one. Each
speech's linked editor document is used when it has one, otherwise the
flow's own speech doc. Highlighted card text is kept marked so the model
can tell what was read aloud.`},{heading:`where-the-context-comes-from`,content:`**Flow:** every flow sheet in the round, one line per argument row with
each speech's entry, unanswered rows flagged.`},{heading:`where-the-context-comes-from`,content:`**Judge:** the round judge with the most ballots in
Judge Profiles, voting under that profile's most-tagged
paradigm. With no saved profile for the round's judges, the paradigm most
common across your saved profiles is used, else a flow judge.`},{heading:`known-gaps`,content:`Results are not saved; closing the dialog keeps them only until you
switch speeches.`},{heading:`known-gaps`,content:`Success rates are model estimates, not calibrated against real ballots.`},{heading:`known-gaps`,content:`On the free plan the AI reply is capped at 2,048 tokens, which can cut a
long three-candidate reply short; the dialog then shows a parse error.`},{heading:`known-gaps`,content:`Long rounds are trimmed to about 60,000 characters of speech text, oldest
speeches first.`}],headings:[{id:`ai-outcome-responses`,content:`AI Outcome Responses`},{id:`what-it-shows`,content:`What it shows`},{id:`where-the-context-comes-from`,content:`Where the context comes from`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#ai-outcome-responses`,title:(0,t.jsx)(t.Fragment,{children:`AI Outcome Responses`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#where-the-context-comes-from`,title:(0,t.jsx)(t.Fragment,{children:`Where the context comes from`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`ai-outcome-responses`,children:`AI Outcome Responses`}),`
`,(0,t.jsxs)(n.p,{children:[`During a live round, the speech timer's menu (the \u22EE next to the timer) has
an `,(0,t.jsx)(n.strong,{children:`AI Outcome Responses`}),` item. It reads the whole round so far and
suggests three ways to give the speech you are on, then plays each one
forward.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Where:`}),` live round workspace, speech timer menu`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`}),` (UI and context), `,(0,t.jsx)(n.code,{children:`debate-speech-writer`}),` (prompt)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`Three candidate approaches side by side. Each one has:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`a `,(0,t.jsx)(n.strong,{children:`success rate`}),`: the AI's estimate that this approach wins the round
for your side, with the best bet marked;`]}),`
`,(0,t.jsxs)(n.li,{children:[`a speech-ready `,(0,t.jsx)(n.strong,{children:`outline`}),` that extends cards already read and answers
the opponent's newest arguments (copy button included);`]}),`
`,(0,t.jsxs)(n.li,{children:[`the `,(0,t.jsx)(n.strong,{children:`opponent's likely answers`}),` in their next speech;`]}),`
`,(0,t.jsxs)(n.li,{children:[`the `,(0,t.jsx)(n.strong,{children:`judge decision`}),`: who the predicted judge votes for on that path,
and why;`]}),`
`,(0,t.jsxs)(n.li,{children:[`the `,(0,t.jsx)(n.strong,{children:`issues`}),` that could lose it (drops, missing evidence, judge fit);`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`cards to find`}),`: search queries that run against CARDS in place and
show the highlighted text of the top hits, with a copy button and a link
to open the full search.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`You can override the judge paradigm and add an optional focus ("go for the
DA") before regenerating.`}),`
`,(0,t.jsx)(n.h2,{id:`where-the-context-comes-from`,children:`Where the context comes from`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Prior speeches:`}),` every speech column before the current one. Each
speech's linked editor document is used when it has one, otherwise the
flow's own speech doc. Highlighted card text is kept marked so the model
can tell what was read aloud.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Flow:`}),` every flow sheet in the round, one line per argument row with
each speech's entry, unanswered rows flagged.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Judge:`}),` the round judge with the most ballots in
`,(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/judge-profiles`,children:`Judge Profiles`}),`, voting under that profile's most-tagged
paradigm. With no saved profile for the round's judges, the paradigm most
common across your saved profiles is used, else a flow judge.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`SpeechRecordingMenu (debate-timer) actions prop`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 dialogs/AiOutcomeResponsesDialog.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`round/outcome-responses-context.ts   (prior speeches, flow text, likely judge)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`round/outcome-responses-client.ts    (linked docs, /api/reason-ai, /api/search)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`debate-speech-writer prompts/speech-outcome-responses.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 SPEECH_OUTCOME_RESPONSES_SYSTEM_PROMPT (built on speechToResponsePrompt)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildSpeechOutcomeResponsesUserPrompt / parseSpeechOutcomeResponsesResponse`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Results are not saved; closing the dialog keeps them only until you
switch speeches.`}),`
`,(0,t.jsx)(n.li,{children:`Success rates are model estimates, not calibrated against real ballots.`}),`
`,(0,t.jsx)(n.li,{children:`On the free plan the AI reply is capped at 2,048 tokens, which can cut a
long three-candidate reply short; the dialog then shows a parse error.`}),`
`,(0,t.jsx)(n.li,{children:`Long rounds are trimmed to about 60,000 characters of speech text, oldest
speeches first.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};