import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Round Sidebar Speeches & Captions`},r=`# Round Sidebar Speeches & Captions [#round-sidebar-speeches--captions]

The round group in the round workspace's sidebar lists every speech in the
round with its timer and word totals. It also holds the selected speech's
view controls and shows captions for recorded speeches.

- **Nav:** \`/debate\`, left sidebar, under the selected round
- **Package:** \`debate-round\` (\`layout/LiveRoundGroup.tsx\`,
  \`round/my-speeches.ts\`, \`dialogs/SpeechGradeDialog.tsx\`,
  \`round/speech-rubric.ts\`), \`debate-timer\` (\`recorder/SpeechCaptionsTicker.tsx\`,
  \`recorder/SpeechTranscriptDialog.tsx\`, \`recorder/speech-captions.ts\`,
  \`recorder/transcript-sections.ts\`)

## What it does [#what-it-does]

- **View controls above the speeches.** On desktop, when the sidebar shows a
  round, the quote view, view mode, split layout and "open speech document"
  buttons sit above the speech list instead of in the top bar. With no round
  (or on mobile) they stay in the top bar.
- **Click a speech to make it active.** Clicking any speech that isn't the
  active one opens it. In split view, a speech already in a pane becomes the
  active pane; otherwise the pair shifts to show it.
- **Your speeches are highlighted.** If your email (your signed-in account,
  or the "My Team" email saved in the round editor) is one of the round's
  debaters, the speeches you give get an amber outline and a **You** tag.
  Speeches are matched by speaker: in Policy and PF the first debater listed
  gives the 1A/1N (A1/N1) speeches and the second gives the 2A/2N ones. In
  LD, every speech on your side is yours.
- **Grade a speech.** Every speech row has a clipboard button (tooltip:
  "Grade 1AC (speaker)"). It opens a modal that scores the speech on five
  independent categories, 1\u20135 each, with a slider apiece: Organization,
  Evidence Quality, Argument Analysis, Clash & Strategy and Presentation
  Clarity. A radar chart and the /25 total (Deficient \u2192 Exceptional) update as
  you drag. The \u24D8 beside each category says what it does and doesn't grade,
  and "Criteria and examples" shows what a 5 and a 3 look like. There is a
  notes box, a Reset button and "Copy scorecard". Grades save to the round as
  you go, and the row shows the total once a speech is graded.
- **Captions ticker.** The captions button on a speech's recording player
  shows the words transcribed while the speech was recorded, scrolling past
  the player like a ticker. The word being played is highlighted and kept
  centred. Click any word to jump the audio to that point. The on/off choice
  is remembered across speeches. The player sits on its own row under the
  speech's name and timer, so the ticker spans the full width of the panel.
- **Full transcript.** The expand button at the end of the ticker opens the
  whole transcript in a modal. Click any word to jump the audio there; the
  word being played stays highlighted and in view.
- **AI sections.** "Split into sections" in the transcript modal asks the AI
  to break the speech into titled sections (framework, each contention,
  each off-case, responses). The headings show above the transcript and
  inside it, and clicking one jumps the audio to where it starts. Sections
  are remembered for the speech until its transcript changes. This needs
  you to be signed in, like the other AI features.
- **Ask the speaker to be more clear.** When you judge a round (your email is
  one of its judges), each speech's \u22EE menu has "Tell the debater to be more
  clear". It pops a toast on the laptop of the debater giving that speech:
  "The judge has requested you be more clear." You can send it once every
  few seconds per speech.

## Known gaps [#known-gaps]

- Grades are stored on the round (\`Round.speechGrades\`, keyed by speech name),
  so they follow the round's own save and sync. They are not a separate
  per-grader record: two people grading the same speech overwrite each other.

- The browser's speech recognition only reports when a phrase ends, not
  per-word times, so word times are estimated by spreading each phrase
  across the time it took. Clicking a word lands close to it, not exactly on
  it.
- Recordings transcribed before captions existed have no phrase timings, so
  their words are spread evenly across the whole recording.
- Transcription needs a browser with the Web Speech API (Chrome, Edge,
  Safari). Elsewhere the ticker says there are no captions yet.
- AI sections are saved only in this browser (localStorage), not on the
  round, so other devices and other people in the round don't see them.
  Section starts are snapped to the transcript's ~20-word lines, so a
  heading can land a few words early.
- The clarity request reaches the speaker over the round's live room, so both
  laptops need the round open. The speaker is found from the round's debater
  emails; a device not seated there gets it only while its own timer for that
  speech is running. Only judges listed on the round see the menu item.
`,i={contents:[{heading:`round-sidebar-speeches--captions`,content:`The round group in the round workspace's sidebar lists every speech in the
round with its timer and word totals. It also holds the selected speech's
view controls and shows captions for recorded speeches.`},{heading:`round-sidebar-speeches--captions`,content:"**Nav:** `/debate`, left sidebar, under the selected round"},{heading:`round-sidebar-speeches--captions`,content:"**Package:** `debate-round` (`layout/LiveRoundGroup.tsx`,\n`round/my-speeches.ts`, `dialogs/SpeechGradeDialog.tsx`,\n`round/speech-rubric.ts`), `debate-timer` (`recorder/SpeechCaptionsTicker.tsx`,\n`recorder/SpeechTranscriptDialog.tsx`, `recorder/speech-captions.ts`,\n`recorder/transcript-sections.ts`)"},{heading:`what-it-does`,content:`**View controls above the speeches.** On desktop, when the sidebar shows a
round, the quote view, view mode, split layout and "open speech document"
buttons sit above the speech list instead of in the top bar. With no round
(or on mobile) they stay in the top bar.`},{heading:`what-it-does`,content:`**Click a speech to make it active.** Clicking any speech that isn't the
active one opens it. In split view, a speech already in a pane becomes the
active pane; otherwise the pair shifts to show it.`},{heading:`what-it-does`,content:`**Your speeches are highlighted.** If your email (your signed-in account,
or the "My Team" email saved in the round editor) is one of the round's
debaters, the speeches you give get an amber outline and a **You** tag.
Speeches are matched by speaker: in Policy and PF the first debater listed
gives the 1A/1N (A1/N1) speeches and the second gives the 2A/2N ones. In
LD, every speech on your side is yours.`},{heading:`what-it-does`,content:`**Grade a speech.** Every speech row has a clipboard button (tooltip:
"Grade 1AC (speaker)"). It opens a modal that scores the speech on five
independent categories, 1\u20135 each, with a slider apiece: Organization,
Evidence Quality, Argument Analysis, Clash & Strategy and Presentation
Clarity. A radar chart and the /25 total (Deficient \u2192 Exceptional) update as
you drag. The \u24D8 beside each category says what it does and doesn't grade,
and "Criteria and examples" shows what a 5 and a 3 look like. There is a
notes box, a Reset button and "Copy scorecard". Grades save to the round as
you go, and the row shows the total once a speech is graded.`},{heading:`what-it-does`,content:`**Captions ticker.** The captions button on a speech's recording player
shows the words transcribed while the speech was recorded, scrolling past
the player like a ticker. The word being played is highlighted and kept
centred. Click any word to jump the audio to that point. The on/off choice
is remembered across speeches. The player sits on its own row under the
speech's name and timer, so the ticker spans the full width of the panel.`},{heading:`what-it-does`,content:`**Full transcript.** The expand button at the end of the ticker opens the
whole transcript in a modal. Click any word to jump the audio there; the
word being played stays highlighted and in view.`},{heading:`what-it-does`,content:`**AI sections.** "Split into sections" in the transcript modal asks the AI
to break the speech into titled sections (framework, each contention,
each off-case, responses). The headings show above the transcript and
inside it, and clicking one jumps the audio to where it starts. Sections
are remembered for the speech until its transcript changes. This needs
you to be signed in, like the other AI features.`},{heading:`what-it-does`,content:`**Ask the speaker to be more clear.** When you judge a round (your email is
one of its judges), each speech's \u22EE menu has "Tell the debater to be more
clear". It pops a toast on the laptop of the debater giving that speech:
"The judge has requested you be more clear." You can send it once every
few seconds per speech.`},{heading:`known-gaps`,content:`Grades are stored on the round (\`Round.speechGrades\`, keyed by speech name),
so they follow the round's own save and sync. They are not a separate
per-grader record: two people grading the same speech overwrite each other.`},{heading:`known-gaps`,content:`The browser's speech recognition only reports when a phrase ends, not
per-word times, so word times are estimated by spreading each phrase
across the time it took. Clicking a word lands close to it, not exactly on
it.`},{heading:`known-gaps`,content:`Recordings transcribed before captions existed have no phrase timings, so
their words are spread evenly across the whole recording.`},{heading:`known-gaps`,content:`Transcription needs a browser with the Web Speech API (Chrome, Edge,
Safari). Elsewhere the ticker says there are no captions yet.`},{heading:`known-gaps`,content:`AI sections are saved only in this browser (localStorage), not on the
round, so other devices and other people in the round don't see them.
Section starts are snapped to the transcript's ~20-word lines, so a
heading can land a few words early.`},{heading:`known-gaps`,content:`The clarity request reaches the speaker over the round's live room, so both
laptops need the round open. The speaker is found from the round's debater
emails; a device not seated there gets it only while its own timer for that
speech is running. Only judges listed on the round see the menu item.`}],headings:[{id:`round-sidebar-speeches--captions`,content:`Round Sidebar Speeches & Captions`},{id:`what-it-does`,content:`What it does`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#round-sidebar-speeches--captions`,title:(0,t.jsx)(t.Fragment,{children:`Round Sidebar Speeches & Captions`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`round-sidebar-speeches--captions`,children:`Round Sidebar Speeches & Captions`}),`
`,(0,t.jsx)(n.p,{children:`The round group in the round workspace's sidebar lists every speech in the
round with its timer and word totals. It also holds the selected speech's
view controls and shows captions for recorded speeches.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` `,(0,t.jsx)(n.code,{children:`/debate`}),`, left sidebar, under the selected round`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`}),` (`,(0,t.jsx)(n.code,{children:`layout/LiveRoundGroup.tsx`}),`,
`,(0,t.jsx)(n.code,{children:`round/my-speeches.ts`}),`, `,(0,t.jsx)(n.code,{children:`dialogs/SpeechGradeDialog.tsx`}),`,
`,(0,t.jsx)(n.code,{children:`round/speech-rubric.ts`}),`), `,(0,t.jsx)(n.code,{children:`debate-timer`}),` (`,(0,t.jsx)(n.code,{children:`recorder/SpeechCaptionsTicker.tsx`}),`,
`,(0,t.jsx)(n.code,{children:`recorder/SpeechTranscriptDialog.tsx`}),`, `,(0,t.jsx)(n.code,{children:`recorder/speech-captions.ts`}),`,
`,(0,t.jsx)(n.code,{children:`recorder/transcript-sections.ts`}),`)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`View controls above the speeches.`}),` On desktop, when the sidebar shows a
round, the quote view, view mode, split layout and "open speech document"
buttons sit above the speech list instead of in the top bar. With no round
(or on mobile) they stay in the top bar.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Click a speech to make it active.`}),` Clicking any speech that isn't the
active one opens it. In split view, a speech already in a pane becomes the
active pane; otherwise the pair shifts to show it.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Your speeches are highlighted.`}),` If your email (your signed-in account,
or the "My Team" email saved in the round editor) is one of the round's
debaters, the speeches you give get an amber outline and a `,(0,t.jsx)(n.strong,{children:`You`}),` tag.
Speeches are matched by speaker: in Policy and PF the first debater listed
gives the 1A/1N (A1/N1) speeches and the second gives the 2A/2N ones. In
LD, every speech on your side is yours.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Grade a speech.`}),` Every speech row has a clipboard button (tooltip:
"Grade 1AC (speaker)"). It opens a modal that scores the speech on five
independent categories, 1\u20135 each, with a slider apiece: Organization,
Evidence Quality, Argument Analysis, Clash & Strategy and Presentation
Clarity. A radar chart and the /25 total (Deficient \u2192 Exceptional) update as
you drag. The \u24D8 beside each category says what it does and doesn't grade,
and "Criteria and examples" shows what a 5 and a 3 look like. There is a
notes box, a Reset button and "Copy scorecard". Grades save to the round as
you go, and the row shows the total once a speech is graded.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Captions ticker.`}),` The captions button on a speech's recording player
shows the words transcribed while the speech was recorded, scrolling past
the player like a ticker. The word being played is highlighted and kept
centred. Click any word to jump the audio to that point. The on/off choice
is remembered across speeches. The player sits on its own row under the
speech's name and timer, so the ticker spans the full width of the panel.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Full transcript.`}),` The expand button at the end of the ticker opens the
whole transcript in a modal. Click any word to jump the audio there; the
word being played stays highlighted and in view.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`AI sections.`}),` "Split into sections" in the transcript modal asks the AI
to break the speech into titled sections (framework, each contention,
each off-case, responses). The headings show above the transcript and
inside it, and clicking one jumps the audio to where it starts. Sections
are remembered for the speech until its transcript changes. This needs
you to be signed in, like the other AI features.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Ask the speaker to be more clear.`}),` When you judge a round (your email is
one of its judges), each speech's \u22EE menu has "Tell the debater to be more
clear". It pops a toast on the laptop of the debater giving that speech:
"The judge has requested you be more clear." You can send it once every
few seconds per speech.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsxs)(n.p,{children:[`Grades are stored on the round (`,(0,t.jsx)(n.code,{children:`Round.speechGrades`}),`, keyed by speech name),
so they follow the round's own save and sync. They are not a separate
per-grader record: two people grading the same speech overwrite each other.`]}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`The browser's speech recognition only reports when a phrase ends, not
per-word times, so word times are estimated by spreading each phrase
across the time it took. Clicking a word lands close to it, not exactly on
it.`}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`Recordings transcribed before captions existed have no phrase timings, so
their words are spread evenly across the whole recording.`}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`Transcription needs a browser with the Web Speech API (Chrome, Edge,
Safari). Elsewhere the ticker says there are no captions yet.`}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`AI sections are saved only in this browser (localStorage), not on the
round, so other devices and other people in the round don't see them.
Section starts are snapped to the transcript's ~20-word lines, so a
heading can land a few words early.`}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[`
`,(0,t.jsx)(n.p,{children:`The clarity request reaches the speaker over the round's live room, so both
laptops need the round open. The speaker is found from the round's debater
emails; a device not seated there gets it only while its own timer for that
speech is running. Only judges listed on the round see the menu item.`}),`
`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};