import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Judge Profiles`},r=`# Judge Profiles [#judge-profiles]

Shows every persisted judge profile as a roster \u2014 side-vote bias, average
speaker points, delivery-speed tolerance, theory receptiveness, and
most-tagged paradigm \u2014 ordered by rounds judged.

- **Route:** \`/practice/prep?section=judges\`, a tab of the [Prep Workspace](/docs/features/rounds/prep-workspace) (the old \`/practice/judges\` redirects there)
- **Package:** \`debate-speech-writer\`

## What it shows [#what-it-shows]

A roster table, a "Log a judged round" form (creates/updates a profile from
ballot history), a **Bulk import (CSV)** section for pasting a whole
spreadsheet of judged rounds at once, a logged-rounds list with
Edit/Delete/Undo/Redo actions, and a **Compare judges** section for
prepping a panel round (side leans, recommended pace, theory risk, paradigm
conflicts).

## Data flow [#data-flow]

\`\`\`
state/judgeRoundRecords.ts (localStorage: judgeRoundRecords)
  \u2192 rebuildJudgeProfileFromRecords(judgeId)
state/judgeProfiles.ts (localStorage: judgeProfiles)
  \u2192 buildJudgeProfilesRoster()
  \u2192 panels/JudgeProfilesPanel.tsx
\`\`\`

## Known gaps [#known-gaps]

No real ballot data source \u2014 every round is entered by hand, one at a time
or in a CSV batch via Bulk import. Profiles (\`judgeProfiles\`) and their
logged rounds (\`judgeRoundRecords\`) sync to a signed-in user's account \u2014
see Tool Data Sync \u2014 but still per-user,
not a shared team resource, and with no identity/permission checks.
`,i={contents:[{heading:`judge-profiles`,content:`Shows every persisted judge profile as a roster \u2014 side-vote bias, average
speaker points, delivery-speed tolerance, theory receptiveness, and
most-tagged paradigm \u2014 ordered by rounds judged.`},{heading:`judge-profiles`,content:"**Route:** `/practice/prep?section=judges`, a tab of the Prep Workspace (the old `/practice/judges` redirects there)"},{heading:`judge-profiles`,content:"**Package:** `debate-speech-writer`"},{heading:`what-it-shows`,content:`A roster table, a "Log a judged round" form (creates/updates a profile from
ballot history), a **Bulk import (CSV)** section for pasting a whole
spreadsheet of judged rounds at once, a logged-rounds list with
Edit/Delete/Undo/Redo actions, and a **Compare judges** section for
prepping a panel round (side leans, recommended pace, theory risk, paradigm
conflicts).`},{heading:`known-gaps`,content:`No real ballot data source \u2014 every round is entered by hand, one at a time
or in a CSV batch via Bulk import. Profiles (\`judgeProfiles\`) and their
logged rounds (\`judgeRoundRecords\`) sync to a signed-in user's account \u2014
see Tool Data Sync \u2014 but still per-user,
not a shared team resource, and with no identity/permission checks.`}],headings:[{id:`judge-profiles`,content:`Judge Profiles`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#judge-profiles`,title:(0,t.jsx)(t.Fragment,{children:`Judge Profiles`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`judge-profiles`,children:`Judge Profiles`}),`
`,(0,t.jsx)(n.p,{children:`Shows every persisted judge profile as a roster \u2014 side-vote bias, average
speaker points, delivery-speed tolerance, theory receptiveness, and
most-tagged paradigm \u2014 ordered by rounds judged.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/prep?section=judges`}),`, a tab of the `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/prep-workspace`,children:`Prep Workspace`}),` (the old `,(0,t.jsx)(n.code,{children:`/practice/judges`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-speech-writer`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`A roster table, a "Log a judged round" form (creates/updates a profile from
ballot history), a `,(0,t.jsx)(n.strong,{children:`Bulk import (CSV)`}),` section for pasting a whole
spreadsheet of judged rounds at once, a logged-rounds list with
Edit/Delete/Undo/Redo actions, and a `,(0,t.jsx)(n.strong,{children:`Compare judges`}),` section for
prepping a panel round (side leans, recommended pace, theory risk, paradigm
conflicts).`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/judgeRoundRecords.ts (localStorage: judgeRoundRecords)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 rebuildJudgeProfileFromRecords(judgeId)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/judgeProfiles.ts (localStorage: judgeProfiles)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildJudgeProfilesRoster()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/JudgeProfilesPanel.tsx`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`No real ballot data source \u2014 every round is entered by hand, one at a time
or in a CSV batch via Bulk import. Profiles (`,(0,t.jsx)(n.code,{children:`judgeProfiles`}),`) and their
logged rounds (`,(0,t.jsx)(n.code,{children:`judgeRoundRecords`}),`) sync to a signed-in user's account \u2014
see Tool Data Sync \u2014 but still per-user,
not a shared team resource, and with no identity/permission checks.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};