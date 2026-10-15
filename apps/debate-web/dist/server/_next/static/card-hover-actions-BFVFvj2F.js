import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Card hover actions in the editor`},r=`# Card hover actions in the editor [#card-hover-actions-in-the-editor]

Hover over any card in the CardMirror editor and a small column of buttons
appears beside it:

- **Summarize** asks the AI for a two-to-four sentence summary of the card: its
  claim, its warrant, and the impact it supports.
- **Find flaws** asks the AI for the weaknesses an opponent would attack, the
  same find-flaws-and-extensions analysis as the evidence search's AI panel.
- **Read aloud** reads the card out loud in a natural AI voice: the
  tag, then the citation (the author and year), then the highlighted
  text (what you would read in round), or the underlined text when
  nothing is highlighted. In read mode it reads only what read mode shows
  of the card. Click it again to stop.

AI answers open in a small panel next to the card, with **Copy** and **Close**
buttons; Escape closes it too. The buttons only appear with a mouse, so they
never get in the way on a phone or tablet.

## Read aloud voices [#read-aloud-voices]

The gear under **Read aloud** opens its settings: a speed slider (2x by
default, and it changes speed while a card is playing) and a **Voice** list.
Kokoro voices come first and are the default; Deepgram voices and your
browser's built-in voice are the other choices. Both settings are remembered.

Kokoro voices run right in your browser: the first time you read a card
aloud, the Kokoro voice model (about 90 MB) downloads once and is kept by your
browser, and from then on reading needs no server and has no daily limit. The
card starts playing as soon as its first sentence is ready.

If your browser can't run Kokoro, or the download fails, the card is read by
a server instead. Those voices come from QwkSearch (Kokoro or Deepgram), or from Cloudflare's
Deepgram Aura voices when the site has Cloudflare AI set up. Signed out, you
share QwkSearch's free allowance of 10 reads a day; link your QwkSearch account
in settings to read on your own account. When an AI voice isn't available, or
the daily allowance is used up, the card is read with your browser's voice
instead, so Read aloud always works.

## Which AI it uses [#which-ai-it-uses]

If you have turned on AI features with your own Anthropic or OpenRouter key in
the editor's settings, the buttons use that key. Otherwise they use
debate-ai.com's AI: each new answer counts toward your plan's daily card AI
analyses, a card that already has a saved answer costs nothing, and the
summary needs you to be signed in.

## Where it lives [#where-it-lives]

- **Routes:** \`/reason-editor\` and Flow's speech-doc panels (anywhere the
  CardMirror embed is mounted)
- **Package:** \`debate-editor\` (\`overlay/editor/card-hover-actions.ts\`,
  \`overlay/editor/card-ai-client.ts\`, \`overlay/editor/card-tts-client.ts\`,
  \`overlay/editor/kokoro-browser-tts.ts\`,
  registered in \`overlay/react/singleton.ts\`)
- **API:** \`/api/card-ai-analysis\`, \`/api/tts\` (\`apps/debate-ai.com/lib/tts/voice.ts\`)
`,i={contents:[{heading:`card-hover-actions-in-the-editor`,content:`Hover over any card in the CardMirror editor and a small column of buttons
appears beside it:`},{heading:`card-hover-actions-in-the-editor`,content:`**Summarize** asks the AI for a two-to-four sentence summary of the card: its
claim, its warrant, and the impact it supports.`},{heading:`card-hover-actions-in-the-editor`,content:`**Find flaws** asks the AI for the weaknesses an opponent would attack, the
same find-flaws-and-extensions analysis as the evidence search's AI panel.`},{heading:`card-hover-actions-in-the-editor`,content:`**Read aloud** reads the card out loud in a natural AI voice: the
tag, then the citation (the author and year), then the highlighted
text (what you would read in round), or the underlined text when
nothing is highlighted. In read mode it reads only what read mode shows
of the card. Click it again to stop.`},{heading:`card-hover-actions-in-the-editor`,content:`AI answers open in a small panel next to the card, with **Copy** and **Close**
buttons; Escape closes it too. The buttons only appear with a mouse, so they
never get in the way on a phone or tablet.`},{heading:`read-aloud-voices`,content:`The gear under **Read aloud** opens its settings: a speed slider (2x by
default, and it changes speed while a card is playing) and a **Voice** list.
Kokoro voices come first and are the default; Deepgram voices and your
browser's built-in voice are the other choices. Both settings are remembered.`},{heading:`read-aloud-voices`,content:`Kokoro voices run right in your browser: the first time you read a card
aloud, the Kokoro voice model (about 90 MB) downloads once and is kept by your
browser, and from then on reading needs no server and has no daily limit. The
card starts playing as soon as its first sentence is ready.`},{heading:`read-aloud-voices`,content:`If your browser can't run Kokoro, or the download fails, the card is read by
a server instead. Those voices come from QwkSearch (Kokoro or Deepgram), or from Cloudflare's
Deepgram Aura voices when the site has Cloudflare AI set up. Signed out, you
share QwkSearch's free allowance of 10 reads a day; link your QwkSearch account
in settings to read on your own account. When an AI voice isn't available, or
the daily allowance is used up, the card is read with your browser's voice
instead, so Read aloud always works.`},{heading:`which-ai-it-uses`,content:`If you have turned on AI features with your own Anthropic or OpenRouter key in
the editor's settings, the buttons use that key. Otherwise they use
debate-ai.com's AI: each new answer counts toward your plan's daily card AI
analyses, a card that already has a saved answer costs nothing, and the
summary needs you to be signed in.`},{heading:`where-it-lives`,content:"**Routes:** `/reason-editor` and Flow's speech-doc panels (anywhere the\nCardMirror embed is mounted)"},{heading:`where-it-lives`,content:"**Package:** `debate-editor` (`overlay/editor/card-hover-actions.ts`,\n`overlay/editor/card-ai-client.ts`, `overlay/editor/card-tts-client.ts`,\n`overlay/editor/kokoro-browser-tts.ts`,\nregistered in `overlay/react/singleton.ts`)"},{heading:`where-it-lives`,content:"**API:** `/api/card-ai-analysis`, `/api/tts` (`apps/debate-ai.com/lib/tts/voice.ts`)"}],headings:[{id:`card-hover-actions-in-the-editor`,content:`Card hover actions in the editor`},{id:`read-aloud-voices`,content:`Read aloud voices`},{id:`which-ai-it-uses`,content:`Which AI it uses`},{id:`where-it-lives`,content:`Where it lives`}]},a=[{depth:1,url:`#card-hover-actions-in-the-editor`,title:(0,t.jsx)(t.Fragment,{children:`Card hover actions in the editor`})},{depth:2,url:`#read-aloud-voices`,title:(0,t.jsx)(t.Fragment,{children:`Read aloud voices`})},{depth:2,url:`#which-ai-it-uses`,title:(0,t.jsx)(t.Fragment,{children:`Which AI it uses`})},{depth:2,url:`#where-it-lives`,title:(0,t.jsx)(t.Fragment,{children:`Where it lives`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`card-hover-actions-in-the-editor`,children:`Card hover actions in the editor`}),`
`,(0,t.jsx)(n.p,{children:`Hover over any card in the CardMirror editor and a small column of buttons
appears beside it:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Summarize`}),` asks the AI for a two-to-four sentence summary of the card: its
claim, its warrant, and the impact it supports.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Find flaws`}),` asks the AI for the weaknesses an opponent would attack, the
same find-flaws-and-extensions analysis as the evidence search's AI panel.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Read aloud`}),` reads the card out loud in a natural AI voice: the
tag, then the citation (the author and year), then the highlighted
text (what you would read in round), or the underlined text when
nothing is highlighted. In read mode it reads only what read mode shows
of the card. Click it again to stop.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`AI answers open in a small panel next to the card, with `,(0,t.jsx)(n.strong,{children:`Copy`}),` and `,(0,t.jsx)(n.strong,{children:`Close`}),`
buttons; Escape closes it too. The buttons only appear with a mouse, so they
never get in the way on a phone or tablet.`]}),`
`,(0,t.jsx)(n.h2,{id:`read-aloud-voices`,children:`Read aloud voices`}),`
`,(0,t.jsxs)(n.p,{children:[`The gear under `,(0,t.jsx)(n.strong,{children:`Read aloud`}),` opens its settings: a speed slider (2x by
default, and it changes speed while a card is playing) and a `,(0,t.jsx)(n.strong,{children:`Voice`}),` list.
Kokoro voices come first and are the default; Deepgram voices and your
browser's built-in voice are the other choices. Both settings are remembered.`]}),`
`,(0,t.jsx)(n.p,{children:`Kokoro voices run right in your browser: the first time you read a card
aloud, the Kokoro voice model (about 90 MB) downloads once and is kept by your
browser, and from then on reading needs no server and has no daily limit. The
card starts playing as soon as its first sentence is ready.`}),`
`,(0,t.jsx)(n.p,{children:`If your browser can't run Kokoro, or the download fails, the card is read by
a server instead. Those voices come from QwkSearch (Kokoro or Deepgram), or from Cloudflare's
Deepgram Aura voices when the site has Cloudflare AI set up. Signed out, you
share QwkSearch's free allowance of 10 reads a day; link your QwkSearch account
in settings to read on your own account. When an AI voice isn't available, or
the daily allowance is used up, the card is read with your browser's voice
instead, so Read aloud always works.`}),`
`,(0,t.jsx)(n.h2,{id:`which-ai-it-uses`,children:`Which AI it uses`}),`
`,(0,t.jsx)(n.p,{children:`If you have turned on AI features with your own Anthropic or OpenRouter key in
the editor's settings, the buttons use that key. Otherwise they use
debate-ai.com's AI: each new answer counts toward your plan's daily card AI
analyses, a card that already has a saved answer costs nothing, and the
summary needs you to be signed in.`}),`
`,(0,t.jsx)(n.h2,{id:`where-it-lives`,children:`Where it lives`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Routes:`}),` `,(0,t.jsx)(n.code,{children:`/reason-editor`}),` and Flow's speech-doc panels (anywhere the
CardMirror embed is mounted)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`}),` (`,(0,t.jsx)(n.code,{children:`overlay/editor/card-hover-actions.ts`}),`,
`,(0,t.jsx)(n.code,{children:`overlay/editor/card-ai-client.ts`}),`, `,(0,t.jsx)(n.code,{children:`overlay/editor/card-tts-client.ts`}),`,
`,(0,t.jsx)(n.code,{children:`overlay/editor/kokoro-browser-tts.ts`}),`,
registered in `,(0,t.jsx)(n.code,{children:`overlay/react/singleton.ts`}),`)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`API:`}),` `,(0,t.jsx)(n.code,{children:`/api/card-ai-analysis`}),`, `,(0,t.jsx)(n.code,{children:`/api/tts`}),` (`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/tts/voice.ts`}),`)`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};