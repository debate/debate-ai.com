import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Topics & Video Statistics`},r=`# Topics & Video Statistics [#topics--video-statistics]

\`/practice/statistics\` \u2014 a standalone page combining the research-area topic
explorer, a searchable list of every season's debate resolutions, and the
YouTube channel view/upload charts that used to live only in a modal.

- **Route:** \`/practice/statistics\` (also \`/practice/statistics\`)
- **Package:** \`debate-videos\` (the areas explorer comes from \`debate-webview\`)

## What it shows [#what-it-shows]

Three sections, stacked, with Debate Topics by Year at the top:

- **Debate Topics by Year** (\`DebateTopicsExplorer\`) \u2014 a timeline
  (\`components/timeline/Timeline.tsx\`, adapted from the shadcn-space
  "timeline-02" block): a scrollable rail of every season, newest first,
  beside an animated pane for the selected year. The pane shows that year's
  Policy, College (NDT), LD and PF resolutions, each behind a style badge
  (LD and PF list each month's resolution with its short start month, such
  as "Sep" or "Nov", under the badge rather than in the resolution text),
  and \u2014 once \`/api/youtube-stats\` resolves \u2014 that year's video count, total
  views and average views from its \`byYear\` rows. Click a year, use the
  arrow / Home / End keys on the rail, or the up/down buttons beside it to
  scroll through every season; the selection survives filtering when the
  year is still shown. A search box filters by year or by resolution text. The data
  is the same \`topics\` field \`/api/videos/meta\` already returns for the video
  cards' topic tooltips (\`lib/debate-topics.ts\`'s formatters), passed down
  from \`LecturesPage\` rather than fetched again here. Every resolution is a
  link: clicking one opens the CARDS search (\`/research/cards\`) for that topic's short
  name, filtered to that season's year and that format (Policy \u2192 CX,
  College \u2192 NDT, LD, PF), listing every card, outline and round that matches.
- **Research Areas** (\`TopicAreasExplorer\`) \u2014 every NDT, Policy, LD and PF
  resolution since 2000, split into 44 focused research areas. Each format is
  its own collapsible panel with its own selection, so comparing an area's
  Policy history against its PF history is two clicks rather than a filter
  toggle that throws the first answer away. Within a panel the areas are
  ranked by resolution count as a bar chart; selecting one lists its
  resolutions newest first and draws its year-by-year trend line. The area
  assignments are heuristic research categories, not official NSDA or NDT
  classifications \u2014 the section says so in its footer.
  Above the format panels sits a **Next season** entry (\`NextSeasonPanel\`,
  e.g. "Next season \u00B7 2027\u201328"), shown before any of that season's
  resolutions are announced. It holds a poll \u2014 "Which topic area would you
  most like to debate next season?" It's ranked-choice: click up to five
  areas in order of preference (click again to remove one) and press
  **Submit ranking**. Each area scores Borda points \u2014 5 for a first choice
  down to 1 for a fifth \u2014 and the list is ordered by points, then first
  choices. Anyone can see the tally; voting needs a sign-in, and each user has
  one ballot per season that they can update at any time.
- **YouTube Channel Statistics** (\`YouTubeStatsCharts\`) \u2014 the top-channels
  table and the views/videos/avg-views-over-time charts \`YouTubeStatsModal\`
  already drew in its dialog, extracted so they can render inline on a full
  page instead. The four totals charts (views, videos and average views over
  time, and average views by elim round) are compact and sit four to a row on
  wide screens, two on tablets and one on phones. Backed by \`useYouTubeStats()\` (\`GET /api/youtube-stats\`,
  itself optional furniture \u2014 a deployment with no YouTube API key just
  leaves this section off rather than erroring).

Reachable from the sidebar tree's Practice section ("Topics & Video
Statistics", alongside Glossary and Rankings) and from the \`/videos\` quick-link
tile grid.

## Merged from two pages [#merged-from-two-pages]

This page absorbed the standalone **Debate Topics Explorer**, which lived at
\`/research/topics\`. That address now permanently redirects here. The two were
drawing on the same underlying resolutions \u2014 every entry in the areas
explorer's \`resolutions.json\` is the same resolution text as
\`debate-topics.json\`, filed under an added area tag \u2014 so one page now answers
"what has been debated, and in which research domain" and "how much of it is on
the channel" without crossing two routes to join the halves. The areas
explorer's sidebar row was removed from the Research section, where it would
otherwise have been a second entry for the same page.

The 44 area definitions stay in \`debate-webview\`
(\`lib/topic-areas/topic-areas.ts\`) rather than moving to \`debate-videos\`,
where this page renders: \`debate-videos\` depends on \`debate-webview\`, not the
reverse, so it cannot import the data. The host page mounts the explorer and
hands it down as a \`topicAreasSlot\` element, the same way \`dockSlot\` carries
the app dock into the video library.

## Data flow [#data-flow]

\`\`\`
panels/LecturesPage.tsx \u2014 currentCategory === "statistics" branch
  \u2192 panels/statistics/StatisticsPage.tsx
    \u2192 components/topic-explorer/DebateTopicsExplorer.tsx   (topics, youtubeStats.byYear)
      \u2192 components/timeline/Timeline.tsx
    \u2192 components/topic-explorer/TopicAreasExplorer.tsx
    \u2192 components/youtube-stats-modal/YouTubeStatsCharts.tsx (youtubeStats prop)
\`\`\`

\`StatisticsPage\` takes both as props rather than fetching them itself:
\`topics\` comes from the same \`useVideoMeta()\` call every other \`/videos\`
branch already makes, and \`youtubeStats\` from the same \`useYouTubeStats()\`
call \`LecturesVideoGridView\`'s own stats-modal button uses \u2014 so landing on
this page makes no request the rest of \`/videos\` wasn't already making.

## Known gaps [#known-gaps]

~~No per-style filter on the topics grid \u2014 search matches across every
style's text at once, there's no "Policy only" toggle.~~ **Fixed:**
\`DebateTopicsExplorer\` has an "All / Policy / College / LD / PF" filter
row above the search box (labels match the same \`DEBATE_STYLE_LABELS\` the
per-year badges already use \u2014 College here is the NDT resolution). Picking a style hides any year with no resolution
for that style, restricts the search box to that style's text (plus the year
itself), and shows only that style's badge in each remaining year's pane \u2014 "Policy
only" now works exactly as named. "All" restores the previous behavior.

The topic links search by the topic's short name (e.g. "Water"), not the
full resolution \u2014 the cards search is a substring match, so a whole
resolution sentence would match almost nothing. ~~Some older short names
in \`debate-topics.json\` were just the resolution's first two words
("All Young", "The United"), so those searches were broad.~~ **Fixed** for
the 2002\u20132009 PF topics, which now carry real short names ("National Service",
"War on Terror"). Other seasons' names may still need the same pass; the fix
is better names in the data, not in the link.

The next-season poll has no admin view or reset; ballots for a season stay in
\`topic_area_rankings\` after that season starts, and the panel simply moves on to
the following season in July (\`nextPollSeason\`).

## Topic-area poll internals [#topic-area-poll-internals]

- Shared rules: \`debate-videos\` \`lib/topic-areas/topic-area-poll.ts\` \u2014 which
  season is polled (\`nextPollSeason\`: July starts a new season, labelled by its
  spring year), ballot validation (\`parseVoteBody\`: 1\u20135 distinct known
  areas), Borda scoring (\`pointsForRank\`), option order and the two client
  calls.
- API: \`GET /api/topic-area-poll?season=\` (\`points\`, \`firstChoices\`, \`total\`
  ballots, plus \`myRanking\` when signed in) and \`PUT /api/topic-area-poll\`
  \`{ season, ranking }\` (401 signed out; only next season, and one to five
  distinct known areas).
- Storage: \`topic_area_rankings\`, primary key \`(season, user_id, rank)\` \u2014 one
  row per ranked area. A new ballot deletes the user's rows for the season and
  inserts the new ones in one batch. Declared in \`schema.ts\`, created by
  \`packages/debate-videos/migrations/0003_topic_area_rankings.sql\`, which also
  copies the old single-choice \`topic_area_votes\` rows in as first choices
  (that table is left in place, unread).
`,i={contents:[{heading:`topics--video-statistics`,content:`\`/practice/statistics\` \u2014 a standalone page combining the research-area topic
explorer, a searchable list of every season's debate resolutions, and the
YouTube channel view/upload charts that used to live only in a modal.`},{heading:`topics--video-statistics`,content:"**Route:** `/practice/statistics` (also `/practice/statistics`)"},{heading:`topics--video-statistics`,content:"**Package:** `debate-videos` (the areas explorer comes from `debate-webview`)"},{heading:`what-it-shows`,content:`Three sections, stacked, with Debate Topics by Year at the top:`},{heading:`what-it-shows`,content:`**Debate Topics by Year** (\`DebateTopicsExplorer\`) \u2014 a timeline
(\`components/timeline/Timeline.tsx\`, adapted from the shadcn-space
"timeline-02" block): a scrollable rail of every season, newest first,
beside an animated pane for the selected year. The pane shows that year's
Policy, College (NDT), LD and PF resolutions, each behind a style badge
(LD and PF list each month's resolution with its short start month, such
as "Sep" or "Nov", under the badge rather than in the resolution text),
and \u2014 once \`/api/youtube-stats\` resolves \u2014 that year's video count, total
views and average views from its \`byYear\` rows. Click a year, use the
arrow / Home / End keys on the rail, or the up/down buttons beside it to
scroll through every season; the selection survives filtering when the
year is still shown. A search box filters by year or by resolution text. The data
is the same \`topics\` field \`/api/videos/meta\` already returns for the video
cards' topic tooltips (\`lib/debate-topics.ts\`'s formatters), passed down
from \`LecturesPage\` rather than fetched again here. Every resolution is a
link: clicking one opens the CARDS search (\`/research/cards\`) for that topic's short
name, filtered to that season's year and that format (Policy \u2192 CX,
College \u2192 NDT, LD, PF), listing every card, outline and round that matches.`},{heading:`what-it-shows`,content:`**Research Areas** (\`TopicAreasExplorer\`) \u2014 every NDT, Policy, LD and PF
resolution since 2000, split into 44 focused research areas. Each format is
its own collapsible panel with its own selection, so comparing an area's
Policy history against its PF history is two clicks rather than a filter
toggle that throws the first answer away. Within a panel the areas are
ranked by resolution count as a bar chart; selecting one lists its
resolutions newest first and draws its year-by-year trend line. The area
assignments are heuristic research categories, not official NSDA or NDT
classifications \u2014 the section says so in its footer.
Above the format panels sits a **Next season** entry (\`NextSeasonPanel\`,
e.g. "Next season \u00B7 2027\u201328"), shown before any of that season's
resolutions are announced. It holds a poll \u2014 "Which topic area would you
most like to debate next season?" It's ranked-choice: click up to five
areas in order of preference (click again to remove one) and press
**Submit ranking**. Each area scores Borda points \u2014 5 for a first choice
down to 1 for a fifth \u2014 and the list is ordered by points, then first
choices. Anyone can see the tally; voting needs a sign-in, and each user has
one ballot per season that they can update at any time.`},{heading:`what-it-shows`,content:"**YouTube Channel Statistics** (`YouTubeStatsCharts`) \u2014 the top-channels\ntable and the views/videos/avg-views-over-time charts `YouTubeStatsModal`\nalready drew in its dialog, extracted so they can render inline on a full\npage instead. The four totals charts (views, videos and average views over\ntime, and average views by elim round) are compact and sit four to a row on\nwide screens, two on tablets and one on phones. Backed by `useYouTubeStats()` (`GET /api/youtube-stats`,\nitself optional furniture \u2014 a deployment with no YouTube API key just\nleaves this section off rather than erroring)."},{heading:`what-it-shows`,content:`Reachable from the sidebar tree's Practice section ("Topics & Video
Statistics", alongside Glossary and Rankings) and from the \`/videos\` quick-link
tile grid.`},{heading:`merged-from-two-pages`,content:`This page absorbed the standalone **Debate Topics Explorer**, which lived at
\`/research/topics\`. That address now permanently redirects here. The two were
drawing on the same underlying resolutions \u2014 every entry in the areas
explorer's \`resolutions.json\` is the same resolution text as
\`debate-topics.json\`, filed under an added area tag \u2014 so one page now answers
"what has been debated, and in which research domain" and "how much of it is on
the channel" without crossing two routes to join the halves. The areas
explorer's sidebar row was removed from the Research section, where it would
otherwise have been a second entry for the same page.`},{heading:`merged-from-two-pages`,content:"The 44 area definitions stay in `debate-webview`\n(`lib/topic-areas/topic-areas.ts`) rather than moving to `debate-videos`,\nwhere this page renders: `debate-videos` depends on `debate-webview`, not the\nreverse, so it cannot import the data. The host page mounts the explorer and\nhands it down as a `topicAreasSlot` element, the same way `dockSlot` carries\nthe app dock into the video library."},{heading:`data-flow`,content:"`StatisticsPage` takes both as props rather than fetching them itself:\n`topics` comes from the same `useVideoMeta()` call every other `/videos`\nbranch already makes, and `youtubeStats` from the same `useYouTubeStats()`\ncall `LecturesVideoGridView`'s own stats-modal button uses \u2014 so landing on\nthis page makes no request the rest of `/videos` wasn't already making."},{heading:`known-gaps`,content:`~~No per-style filter on the topics grid \u2014 search matches across every
style's text at once, there's no "Policy only" toggle.~~ **Fixed:**
\`DebateTopicsExplorer\` has an "All / Policy / College / LD / PF" filter
row above the search box (labels match the same \`DEBATE_STYLE_LABELS\` the
per-year badges already use \u2014 College here is the NDT resolution). Picking a style hides any year with no resolution
for that style, restricts the search box to that style's text (plus the year
itself), and shows only that style's badge in each remaining year's pane \u2014 "Policy
only" now works exactly as named. "All" restores the previous behavior.`},{heading:`known-gaps`,content:`The topic links search by the topic's short name (e.g. "Water"), not the
full resolution \u2014 the cards search is a substring match, so a whole
resolution sentence would match almost nothing. ~~Some older short names
in \`debate-topics.json\` were just the resolution's first two words
("All Young", "The United"), so those searches were broad.~~ **Fixed** for
the 2002\u20132009 PF topics, which now carry real short names ("National Service",
"War on Terror"). Other seasons' names may still need the same pass; the fix
is better names in the data, not in the link.`},{heading:`known-gaps`,content:"The next-season poll has no admin view or reset; ballots for a season stay in\n`topic_area_rankings` after that season starts, and the panel simply moves on to\nthe following season in July (`nextPollSeason`)."},{heading:`topic-area-poll-internals`,content:"Shared rules: `debate-videos` `lib/topic-areas/topic-area-poll.ts` \u2014 which\nseason is polled (`nextPollSeason`: July starts a new season, labelled by its\nspring year), ballot validation (`parseVoteBody`: 1\u20135 distinct known\nareas), Borda scoring (`pointsForRank`), option order and the two client\ncalls."},{heading:`topic-area-poll-internals`,content:"API: `GET /api/topic-area-poll?season=` (`points`, `firstChoices`, `total`\nballots, plus `myRanking` when signed in) and `PUT /api/topic-area-poll`\n`{ season, ranking }` (401 signed out; only next season, and one to five\ndistinct known areas)."},{heading:`topic-area-poll-internals`,content:"Storage: `topic_area_rankings`, primary key `(season, user_id, rank)` \u2014 one\nrow per ranked area. A new ballot deletes the user's rows for the season and\ninserts the new ones in one batch. Declared in `schema.ts`, created by\n`packages/debate-videos/migrations/0003_topic_area_rankings.sql`, which also\ncopies the old single-choice `topic_area_votes` rows in as first choices\n(that table is left in place, unread)."}],headings:[{id:`topics--video-statistics`,content:`Topics & Video Statistics`},{id:`what-it-shows`,content:`What it shows`},{id:`merged-from-two-pages`,content:`Merged from two pages`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`},{id:`topic-area-poll-internals`,content:`Topic-area poll internals`}]},a=[{depth:1,url:`#topics--video-statistics`,title:(0,t.jsx)(t.Fragment,{children:`Topics & Video Statistics`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#merged-from-two-pages`,title:(0,t.jsx)(t.Fragment,{children:`Merged from two pages`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})},{depth:2,url:`#topic-area-poll-internals`,title:(0,t.jsx)(t.Fragment,{children:`Topic-area poll internals`})}];function o(e){let n={code:`code`,del:`del`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`topics--video-statistics`,children:`Topics & Video Statistics`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/practice/statistics`}),` \u2014 a standalone page combining the research-area topic
explorer, a searchable list of every season's debate resolutions, and the
YouTube channel view/upload charts that used to live only in a modal.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/statistics`}),` (also `,(0,t.jsx)(n.code,{children:`/practice/statistics`}),`)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-videos`}),` (the areas explorer comes from `,(0,t.jsx)(n.code,{children:`debate-webview`}),`)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`Three sections, stacked, with Debate Topics by Year at the top:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Debate Topics by Year`}),` (`,(0,t.jsx)(n.code,{children:`DebateTopicsExplorer`}),`) \u2014 a timeline
(`,(0,t.jsx)(n.code,{children:`components/timeline/Timeline.tsx`}),`, adapted from the shadcn-space
"timeline-02" block): a scrollable rail of every season, newest first,
beside an animated pane for the selected year. The pane shows that year's
Policy, College (NDT), LD and PF resolutions, each behind a style badge
(LD and PF list each month's resolution with its short start month, such
as "Sep" or "Nov", under the badge rather than in the resolution text),
and \u2014 once `,(0,t.jsx)(n.code,{children:`/api/youtube-stats`}),` resolves \u2014 that year's video count, total
views and average views from its `,(0,t.jsx)(n.code,{children:`byYear`}),` rows. Click a year, use the
arrow / Home / End keys on the rail, or the up/down buttons beside it to
scroll through every season; the selection survives filtering when the
year is still shown. A search box filters by year or by resolution text. The data
is the same `,(0,t.jsx)(n.code,{children:`topics`}),` field `,(0,t.jsx)(n.code,{children:`/api/videos/meta`}),` already returns for the video
cards' topic tooltips (`,(0,t.jsx)(n.code,{children:`lib/debate-topics.ts`}),`'s formatters), passed down
from `,(0,t.jsx)(n.code,{children:`LecturesPage`}),` rather than fetched again here. Every resolution is a
link: clicking one opens the CARDS search (`,(0,t.jsx)(n.code,{children:`/research/cards`}),`) for that topic's short
name, filtered to that season's year and that format (Policy \u2192 CX,
College \u2192 NDT, LD, PF), listing every card, outline and round that matches.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Research Areas`}),` (`,(0,t.jsx)(n.code,{children:`TopicAreasExplorer`}),`) \u2014 every NDT, Policy, LD and PF
resolution since 2000, split into 44 focused research areas. Each format is
its own collapsible panel with its own selection, so comparing an area's
Policy history against its PF history is two clicks rather than a filter
toggle that throws the first answer away. Within a panel the areas are
ranked by resolution count as a bar chart; selecting one lists its
resolutions newest first and draws its year-by-year trend line. The area
assignments are heuristic research categories, not official NSDA or NDT
classifications \u2014 the section says so in its footer.
Above the format panels sits a `,(0,t.jsx)(n.strong,{children:`Next season`}),` entry (`,(0,t.jsx)(n.code,{children:`NextSeasonPanel`}),`,
e.g. "Next season \u00B7 2027\u201328"), shown before any of that season's
resolutions are announced. It holds a poll \u2014 "Which topic area would you
most like to debate next season?" It's ranked-choice: click up to five
areas in order of preference (click again to remove one) and press
`,(0,t.jsx)(n.strong,{children:`Submit ranking`}),`. Each area scores Borda points \u2014 5 for a first choice
down to 1 for a fifth \u2014 and the list is ordered by points, then first
choices. Anyone can see the tally; voting needs a sign-in, and each user has
one ballot per season that they can update at any time.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`YouTube Channel Statistics`}),` (`,(0,t.jsx)(n.code,{children:`YouTubeStatsCharts`}),`) \u2014 the top-channels
table and the views/videos/avg-views-over-time charts `,(0,t.jsx)(n.code,{children:`YouTubeStatsModal`}),`
already drew in its dialog, extracted so they can render inline on a full
page instead. The four totals charts (views, videos and average views over
time, and average views by elim round) are compact and sit four to a row on
wide screens, two on tablets and one on phones. Backed by `,(0,t.jsx)(n.code,{children:`useYouTubeStats()`}),` (`,(0,t.jsx)(n.code,{children:`GET /api/youtube-stats`}),`,
itself optional furniture \u2014 a deployment with no YouTube API key just
leaves this section off rather than erroring).`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`Reachable from the sidebar tree's Practice section ("Topics & Video
Statistics", alongside Glossary and Rankings) and from the `,(0,t.jsx)(n.code,{children:`/videos`}),` quick-link
tile grid.`]}),`
`,(0,t.jsx)(n.h2,{id:`merged-from-two-pages`,children:`Merged from two pages`}),`
`,(0,t.jsxs)(n.p,{children:[`This page absorbed the standalone `,(0,t.jsx)(n.strong,{children:`Debate Topics Explorer`}),`, which lived at
`,(0,t.jsx)(n.code,{children:`/research/topics`}),`. That address now permanently redirects here. The two were
drawing on the same underlying resolutions \u2014 every entry in the areas
explorer's `,(0,t.jsx)(n.code,{children:`resolutions.json`}),` is the same resolution text as
`,(0,t.jsx)(n.code,{children:`debate-topics.json`}),`, filed under an added area tag \u2014 so one page now answers
"what has been debated, and in which research domain" and "how much of it is on
the channel" without crossing two routes to join the halves. The areas
explorer's sidebar row was removed from the Research section, where it would
otherwise have been a second entry for the same page.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The 44 area definitions stay in `,(0,t.jsx)(n.code,{children:`debate-webview`}),`
(`,(0,t.jsx)(n.code,{children:`lib/topic-areas/topic-areas.ts`}),`) rather than moving to `,(0,t.jsx)(n.code,{children:`debate-videos`}),`,
where this page renders: `,(0,t.jsx)(n.code,{children:`debate-videos`}),` depends on `,(0,t.jsx)(n.code,{children:`debate-webview`}),`, not the
reverse, so it cannot import the data. The host page mounts the explorer and
hands it down as a `,(0,t.jsx)(n.code,{children:`topicAreasSlot`}),` element, the same way `,(0,t.jsx)(n.code,{children:`dockSlot`}),` carries
the app dock into the video library.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`panels/LecturesPage.tsx \u2014 currentCategory === "statistics" branch`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/statistics/StatisticsPage.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`    \u2192 components/topic-explorer/DebateTopicsExplorer.tsx   (topics, youtubeStats.byYear)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      \u2192 components/timeline/Timeline.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`    \u2192 components/topic-explorer/TopicAreasExplorer.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`    \u2192 components/youtube-stats-modal/YouTubeStatsCharts.tsx (youtubeStats prop)`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`StatisticsPage`}),` takes both as props rather than fetching them itself:
`,(0,t.jsx)(n.code,{children:`topics`}),` comes from the same `,(0,t.jsx)(n.code,{children:`useVideoMeta()`}),` call every other `,(0,t.jsx)(n.code,{children:`/videos`}),`
branch already makes, and `,(0,t.jsx)(n.code,{children:`youtubeStats`}),` from the same `,(0,t.jsx)(n.code,{children:`useYouTubeStats()`}),`
call `,(0,t.jsx)(n.code,{children:`LecturesVideoGridView`}),`'s own stats-modal button uses \u2014 so landing on
this page makes no request the rest of `,(0,t.jsx)(n.code,{children:`/videos`}),` wasn't already making.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.del,{children:`No per-style filter on the topics grid \u2014 search matches across every
style's text at once, there's no "Policy only" toggle.`}),` `,(0,t.jsx)(n.strong,{children:`Fixed:`}),`
`,(0,t.jsx)(n.code,{children:`DebateTopicsExplorer`}),` has an "All / Policy / College / LD / PF" filter
row above the search box (labels match the same `,(0,t.jsx)(n.code,{children:`DEBATE_STYLE_LABELS`}),` the
per-year badges already use \u2014 College here is the NDT resolution). Picking a style hides any year with no resolution
for that style, restricts the search box to that style's text (plus the year
itself), and shows only that style's badge in each remaining year's pane \u2014 "Policy
only" now works exactly as named. "All" restores the previous behavior.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The topic links search by the topic's short name (e.g. "Water"), not the
full resolution \u2014 the cards search is a substring match, so a whole
resolution sentence would match almost nothing. `,(0,t.jsxs)(n.del,{children:[`Some older short names
in `,(0,t.jsx)(n.code,{children:`debate-topics.json`}),` were just the resolution's first two words
("All Young", "The United"), so those searches were broad.`]}),` `,(0,t.jsx)(n.strong,{children:`Fixed`}),` for
the 2002\u20132009 PF topics, which now carry real short names ("National Service",
"War on Terror"). Other seasons' names may still need the same pass; the fix
is better names in the data, not in the link.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The next-season poll has no admin view or reset; ballots for a season stay in
`,(0,t.jsx)(n.code,{children:`topic_area_rankings`}),` after that season starts, and the panel simply moves on to
the following season in July (`,(0,t.jsx)(n.code,{children:`nextPollSeason`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`topic-area-poll-internals`,children:`Topic-area poll internals`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`Shared rules: `,(0,t.jsx)(n.code,{children:`debate-videos`}),` `,(0,t.jsx)(n.code,{children:`lib/topic-areas/topic-area-poll.ts`}),` \u2014 which
season is polled (`,(0,t.jsx)(n.code,{children:`nextPollSeason`}),`: July starts a new season, labelled by its
spring year), ballot validation (`,(0,t.jsx)(n.code,{children:`parseVoteBody`}),`: 1\u20135 distinct known
areas), Borda scoring (`,(0,t.jsx)(n.code,{children:`pointsForRank`}),`), option order and the two client
calls.`]}),`
`,(0,t.jsxs)(n.li,{children:[`API: `,(0,t.jsx)(n.code,{children:`GET /api/topic-area-poll?season=`}),` (`,(0,t.jsx)(n.code,{children:`points`}),`, `,(0,t.jsx)(n.code,{children:`firstChoices`}),`, `,(0,t.jsx)(n.code,{children:`total`}),`
ballots, plus `,(0,t.jsx)(n.code,{children:`myRanking`}),` when signed in) and `,(0,t.jsx)(n.code,{children:`PUT /api/topic-area-poll`}),`
`,(0,t.jsx)(n.code,{children:`{ season, ranking }`}),` (401 signed out; only next season, and one to five
distinct known areas).`]}),`
`,(0,t.jsxs)(n.li,{children:[`Storage: `,(0,t.jsx)(n.code,{children:`topic_area_rankings`}),`, primary key `,(0,t.jsx)(n.code,{children:`(season, user_id, rank)`}),` \u2014 one
row per ranked area. A new ballot deletes the user's rows for the season and
inserts the new ones in one batch. Declared in `,(0,t.jsx)(n.code,{children:`schema.ts`}),`, created by
`,(0,t.jsx)(n.code,{children:`packages/debate-videos/migrations/0003_topic_area_rankings.sql`}),`, which also
copies the old single-choice `,(0,t.jsx)(n.code,{children:`topic_area_votes`}),` rows in as first choices
(that table is left in place, unread).`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};