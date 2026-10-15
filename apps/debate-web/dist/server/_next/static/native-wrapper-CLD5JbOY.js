import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Native Wrapper`},r=`# Native Wrapper [#native-wrapper]

A native desktop (Windows/macOS/Linux) and mobile (Android/iOS) app that
opens debate-ai.com in its own window instead of a browser tab, with a
Google-OAuth-compatible sign-in flow despite Google blocking OAuth inside
embedded webviews. Built with [Tauri](https://tauri.app) as \`native-wrapper\`,
a generic wrapper package pre-configured to ship Debate AI.

- **Package:** \`native-wrapper\` (the Tauri shell)

## What it shows [#what-it-shows]

Functionally identical to the website \u2014 the wrapper's window loads
\`https://debate-ai.com\` directly. The one difference is sign-in: inside
the wrapper, a "Continue in your browser" button replaces the normal
social/magic-link buttons, since OAuth providers refuse to run inside an
embedded webview. A deep link (\`debateai://auth-callback\`) hands a
one-time token back to the wrapper's window after the browser completes
sign-in.

## Camera and microphone [#camera-and-microphone]

The webcam room and the speech recorder work in the app. The first time a
page turns the camera or microphone on, the operating system asks once
(macOS shows "Debate AI would like to access the camera"); the app itself
does not ask again for its own pages. If the camera still won't turn on,
check the OS privacy settings for Debate AI.

## Known gaps [#known-gaps]

No auto-update yet. Android/iOS projects are scaffolded but not generated
or exercised end-to-end. No store submissions have been made. Camera and microphone
access is not set up for the Android/iOS builds yet (their manifests need the
camera permissions added after \`tauri android init\` / \`tauri ios init\`).
`,i={contents:[{heading:`native-wrapper`,content:`A native desktop (Windows/macOS/Linux) and mobile (Android/iOS) app that
opens debate-ai.com in its own window instead of a browser tab, with a
Google-OAuth-compatible sign-in flow despite Google blocking OAuth inside
embedded webviews. Built with Tauri as \`native-wrapper\`,
a generic wrapper package pre-configured to ship Debate AI.`},{heading:`native-wrapper`,content:"**Package:** `native-wrapper` (the Tauri shell)"},{heading:`what-it-shows`,content:`Functionally identical to the website \u2014 the wrapper's window loads
\`https://debate-ai.com\` directly. The one difference is sign-in: inside
the wrapper, a "Continue in your browser" button replaces the normal
social/magic-link buttons, since OAuth providers refuse to run inside an
embedded webview. A deep link (\`debateai://auth-callback\`) hands a
one-time token back to the wrapper's window after the browser completes
sign-in.`},{heading:`camera-and-microphone`,content:`The webcam room and the speech recorder work in the app. The first time a
page turns the camera or microphone on, the operating system asks once
(macOS shows "Debate AI would like to access the camera"); the app itself
does not ask again for its own pages. If the camera still won't turn on,
check the OS privacy settings for Debate AI.`},{heading:`known-gaps`,content:"No auto-update yet. Android/iOS projects are scaffolded but not generated\nor exercised end-to-end. No store submissions have been made. Camera and microphone\naccess is not set up for the Android/iOS builds yet (their manifests need the\ncamera permissions added after `tauri android init` / `tauri ios init`)."}],headings:[{id:`native-wrapper`,content:`Native Wrapper`},{id:`what-it-shows`,content:`What it shows`},{id:`camera-and-microphone`,content:`Camera and microphone`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#native-wrapper`,title:(0,t.jsx)(t.Fragment,{children:`Native Wrapper`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#camera-and-microphone`,title:(0,t.jsx)(t.Fragment,{children:`Camera and microphone`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`native-wrapper`,children:`Native Wrapper`}),`
`,(0,t.jsxs)(n.p,{children:[`A native desktop (Windows/macOS/Linux) and mobile (Android/iOS) app that
opens debate-ai.com in its own window instead of a browser tab, with a
Google-OAuth-compatible sign-in flow despite Google blocking OAuth inside
embedded webviews. Built with `,(0,t.jsx)(n.a,{href:`https://tauri.app`,children:`Tauri`}),` as `,(0,t.jsx)(n.code,{children:`native-wrapper`}),`,
a generic wrapper package pre-configured to ship Debate AI.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`native-wrapper`}),` (the Tauri shell)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Functionally identical to the website \u2014 the wrapper's window loads
`,(0,t.jsx)(n.code,{children:`https://debate-ai.com`}),` directly. The one difference is sign-in: inside
the wrapper, a "Continue in your browser" button replaces the normal
social/magic-link buttons, since OAuth providers refuse to run inside an
embedded webview. A deep link (`,(0,t.jsx)(n.code,{children:`debateai://auth-callback`}),`) hands a
one-time token back to the wrapper's window after the browser completes
sign-in.`]}),`
`,(0,t.jsx)(n.h2,{id:`camera-and-microphone`,children:`Camera and microphone`}),`
`,(0,t.jsx)(n.p,{children:`The webcam room and the speech recorder work in the app. The first time a
page turns the camera or microphone on, the operating system asks once
(macOS shows "Debate AI would like to access the camera"); the app itself
does not ask again for its own pages. If the camera still won't turn on,
check the OS privacy settings for Debate AI.`}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`No auto-update yet. Android/iOS projects are scaffolded but not generated
or exercised end-to-end. No store submissions have been made. Camera and microphone
access is not set up for the Android/iOS builds yet (their manifests need the
camera permissions added after `,(0,t.jsx)(n.code,{children:`tauri android init`}),` / `,(0,t.jsx)(n.code,{children:`tauri ios init`}),`).`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};