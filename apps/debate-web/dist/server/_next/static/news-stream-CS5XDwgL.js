import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`News & Forums`},r=`# News & Forums [#news--forums]

One page for what's new in the community, so a debater doesn't have to
separately check several pages. It has two tabs: **News**, the feed of
product updates and community announcements, and **Forums**, the
discussion threads. It is the "News & Forums" row in the sidebar's
Coaching section.

- **Route:** \`/news\` (News tab), \`/news?section=forums\` (Forums tab)
- **Old address:** \`/practice/forums\` redirects to the Forums tab. A
  single thread still opens at \`/practice/forums/<id>\`, and the sidebar
  keeps the News & Forums row highlighted there.
- **Package:** \`debate-card-search\`

## Forums [#forums]

Anyone signed in can open a thread from the form at the top of the tab.
The list below it shows every thread, ordered by when each was last
posted to, so the live discussion is on top. Opening a thread shows its
replies; its back link returns to the Forums tab.

## What the News tab shows [#what-the-news-tab-shows]

Every item, newest first, filterable by category: **Product Updates**
(hand-maintained, plus auto-generated "Tool spotlight" posts for every
cataloged feature), **Daily Best Card**, **Contributor Awards**, and five
**Community** sources \u2014 Quest Streak milestones, Group Challenge
completions, Revision Incentives' daily top reviser, Team Collaboration
Mode prep notes, new Argument Library submissions, and new AI Coach Mode
sessions. Each item can be liked and is marked read on hover.

**Following** shows updates from the teams and schools the reader follows
from their profile pages: new rounds, new caselist research, tournament
results and monthly recaps (see
[Team Rankings](/docs/features/team-collaboration/team-rankings#following-a-team-or-school)).
The followed profiles are listed above the feed. These items are fetched
after the page loads, so the panel rebuilds when the set of extra item ids
changes.

## Data flow [#data-flow]

\`\`\`
lib/news-stream.ts        \u2014 NewsItem type, PRODUCT_NEWS, buildAutoFeatureNews()
state/newsStream.ts        \u2014 buildNewsFeed(extraItems?) merges every source
@debate/videos useFollowingNews() \u2014 "following" items, passed in as extraItems
panels/NewsStreamPanel.tsx \u2014 category filter tabs, read/like UI
\`\`\`

Read/like state is account-synced via \`/api/settings\` as a union merge, not
a full two-way sync.

## Known gaps [#known-gaps]

~~Unliking on one device doesn't clear the like on another device until that
device's own next toggle overwrites the account row.~~ **Fixed:**
\`mergeRemoteViewerState\` (\`state/newsStream.ts\`) now tracks
\`lastSyncedRemoteLiked\` \u2014 this browser's own account row as of its last
successful hydrate \u2014 alongside the local liked set. On the next hydrate (a
page load/reload; hydrate still only runs once per mount, not live), an id
that was part of that last-known-synced snapshot but is missing from the
fresh fetch was confirmed liked before and confirmed unliked since, so it's
now cleared locally too. A like this browser made but hasn't pushed yet (or
whose push failed) was never part of a synced snapshot, so reconciliation
leaves it untouched \u2014 it still survives a merge exactly as before. Read
state is unaffected: there's no "unread" op, so it stays a pure union.
`,i={contents:[{heading:`news--forums`,content:`One page for what's new in the community, so a debater doesn't have to
separately check several pages. It has two tabs: **News**, the feed of
product updates and community announcements, and **Forums**, the
discussion threads. It is the "News & Forums" row in the sidebar's
Coaching section.`},{heading:`news--forums`,content:"**Route:** `/news` (News tab), `/news?section=forums` (Forums tab)"},{heading:`news--forums`,content:"**Old address:** `/practice/forums` redirects to the Forums tab. A\nsingle thread still opens at `/practice/forums/<id>`, and the sidebar\nkeeps the News & Forums row highlighted there."},{heading:`news--forums`,content:"**Package:** `debate-card-search`"},{heading:`forums`,content:`Anyone signed in can open a thread from the form at the top of the tab.
The list below it shows every thread, ordered by when each was last
posted to, so the live discussion is on top. Opening a thread shows its
replies; its back link returns to the Forums tab.`},{heading:`what-the-news-tab-shows`,content:`Every item, newest first, filterable by category: **Product Updates**
(hand-maintained, plus auto-generated "Tool spotlight" posts for every
cataloged feature), **Daily Best Card**, **Contributor Awards**, and five
**Community** sources \u2014 Quest Streak milestones, Group Challenge
completions, Revision Incentives' daily top reviser, Team Collaboration
Mode prep notes, new Argument Library submissions, and new AI Coach Mode
sessions. Each item can be liked and is marked read on hover.`},{heading:`what-the-news-tab-shows`,content:`**Following** shows updates from the teams and schools the reader follows
from their profile pages: new rounds, new caselist research, tournament
results and monthly recaps (see
Team Rankings).
The followed profiles are listed above the feed. These items are fetched
after the page loads, so the panel rebuilds when the set of extra item ids
changes.`},{heading:`data-flow`,content:"Read/like state is account-synced via `/api/settings` as a union merge, not\na full two-way sync."},{heading:`known-gaps`,content:`~~Unliking on one device doesn't clear the like on another device until that
device's own next toggle overwrites the account row.~~ **Fixed:**
\`mergeRemoteViewerState\` (\`state/newsStream.ts\`) now tracks
\`lastSyncedRemoteLiked\` \u2014 this browser's own account row as of its last
successful hydrate \u2014 alongside the local liked set. On the next hydrate (a
page load/reload; hydrate still only runs once per mount, not live), an id
that was part of that last-known-synced snapshot but is missing from the
fresh fetch was confirmed liked before and confirmed unliked since, so it's
now cleared locally too. A like this browser made but hasn't pushed yet (or
whose push failed) was never part of a synced snapshot, so reconciliation
leaves it untouched \u2014 it still survives a merge exactly as before. Read
state is unaffected: there's no "unread" op, so it stays a pure union.`}],headings:[{id:`news--forums`,content:`News & Forums`},{id:`forums`,content:`Forums`},{id:`what-the-news-tab-shows`,content:`What the News tab shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#news--forums`,title:(0,t.jsx)(t.Fragment,{children:`News & Forums`})},{depth:2,url:`#forums`,title:(0,t.jsx)(t.Fragment,{children:`Forums`})},{depth:2,url:`#what-the-news-tab-shows`,title:(0,t.jsx)(t.Fragment,{children:`What the News tab shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,del:`del`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`news--forums`,children:`News & Forums`}),`
`,(0,t.jsxs)(n.p,{children:[`One page for what's new in the community, so a debater doesn't have to
separately check several pages. It has two tabs: `,(0,t.jsx)(n.strong,{children:`News`}),`, the feed of
product updates and community announcements, and `,(0,t.jsx)(n.strong,{children:`Forums`}),`, the
discussion threads. It is the "News & Forums" row in the sidebar's
Coaching section.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/news`}),` (News tab), `,(0,t.jsx)(n.code,{children:`/news?section=forums`}),` (Forums tab)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Old address:`}),` `,(0,t.jsx)(n.code,{children:`/practice/forums`}),` redirects to the Forums tab. A
single thread still opens at `,(0,t.jsx)(n.code,{children:`/practice/forums/<id>`}),`, and the sidebar
keeps the News & Forums row highlighted there.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`forums`,children:`Forums`}),`
`,(0,t.jsx)(n.p,{children:`Anyone signed in can open a thread from the form at the top of the tab.
The list below it shows every thread, ordered by when each was last
posted to, so the live discussion is on top. Opening a thread shows its
replies; its back link returns to the Forums tab.`}),`
`,(0,t.jsx)(n.h2,{id:`what-the-news-tab-shows`,children:`What the News tab shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Every item, newest first, filterable by category: `,(0,t.jsx)(n.strong,{children:`Product Updates`}),`
(hand-maintained, plus auto-generated "Tool spotlight" posts for every
cataloged feature), `,(0,t.jsx)(n.strong,{children:`Daily Best Card`}),`, `,(0,t.jsx)(n.strong,{children:`Contributor Awards`}),`, and five
`,(0,t.jsx)(n.strong,{children:`Community`}),` sources \u2014 Quest Streak milestones, Group Challenge
completions, Revision Incentives' daily top reviser, Team Collaboration
Mode prep notes, new Argument Library submissions, and new AI Coach Mode
sessions. Each item can be liked and is marked read on hover.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Following`}),` shows updates from the teams and schools the reader follows
from their profile pages: new rounds, new caselist research, tournament
results and monthly recaps (see
`,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/team-rankings#following-a-team-or-school`,children:`Team Rankings`}),`).
The followed profiles are listed above the feed. These items are fetched
after the page loads, so the panel rebuilds when the set of extra item ids
changes.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`lib/news-stream.ts        \u2014 NewsItem type, PRODUCT_NEWS, buildAutoFeatureNews()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/newsStream.ts        \u2014 buildNewsFeed(extraItems?) merges every source`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`@debate/videos useFollowingNews() \u2014 "following" items, passed in as extraItems`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`panels/NewsStreamPanel.tsx \u2014 category filter tabs, read/like UI`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`Read/like state is account-synced via `,(0,t.jsx)(n.code,{children:`/api/settings`}),` as a union merge, not
a full two-way sync.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.del,{children:`Unliking on one device doesn't clear the like on another device until that
device's own next toggle overwrites the account row.`}),` `,(0,t.jsx)(n.strong,{children:`Fixed:`}),`
`,(0,t.jsx)(n.code,{children:`mergeRemoteViewerState`}),` (`,(0,t.jsx)(n.code,{children:`state/newsStream.ts`}),`) now tracks
`,(0,t.jsx)(n.code,{children:`lastSyncedRemoteLiked`}),` \u2014 this browser's own account row as of its last
successful hydrate \u2014 alongside the local liked set. On the next hydrate (a
page load/reload; hydrate still only runs once per mount, not live), an id
that was part of that last-known-synced snapshot but is missing from the
fresh fetch was confirmed liked before and confirmed unliked since, so it's
now cleared locally too. A like this browser made but hasn't pushed yet (or
whose push failed) was never part of a synced snapshot, so reconciliation
leaves it untouched \u2014 it still survives a merge exactly as before. Read
state is unaffected: there's no "unread" op, so it stays a pure union.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};