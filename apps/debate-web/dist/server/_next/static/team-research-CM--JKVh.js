import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Team Research`},r=`# Team Research [#team-research]

One page for working a topic with your squad. Six research collaboration
tools sit side by side, one tab each, as part of the
[Research Workspace](/docs/features/research-evidence/research-collaboration):

| Tab | \`?section=\` | What it does |
| --- | --- | --- |
| [Topic Coverage](/docs/features/research-evidence/topic-coverage-dashboard) | \`coverage\` | Which arguments are well-covered, thin, or missing, by card count and word count. |
| [Prep Room](/docs/features/team-collaboration/collaboration-prep-room) | \`prep-room\` | A topic's shared prep space: its evidence, draft blocks, and routed research tasks. |
| [Review Queue](/docs/features/team-collaboration/review-queue) | \`reviews\` | Move a submitted card through peer review: comment, request changes, approve, and publish. |
| [Task Inbox](/docs/features/team-collaboration/task-inbox) | \`inbox\` | Research tasks routed to contributors by skill level, grouped by topic, with peer verification. |
| [Contributions](/docs/features/team-collaboration/contributions-feed) | \`contributions\` | Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations. |
| [Brainstorm](/docs/features/research-evidence/brainstorm-board) | \`brainstorm\` | Submit and upvote squad ideas for an argument block, grouped into boards by category. |

- **Route:** \`/research/team\`, listed in the sidebar's **Research** section
  under the Research Workspace
- **Package:** \`debate-webview\` (\`components/research/TeamResearchWorkspace.tsx\`)
  over panels from \`debate-research-evidence\`, \`debate-team-collaboration\`
  and \`debate-community\`

## Old addresses [#old-addresses]

Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:

| Old route | Now |
| --- | --- |
| \`/research/cards/coverage\` | \`/research/team?section=coverage\` |
| \`/research/cards/prep-room\` | \`/research/team?section=prep-room\` |
| \`/research/cards/reviews\` | \`/research/team?section=reviews\` |
| \`/research/cards/inbox\` | \`/research/team?section=inbox\` |
| \`/research/cards/contributions\` | \`/research/team?section=contributions\` |
| \`/research/cards/brainstorm\` | \`/research/team?section=brainstorm\` |

## How it works [#how-it-works]

The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so coverage
snapshots, prep-room checklists, reviews, routed tasks, contributions and
brainstorm ideas carry over unchanged and keep syncing to your account. The
open tab is kept in \`?section=\` (so a tab can be shared or bookmarked) and
remembered in this browser for the next visit. The tab strip is the
Research, Coach and Prep workspaces' own (\`components/hubs/HubSectionNav.tsx\`).

The Research Workspace (\`/research\`) still mounts these panels inside its
own stage-by-stage sections; its "open as its own page" chips for them now
lead to the matching Team Research tab.

Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.

## Known gaps [#known-gaps]

- Opening a saved record from the Tools page's recent-items list lands on
  the Team Research page's last-opened tab, not on the record itself.
`,i={contents:[{heading:`team-research`,content:`One page for working a topic with your squad. Six research collaboration
tools sit side by side, one tab each, as part of the
Research Workspace:`},{heading:`team-research`,content:"| Tab            | `?section=` | What it does                                                                      |\n| -------------- | ----------- | --------------------------------------------------------------------------------- |\n| Topic Coverage | `coverage`  | Which arguments are well-covered, thin, or missing, by card count and word count. |",table:`table-0`},{heading:`team-research`,content:"| Tab       | `?section=` | What it does                                                                        |\n| --------- | ----------- | ----------------------------------------------------------------------------------- |\n| Prep Room | `prep-room` | A topic's shared prep space: its evidence, draft blocks, and routed research tasks. |",table:`table-0`},{heading:`team-research`,content:"| Tab          | `?section=` | What it does                                                                               |\n| ------------ | ----------- | ------------------------------------------------------------------------------------------ |\n| Review Queue | `reviews`   | Move a submitted card through peer review: comment, request changes, approve, and publish. |",table:`table-0`},{heading:`team-research`,content:"| Tab        | `?section=` | What it does                                                                                    |\n| ---------- | ----------- | ----------------------------------------------------------------------------------------------- |\n| Task Inbox | `inbox`     | Research tasks routed to contributors by skill level, grouped by topic, with peer verification. |",table:`table-0`},{heading:`team-research`,content:"| Tab           | `?section=`     | What it does                                                                                   |\n| ------------- | --------------- | ---------------------------------------------------------------------------------------------- |\n| Contributions | `contributions` | Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations. |",table:`table-0`},{heading:`team-research`,content:"| Tab        | `?section=`  | What it does                                                                          |\n| ---------- | ------------ | ------------------------------------------------------------------------------------- |\n| Brainstorm | `brainstorm` | Submit and upvote squad ideas for an argument block, grouped into boards by category. |",table:`table-0`},{heading:`team-research`,content:"**Route:** `/research/team`, listed in the sidebar's **Research** section\nunder the Research Workspace"},{heading:`team-research`,content:"**Package:** `debate-webview` (`components/research/TeamResearchWorkspace.tsx`)\nover panels from `debate-research-evidence`, `debate-team-collaboration`\nand `debate-community`"},{heading:`old-addresses`,content:`Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:`},{heading:`old-addresses`,content:"| Old route                  | Now                               |\n| -------------------------- | --------------------------------- |\n| `/research/cards/coverage` | `/research/team?section=coverage` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route                   | Now                                |\n| --------------------------- | ---------------------------------- |\n| `/research/cards/prep-room` | `/research/team?section=prep-room` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route                 | Now                              |\n| ------------------------- | -------------------------------- |\n| `/research/cards/reviews` | `/research/team?section=reviews` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route               | Now                            |\n| ----------------------- | ------------------------------ |\n| `/research/cards/inbox` | `/research/team?section=inbox` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route                       | Now                                    |\n| ------------------------------- | -------------------------------------- |\n| `/research/cards/contributions` | `/research/team?section=contributions` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route                    | Now                                 |\n| ---------------------------- | ----------------------------------- |\n| `/research/cards/brainstorm` | `/research/team?section=brainstorm` |",table:`table-1`},{heading:`how-it-works`,content:`The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so coverage
snapshots, prep-room checklists, reviews, routed tasks, contributions and
brainstorm ideas carry over unchanged and keep syncing to your account. The
open tab is kept in \`?section=\` (so a tab can be shared or bookmarked) and
remembered in this browser for the next visit. The tab strip is the
Research, Coach and Prep workspaces' own (\`components/hubs/HubSectionNav.tsx\`).`},{heading:`how-it-works`,content:`The Research Workspace (\`/research\`) still mounts these panels inside its
own stage-by-stage sections; its "open as its own page" chips for them now
lead to the matching Team Research tab.`},{heading:`how-it-works`,content:`Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.`},{heading:`known-gaps`,content:`Opening a saved record from the Tools page's recent-items list lands on
the Team Research page's last-opened tab, not on the record itself.`}],headings:[{id:`team-research`,content:`Team Research`},{id:`old-addresses`,content:`Old addresses`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#team-research`,title:(0,t.jsx)(t.Fragment,{children:`Team Research`})},{depth:2,url:`#old-addresses`,title:(0,t.jsx)(t.Fragment,{children:`Old addresses`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`team-research`,children:`Team Research`}),`
`,(0,t.jsxs)(n.p,{children:[`One page for working a topic with your squad. Six research collaboration
tools sit side by side, one tab each, as part of the
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/research-collaboration`,children:`Research Workspace`}),`:`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tab`}),(0,t.jsx)(n.th,{children:(0,t.jsx)(n.code,{children:`?section=`})}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/topic-coverage-dashboard`,children:`Topic Coverage`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`coverage`})}),(0,t.jsx)(n.td,{children:`Which arguments are well-covered, thin, or missing, by card count and word count.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/collaboration-prep-room`,children:`Prep Room`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`prep-room`})}),(0,t.jsx)(n.td,{children:`A topic's shared prep space: its evidence, draft blocks, and routed research tasks.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/review-queue`,children:`Review Queue`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`reviews`})}),(0,t.jsx)(n.td,{children:`Move a submitted card through peer review: comment, request changes, approve, and publish.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/task-inbox`,children:`Task Inbox`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`inbox`})}),(0,t.jsx)(n.td,{children:`Research tasks routed to contributors by skill level, grouped by topic, with peer verification.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/contributions-feed`,children:`Contributions`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`contributions`})}),(0,t.jsx)(n.td,{children:`Submit, like, save, and endorse the community's cards, summaries, highlights, and annotations.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/brainstorm-board`,children:`Brainstorm`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`brainstorm`})}),(0,t.jsx)(n.td,{children:`Submit and upvote squad ideas for an argument block, grouped into boards by category.`})]})]})]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/team`}),`, listed in the sidebar's `,(0,t.jsx)(n.strong,{children:`Research`}),` section
under the Research Workspace`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-webview`}),` (`,(0,t.jsx)(n.code,{children:`components/research/TeamResearchWorkspace.tsx`}),`)
over panels from `,(0,t.jsx)(n.code,{children:`debate-research-evidence`}),`, `,(0,t.jsx)(n.code,{children:`debate-team-collaboration`}),`
and `,(0,t.jsx)(n.code,{children:`debate-community`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`old-addresses`,children:`Old addresses`}),`
`,(0,t.jsx)(n.p,{children:`Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Old route`}),(0,t.jsx)(n.th,{children:`Now`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/cards/coverage`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/team?section=coverage`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/cards/prep-room`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/team?section=prep-room`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/cards/reviews`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/team?section=reviews`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/cards/inbox`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/team?section=inbox`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/cards/contributions`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/team?section=contributions`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/cards/brainstorm`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/research/team?section=brainstorm`})})]})]})]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.p,{children:[`The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so coverage
snapshots, prep-room checklists, reviews, routed tasks, contributions and
brainstorm ideas carry over unchanged and keep syncing to your account. The
open tab is kept in `,(0,t.jsx)(n.code,{children:`?section=`}),` (so a tab can be shared or bookmarked) and
remembered in this browser for the next visit. The tab strip is the
Research, Coach and Prep workspaces' own (`,(0,t.jsx)(n.code,{children:`components/hubs/HubSectionNav.tsx`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`The Research Workspace (`,(0,t.jsx)(n.code,{children:`/research`}),`) still mounts these panels inside its
own stage-by-stage sections; its "open as its own page" chips for them now
lead to the matching Team Research tab.`]}),`
`,(0,t.jsx)(n.p,{children:`Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.`}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Opening a saved record from the Tools page's recent-items list lands on
the Team Research page's last-opened tab, not on the record itself.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};