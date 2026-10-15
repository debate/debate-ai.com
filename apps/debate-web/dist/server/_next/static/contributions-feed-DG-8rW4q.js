import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Contributions Feed`},r=`# Contributions Feed [#contributions-feed]

Lets a contributor submit an \`AttributedContribution\` (a card, summary,
highlight, annotation, original argument, or refutation), then renders
every persisted contribution ranked by blended helpfulness score, with
Like/Save/Endorse actions per entry.

- **Route:** \`/research/team?section=contributions\`, the **[Team Research](/docs/features/research-evidence/team-research)** page's tab (the old \`/research/cards/contributions\` redirects there)
- **Package:** \`debate-card-search\`

## What it shows [#what-it-shows]

A submission form followed by the ranked feed. Each entry shows its kind
badge, contributor, helpfulness score, likes/saves/endorsement counts, and
Like/Save/Endorse buttons. A "Flagged for review" moderator toggle narrows
the feed to popularity-driven outliers.

A "Comments" toggle on each entry mounts \`debate-comments\`'
\`<CommentSection resourceType="contribution" resourceId={entry.id} />\` \u2014 the
same threaded, likeable, account-only discussion UI already used on video
watch pages and forum threads. Collapsed by default and mounted only once
expanded, since the feed can list many entries at once and each mount fetches
its own thread.

## Data flow [#data-flow]

\`\`\`
state/contributions.ts (localStorage: "contributions")
  \u2192 saveContribution() / recordPersistedLike() / recordPersistedSave() /
    recordPersistedEndorsementFromReviewer()
  \u2192 buildPersistedContributionFeed()
  \u2192 panels/ContributionsFeedPanel.tsx
\`\`\`

Endorsing is locked to the signed-in identity, and self-endorsement throws
\`SelfEndorsementNotAllowedError\`.

## Known gaps [#known-gaps]

- A submitted contribution starts with a neutral quality-signal placeholder.
- The reviewer-identity lock only stops a signed-in visitor from spoofing.
`,i={contents:[{heading:`contributions-feed`,content:`Lets a contributor submit an \`AttributedContribution\` (a card, summary,
highlight, annotation, original argument, or refutation), then renders
every persisted contribution ranked by blended helpfulness score, with
Like/Save/Endorse actions per entry.`},{heading:`contributions-feed`,content:"**Route:** `/research/team?section=contributions`, the **Team Research** page's tab (the old `/research/cards/contributions` redirects there)"},{heading:`contributions-feed`,content:"**Package:** `debate-card-search`"},{heading:`what-it-shows`,content:`A submission form followed by the ranked feed. Each entry shows its kind
badge, contributor, helpfulness score, likes/saves/endorsement counts, and
Like/Save/Endorse buttons. A "Flagged for review" moderator toggle narrows
the feed to popularity-driven outliers.`},{heading:`what-it-shows`,content:`A "Comments" toggle on each entry mounts \`debate-comments\`'
\`<CommentSection resourceType="contribution" resourceId={entry.id} />\` \u2014 the
same threaded, likeable, account-only discussion UI already used on video
watch pages and forum threads. Collapsed by default and mounted only once
expanded, since the feed can list many entries at once and each mount fetches
its own thread.`},{heading:`data-flow`,content:"Endorsing is locked to the signed-in identity, and self-endorsement throws\n`SelfEndorsementNotAllowedError`."},{heading:`known-gaps`,content:`A submitted contribution starts with a neutral quality-signal placeholder.`},{heading:`known-gaps`,content:`The reviewer-identity lock only stops a signed-in visitor from spoofing.`}],headings:[{id:`contributions-feed`,content:`Contributions Feed`},{id:`what-it-shows`,content:`What it shows`},{id:`data-flow`,content:`Data flow`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#contributions-feed`,title:(0,t.jsx)(t.Fragment,{children:`Contributions Feed`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`contributions-feed`,children:`Contributions Feed`}),`
`,(0,t.jsxs)(n.p,{children:[`Lets a contributor submit an `,(0,t.jsx)(n.code,{children:`AttributedContribution`}),` (a card, summary,
highlight, annotation, original argument, or refutation), then renders
every persisted contribution ranked by blended helpfulness score, with
Like/Save/Endorse actions per entry.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/research/team?section=contributions`}),`, the `,(0,t.jsx)(n.strong,{children:(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/team-research`,children:`Team Research`})}),` page's tab (the old `,(0,t.jsx)(n.code,{children:`/research/cards/contributions`}),` redirects there)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-card-search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`A submission form followed by the ranked feed. Each entry shows its kind
badge, contributor, helpfulness score, likes/saves/endorsement counts, and
Like/Save/Endorse buttons. A "Flagged for review" moderator toggle narrows
the feed to popularity-driven outliers.`}),`
`,(0,t.jsxs)(n.p,{children:[`A "Comments" toggle on each entry mounts `,(0,t.jsx)(n.code,{children:`debate-comments`}),`'
`,(0,t.jsx)(n.code,{children:`<CommentSection resourceType="contribution" resourceId={entry.id} />`}),` \u2014 the
same threaded, likeable, account-only discussion UI already used on video
watch pages and forum threads. Collapsed by default and mounted only once
expanded, since the feed can list many entries at once and each mount fetches
its own thread.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/contributions.ts (localStorage: "contributions")`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 saveContribution() / recordPersistedLike() / recordPersistedSave() /`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`    recordPersistedEndorsementFromReviewer()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 buildPersistedContributionFeed()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 panels/ContributionsFeedPanel.tsx`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`Endorsing is locked to the signed-in identity, and self-endorsement throws
`,(0,t.jsx)(n.code,{children:`SelfEndorsementNotAllowedError`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`A submitted contribution starts with a neutral quality-signal placeholder.`}),`
`,(0,t.jsx)(n.li,{children:`The reviewer-identity lock only stops a signed-in visitor from spoofing.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};