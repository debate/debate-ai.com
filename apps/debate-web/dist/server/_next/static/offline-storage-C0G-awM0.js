import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Offline Storage`},r=`# Offline Storage [#offline-storage]

Where Debate AI keeps your work on this device, and how to get unlimited
offline storage with the browser extension.

- **Settings:** \`/settings\` \u2192 **Storage on this device**
- **Packages:** \`debate-data-sync\` (\`src/state/bulk-storage.ts\`),
  \`apps/debate-browser-ext\` (\`src/storage/bulk-storage-bridge.ts\`)

## What it does [#what-it-does]

- **Your account is the real copy.** Signed in, your flows, rounds, cards and
  settings are saved to your account and follow you to any device.
- **The browser keeps an offline copy** so you can keep flowing without a
  connection. Flows, rounds and flow history live in the browser's database
  (IndexedDB), which has room for gigabytes \u2014 not in \`localStorage\`, which is
  kept for small preferences only. You will not see "storage quota exceeded"
  warnings, and nothing is deleted to make room.
- **The browser extension makes it unlimited.** Install the Debate AI
  extension and it asks for the *unlimited storage* permission. While it is
  installed, the site mirrors its offline copy into the extension, where no
  browser quota applies, and restores from it if the browser ever clears the
  site's own copy.

The Settings card shows which of these is active on this browser: whether the
offline copy is in the browser database, whether the extension is connected,
how much space the site is using, and whether the browser has agreed not to
clear it.

Older versions kept flows in \`localStorage\`. The first visit after updating
moves them into the browser database automatically and frees that space.
`,i={contents:[{heading:`offline-storage`,content:`Where Debate AI keeps your work on this device, and how to get unlimited
offline storage with the browser extension.`},{heading:`offline-storage`,content:"**Settings:** `/settings` \u2192 **Storage on this device**"},{heading:`offline-storage`,content:"**Packages:** `debate-data-sync` (`src/state/bulk-storage.ts`),\n`apps/debate-browser-ext` (`src/storage/bulk-storage-bridge.ts`)"},{heading:`what-it-does`,content:`**Your account is the real copy.** Signed in, your flows, rounds, cards and
settings are saved to your account and follow you to any device.`},{heading:`what-it-does`,content:`**The browser keeps an offline copy** so you can keep flowing without a
connection. Flows, rounds and flow history live in the browser's database
(IndexedDB), which has room for gigabytes \u2014 not in \`localStorage\`, which is
kept for small preferences only. You will not see "storage quota exceeded"
warnings, and nothing is deleted to make room.`},{heading:`what-it-does`,content:`**The browser extension makes it unlimited.** Install the Debate AI
extension and it asks for the *unlimited storage* permission. While it is
installed, the site mirrors its offline copy into the extension, where no
browser quota applies, and restores from it if the browser ever clears the
site's own copy.`},{heading:`what-it-does`,content:`The Settings card shows which of these is active on this browser: whether the
offline copy is in the browser database, whether the extension is connected,
how much space the site is using, and whether the browser has agreed not to
clear it.`},{heading:`what-it-does`,content:"Older versions kept flows in `localStorage`. The first visit after updating\nmoves them into the browser database automatically and frees that space."}],headings:[{id:`offline-storage`,content:`Offline Storage`},{id:`what-it-does`,content:`What it does`}]},a=[{depth:1,url:`#offline-storage`,title:(0,t.jsx)(t.Fragment,{children:`Offline Storage`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})}];function o(e){let n={code:`code`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`offline-storage`,children:`Offline Storage`}),`
`,(0,t.jsx)(n.p,{children:`Where Debate AI keeps your work on this device, and how to get unlimited
offline storage with the browser extension.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Settings:`}),` `,(0,t.jsx)(n.code,{children:`/settings`}),` \u2192 `,(0,t.jsx)(n.strong,{children:`Storage on this device`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Packages:`}),` `,(0,t.jsx)(n.code,{children:`debate-data-sync`}),` (`,(0,t.jsx)(n.code,{children:`src/state/bulk-storage.ts`}),`),
`,(0,t.jsx)(n.code,{children:`apps/debate-browser-ext`}),` (`,(0,t.jsx)(n.code,{children:`src/storage/bulk-storage-bridge.ts`}),`)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Your account is the real copy.`}),` Signed in, your flows, rounds, cards and
settings are saved to your account and follow you to any device.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`The browser keeps an offline copy`}),` so you can keep flowing without a
connection. Flows, rounds and flow history live in the browser's database
(IndexedDB), which has room for gigabytes \u2014 not in `,(0,t.jsx)(n.code,{children:`localStorage`}),`, which is
kept for small preferences only. You will not see "storage quota exceeded"
warnings, and nothing is deleted to make room.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`The browser extension makes it unlimited.`}),` Install the Debate AI
extension and it asks for the `,(0,t.jsx)(n.em,{children:`unlimited storage`}),` permission. While it is
installed, the site mirrors its offline copy into the extension, where no
browser quota applies, and restores from it if the browser ever clears the
site's own copy.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`The Settings card shows which of these is active on this browser: whether the
offline copy is in the browser database, whether the extension is connected,
how much space the site is using, and whether the browser has agreed not to
clear it.`}),`
`,(0,t.jsxs)(n.p,{children:[`Older versions kept flows in `,(0,t.jsx)(n.code,{children:`localStorage`}),`. The first visit after updating
moves them into the browser database automatically and frees that space.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};