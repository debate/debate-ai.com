import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Online Debate Versus AI`},r=`# Online Debate Versus AI [#online-debate-versus-ai]

Lets a debater start a full practice round against an AI opponent \u2014 pick a
\`debate-timer\` format and side, then submit their own speeches one at a
time, in turn order.

- **Route:** none of its own \u2014 the panel renders inside \`/coaching\`. \`/practice/versus-ai\`
  now serves Practice vs AI, the ported full-round feature.
- **Nav:** the Coach hub
- **Package:** \`debate-round\`

## What it shows [#what-it-shows]

A form to start a round: a round ID, a \`debate-timer\` format, and which
side the user is speaking (formats with no \`secondary\` side, like
Congress, only offer the primary side). Starting a round derives its full
speech order via \`buildAiVersusSpeechOrder\` and persists an empty round
through \`saveAiVersusRound\`.

Once a round is active, the panel renders its full turn order \u2014 each slot
tagged "You" or "AI" and marked Delivered/Next/Pending \u2014 and, when it's the
user's turn, a text area to type and submit the next expected speech.
Submission calls \`validateSpeechSubmission\` before saving. On the AI's
turn, a "Generate AI speech" button calls the real AI speech-generation
request and saves the returned text as that slot's speech.

Every delivered AI speech in the turn-order list gets its own "Regenerate"
button. Clicking it re-requests that slot, from the same prior-speeches
context originally used to generate it, and replaces it in place \u2014 every
other speech is untouched.

A "Download transcript" button appears once a round's \`nextSlot\` is \`null\`
(every speech delivered), rendering a plain-text transcript labeled
"You"/"AI" per slot.

The speech-submission text field also has a "\u{1F3A4} Record"/"Stop recording"
button dictating directly into the same \`speechText\` state via the
browser's Web Speech API, with a disabled fallback when unsupported.

## Data flow [#data-flow]

\`\`\`
round/ai-versus-speech-order.ts
  \u2192 buildAiVersusSpeechOrder(styleKey, userSide)   \u2014 derives the turn order
  \u2192 validateSpeechSubmission(order, submittedCount, speechName)

state/aiVersusRounds.ts (localStorage: aiVersusRounds)
  \u2192 buildAiVersusRoundsPanelView()
  \u2192 getAiVersusRoundStatus(roundId)
  \u2192 panels/AiVersusRoundPanel.tsx
  \u2192 apps/debate-ai.com/app/versus-ai/page.tsx

Generating the AI's next speech:
panels/AiVersusRoundPanel.tsx
  \u2192 buildAiResponseRequest(order, submittedCount, submittedSpeeches)
  \u2192 round/ai-versus-speech-client.ts's requestAiVersusSpeech(request)
      \u2192 round/ai-versus-speech-ai.ts's AI_VERSUS_SPEECH_SYSTEM_PROMPT + buildAiVersusSpeechUserPrompt(request)
      \u2192 POST /api/reason-ai
      \u2192 parseAiVersusSpeechResponse(text)
  \u2192 saveAiVersusRound({ ...record, submittedSpeeches: [...] })
\`\`\`

## Known gaps [#known-gaps]

None open. Every delivered AI speech can be regenerated independently in
place; a completed round's transcript can be downloaded as plain text;
speech submission stays text-only beyond microphone dictation, and there is
no transcription path for an already-recorded audio/video file, matching
every other panel in this repo that shares that same gap.
`,i={contents:[{heading:`online-debate-versus-ai`,content:`Lets a debater start a full practice round against an AI opponent \u2014 pick a
\`debate-timer\` format and side, then submit their own speeches one at a
time, in turn order.`},{heading:`online-debate-versus-ai`,content:"**Route:** none of its own \u2014 the panel renders inside `/coaching`. `/practice/versus-ai`\nnow serves Practice vs AI, the ported full-round feature."},{heading:`online-debate-versus-ai`,content:`**Nav:** the Coach hub`},{heading:`online-debate-versus-ai`,content:"**Package:** `debate-round`"},{heading:`what-it-shows`,content:"A form to start a round: a round ID, a `debate-timer` format, and which\nside the user is speaking (formats with no `secondary` side, like\nCongress, only offer the primary side). Starting a round derives its full\nspeech order via `buildAiVersusSpeechOrder` and persists an empty round\nthrough `saveAiVersusRound`."},{heading:`what-it-shows`,content:`Once a round is active, the panel renders its full turn order \u2014 each slot
tagged "You" or "AI" and marked Delivered/Next/Pending \u2014 and, when it's the
user's turn, a text area to type and submit the next expected speech.
Submission calls \`validateSpeechSubmission\` before saving. On the AI's
turn, a "Generate AI speech" button calls the real AI speech-generation
request and saves the returned text as that slot's speech.`},{heading:`what-it-shows`,content:`Every delivered AI speech in the turn-order list gets its own "Regenerate"
button. Clicking it re-requests that slot, from the same prior-speeches
context originally used to generate it, and replaces it in place \u2014 every
other speech is untouched.`},{heading:`what-it-shows`,content:'A "Download transcript" button appears once a round\'s `nextSlot` is `null`\n(every speech delivered), rendering a plain-text transcript labeled\n"You"/"AI" per slot.'},{heading:`what-it-shows`,content:`The speech-submission text field also has a "\u{1F3A4} Record"/"Stop recording"
button dictating directly into the same \`speechText\` state via the
browser's Web Speech API, with a disabled fallback when unsupported.`},{heading:`known-gaps`,content:`None open. Every delivered AI speech can be regenerated independently in
place; a completed round's transcript can be downloaded as plain text;
speech submission stays text-only beyond microphone dictation, and there is
no transcription path for an already-recorded audio/video file, matching
every other panel in this repo that shares that same gap.`}],headings:[{id:`online-debate-versus-ai`,content:`Online Debate Versus AI`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#online-debate-versus-ai`,title:(0,t.jsx)(t.Fragment,{children:`Online Debate Versus AI`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`online-debate-versus-ai`,children:`Online Debate Versus AI`}),`
`,(0,t.jsxs)(n.p,{children:[`Lets a debater start a full practice round against an AI opponent \u2014 pick a
`,(0,t.jsx)(n.code,{children:`debate-timer`}),` format and side, then submit their own speeches one at a
time, in turn order.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` none of its own \u2014 the panel renders inside `,(0,t.jsx)(n.code,{children:`/coaching`}),`. `,(0,t.jsx)(n.code,{children:`/practice/versus-ai`}),`
now serves Practice vs AI, the ported full-round feature.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` the Coach hub`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A form to start a round: a round ID, a `,(0,t.jsx)(n.code,{children:`debate-timer`}),` format, and which
side the user is speaking (formats with no `,(0,t.jsx)(n.code,{children:`secondary`}),` side, like
Congress, only offer the primary side). Starting a round derives its full
speech order via `,(0,t.jsx)(n.code,{children:`buildAiVersusSpeechOrder`}),` and persists an empty round
through `,(0,t.jsx)(n.code,{children:`saveAiVersusRound`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Once a round is active, the panel renders its full turn order \u2014 each slot
tagged "You" or "AI" and marked Delivered/Next/Pending \u2014 and, when it's the
user's turn, a text area to type and submit the next expected speech.
Submission calls `,(0,t.jsx)(n.code,{children:`validateSpeechSubmission`}),` before saving. On the AI's
turn, a "Generate AI speech" button calls the real AI speech-generation
request and saves the returned text as that slot's speech.`]}),`
`,(0,t.jsx)(n.p,{children:`Every delivered AI speech in the turn-order list gets its own "Regenerate"
button. Clicking it re-requests that slot, from the same prior-speeches
context originally used to generate it, and replaces it in place \u2014 every
other speech is untouched.`}),`
`,(0,t.jsxs)(n.p,{children:[`A "Download transcript" button appears once a round's `,(0,t.jsx)(n.code,{children:`nextSlot`}),` is `,(0,t.jsx)(n.code,{children:`null`}),`
(every speech delivered), rendering a plain-text transcript labeled
"You"/"AI" per slot.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The speech-submission text field also has a "\u{1F3A4} Record"/"Stop recording"
button dictating directly into the same `,(0,t.jsx)(n.code,{children:`speechText`}),` state via the
browser's Web Speech API, with a disabled fallback when unsupported.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`round/ai-versus-speech-order.ts`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildAiVersusSpeechOrder(styleKey, userSide)   \u2014 derives the turn order`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 validateSpeechSubmission(order, submittedCount, speechName)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/aiVersusRounds.ts (localStorage: aiVersusRounds)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildAiVersusRoundsPanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 getAiVersusRoundStatus(roundId)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/AiVersusRoundPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 apps/debate-ai.com/app/versus-ai/page.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`Generating the AI's next speech:`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`panels/AiVersusRoundPanel.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildAiResponseRequest(order, submittedCount, submittedSpeeches)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 round/ai-versus-speech-client.ts's requestAiVersusSpeech(request)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 round/ai-versus-speech-ai.ts's AI_VERSUS_SPEECH_SYSTEM_PROMPT + buildAiVersusSpeechUserPrompt(request)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 POST /api/reason-ai`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 parseAiVersusSpeechResponse(text)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 saveAiVersusRound({ ...record, submittedSpeeches: [...] })`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`None open. Every delivered AI speech can be regenerated independently in
place; a completed round's transcript can be downloaded as plain text;
speech submission stays text-only beyond microphone dictation, and there is
no transcription path for an already-recorded audio/video file, matching
every other panel in this repo that shares that same gap.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};