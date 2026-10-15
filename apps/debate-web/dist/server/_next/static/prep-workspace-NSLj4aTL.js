import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Prep Workspace`},r=`# Prep Workspace [#prep-workspace]

One page for getting ready for a round. The five pre-round prep tools sit
side by side, one tab each:

| Tab | \`?section=\` | What it does |
| --- | --- | --- |
| [Pre-Round Briefings](/docs/features/tournaments-judge/pre-round-briefings) | \`briefings\` | One briefing per upcoming round: opponent scouting, judge tendencies, the head-to-head record, and team prep notes. |
| [Scout-to-Strategy](/docs/features/ai-coaching/scout-to-strategy) | \`strategy\` | Ranks your case options against the saved opponent and judge profiles, with a judge-adaptation note each and a matchup risk level. |
| [Opponent Team Profiles](/docs/features/tournaments-judge/opponent-team-profiles) | \`opponents\` | Records, Aff/Neg side tendencies, and the arguments and cases each scouted team runs most. |
| [Judge Profiles](/docs/features/tournaments-judge/judge-profiles) | \`judges\` | Side-vote bias, average speaker points, speed tolerance, and theory receptiveness for every saved judge. |
| [Prep Notes](/docs/features/flow-speech/prep-notes) | \`notes\` | Live prep notes across every flow, needs-follow-up first, with handoff to a teammate. |

- **Route:** \`/practice/prep\`, listed in the sidebar's **Practice** section
- **Package:** \`debate-webview\` (\`components/practice/PrepWorkspace.tsx\`) over
  panels from \`debate-round\`, \`debate-speech-writer\` and
  \`debate-team-collaboration\`

## Old addresses [#old-addresses]

Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:

| Old route | Now |
| --- | --- |
| \`/practice/briefings\` | \`/practice/prep?section=briefings\` |
| \`/practice/strategy\` | \`/practice/prep?section=strategy\` |
| \`/practice/opponents\` | \`/practice/prep?section=opponents\` |
| \`/practice/judges\` | \`/practice/prep?section=judges\` |
| \`/practice/prep-notes\` | \`/practice/prep?section=notes\` |

## How it works [#how-it-works]

The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so saved
briefings, profiles, recommendations and notes carry over unchanged and
keep syncing to your account. The open tab is kept in \`?section=\` (so a tab
can be shared or bookmarked) and remembered in this browser for the next
visit. The tab strip is the Coach and Research workspaces' own
(\`components/hubs/HubSectionNav.tsx\`).

Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.

## Known gaps [#known-gaps]

- Opening a saved record from the Tools page's recent-items list lands on
  the right tab, not on the record itself.
- The Coach Workspace still splits these tools across its **Prep** and
  **Scouting** sections; its "open as its own page" chips now lead to the
  matching Prep Workspace tab.
`,i={contents:[{heading:`prep-workspace`,content:`One page for getting ready for a round. The five pre-round prep tools sit
side by side, one tab each:`},{heading:`prep-workspace`,content:"| Tab                 | `?section=` | What it does                                                                                                        |\n| ------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------- |\n| Pre-Round Briefings | `briefings` | One briefing per upcoming round: opponent scouting, judge tendencies, the head-to-head record, and team prep notes. |",table:`table-0`},{heading:`prep-workspace`,content:"| Tab               | `?section=` | What it does                                                                                                                       |\n| ----------------- | ----------- | ---------------------------------------------------------------------------------------------------------------------------------- |\n| Scout-to-Strategy | `strategy`  | Ranks your case options against the saved opponent and judge profiles, with a judge-adaptation note each and a matchup risk level. |",table:`table-0`},{heading:`prep-workspace`,content:"| Tab                    | `?section=` | What it does                                                                               |\n| ---------------------- | ----------- | ------------------------------------------------------------------------------------------ |\n| Opponent Team Profiles | `opponents` | Records, Aff/Neg side tendencies, and the arguments and cases each scouted team runs most. |",table:`table-0`},{heading:`prep-workspace`,content:"| Tab            | `?section=` | What it does                                                                                             |\n| -------------- | ----------- | -------------------------------------------------------------------------------------------------------- |\n| Judge Profiles | `judges`    | Side-vote bias, average speaker points, speed tolerance, and theory receptiveness for every saved judge. |",table:`table-0`},{heading:`prep-workspace`,content:"| Tab        | `?section=` | What it does                                                                          |\n| ---------- | ----------- | ------------------------------------------------------------------------------------- |\n| Prep Notes | `notes`     | Live prep notes across every flow, needs-follow-up first, with handoff to a teammate. |",table:`table-0`},{heading:`prep-workspace`,content:"**Route:** `/practice/prep`, listed in the sidebar's **Practice** section"},{heading:`prep-workspace`,content:"**Package:** `debate-webview` (`components/practice/PrepWorkspace.tsx`) over\npanels from `debate-round`, `debate-speech-writer` and\n`debate-team-collaboration`"},{heading:`old-addresses`,content:`Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:`},{heading:`old-addresses`,content:"| Old route             | Now                                |\n| --------------------- | ---------------------------------- |\n| `/practice/briefings` | `/practice/prep?section=briefings` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route            | Now                               |\n| -------------------- | --------------------------------- |\n| `/practice/strategy` | `/practice/prep?section=strategy` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route             | Now                                |\n| --------------------- | ---------------------------------- |\n| `/practice/opponents` | `/practice/prep?section=opponents` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route          | Now                             |\n| ------------------ | ------------------------------- |\n| `/practice/judges` | `/practice/prep?section=judges` |",table:`table-1`},{heading:`old-addresses`,content:"| Old route              | Now                            |\n| ---------------------- | ------------------------------ |\n| `/practice/prep-notes` | `/practice/prep?section=notes` |",table:`table-1`},{heading:`how-it-works`,content:`The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so saved
briefings, profiles, recommendations and notes carry over unchanged and
keep syncing to your account. The open tab is kept in \`?section=\` (so a tab
can be shared or bookmarked) and remembered in this browser for the next
visit. The tab strip is the Coach and Research workspaces' own
(\`components/hubs/HubSectionNav.tsx\`).`},{heading:`how-it-works`,content:`Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.`},{heading:`known-gaps`,content:`Opening a saved record from the Tools page's recent-items list lands on
the right tab, not on the record itself.`},{heading:`known-gaps`,content:`The Coach Workspace still splits these tools across its **Prep** and
**Scouting** sections; its "open as its own page" chips now lead to the
matching Prep Workspace tab.`}],headings:[{id:`prep-workspace`,content:`Prep Workspace`},{id:`old-addresses`,content:`Old addresses`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#prep-workspace`,title:(0,t.jsx)(t.Fragment,{children:`Prep Workspace`})},{depth:2,url:`#old-addresses`,title:(0,t.jsx)(t.Fragment,{children:`Old addresses`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`prep-workspace`,children:`Prep Workspace`}),`
`,(0,t.jsx)(n.p,{children:`One page for getting ready for a round. The five pre-round prep tools sit
side by side, one tab each:`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Tab`}),(0,t.jsx)(n.th,{children:(0,t.jsx)(n.code,{children:`?section=`})}),(0,t.jsx)(n.th,{children:`What it does`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/pre-round-briefings`,children:`Pre-Round Briefings`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`briefings`})}),(0,t.jsx)(n.td,{children:`One briefing per upcoming round: opponent scouting, judge tendencies, the head-to-head record, and team prep notes.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/scout-to-strategy`,children:`Scout-to-Strategy`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`strategy`})}),(0,t.jsx)(n.td,{children:`Ranks your case options against the saved opponent and judge profiles, with a judge-adaptation note each and a matchup risk level.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/opponent-team-profiles`,children:`Opponent Team Profiles`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`opponents`})}),(0,t.jsx)(n.td,{children:`Records, Aff/Neg side tendencies, and the arguments and cases each scouted team runs most.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/tournaments-judge/judge-profiles`,children:`Judge Profiles`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`judges`})}),(0,t.jsx)(n.td,{children:`Side-vote bias, average speaker points, speed tolerance, and theory receptiveness for every saved judge.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.a,{href:`/docs/features/flow-speech/prep-notes`,children:`Prep Notes`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`notes`})}),(0,t.jsx)(n.td,{children:`Live prep notes across every flow, needs-follow-up first, with handoff to a teammate.`})]})]})]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/prep`}),`, listed in the sidebar's `,(0,t.jsx)(n.strong,{children:`Practice`}),` section`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-webview`}),` (`,(0,t.jsx)(n.code,{children:`components/practice/PrepWorkspace.tsx`}),`) over
panels from `,(0,t.jsx)(n.code,{children:`debate-round`}),`, `,(0,t.jsx)(n.code,{children:`debate-speech-writer`}),` and
`,(0,t.jsx)(n.code,{children:`debate-team-collaboration`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`old-addresses`,children:`Old addresses`}),`
`,(0,t.jsx)(n.p,{children:`Each tool used to have its own page. Those addresses still work and
permanently redirect to the matching tab:`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Old route`}),(0,t.jsx)(n.th,{children:`Now`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/briefings`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/prep?section=briefings`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/strategy`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/prep?section=strategy`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/opponents`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/prep?section=opponents`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/judges`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/prep?section=judges`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/prep-notes`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/practice/prep?section=notes`})})]})]})]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.p,{children:[`The page is navigation only: each tab mounts the same panel the old page
did, and each panel still reads and writes its own store, so saved
briefings, profiles, recommendations and notes carry over unchanged and
keep syncing to your account. The open tab is kept in `,(0,t.jsx)(n.code,{children:`?section=`}),` (so a tab
can be shared or bookmarked) and remembered in this browser for the next
visit. The tab strip is the Coach and Research workspaces' own
(`,(0,t.jsx)(n.code,{children:`components/hubs/HubSectionNav.tsx`}),`).`]}),`
`,(0,t.jsx)(n.p,{children:`Outside Next (the browser extension's router), the old routes render this
page opened on their tab instead of redirecting.`}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Opening a saved record from the Tools page's recent-items list lands on
the right tab, not on the record itself.`}),`
`,(0,t.jsxs)(n.li,{children:[`The Coach Workspace still splits these tools across its `,(0,t.jsx)(n.strong,{children:`Prep`}),` and
`,(0,t.jsx)(n.strong,{children:`Scouting`}),` sections; its "open as its own page" chips now lead to the
matching Prep Workspace tab.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};