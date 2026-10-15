import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Browser Extension: Reading Mode and Search`},r=`# Browser Extension: Reading Mode and Search [#browser-extension-reading-mode-and-search]

Two tools the Debate AI browser extension adds to every web page you open.

- **Extension:** \`apps/debate-browser-ext\` (the \`page-tools\` content script)
- **Settings:** Settings \u2192 **Browser extension**, on the extension's Options page

## Reading-mode arrow [#reading-mode-arrow]

When a page holds an article of more than 1000 words, a small, half-transparent
arrow appears on the far left edge of the page. Click it to open the article in
the extension's reading mode, with the AI panel beside it. Pages without an
article (search results, feeds, apps, short pages) never show the arrow.

The check runs in your browser: a quick word count first, then the same
reading-mode extractor the article panel uses, so navigation, comments and
footers don't count toward the 1000 words. No page text is sent anywhere to
decide.

## YouTube, PDFs and pages that won't read [#youtube-pdfs-and-pages-that-wont-read]

Reading mode works on more than articles:

- **YouTube videos** open as their transcript, split into paragraphs that each
  start with a timestamp linking to that moment in the video. The arrow also
  shows on every YouTube video page.
- **PDFs** open in reading mode in a new tab, since the browser's PDF viewer
  has no page to put the panel on.
- **Any other page** the extension can't find an article in is tried once more
  by its address.

For these, the page's address (only the address, and only when you open
reading mode) is sent to Debate AI's transcript service for YouTube and to the
QwkSearch extract-webpage service for everything else.

## Backtick search [#backtick-search]

Select text on any page and press the key under Escape (\`\` \` \`\` / \`~\`). A
search menu opens next to the selection with every search engine the extension
supports: Quick search, Debate AI cards, Google, Google Scholar, Google News,
Bing, DuckDuckGo, Brave Search, Wikipedia and YouTube. Quick search is selected,
so pressing Enter searches it straight away; arrow keys pick another engine and
Escape closes the menu. Results open in a new tab. The key still types a
backtick in text fields and editors.

## Settings and AI key [#settings-and-ai-key]

The extension has no settings screen or API keys of its own. Its settings
(reading-mode arrow, search shortcut, round timer, toolbar icon, card reuse
check) are the **Browser extension** tab of the app's Settings page. The article
panel's AI uses the OpenRouter or Anthropic key saved under Settings \u2192
Preferences \u2192 **Your own AI key**, or your Debate AI account when no key is
saved.

## Known gaps [#known-gaps]

- The AI key is reused from the extension's own copy of the app (its Options
  page). A key saved only on debate-ai.com in a normal tab is not visible to the
  extension; save it once from the Options page.
- A video with no captions has no transcript to read.
- Running on every page means the extension now asks for access to all
  http(s) sites when installed.
`,i={contents:[{heading:`browser-extension-reading-mode-and-search`,content:`Two tools the Debate AI browser extension adds to every web page you open.`},{heading:`browser-extension-reading-mode-and-search`,content:"**Extension:** `apps/debate-browser-ext` (the `page-tools` content script)"},{heading:`browser-extension-reading-mode-and-search`,content:`**Settings:** Settings \u2192 **Browser extension**, on the extension's Options page`},{heading:`reading-mode-arrow`,content:`When a page holds an article of more than 1000 words, a small, half-transparent
arrow appears on the far left edge of the page. Click it to open the article in
the extension's reading mode, with the AI panel beside it. Pages without an
article (search results, feeds, apps, short pages) never show the arrow.`},{heading:`reading-mode-arrow`,content:`The check runs in your browser: a quick word count first, then the same
reading-mode extractor the article panel uses, so navigation, comments and
footers don't count toward the 1000 words. No page text is sent anywhere to
decide.`},{heading:`youtube-pdfs-and-pages-that-wont-read`,content:`Reading mode works on more than articles:`},{heading:`youtube-pdfs-and-pages-that-wont-read`,content:`**YouTube videos** open as their transcript, split into paragraphs that each
start with a timestamp linking to that moment in the video. The arrow also
shows on every YouTube video page.`},{heading:`youtube-pdfs-and-pages-that-wont-read`,content:`**PDFs** open in reading mode in a new tab, since the browser's PDF viewer
has no page to put the panel on.`},{heading:`youtube-pdfs-and-pages-that-wont-read`,content:`**Any other page** the extension can't find an article in is tried once more
by its address.`},{heading:`youtube-pdfs-and-pages-that-wont-read`,content:`For these, the page's address (only the address, and only when you open
reading mode) is sent to Debate AI's transcript service for YouTube and to the
QwkSearch extract-webpage service for everything else.`},{heading:`backtick-search`,content:"Select text on any page and press the key under Escape (`` ` `` / `~`). A\nsearch menu opens next to the selection with every search engine the extension\nsupports: Quick search, Debate AI cards, Google, Google Scholar, Google News,\nBing, DuckDuckGo, Brave Search, Wikipedia and YouTube. Quick search is selected,\nso pressing Enter searches it straight away; arrow keys pick another engine and\nEscape closes the menu. Results open in a new tab. The key still types a\nbacktick in text fields and editors."},{heading:`settings-and-ai-key`,content:`The extension has no settings screen or API keys of its own. Its settings
(reading-mode arrow, search shortcut, round timer, toolbar icon, card reuse
check) are the **Browser extension** tab of the app's Settings page. The article
panel's AI uses the OpenRouter or Anthropic key saved under Settings \u2192
Preferences \u2192 **Your own AI key**, or your Debate AI account when no key is
saved.`},{heading:`known-gaps`,content:`The AI key is reused from the extension's own copy of the app (its Options
page). A key saved only on debate-ai.com in a normal tab is not visible to the
extension; save it once from the Options page.`},{heading:`known-gaps`,content:`A video with no captions has no transcript to read.`},{heading:`known-gaps`,content:`Running on every page means the extension now asks for access to all
http(s) sites when installed.`}],headings:[{id:`browser-extension-reading-mode-and-search`,content:`Browser Extension: Reading Mode and Search`},{id:`reading-mode-arrow`,content:`Reading-mode arrow`},{id:`youtube-pdfs-and-pages-that-wont-read`,content:`YouTube, PDFs and pages that won't read`},{id:`backtick-search`,content:`Backtick search`},{id:`settings-and-ai-key`,content:`Settings and AI key`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#browser-extension-reading-mode-and-search`,title:(0,t.jsx)(t.Fragment,{children:`Browser Extension: Reading Mode and Search`})},{depth:2,url:`#reading-mode-arrow`,title:(0,t.jsx)(t.Fragment,{children:`Reading-mode arrow`})},{depth:2,url:`#youtube-pdfs-and-pages-that-wont-read`,title:(0,t.jsx)(t.Fragment,{children:`YouTube, PDFs and pages that won't read`})},{depth:2,url:`#backtick-search`,title:(0,t.jsx)(t.Fragment,{children:`Backtick search`})},{depth:2,url:`#settings-and-ai-key`,title:(0,t.jsx)(t.Fragment,{children:`Settings and AI key`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`browser-extension-reading-mode-and-search`,children:`Browser Extension: Reading Mode and Search`}),`
`,(0,t.jsx)(n.p,{children:`Two tools the Debate AI browser extension adds to every web page you open.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Extension:`}),` `,(0,t.jsx)(n.code,{children:`apps/debate-browser-ext`}),` (the `,(0,t.jsx)(n.code,{children:`page-tools`}),` content script)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Settings:`}),` Settings \u2192 `,(0,t.jsx)(n.strong,{children:`Browser extension`}),`, on the extension's Options page`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`reading-mode-arrow`,children:`Reading-mode arrow`}),`
`,(0,t.jsx)(n.p,{children:`When a page holds an article of more than 1000 words, a small, half-transparent
arrow appears on the far left edge of the page. Click it to open the article in
the extension's reading mode, with the AI panel beside it. Pages without an
article (search results, feeds, apps, short pages) never show the arrow.`}),`
`,(0,t.jsx)(n.p,{children:`The check runs in your browser: a quick word count first, then the same
reading-mode extractor the article panel uses, so navigation, comments and
footers don't count toward the 1000 words. No page text is sent anywhere to
decide.`}),`
`,(0,t.jsx)(n.h2,{id:`youtube-pdfs-and-pages-that-wont-read`,children:`YouTube, PDFs and pages that won't read`}),`
`,(0,t.jsx)(n.p,{children:`Reading mode works on more than articles:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`YouTube videos`}),` open as their transcript, split into paragraphs that each
start with a timestamp linking to that moment in the video. The arrow also
shows on every YouTube video page.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`PDFs`}),` open in reading mode in a new tab, since the browser's PDF viewer
has no page to put the panel on.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Any other page`}),` the extension can't find an article in is tried once more
by its address.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`For these, the page's address (only the address, and only when you open
reading mode) is sent to Debate AI's transcript service for YouTube and to the
QwkSearch extract-webpage service for everything else.`}),`
`,(0,t.jsx)(n.h2,{id:`backtick-search`,children:`Backtick search`}),`
`,(0,t.jsxs)(n.p,{children:[`Select text on any page and press the key under Escape (`,(0,t.jsx)(n.code,{children:"`"}),` / `,(0,t.jsx)(n.code,{children:`~`}),`). A
search menu opens next to the selection with every search engine the extension
supports: Quick search, Debate AI cards, Google, Google Scholar, Google News,
Bing, DuckDuckGo, Brave Search, Wikipedia and YouTube. Quick search is selected,
so pressing Enter searches it straight away; arrow keys pick another engine and
Escape closes the menu. Results open in a new tab. The key still types a
backtick in text fields and editors.`]}),`
`,(0,t.jsx)(n.h2,{id:`settings-and-ai-key`,children:`Settings and AI key`}),`
`,(0,t.jsxs)(n.p,{children:[`The extension has no settings screen or API keys of its own. Its settings
(reading-mode arrow, search shortcut, round timer, toolbar icon, card reuse
check) are the `,(0,t.jsx)(n.strong,{children:`Browser extension`}),` tab of the app's Settings page. The article
panel's AI uses the OpenRouter or Anthropic key saved under Settings \u2192
Preferences \u2192 `,(0,t.jsx)(n.strong,{children:`Your own AI key`}),`, or your Debate AI account when no key is
saved.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`The AI key is reused from the extension's own copy of the app (its Options
page). A key saved only on debate-ai.com in a normal tab is not visible to the
extension; save it once from the Options page.`}),`
`,(0,t.jsx)(n.li,{children:`A video with no captions has no transcript to read.`}),`
`,(0,t.jsx)(n.li,{children:`Running on every page means the extension now asks for access to all
http(s) sites when installed.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};