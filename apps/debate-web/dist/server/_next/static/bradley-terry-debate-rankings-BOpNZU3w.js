import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`How Team Ratings Are Computed`},r=`# How Team Ratings Are Computed [#how-team-ratings-are-computed]

The [Team Rankings](/docs/features/team-collaboration/team-rankings) come from the
\`debate-rankings\` pipeline (\`src/main.py\`), which fits a **ballot-level
Bradley-Terry model** to every decided round of the season at once. The
results are written to \`output/<prefix>full_rankings.csv\` and
\`output/<prefix>field_statistics.csv\`, which the site reads through
\`debate-rankings-adapter\`.

Fitting the whole season together means the order rounds were debated in does
not matter: a round in September counts the same as one in February, and a
team's rating reflects everyone it has beaten and lost to, weighted by how
strong those opponents turned out to be.

## The model [#the-model]

Each team (or LD debater) gets a skill \`\u03B8\` on the logit scale. The
probability that the aff wins a ballot is

\`\`\`latex
\\[
P(\\text{aff wins}) = \\frac{1}{1 + e^{-(\\theta_{\\text{aff}} - \\theta_{\\text{neg}} + \\beta)}}
\\]
\`\`\`

where \`\u03B2\` is one shared **side term** that soaks up any field-wide
aff or neg advantage, so a team isn't credited for drawing the favored side.

## Side balancing, prelims and elims apart [#side-balancing-prelims-and-elims-apart]

One side term isn't enough on its own, because side bias differs by round
type: prelim sides are assigned, while in elims a coin-flip winner or the
higher seed picks the side, so the aff can win well over half of elims in a
field whose prelims are close to even. Before the fit, every ballot is
weighted so that **aff and neg each carry exactly half the ballot weight,
separately in prelims and in elims**:

\`\`\`latex
\\[
w_{\\text{aff}} = \\frac{A + N}{2A}, \\qquad w_{\\text{neg}} = \\frac{A + N}{2N}
\\]
\`\`\`

where \`A\` and \`N\` are the aff and neg ballots of that round type. The
favored side's ballots weigh less than 1 and the other side's more, and the
round type's total weight is unchanged \u2014 so a team that won a run of elims on
the favored side isn't over-credited, and one that won on the disfavored side
gets its due. \`\u03B2\` then absorbs whatever side effect is left. If a round type
has no ballots on one side, its weights stay 1.

## What counts as data [#what-counts-as-data]

- **Ballots, not just rounds.** When a round lists panel votes, each ballot is
  its own comparison \u2014 a 3\u20130 is stronger evidence than a 2\u20131. Rounds without
  votes count as one ballot for the winner.
- **Majors count double.** Ballots at the tournaments marked as majors have a
  likelihood weight of 2, on top of the side weight above.
- **Byes, forfeits and undecided rounds are skipped** for the rating, though
  they still count toward the raw win rates.

## The prior [#the-prior]

The fit adds a ridge penalty of 1.0 on every skill \u2014 equivalent to a
\`N(0, 1)\` prior. Teams with only a few ballots are pulled toward
the field average, and an unbeaten team still gets a finite rating instead of
running off to infinity. A team with no decided rounds sits exactly at the
prior: field average, standard error 1.

## From skill to the CSV columns [#from-skill-to-the-csv-columns]

Skills are reported on the familiar Elo scale, where 1500 is the field average
and 400 points is 10:1 odds:

| Column | Formula |
| --- | --- |
| Rating | \`1500 + (400 / ln 10) \u00D7 \u03B8\` |
| Deviation | \`(400 / ln 10) \u00D7 SE(\u03B8)\` \u2014 the skill's standard error in rating points |
| Adjusted Rating | Rating \u2212 2 \u00D7 Deviation \u2014 what the rank is sorted on |
| Matches | Decided rounds debated (aff + neg) |
| Aff Rating Advantage | \`(400 / ln 10) \u00D7 \u03B2\` \u2014 rating points the aff side is still worth, field-wide, after side balancing |
| Aff / Neg Side Weight | \`w_aff\`, \`w_neg\` for prelim ballots |
| Aff / Neg Elim Side Weight | \`w_aff\`, \`w_neg\` for elim ballots |

Adjusted Rating is a conservative estimate: a lightly tested team with a high
point estimate can't outrank a similarly rated, well-established one.

The win probability between two entries, ignoring side, is

\`\`\`latex
\\[
P(A \\text{ beats } B) = \\frac{1}{1 + 10^{(R_B - R_A)/400}}
\\]
\`\`\`

## On this site [#on-this-site]

The site shows every rating 1000 points lower and divided by 8, then clamped
to 0\u2013109 (\`RATING_OFFSET\`, \`RATING_DIVISOR\`, \`RATING_MIN\` and \`RATING_MAX\` in
\`debate-rankings-adapter\`). That puts the top handful of teams in each event
around 100 and the weakest teams at or near 0. The shift and scale keep ranks
and win probabilities unchanged; the clamp only ties the few teams past either
end. The aff rating advantage, being a difference, is only divided by 8.

Ratings are shown with at least two digits (\`07\`, not \`7\`). The leading
digits, \`0\` through \`10\`, are the team's tier and are shaded from gold at the
top tier down to gray at the bottom, so the tier boundaries stand out as you
scroll down the table.
`,i={contents:[{heading:`how-team-ratings-are-computed`,content:"The Team Rankings come from the\n`debate-rankings` pipeline (`src/main.py`), which fits a **ballot-level\nBradley-Terry model** to every decided round of the season at once. The\nresults are written to `output/<prefix>full_rankings.csv` and\n`output/<prefix>field_statistics.csv`, which the site reads through\n`debate-rankings-adapter`."},{heading:`how-team-ratings-are-computed`,content:`Fitting the whole season together means the order rounds were debated in does
not matter: a round in September counts the same as one in February, and a
team's rating reflects everyone it has beaten and lost to, weighted by how
strong those opponents turned out to be.`},{heading:`the-model`,content:"Each team (or LD debater) gets a skill `\u03B8` on the logit scale. The\nprobability that the aff wins a ballot is"},{heading:`the-model`,content:"where `\u03B2` is one shared **side term** that soaks up any field-wide\naff or neg advantage, so a team isn't credited for drawing the favored side."},{heading:`side-balancing-prelims-and-elims-apart`,content:`One side term isn't enough on its own, because side bias differs by round
type: prelim sides are assigned, while in elims a coin-flip winner or the
higher seed picks the side, so the aff can win well over half of elims in a
field whose prelims are close to even. Before the fit, every ballot is
weighted so that **aff and neg each carry exactly half the ballot weight,
separately in prelims and in elims**:`},{heading:`side-balancing-prelims-and-elims-apart`,content:"where `A` and `N` are the aff and neg ballots of that round type. The\nfavored side's ballots weigh less than 1 and the other side's more, and the\nround type's total weight is unchanged \u2014 so a team that won a run of elims on\nthe favored side isn't over-credited, and one that won on the disfavored side\ngets its due. `\u03B2` then absorbs whatever side effect is left. If a round type\nhas no ballots on one side, its weights stay 1."},{heading:`what-counts-as-data`,content:`**Ballots, not just rounds.** When a round lists panel votes, each ballot is
its own comparison \u2014 a 3\u20130 is stronger evidence than a 2\u20131. Rounds without
votes count as one ballot for the winner.`},{heading:`what-counts-as-data`,content:`**Majors count double.** Ballots at the tournaments marked as majors have a
likelihood weight of 2, on top of the side weight above.`},{heading:`what-counts-as-data`,content:`**Byes, forfeits and undecided rounds are skipped** for the rating, though
they still count toward the raw win rates.`},{heading:`the-prior`,content:`The fit adds a ridge penalty of 1.0 on every skill \u2014 equivalent to a
\`N(0, 1)\` prior. Teams with only a few ballots are pulled toward
the field average, and an unbeaten team still gets a finite rating instead of
running off to infinity. A team with no decided rounds sits exactly at the
prior: field average, standard error 1.`},{heading:`from-skill-to-the-csv-columns`,content:`Skills are reported on the familiar Elo scale, where 1500 is the field average
and 400 points is 10:1 odds:`},{heading:`from-skill-to-the-csv-columns`,content:`| Column | Formula                    |
| ------ | -------------------------- |
| Rating | \`1500 + (400 / ln 10) \u00D7 \u03B8\` |`,table:`table-0`},{heading:`from-skill-to-the-csv-columns`,content:`| Column    | Formula                                                               |
| --------- | --------------------------------------------------------------------- |
| Deviation | \`(400 / ln 10) \u00D7 SE(\u03B8)\` \u2014 the skill's standard error in rating points |`,table:`table-0`},{heading:`from-skill-to-the-csv-columns`,content:`| Column          | Formula                                             |
| --------------- | --------------------------------------------------- |
| Adjusted Rating | Rating \u2212 2 \u00D7 Deviation \u2014 what the rank is sorted on |`,table:`table-0`},{heading:`from-skill-to-the-csv-columns`,content:`| Column  | Formula                            |
| ------- | ---------------------------------- |
| Matches | Decided rounds debated (aff + neg) |`,table:`table-0`},{heading:`from-skill-to-the-csv-columns`,content:`| Column               | Formula                                                                                           |
| -------------------- | ------------------------------------------------------------------------------------------------- |
| Aff Rating Advantage | \`(400 / ln 10) \u00D7 \u03B2\` \u2014 rating points the aff side is still worth, field-wide, after side balancing |`,table:`table-0`},{heading:`from-skill-to-the-csv-columns`,content:"| Column                | Formula                             |\n| --------------------- | ----------------------------------- |\n| Aff / Neg Side Weight | `w_aff`, `w_neg` for prelim ballots |",table:`table-0`},{heading:`from-skill-to-the-csv-columns`,content:"| Column                     | Formula                           |\n| -------------------------- | --------------------------------- |\n| Aff / Neg Elim Side Weight | `w_aff`, `w_neg` for elim ballots |",table:`table-0`},{heading:`from-skill-to-the-csv-columns`,content:`Adjusted Rating is a conservative estimate: a lightly tested team with a high
point estimate can't outrank a similarly rated, well-established one.`},{heading:`from-skill-to-the-csv-columns`,content:`The win probability between two entries, ignoring side, is`},{heading:`on-this-site`,content:"The site shows every rating 1000 points lower and divided by 8, then clamped\nto 0\u2013109 (`RATING_OFFSET`, `RATING_DIVISOR`, `RATING_MIN` and `RATING_MAX` in\n`debate-rankings-adapter`). That puts the top handful of teams in each event\naround 100 and the weakest teams at or near 0. The shift and scale keep ranks\nand win probabilities unchanged; the clamp only ties the few teams past either\nend. The aff rating advantage, being a difference, is only divided by 8."},{heading:`on-this-site`,content:"Ratings are shown with at least two digits (`07`, not `7`). The leading\ndigits, `0` through `10`, are the team's tier and are shaded from gold at the\ntop tier down to gray at the bottom, so the tier boundaries stand out as you\nscroll down the table."}],headings:[{id:`how-team-ratings-are-computed`,content:`How Team Ratings Are Computed`},{id:`the-model`,content:`The model`},{id:`side-balancing-prelims-and-elims-apart`,content:`Side balancing, prelims and elims apart`},{id:`what-counts-as-data`,content:`What counts as data`},{id:`the-prior`,content:`The prior`},{id:`from-skill-to-the-csv-columns`,content:`From skill to the CSV columns`},{id:`on-this-site`,content:`On this site`}]},a=[{depth:1,url:`#how-team-ratings-are-computed`,title:(0,t.jsx)(t.Fragment,{children:`How Team Ratings Are Computed`})},{depth:2,url:`#the-model`,title:(0,t.jsx)(t.Fragment,{children:`The model`})},{depth:2,url:`#side-balancing-prelims-and-elims-apart`,title:(0,t.jsx)(t.Fragment,{children:`Side balancing, prelims and elims apart`})},{depth:2,url:`#what-counts-as-data`,title:(0,t.jsx)(t.Fragment,{children:`What counts as data`})},{depth:2,url:`#the-prior`,title:(0,t.jsx)(t.Fragment,{children:`The prior`})},{depth:2,url:`#from-skill-to-the-csv-columns`,title:(0,t.jsx)(t.Fragment,{children:`From skill to the CSV columns`})},{depth:2,url:`#on-this-site`,title:(0,t.jsx)(t.Fragment,{children:`On this site`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`how-team-ratings-are-computed`,children:`How Team Ratings Are Computed`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/team-rankings`,children:`Team Rankings`}),` come from the
`,(0,t.jsx)(n.code,{children:`debate-rankings`}),` pipeline (`,(0,t.jsx)(n.code,{children:`src/main.py`}),`), which fits a `,(0,t.jsx)(n.strong,{children:`ballot-level
Bradley-Terry model`}),` to every decided round of the season at once. The
results are written to `,(0,t.jsx)(n.code,{children:`output/<prefix>full_rankings.csv`}),` and
`,(0,t.jsx)(n.code,{children:`output/<prefix>field_statistics.csv`}),`, which the site reads through
`,(0,t.jsx)(n.code,{children:`debate-rankings-adapter`}),`.`]}),`
`,(0,t.jsx)(n.p,{children:`Fitting the whole season together means the order rounds were debated in does
not matter: a round in September counts the same as one in February, and a
team's rating reflects everyone it has beaten and lost to, weighted by how
strong those opponents turned out to be.`}),`
`,(0,t.jsx)(n.h2,{id:`the-model`,children:`The model`}),`
`,(0,t.jsxs)(n.p,{children:[`Each team (or LD debater) gets a skill `,(0,t.jsx)(n.code,{children:`\u03B8`}),` on the logit scale. The
probability that the aff wins a ballot is`]}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`\\[`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#005CC5`,"--shiki-dark":`#79B8FF`},children:`P(\\text{aff wins}) = \\frac{1}{1 + e^{-(\\theta_{\\text{aff}} - \\theta_{\\text{neg}} + \\beta)}}`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`\\]`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`where `,(0,t.jsx)(n.code,{children:`\u03B2`}),` is one shared `,(0,t.jsx)(n.strong,{children:`side term`}),` that soaks up any field-wide
aff or neg advantage, so a team isn't credited for drawing the favored side.`]}),`
`,(0,t.jsx)(n.h2,{id:`side-balancing-prelims-and-elims-apart`,children:`Side balancing, prelims and elims apart`}),`
`,(0,t.jsxs)(n.p,{children:[`One side term isn't enough on its own, because side bias differs by round
type: prelim sides are assigned, while in elims a coin-flip winner or the
higher seed picks the side, so the aff can win well over half of elims in a
field whose prelims are close to even. Before the fit, every ballot is
weighted so that `,(0,t.jsx)(n.strong,{children:`aff and neg each carry exactly half the ballot weight,
separately in prelims and in elims`}),`:`]}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`\\[`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#005CC5`,"--shiki-dark":`#79B8FF`},children:`w_{\\text{aff}} = \\frac{A + N}{2A}, \\qquad w_{\\text{neg}} = \\frac{A + N}{2N}`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`\\]`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`where `,(0,t.jsx)(n.code,{children:`A`}),` and `,(0,t.jsx)(n.code,{children:`N`}),` are the aff and neg ballots of that round type. The
favored side's ballots weigh less than 1 and the other side's more, and the
round type's total weight is unchanged \u2014 so a team that won a run of elims on
the favored side isn't over-credited, and one that won on the disfavored side
gets its due. `,(0,t.jsx)(n.code,{children:`\u03B2`}),` then absorbs whatever side effect is left. If a round type
has no ballots on one side, its weights stay 1.`]}),`
`,(0,t.jsx)(n.h2,{id:`what-counts-as-data`,children:`What counts as data`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Ballots, not just rounds.`}),` When a round lists panel votes, each ballot is
its own comparison \u2014 a 3\u20130 is stronger evidence than a 2\u20131. Rounds without
votes count as one ballot for the winner.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Majors count double.`}),` Ballots at the tournaments marked as majors have a
likelihood weight of 2, on top of the side weight above.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Byes, forfeits and undecided rounds are skipped`}),` for the rating, though
they still count toward the raw win rates.`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`the-prior`,children:`The prior`}),`
`,(0,t.jsxs)(n.p,{children:[`The fit adds a ridge penalty of 1.0 on every skill \u2014 equivalent to a
`,(0,t.jsx)(n.code,{children:`N(0, 1)`}),` prior. Teams with only a few ballots are pulled toward
the field average, and an unbeaten team still gets a finite rating instead of
running off to infinity. A team with no decided rounds sits exactly at the
prior: field average, standard error 1.`]}),`
`,(0,t.jsx)(n.h2,{id:`from-skill-to-the-csv-columns`,children:`From skill to the CSV columns`}),`
`,(0,t.jsx)(n.p,{children:`Skills are reported on the familiar Elo scale, where 1500 is the field average
and 400 points is 10:1 odds:`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Column`}),(0,t.jsx)(n.th,{children:`Formula`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Rating`}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`1500 + (400 / ln 10) \u00D7 \u03B8`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Deviation`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`(400 / ln 10) \u00D7 SE(\u03B8)`}),` \u2014 the skill's standard error in rating points`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Adjusted Rating`}),(0,t.jsx)(n.td,{children:`Rating \u2212 2 \u00D7 Deviation \u2014 what the rank is sorted on`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Matches`}),(0,t.jsx)(n.td,{children:`Decided rounds debated (aff + neg)`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Aff Rating Advantage`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`(400 / ln 10) \u00D7 \u03B2`}),` \u2014 rating points the aff side is still worth, field-wide, after side balancing`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Aff / Neg Side Weight`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`w_aff`}),`, `,(0,t.jsx)(n.code,{children:`w_neg`}),` for prelim ballots`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Aff / Neg Elim Side Weight`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`w_aff`}),`, `,(0,t.jsx)(n.code,{children:`w_neg`}),` for elim ballots`]})]})]})]}),`
`,(0,t.jsx)(n.p,{children:`Adjusted Rating is a conservative estimate: a lightly tested team with a high
point estimate can't outrank a similarly rated, well-established one.`}),`
`,(0,t.jsx)(n.p,{children:`The win probability between two entries, ignoring side, is`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`\\[`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#005CC5`,"--shiki-dark":`#79B8FF`},children:`P(A \\text{ beats } B) = \\frac{1}{1 + 10^{(R_B - R_A)/400}}`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{style:{"--shiki-light":`#032F62`,"--shiki-dark":`#9ECBFF`},children:`\\]`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`on-this-site`,children:`On this site`}),`
`,(0,t.jsxs)(n.p,{children:[`The site shows every rating 1000 points lower and divided by 8, then clamped
to 0\u2013109 (`,(0,t.jsx)(n.code,{children:`RATING_OFFSET`}),`, `,(0,t.jsx)(n.code,{children:`RATING_DIVISOR`}),`, `,(0,t.jsx)(n.code,{children:`RATING_MIN`}),` and `,(0,t.jsx)(n.code,{children:`RATING_MAX`}),` in
`,(0,t.jsx)(n.code,{children:`debate-rankings-adapter`}),`). That puts the top handful of teams in each event
around 100 and the weakest teams at or near 0. The shift and scale keep ranks
and win probabilities unchanged; the clamp only ties the few teams past either
end. The aff rating advantage, being a difference, is only divided by 8.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Ratings are shown with at least two digits (`,(0,t.jsx)(n.code,{children:`07`}),`, not `,(0,t.jsx)(n.code,{children:`7`}),`). The leading
digits, `,(0,t.jsx)(n.code,{children:`0`}),` through `,(0,t.jsx)(n.code,{children:`10`}),`, are the team's tier and are shaded from gold at the
top tier down to gray at the bottom, so the tier boundaries stand out as you
scroll down the table.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};