import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Judge Awards`},r=`# Judge Awards [#judge-awards]

Five badges a debater can't earn with XP \u2014 only a judge can give them at a
tournament. They appear on the debater's page with the judge's name under
each badge.

- **Routes:** \`/coaching/leaderboard/{debaterId}\` (earned awards and the
  **Give an award** form), \`/practice/level\` (all five awards and what they
  recognize)
- **Package:** \`debate-community\` (\`packages/debate-contributor-progress\`)

## The awards [#the-awards]

| Award | Recognizes |
| --- | --- |
| Most Improved | Came back sharper every round over the course of a tournament |
| Best Speaker | The clearest, most persuasive delivery the judge heard |
| Best Critique Debater | Took apart the other side's assumptions, not just their arguments |
| Best Impact Calculus | Explicit weighing \u2014 magnitude, probability, timeframe |
| Best Research Award | Evidence deeper, fresher and better cut than anything else in the room |

## The rule [#the-rule]

Each judge can give **each award once per tournament**. A judge who gives
Best Speaker at Glenbrooks can't give Best Speaker to a second debater there,
but can still give the other four, and can give Best Speaker again at the
next tournament. Judge and tournament names are matched ignoring case and
extra spaces. A judge can't give an award to themself.

## Data flow [#data-flow]

\`\`\`
lib/judge-awards.ts        \u2014 award definitions, validateJudgeAward()
state/judgeAwards.ts       \u2014 localStorage "judgeAwards", giveJudgeAward()
  \u2192 panels/JudgeAwardsSection.tsx
      JudgeAwardsSection   \u2192 ContributorProfilePanel (debater page)
      JudgeAwardShowcase   \u2192 DebaterLevelPanel (/practice/level)
\`\`\`

Awards sync to the signed-in user's account as the \`judgeAwards\` collection.

## Known gaps [#known-gaps]

- **No judge verification.** The judge's name is typed in by whoever fills in
  the form; nothing checks that they judged the tournament.
- **Per-browser, not shared.** An award lives in the browser (and account) of
  whoever gave it. The debater sees it on their page only on that device or
  account \u2014 a shared server-side table is needed for it to follow the debater.
- **No XP.** The badge art shows +200 XP, but judge awards don't add to the
  debater's level yet, for the same reason: the level lives in the debater's
  browser, while the award lives in the judge's.
`,i={contents:[{heading:`judge-awards`,content:`Five badges a debater can't earn with XP \u2014 only a judge can give them at a
tournament. They appear on the debater's page with the judge's name under
each badge.`},{heading:`judge-awards`,content:"**Routes:** `/coaching/leaderboard/{debaterId}` (earned awards and the\n**Give an award** form), `/practice/level` (all five awards and what they\nrecognize)"},{heading:`judge-awards`,content:"**Package:** `debate-community` (`packages/debate-contributor-progress`)"},{heading:`the-awards`,content:`| Award         | Recognizes                                                    |
| ------------- | ------------------------------------------------------------- |
| Most Improved | Came back sharper every round over the course of a tournament |`,table:`table-0`},{heading:`the-awards`,content:`| Award        | Recognizes                                             |
| ------------ | ------------------------------------------------------ |
| Best Speaker | The clearest, most persuasive delivery the judge heard |`,table:`table-0`},{heading:`the-awards`,content:`| Award                 | Recognizes                                                        |
| --------------------- | ----------------------------------------------------------------- |
| Best Critique Debater | Took apart the other side's assumptions, not just their arguments |`,table:`table-0`},{heading:`the-awards`,content:`| Award                | Recognizes                                            |
| -------------------- | ----------------------------------------------------- |
| Best Impact Calculus | Explicit weighing \u2014 magnitude, probability, timeframe |`,table:`table-0`},{heading:`the-awards`,content:`| Award               | Recognizes                                                             |
| ------------------- | ---------------------------------------------------------------------- |
| Best Research Award | Evidence deeper, fresher and better cut than anything else in the room |`,table:`table-0`},{heading:`the-rule`,content:`Each judge can give **each award once per tournament**. A judge who gives
Best Speaker at Glenbrooks can't give Best Speaker to a second debater there,
but can still give the other four, and can give Best Speaker again at the
next tournament. Judge and tournament names are matched ignoring case and
extra spaces. A judge can't give an award to themself.`},{heading:`data-flow`,content:"Awards sync to the signed-in user's account as the `judgeAwards` collection."},{heading:`known-gaps`,content:`**No judge verification.** The judge's name is typed in by whoever fills in
the form; nothing checks that they judged the tournament.`},{heading:`known-gaps`,content:`**Per-browser, not shared.** An award lives in the browser (and account) of
whoever gave it. The debater sees it on their page only on that device or
account \u2014 a shared server-side table is needed for it to follow the debater.`},{heading:`known-gaps`,content:`**No XP.** The badge art shows +200 XP, but judge awards don't add to the
debater's level yet, for the same reason: the level lives in the debater's
browser, while the award lives in the judge's.`}],headings:[{id:`judge-awards`,content:`Judge Awards`},{id:`the-awards`,content:`The awards`},{id:`the-rule`,content:`The rule`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#judge-awards`,title:(0,t.jsx)(t.Fragment,{children:`Judge Awards`})},{depth:2,url:`#the-awards`,title:(0,t.jsx)(t.Fragment,{children:`The awards`})},{depth:2,url:`#the-rule`,title:(0,t.jsx)(t.Fragment,{children:`The rule`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`judge-awards`,children:`Judge Awards`}),`
`,(0,t.jsx)(n.p,{children:`Five badges a debater can't earn with XP \u2014 only a judge can give them at a
tournament. They appear on the debater's page with the judge's name under
each badge.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Routes:`}),` `,(0,t.jsx)(n.code,{children:`/coaching/leaderboard/{debaterId}`}),` (earned awards and the
`,(0,t.jsx)(n.strong,{children:`Give an award`}),` form), `,(0,t.jsx)(n.code,{children:`/practice/level`}),` (all five awards and what they
recognize)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-community`}),` (`,(0,t.jsx)(n.code,{children:`packages/debate-contributor-progress`}),`)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`the-awards`,children:`The awards`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Award`}),(0,t.jsx)(n.th,{children:`Recognizes`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Most Improved`}),(0,t.jsx)(n.td,{children:`Came back sharper every round over the course of a tournament`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Best Speaker`}),(0,t.jsx)(n.td,{children:`The clearest, most persuasive delivery the judge heard`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Best Critique Debater`}),(0,t.jsx)(n.td,{children:`Took apart the other side's assumptions, not just their arguments`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Best Impact Calculus`}),(0,t.jsx)(n.td,{children:`Explicit weighing \u2014 magnitude, probability, timeframe`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Best Research Award`}),(0,t.jsx)(n.td,{children:`Evidence deeper, fresher and better cut than anything else in the room`})]})]})]}),`
`,(0,t.jsx)(n.h2,{id:`the-rule`,children:`The rule`}),`
`,(0,t.jsxs)(n.p,{children:[`Each judge can give `,(0,t.jsx)(n.strong,{children:`each award once per tournament`}),`. A judge who gives
Best Speaker at Glenbrooks can't give Best Speaker to a second debater there,
but can still give the other four, and can give Best Speaker again at the
next tournament. Judge and tournament names are matched ignoring case and
extra spaces. A judge can't give an award to themself.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`lib/judge-awards.ts        \u2014 award definitions, validateJudgeAward()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/judgeAwards.ts       \u2014 localStorage "judgeAwards", giveJudgeAward()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/JudgeAwardsSection.tsx`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      JudgeAwardsSection   \u2192 ContributorProfilePanel (debater page)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`      JudgeAwardShowcase   \u2192 DebaterLevelPanel (/practice/level)`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`Awards sync to the signed-in user's account as the `,(0,t.jsx)(n.code,{children:`judgeAwards`}),` collection.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`No judge verification.`}),` The judge's name is typed in by whoever fills in
the form; nothing checks that they judged the tournament.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Per-browser, not shared.`}),` An award lives in the browser (and account) of
whoever gave it. The debater sees it on their page only on that device or
account \u2014 a shared server-side table is needed for it to follow the debater.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`No XP.`}),` The badge art shows +200 XP, but judge awards don't add to the
debater's level yet, for the same reason: the level lives in the debater's
browser, while the award lives in the judge's.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};