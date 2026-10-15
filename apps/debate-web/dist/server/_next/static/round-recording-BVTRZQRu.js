import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Joined Round Recording`},r=`# Joined Round Recording [#joined-round-recording]

Once the speeches of a round are recorded, **Join round recording** puts them
in round order in one MP3, plays it back with captions and each debater's
webcam, lets you fix where every speech begins, and saves it all to the
site's cloud storage.

- **Nav:** \`/debate\`, the speech recording menu (\u22EE or "Mic & recording") \u2192
  **Join round recording\u2026**
- **Package:** \`debate-timer\` (\`recorder/RoundRecordingDialog.tsx\`,
  \`recorder/SpeechStartsDialog.tsx\`, \`recorder/round-recording.ts\`,
  \`recorder/round-recording-audio.ts\`, \`recorder/round-recording-cloud.ts\`,
  \`recorder/media-store.ts\`), \`debate-round\` (\`round/round-recording-items.ts\`,
  \`webcam/useRoomSpeechRecorder.ts\`), app (\`/api/round-recordings\`,
  \`lib/round-recordings/storage.ts\`, R2 binding \`ROUND_RECORDINGS\`)

## What it does [#what-it-does]

- **One MP3 for the round.** Every speech with a recording is joined in round
  order with a one-second gap, at 32 kHz mono, 64 kbps \u2014 about 30 MB an hour.
  Cross-ex has no recording of its own; it is timed inside a speaker's
  recording. The MP3 is built in your browser and can be downloaded.
- **Optional processing.**
  - *Read each speech's name* \u2014 a Kokoro voice (through \`/api/tts\`) says
    "1 A C" before the 1AC, and so on.
  - *Captions from the live transcription* \u2014 what the browser heard while each
    speech recorded, moved to where the speech sits in the MP3.
  - *Transcribe with Moonshine* \u2014 runs the Moonshine speech model on your
    device over the joined MP3 for more accurate captions. The model downloads
    the first time.
- **Speech start times.** Each speech's start is tracked. **Adjust speech
  starts** opens a modal listing every speech: play to where it begins and
  press the crosshair, type \`m:ss\`, nudge \u00B15 s, jump to it, or clear it. The
  same modal labels speeches on a YouTube round (watch page \u2192 **Speech
  starts**), docked in the corner so the video stays visible. The speech
  menu's **Select YouTube Start** uses the same list, with stop times too.
- **Webcam video.** Turn on **Record webcam video** in the recording menu
  and your camera is recorded with each speech. Debaters in the round's
  **Cameras** room are each recorded separately from what your browser
  receives. In playback, every debater's clip for the current speech plays in
  step with the MP3.
- **Save to cloud.** Uploads the MP3, captions, webcam clips and a manifest to
  a private R2 bucket under your account. Only you can stream them back.
  Nothing uploads until you press the button.

## Known gaps [#known-gaps]

- A speech resumed after a pause keeps only its last webcam clip.
- Cloud copies are per account; other debaters see the round only from their
  own uploads.
- Files over 95 MB (about 25 minutes of webcam video) are refused.
`,i={contents:[{heading:`joined-round-recording`,content:`Once the speeches of a round are recorded, **Join round recording** puts them
in round order in one MP3, plays it back with captions and each debater's
webcam, lets you fix where every speech begins, and saves it all to the
site's cloud storage.`},{heading:`joined-round-recording`,content:'**Nav:** `/debate`, the speech recording menu (\u22EE or "Mic & recording") \u2192\n**Join round recording\u2026**'},{heading:`joined-round-recording`,content:"**Package:** `debate-timer` (`recorder/RoundRecordingDialog.tsx`,\n`recorder/SpeechStartsDialog.tsx`, `recorder/round-recording.ts`,\n`recorder/round-recording-audio.ts`, `recorder/round-recording-cloud.ts`,\n`recorder/media-store.ts`), `debate-round` (`round/round-recording-items.ts`,\n`webcam/useRoomSpeechRecorder.ts`), app (`/api/round-recordings`,\n`lib/round-recordings/storage.ts`, R2 binding `ROUND_RECORDINGS`)"},{heading:`what-it-does`,content:`**One MP3 for the round.** Every speech with a recording is joined in round
order with a one-second gap, at 32 kHz mono, 64 kbps \u2014 about 30 MB an hour.
Cross-ex has no recording of its own; it is timed inside a speaker's
recording. The MP3 is built in your browser and can be downloaded.`},{heading:`what-it-does`,content:`**Optional processing.**`},{heading:`what-it-does`,content:`*Read each speech's name* \u2014 a Kokoro voice (through \`/api/tts\`) says
"1 A C" before the 1AC, and so on.`},{heading:`what-it-does`,content:`*Captions from the live transcription* \u2014 what the browser heard while each
speech recorded, moved to where the speech sits in the MP3.`},{heading:`what-it-does`,content:`*Transcribe with Moonshine* \u2014 runs the Moonshine speech model on your
device over the joined MP3 for more accurate captions. The model downloads
the first time.`},{heading:`what-it-does`,content:`**Speech start times.** Each speech's start is tracked. **Adjust speech
starts** opens a modal listing every speech: play to where it begins and
press the crosshair, type \`m:ss\`, nudge \u00B15 s, jump to it, or clear it. The
same modal labels speeches on a YouTube round (watch page \u2192 **Speech
starts**), docked in the corner so the video stays visible. The speech
menu's **Select YouTube Start** uses the same list, with stop times too.`},{heading:`what-it-does`,content:`**Webcam video.** Turn on **Record webcam video** in the recording menu
and your camera is recorded with each speech. Debaters in the round's
**Cameras** room are each recorded separately from what your browser
receives. In playback, every debater's clip for the current speech plays in
step with the MP3.`},{heading:`what-it-does`,content:`**Save to cloud.** Uploads the MP3, captions, webcam clips and a manifest to
a private R2 bucket under your account. Only you can stream them back.
Nothing uploads until you press the button.`},{heading:`known-gaps`,content:`A speech resumed after a pause keeps only its last webcam clip.`},{heading:`known-gaps`,content:`Cloud copies are per account; other debaters see the round only from their
own uploads.`},{heading:`known-gaps`,content:`Files over 95 MB (about 25 minutes of webcam video) are refused.`}],headings:[{id:`joined-round-recording`,content:`Joined Round Recording`},{id:`what-it-does`,content:`What it does`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#joined-round-recording`,title:(0,t.jsx)(t.Fragment,{children:`Joined Round Recording`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`joined-round-recording`,children:`Joined Round Recording`}),`
`,(0,t.jsxs)(n.p,{children:[`Once the speeches of a round are recorded, `,(0,t.jsx)(n.strong,{children:`Join round recording`}),` puts them
in round order in one MP3, plays it back with captions and each debater's
webcam, lets you fix where every speech begins, and saves it all to the
site's cloud storage.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` `,(0,t.jsx)(n.code,{children:`/debate`}),`, the speech recording menu (\u22EE or "Mic & recording") \u2192
`,(0,t.jsx)(n.strong,{children:`Join round recording\u2026`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-timer`}),` (`,(0,t.jsx)(n.code,{children:`recorder/RoundRecordingDialog.tsx`}),`,
`,(0,t.jsx)(n.code,{children:`recorder/SpeechStartsDialog.tsx`}),`, `,(0,t.jsx)(n.code,{children:`recorder/round-recording.ts`}),`,
`,(0,t.jsx)(n.code,{children:`recorder/round-recording-audio.ts`}),`, `,(0,t.jsx)(n.code,{children:`recorder/round-recording-cloud.ts`}),`,
`,(0,t.jsx)(n.code,{children:`recorder/media-store.ts`}),`), `,(0,t.jsx)(n.code,{children:`debate-round`}),` (`,(0,t.jsx)(n.code,{children:`round/round-recording-items.ts`}),`,
`,(0,t.jsx)(n.code,{children:`webcam/useRoomSpeechRecorder.ts`}),`), app (`,(0,t.jsx)(n.code,{children:`/api/round-recordings`}),`,
`,(0,t.jsx)(n.code,{children:`lib/round-recordings/storage.ts`}),`, R2 binding `,(0,t.jsx)(n.code,{children:`ROUND_RECORDINGS`}),`)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`One MP3 for the round.`}),` Every speech with a recording is joined in round
order with a one-second gap, at 32 kHz mono, 64 kbps \u2014 about 30 MB an hour.
Cross-ex has no recording of its own; it is timed inside a speaker's
recording. The MP3 is built in your browser and can be downloaded.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Optional processing.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.em,{children:`Read each speech's name`}),` \u2014 a Kokoro voice (through `,(0,t.jsx)(n.code,{children:`/api/tts`}),`) says
"1 A C" before the 1AC, and so on.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.em,{children:`Captions from the live transcription`}),` \u2014 what the browser heard while each
speech recorded, moved to where the speech sits in the MP3.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.em,{children:`Transcribe with Moonshine`}),` \u2014 runs the Moonshine speech model on your
device over the joined MP3 for more accurate captions. The model downloads
the first time.`]}),`
`]}),`
`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Speech start times.`}),` Each speech's start is tracked. `,(0,t.jsx)(n.strong,{children:`Adjust speech
starts`}),` opens a modal listing every speech: play to where it begins and
press the crosshair, type `,(0,t.jsx)(n.code,{children:`m:ss`}),`, nudge \u00B15 s, jump to it, or clear it. The
same modal labels speeches on a YouTube round (watch page \u2192 `,(0,t.jsx)(n.strong,{children:`Speech
starts`}),`), docked in the corner so the video stays visible. The speech
menu's `,(0,t.jsx)(n.strong,{children:`Select YouTube Start`}),` uses the same list, with stop times too.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Webcam video.`}),` Turn on `,(0,t.jsx)(n.strong,{children:`Record webcam video`}),` in the recording menu
and your camera is recorded with each speech. Debaters in the round's
`,(0,t.jsx)(n.strong,{children:`Cameras`}),` room are each recorded separately from what your browser
receives. In playback, every debater's clip for the current speech plays in
step with the MP3.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Save to cloud.`}),` Uploads the MP3, captions, webcam clips and a manifest to
a private R2 bucket under your account. Only you can stream them back.
Nothing uploads until you press the button.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`A speech resumed after a pause keeps only its last webcam clip.`}),`
`,(0,t.jsx)(n.li,{children:`Cloud copies are per account; other debaters see the round only from their
own uploads.`}),`
`,(0,t.jsx)(n.li,{children:`Files over 95 MB (about 25 minutes of webcam video) are refused.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};