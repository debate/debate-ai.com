import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Review Queue`},r=`# Review Queue [#review-queue]

Lets a user move a submitted card through peer review \u2014 start a review,
submit it, leave and resolve comments, request changes, approve, and
publish \u2014 before it goes live in the Shared Evidence Library.

- **Route:** \`/research/team?section=reviews\`, the **[Team Research](/docs/features/research-evidence/team-research)** page's tab (the old \`/research/cards/reviews\` redirects there)
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

Every persisted \`CardReview\` with its status, lifecycle action buttons, a
comment thread (with severity and a "Resolve" action), an
unresolved-blocking warning, a review-aging badge, and a **Reviewer
workload** table. Approve/reject/publish are gated on the acting
reviewer's own Progress Unlocks tier and blocked for self-review.

## Data flow [#data-flow]

\`\`\`
state/peerReviews.ts (localStorage: peerReviews)
  \u2192 buildReviewQueuePanelView()
  \u2192 panels/ReviewQueuePanel.tsx
\`\`\`

A review's lifecycle gates the matching Shared Evidence Library entry's
visibility in search results.

## Known gaps [#known-gaps]

Reviewer identity is still a free-form id, not an authenticated user \u2014 a
signed-in session only prefills it.
`,i={contents:[{heading:`review-queue`,content:`Lets a user move a submitted card through peer review \u2014 start a review,
submit it, leave and resolve comments, request changes, approve, and
publish \u2014 before it goes live in the Shared Evidence Library.`},{heading:`review-queue`,content:"**Route:** `/research/team?section=reviews`, the **Team Research** page's tab (the old `/research/cards/reviews` redirects there)"},{heading:`review-queue`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`Every persisted \`CardReview\` with its status, lifecycle action buttons, a
comment thread (with severity and a "Resolve" action), an
unresolved-blocking warning, a review-aging badge, and a **Reviewer
workload** table. Approve/reject/publish are gated on the acting
reviewer's own Progress Unlocks tier and blocked for self-review.`},{heading:`data-flow`,content:`A review's lifecycle gates the matching Shared Evidence Library entry's
visibility in search results.`},{heading:`known-gaps`,content:`Reviewer identity is still a free-form id, not an authenticated user \u2014 a
signed-in session only prefills it.`}],headings:[{id:`review-queue`,content:`Review Queue`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#review-queue`,title:(0,t.jsx)(t.Fragment,{children:`Review Queue`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`review-queue`,children:`Review Queue`}),`
`,(0,t.jsx)(n.p,{children:`Lets a user move a submitted card through peer review \u2014 start a review,
submit it, leave and resolve comments, request changes, approve, and
publish \u2014 before it goes live in the Shared Evidence Library.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/team?section=reviews`}),`, the `,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/team-research`,children:`Team Research`})}),` page's tab (the old `,(0,t.jsx)(n.code,{children:`/research/cards/reviews`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`Every persisted `,(0,t.jsx)(n.code,{children:`CardReview`}),` with its status, lifecycle action buttons, a
comment thread (with severity and a "Resolve" action), an
unresolved-blocking warning, a review-aging badge, and a `,(0,t.jsx)(n.strong,{children:`Reviewer
workload`}),` table. Approve/reject/publish are gated on the acting
reviewer's own Progress Unlocks tier and blocked for self-review.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/peerReviews.ts (localStorage: peerReviews)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildReviewQueuePanelView()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/ReviewQueuePanel.tsx`})})]})})}),`
`,(0,t.jsx)(n.p,{children:`A review's lifecycle gates the matching Shared Evidence Library entry's
visibility in search results.`}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`Reviewer identity is still a free-form id, not an authenticated user \u2014 a
signed-in session only prefills it.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};