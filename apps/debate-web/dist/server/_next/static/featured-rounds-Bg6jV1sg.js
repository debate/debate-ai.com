import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Featured Rounds`},r=`# Featured Rounds [#featured-rounds]

Real rounds anyone can open from the **Featured** section of the \`/debate\`
start screen, with every speech's doc already filled in and the timers set to
the round's format.

- **Route:** \`/debate\` (start screen), or a featured round's own link such as
  \`/debate/2015-ndt/northwestern-mv-michigan-ap\`
- **Package:** \`debate-round\`

## What's there [#whats-there]

**NDT 2015 Finals** (Northwestern MV vs Michigan AP) is a college policy round
with eight speeches: 1AC, 1NC, 2AC, 2NC, 1NR, 1AR, 2NR and 2AR. The seven
speech docs that were shared publicly (1AC through 2NR) open in their
speeches; there is no 2AR doc, so that speech starts blank.

Click the card and the round opens as one flow with college policy timers
(9-minute constructives, 3-minute cross-examinations, 6-minute rebuttals and
10 minutes of prep per side). Open any speech to read its doc. The round is
then yours like any other: flow it, edit the docs, pin it. Clicking the card
again reopens that same copy rather than building a new one; delete the
round's flow to start fresh.

## Beside the video [#beside-the-video]

The round's video in the library,
[2015 NDT Finals - Northwestern MV vs Michigan AP](https://www.youtube.com/watch?v=zoKowWVQ1wE),
gets a **Speech docs** tab in the column beside the player, opened first. It
shows one speech's doc at a time: click a speech (1AC to 2AR) or use the
arrows to flip through them while you watch. Each doc is shown read-only in
read mode, so a card's body shows only its highlighted text. The 2AR button is greyed out
because there's no doc for it. **Open in debate view** goes to the full round
with timers.

## How it works [#how-it-works]

Featured rounds are a built-in catalog, \`FEATURED_ROUNDS\` in
\`packages/debate-round/src/round/featured-rounds.ts\`. Each entry names the
round's format, teams and slug, plus the public Topic Starter library file
(\`topic_starter_items.id\`) holding each speech's doc.

\`\`\`
DebateStartPanel (Featured card) \u2192 DebateFlowPage.handleOpenFeatured
  \u2192 findLocalFeaturedRound(): already built? reopen it
  \u2192 loadFeaturedSpeechDocs(): GET /api/topic-starters/by-path?path=<id> per speech
      \u2192 storedDocumentHtml() decodes each .cmir row to HTML
  \u2192 buildFeaturedRound(): newFlow() in the round's format, speechDocs filled
  \u2192 createRound() + setFlows(); settings.debateStyle set to the format
\`\`\`

A catalog entry with a \`videoId\` also adds the watch page tab: both watch
routes (\`app/videos/_watch/video-route-page.tsx\` and the webview's
\`VideoWatchRoute\`) pass \`featuredSpeechDocsTabs(videoId)\` from
\`debate-round\` to \`VideoWatchPage\`'s \`sideTabs\` prop, which \`WatchSidePanel\`
shows ahead of its own tabs. \`FeaturedSpeechDocsPanel\` loads the docs with the
same \`loadFeaturedSpeechDocs()\` and renders the HTML read-only with its own
\`pmd-*\` card styles, so no editor is booted. \`debate-videos\` only knows about
generic host tabs, not featured rounds.

Opening \`/debate/<featured slug>\` with no local copy builds it the same way,
so the link can be shared. A doc that fails to load is named in a notice under
the cards and the rest of the round still opens.

### Known gaps [#known-gaps]

- The docs are copied into the flow's \`speechDocs\`, about 1.5 MB of HTML for
  NDT 2015 Finals, so the round takes a large share of the browser's
  localStorage (and of the flow history entry the store saves for it).
- The catalog pins library row ids. If an admin deletes or re-uploads one of
  those Topic Starter files, its speech opens blank until the id is updated.
`,i={contents:[{heading:`featured-rounds`,content:`Real rounds anyone can open from the **Featured** section of the \`/debate\`
start screen, with every speech's doc already filled in and the timers set to
the round's format.`},{heading:`featured-rounds`,content:"**Route:** `/debate` (start screen), or a featured round's own link such as\n`/debate/2015-ndt/northwestern-mv-michigan-ap`"},{heading:`featured-rounds`,content:"**Package:** `debate-round`"},{heading:`whats-there`,content:`**NDT 2015 Finals** (Northwestern MV vs Michigan AP) is a college policy round
with eight speeches: 1AC, 1NC, 2AC, 2NC, 1NR, 1AR, 2NR and 2AR. The seven
speech docs that were shared publicly (1AC through 2NR) open in their
speeches; there is no 2AR doc, so that speech starts blank.`},{heading:`whats-there`,content:`Click the card and the round opens as one flow with college policy timers
(9-minute constructives, 3-minute cross-examinations, 6-minute rebuttals and
10 minutes of prep per side). Open any speech to read its doc. The round is
then yours like any other: flow it, edit the docs, pin it. Clicking the card
again reopens that same copy rather than building a new one; delete the
round's flow to start fresh.`},{heading:`beside-the-video`,content:`The round's video in the library,
2015 NDT Finals - Northwestern MV vs Michigan AP,
gets a **Speech docs** tab in the column beside the player, opened first. It
shows one speech's doc at a time: click a speech (1AC to 2AR) or use the
arrows to flip through them while you watch. Each doc is shown read-only in
read mode, so a card's body shows only its highlighted text. The 2AR button is greyed out
because there's no doc for it. **Open in debate view** goes to the full round
with timers.`},{heading:`how-it-works`,content:"Featured rounds are a built-in catalog, `FEATURED_ROUNDS` in\n`packages/debate-round/src/round/featured-rounds.ts`. Each entry names the\nround's format, teams and slug, plus the public Topic Starter library file\n(`topic_starter_items.id`) holding each speech's doc."},{heading:`how-it-works`,content:"A catalog entry with a `videoId` also adds the watch page tab: both watch\nroutes (`app/videos/_watch/video-route-page.tsx` and the webview's\n`VideoWatchRoute`) pass `featuredSpeechDocsTabs(videoId)` from\n`debate-round` to `VideoWatchPage`'s `sideTabs` prop, which `WatchSidePanel`\nshows ahead of its own tabs. `FeaturedSpeechDocsPanel` loads the docs with the\nsame `loadFeaturedSpeechDocs()` and renders the HTML read-only with its own\n`pmd-*` card styles, so no editor is booted. `debate-videos` only knows about\ngeneric host tabs, not featured rounds."},{heading:`how-it-works`,content:`Opening \`/debate/<featured slug>\` with no local copy builds it the same way,
so the link can be shared. A doc that fails to load is named in a notice under
the cards and the rest of the round still opens.`},{heading:`known-gaps`,content:`The docs are copied into the flow's \`speechDocs\`, about 1.5 MB of HTML for
NDT 2015 Finals, so the round takes a large share of the browser's
localStorage (and of the flow history entry the store saves for it).`},{heading:`known-gaps`,content:`The catalog pins library row ids. If an admin deletes or re-uploads one of
those Topic Starter files, its speech opens blank until the id is updated.`}],headings:[{id:`featured-rounds`,content:`Featured Rounds`},{id:`whats-there`,content:`What's there`},{id:`beside-the-video`,content:`Beside the video`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#featured-rounds`,title:(0,t.jsx)(t.Fragment,{children:`Featured Rounds`})},{depth:2,url:`#whats-there`,title:(0,t.jsx)(t.Fragment,{children:`What's there`})},{depth:2,url:`#beside-the-video`,title:(0,t.jsx)(t.Fragment,{children:`Beside the video`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:3,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,h3:`h3`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`featured-rounds`,children:`Featured Rounds`}),`
`,(0,t.jsxs)(n.p,{children:[`Real rounds anyone can open from the `,(0,t.jsx)(n.strong,{children:`Featured`}),` section of the `,(0,t.jsx)(n.code,{children:`/debate`}),`
start screen, with every speech's doc already filled in and the timers set to
the round's format.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/debate`}),` (start screen), or a featured round's own link such as
`,(0,t.jsx)(n.code,{children:`/debate/2015-ndt/northwestern-mv-michigan-ap`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`whats-there`,children:`What's there`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`NDT 2015 Finals`}),` (Northwestern MV vs Michigan AP) is a college policy round
with eight speeches: 1AC, 1NC, 2AC, 2NC, 1NR, 1AR, 2NR and 2AR. The seven
speech docs that were shared publicly (1AC through 2NR) open in their
speeches; there is no 2AR doc, so that speech starts blank.`]}),`
`,(0,t.jsx)(n.p,{children:`Click the card and the round opens as one flow with college policy timers
(9-minute constructives, 3-minute cross-examinations, 6-minute rebuttals and
10 minutes of prep per side). Open any speech to read its doc. The round is
then yours like any other: flow it, edit the docs, pin it. Clicking the card
again reopens that same copy rather than building a new one; delete the
round's flow to start fresh.`}),`
`,(0,t.jsx)(n.h2,{id:`beside-the-video`,children:`Beside the video`}),`
`,(0,t.jsxs)(n.p,{children:[`The round's video in the library,
`,(0,t.jsx)(n.a,{href:`https://www.youtube.com/watch?v=zoKowWVQ1wE`,children:`2015 NDT Finals - Northwestern MV vs Michigan AP`}),`,
gets a `,(0,t.jsx)(n.strong,{children:`Speech docs`}),` tab in the column beside the player, opened first. It
shows one speech's doc at a time: click a speech (1AC to 2AR) or use the
arrows to flip through them while you watch. Each doc is shown read-only in
read mode, so a card's body shows only its highlighted text. The 2AR button is greyed out
because there's no doc for it. `,(0,t.jsx)(n.strong,{children:`Open in debate view`}),` goes to the full round
with timers.`]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.p,{children:[`Featured rounds are a built-in catalog, `,(0,t.jsx)(n.code,{children:`FEATURED_ROUNDS`}),` in
`,(0,t.jsx)(n.code,{children:`packages/debate-round/src/round/featured-rounds.ts`}),`. Each entry names the
round's format, teams and slug, plus the public Topic Starter library file
(`,(0,t.jsx)(n.code,{children:`topic_starter_items.id`}),`) holding each speech's doc.`]}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`DebateStartPanel (Featured card) \u2192 DebateFlowPage.handleOpenFeatured`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 findLocalFeaturedRound(): already built? reopen it`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 loadFeaturedSpeechDocs(): GET /api/topic-starters/by-path?path=<id> per speech`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 storedDocumentHtml() decodes each .cmir row to HTML`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildFeaturedRound(): newFlow() in the round's format, speechDocs filled`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 createRound() + setFlows(); settings.debateStyle set to the format`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`A catalog entry with a `,(0,t.jsx)(n.code,{children:`videoId`}),` also adds the watch page tab: both watch
routes (`,(0,t.jsx)(n.code,{children:`app/videos/_watch/video-route-page.tsx`}),` and the webview's
`,(0,t.jsx)(n.code,{children:`VideoWatchRoute`}),`) pass `,(0,t.jsx)(n.code,{children:`featuredSpeechDocsTabs(videoId)`}),` from
`,(0,t.jsx)(n.code,{children:`debate-round`}),` to `,(0,t.jsx)(n.code,{children:`VideoWatchPage`}),`'s `,(0,t.jsx)(n.code,{children:`sideTabs`}),` prop, which `,(0,t.jsx)(n.code,{children:`WatchSidePanel`}),`
shows ahead of its own tabs. `,(0,t.jsx)(n.code,{children:`FeaturedSpeechDocsPanel`}),` loads the docs with the
same `,(0,t.jsx)(n.code,{children:`loadFeaturedSpeechDocs()`}),` and renders the HTML read-only with its own
`,(0,t.jsx)(n.code,{children:`pmd-*`}),` card styles, so no editor is booted. `,(0,t.jsx)(n.code,{children:`debate-videos`}),` only knows about
generic host tabs, not featured rounds.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Opening `,(0,t.jsx)(n.code,{children:`/debate/<featured slug>`}),` with no local copy builds it the same way,
so the link can be shared. A doc that fails to load is named in a notice under
the cards and the rest of the round still opens.`]}),`
`,(0,t.jsx)(n.h3,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`The docs are copied into the flow's `,(0,t.jsx)(n.code,{children:`speechDocs`}),`, about 1.5 MB of HTML for
NDT 2015 Finals, so the round takes a large share of the browser's
localStorage (and of the flow history entry the store saves for it).`]}),`
`,(0,t.jsx)(n.li,{children:`The catalog pins library row ids. If an admin deletes or re-uploads one of
those Topic Starter files, its speech opens blank until the id is updated.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};