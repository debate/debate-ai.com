import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Team Rankings`},r=`# Team Rankings [#team-rankings]

A current-season leaderboard of debate teams and debaters for PF, LD, Policy
(CX) and college policy (NDT), rated with a ballot-level Bradley-Terry model
fit to every tournament result of the season \u2014 see
[How Team Ratings Are Computed](/docs/features/ai-coaching/bradley-terry-debate-rankings).

- **Route:** \`/coaching/rankings\`
- **Package:** \`debate-videos\` (the page), \`debate-rankings\` (the ratings)

## What it shows [#what-it-shows]

Pick a division tab. Every column below can be sorted by clicking its
header, and the \u24D8 next to a header explains how the number is worked out.

| Column | Meaning |
| --- | --- |
| Rank | Position by adjusted rating |
| Name / School | The team (\`Last & Last\`) or LD debater, and their school |
| Adj. Rating | Bradley-Terry rating \u2212 2 \u00D7 its deviation (the skill's standard error), rounded to a whole number \u2014 what the rank is sorted on, so a team with only a few rounds can't top the list on luck |
| Matches | Decided rounds debated, aff plus neg (ballots at major tournaments weigh double in the rating, not in this count) |
| Aff Win / Neg Win | Share of rounds won on each side (raw \u2014 the rating itself weights each side's ballots so neither aff nor neg is favored, in prelims and elims separately) |
| Aff Elim Win / Neg Elim Win | Share of elimination rounds won on each side; a dash means no elims on that side |
| ID | A short stable id for the entry across tournaments |

Above the table: the number of ranked entries, the side bias across the
whole field (one chart with two aff vs. neg bars, prelims and elims, and the aff
side's rating advantage from the model's side term), and the list of
tournaments the ratings come from, with majors marked. A filter box narrows
the table by name or school.

### Schools tab [#schools-tab]

The **Schools** tab rolls every ranked entry up by school (All events, or one
division). Schools are ranked by their **Balanced** score (below).

| Column | Meaning |
| --- | --- |
| Best Rating | Highest adjusted rating among the school's entries |
| Top Entry | The entry holding that rating, and its event |
| Avg Rating | Mean adjusted rating across every ranked team (or LD debater) from the school |
| Balanced | What the rank is sorted on: 1.1 \u00D7 (0.7 \u00D7 the average of the school's top three entries + 0.3 \u00D7 (\u00BD Avg Rating + \u00BD depth)), capped at 109. Depth grows with the number of teams and reaches 100 at 15. Schools under four teams are diluted (\u00D70.80 for one team, \u00D70.87 for two, \u00D70.93 for three) |
| Teams | Number of ranked entries |
| Events | Events the school has entries in |

Ranking on **Balanced** is led by a school's best three entries, with
average quality and depth as the rest. A school with one or two strong
entries is diluted, so it doesn't top the table over a deep program whose top
three are just as strong.

### Legendary and gold rows [#legendary-and-gold-rows]

In every division table and on the Schools tab, a small group at the top is
**Legendary**: a thicker gold border, a soft glow and a small crowned
label naming the format, such as "PF Legend", "LD Legend" or "NDT Legend"
(after the team's name in division tables, beside the rank on the Schools
tab, where it reads just "Legend" with all events shown). Each list sets its own cutoff: it counts the
rows rated 90 or more and the rows rated 80 or more, and uses whichever count
is closer to five (on a list with no 80s it keeps going down by tens). So LD,
with four teams in the 90s and fourteen in the 80s, has four legendary teams,
while a list whose best rating is in the 80s takes everyone rated 80+. A list
never has more than seven legendary rows, and searching doesn't change who is
legendary. Any other row whose rating reads 80 or more (a bold leading **8**
or **9**) gets a thin gold border. The division tables use the adjusted
rating; the Schools tab uses the Balanced score.

In the division tables, the School column also shows each school's rank on the
Schools tab for that division as a small **#N** after the school's name.

LD has a second tab, **Sep\u2013Oct topic**, rated only from the tournaments on
the September\u2013October resolution.

The season selector still changes the champion and topic banner. Ratings
exist for the current season only, so earlier seasons show the banner alone,
with one exception: on **College NDT**, the 2009-10 through 2025-26 seasons
also show that season's top 100 teams as
[debatedata](https://debatedata.weebly.com) rated them. Those tables come from
a different model (a skill estimate, Mu, with an uncertainty, Sigma, ranked on
a conservative Rating below Mu), so their numbers are on that site's own scale
and can't be compared with current-season ratings. Seasons from 2010-11 through
2012-13 list schools by the short names the source used ("Georgetown",
"Cal State Fullerton").

Each of those seasons has a **Win probability** calculator above the table.
Pick an aff and a neg team, or type any Mu and Sigma, and it shows the aff's
chance of winning one round: each side's performance is drawn around its Mu,
spread by its Sigma plus a fixed 4.17 points of round-to-round noise, and the
higher draw wins. 2025-26 also shows debatedata's season stats for all
divisions, Open, Junior Varsity and Novice (schools, teams, debaters, rounds,
aff win rate overall and in elims, and speaker points), and lists the 27
tournaments its ratings come from under the table.

## Team and school pages [#team-and-school-pages]

Clicking a team or school opens its profile (\`/teams/<team>\`,
\`/schools/<school>\`): its stats per division, its radar chart, the round
videos it debated in, and its caselist documents. A school page also shows
its logo and its roster of teams and students when a coach or administrator
has claimed it \u2014 see [Claiming a School Page](/docs/features/team-collaboration/school-pages).

A team page opens with a blue record card: the team name, school and Follow
button, a pill per division it is ranked in (click one to switch the card and
radar to that division), and each division's rating. Below that the stats are
grouped into three bands: **Standing** (rating, rank, field percentile,
matches), **Win rates** (aff, neg, elim aff and elim neg) and **Rating model**
(raw rating, deviation, field size, divisions ranked).

Under a team's radar chart, a **Show school average** checkbox (off by default)
overlays a dashed polygon with the average of every ranked team from the same
school in that division, so you can see where the team beats its school. The
checkbox only appears when the school has another ranked team in the division.

The **Videos** section lists rounds, not lectures, and only in the divisions
the team or school is ranked in \u2014 a school ranked only in Policy shows only
Policy rounds, one ranked only in NDT only college rounds. A round counts when
its recorded aff or neg team names the school as whole words; the title is
searched only for a round with no teams recorded, and the description and
channel never are. The school is matched by its full name and by its short
forms: trailing words like *HS*, *Independent* or *College Prep* are dropped
(\`Gunn HS Independent\` \u2192 \`Gunn\`) and known circuit shorthand is added
(\`Glenbrook North\` \u2192 \`GBN\`). A team page also requires the team's initials
after the school (\`Strake Jesuit FS\`, in either order), and an LD debater
also matches by full name. Clicking a card's badge narrows the list further.

## Following a team or school [#following-a-team-or-school]

Every team and school page has a **Follow** button with its follower count
beside it. Signed out, the count still shows and the button reads *Sign in to
follow*. Following adds that team or school to the **Following** filter of
the [News Stream](/docs/features/team-collaboration/news-stream) (\`/news\`), which posts:

- **New rounds**: its three latest round videos, with who won on which side.
- **New research**: its two latest caselist documents.
- **Tournament results**: one line per tournament in the last 120 days, with
  the record and how far it went (*reached Quarterfinals*, *finished
  runner-up*, *won the tournament*).
- **Monthly recaps**: for each of the last three completed months it debated
  in, the month's record, its deep elim runs called out as big results, and
  an estimated rating change.

A user can follow up to 50 teams and schools. Follows are stored in the
\`profile_follows\` table (migration in \`packages/debate-videos/migrations\`)
and served by \`/api/follows\`; the feed items are built in \`debate-videos\`'
\`lib/follows/follow-feed.ts\` and loaded by its \`useFollowingNews\` hook.

## Picking an opponent when creating a round [#picking-an-opponent-when-creating-a-round]

The Create New Round dialog reads the same rankings. Once a school is
entered on either side, up to five of that school's teams in the round's
format appear as round badges under the field, best rank first. Clicking a
badge fills that side's debater names (\`Falk & Sabnani\` fills 1st and 2nd
speaker; an LD entry fills the one debater). A side's badges go away once its
debaters are filled in, so after both teams are entered none are left.

The tournament field suggests Tabroom tournaments running now or coming up
as soon as it is clicked, running ones first. When the round's tournament is
one of them, its schools in the round's format are listed first in the
(scrollable) school dropdown, and the badges show that school's entries at
the tournament instead of its ranked teams. Badges stay hidden for formats
without rankings and for schools with no teams. The lookups live in
\`debate-round\`'s \`round/school-teams.ts\` and \`round/tournament-field.ts\`; the
tournament data is read through \`@debate/tournaments/client\` from the app's
\`/api/tabroom-beta\` proxy.

## Matchup simulator [#matchup-simulator]

Pair any two ranked teams in a division and see who the ratings favour. The
simulator reads each division's full-season rankings
(\`<division>_full_rankings.csv\`), so every ranked team can be picked \u2014 filter
by name or school, or hit **Random opponent**.

Each side is simulated separately: team A locked **aff**, then team A locked
**neg**, so you can see which side a team does better on. Pick **Aff**,
**Neg** or **Both**, and **Prelim** (one judge), **Elim** (3- and 5-judge
panels) or **Both**. With both sides shown, it says which side team A should
take on a coin flip, and by how many points. **Simulate 1,000 rounds per
side** plays each side out to show the spread a percentage hides.

### What goes into the rating [#what-goes-into-the-rating]

Each team's rating is a blend of three signals, set by two sliders:

- **Team**: the pairing's own rating.
- **Individual performance**: how each debater rates in their *other*
  entries at the same school, in any division (other partners, or LD). A
  pair that only does well together, or a debater who carries every partner,
  shows up here. Teams whose debaters have no other entries just use the
  team rating.
- **School performance**: the average rating of every entry the school has
  in the division. This is program strength (coaching, shared files) rather
  than the pair itself.

Under each team the simulator shows all three numbers, the blend, and a
**recommended** mix for that team. A team with few rounds of its own leans
more on its school (15 rounds \u2192 50%, 60 \u2192 20%). A team whose debaters have
other entries leans more on those, up to half. Click it to apply it.

The side effect has two parts: the field's aff/neg split for the stage (elims
often lean further than prelims), and each team's own aff-vs-neg record
beyond the field's, shrunk toward zero for teams with few rounds. A team's
elim-only rates come from a handful of rounds, so its tilt always comes from
its overall record.

The base probability is Glicko-2's expected score, the same formula as
upstream's \`simulate_round.py\` (skelo's \`Glicko2Model.compute_prob\`): ratings
are converted back to Glicko-2's 1500 scale, and the result is
\`1 / (1 + exp(\u2212g(\u03C6_opp) \u00B7 (\u03BC \u2212 \u03BC_opp)))\`. The side shift is added in
log-odds. Panel odds assume each ballot is independent at that probability.

### Your team, pre-filled [#your-team-pre-filled]

**Settings \u2192 My team** sets your role (debater, coach, or assistant/judge),
your partner, and the ranked team you represent in each division. It's saved
in this browser and, when you're signed in, to your account
(\`/api/settings\`' \`myRankedTeams\`). The simulator starts from it.

It appears in two places:

- **Practice round** (\`/practice\`): side A starts as your team for the
  division, and both sides can be changed.
- **Every team profile** (\`/teams/<team>\`): if you have a team set for that
  division, **Simulate vs. any ranked team** pits your team (side A) against
  the profile's team. On your own profile, or with no team set, the profile's
  team is locked in as side A and any other ranked team can be its opponent.

The math lives in \`@debate/rankings-adapter\`: \`match-simulation.ts\` (Glicko-2)
and \`matchup-model.ts\` (blending, side terms, recommendations). The UI is
\`debate-videos\`' \`MatchupSimulator\`, composed on the practice page by
\`debate-practice-rounds\`' \`TeamMatchupSimulatorPanel\`. The setting is
\`debate-videos\`' \`lib/my-ranked-teams\` and \`MyRankedTeamsSettings\`.

## Known gaps [#known-gaps]

The matchup simulator's individual rating finds a debater's other entries by
surname and school, so two debaters with the same surname at one school are
merged, and someone who changed schools isn't linked. The rankings carry no
speaker points, so individual skill is only inferred from other pairings.
The partner name in **My team** is informational and doesn't change the
model.

A profile's Videos section only finds a round whose team label or title spells
the school the way the rankings do, or by one of the short forms above. A
round recorded under an unlisted abbreviation is missed, and a school whose
short name another school shares (two *Memorial* high schools) can show the
other's rounds.

Followed teams' results and recaps come from the round video library, so a
tournament's record counts only the rounds someone recorded, and a round is
dated by its upload, not the day it was debated. The rankings keep no
history, so a recap's rating change is an estimate: each decided round moves
the rating by 32 \u00D7 (result \u2212 expected) on the upstream scale, the expected
score coming from both teams' current ratings. Nothing is emailed; the recap
only appears in the News Stream.

Ratings cover only the tournaments listed above the table; a team that hasn't
attended one of them is not ranked. The list updates when the rankings are
recomputed, not live.
`,i={contents:[{heading:`team-rankings`,content:`A current-season leaderboard of debate teams and debaters for PF, LD, Policy
(CX) and college policy (NDT), rated with a ballot-level Bradley-Terry model
fit to every tournament result of the season \u2014 see
How Team Ratings Are Computed.`},{heading:`team-rankings`,content:"**Route:** `/coaching/rankings`"},{heading:`team-rankings`,content:"**Package:** `debate-videos` (the page), `debate-rankings` (the ratings)"},{heading:`what-it-shows`,content:`Pick a division tab. Every column below can be sorted by clicking its
header, and the \u24D8 next to a header explains how the number is worked out.`},{heading:`what-it-shows`,content:`| Column | Meaning                     |
| ------ | --------------------------- |
| Rank   | Position by adjusted rating |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column        | Meaning                                                  |
| ------------- | -------------------------------------------------------- |
| Name / School | The team (\`Last & Last\`) or LD debater, and their school |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column      | Meaning                                                                                                                                                                                    |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Adj. Rating | Bradley-Terry rating \u2212 2 \u00D7 its deviation (the skill's standard error), rounded to a whole number \u2014 what the rank is sorted on, so a team with only a few rounds can't top the list on luck |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column  | Meaning                                                                                                           |
| ------- | ----------------------------------------------------------------------------------------------------------------- |
| Matches | Decided rounds debated, aff plus neg (ballots at major tournaments weigh double in the rating, not in this count) |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column            | Meaning                                                                                                                                                   |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Aff Win / Neg Win | Share of rounds won on each side (raw \u2014 the rating itself weights each side's ballots so neither aff nor neg is favored, in prelims and elims separately) |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column                      | Meaning                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| Aff Elim Win / Neg Elim Win | Share of elimination rounds won on each side; a dash means no elims on that side |`,table:`table-0`},{heading:`what-it-shows`,content:`| Column | Meaning                                            |
| ------ | -------------------------------------------------- |
| ID     | A short stable id for the entry across tournaments |`,table:`table-0`},{heading:`what-it-shows`,content:`Above the table: the number of ranked entries, the side bias across the
whole field (one chart with two aff vs. neg bars, prelims and elims, and the aff
side's rating advantage from the model's side term), and the list of
tournaments the ratings come from, with majors marked. A filter box narrows
the table by name or school.`},{heading:`schools-tab`,content:`The **Schools** tab rolls every ranked entry up by school (All events, or one
division). Schools are ranked by their **Balanced** score (below).`},{heading:`schools-tab`,content:`| Column      | Meaning                                            |
| ----------- | -------------------------------------------------- |
| Best Rating | Highest adjusted rating among the school's entries |`,table:`table-1`},{heading:`schools-tab`,content:`| Column    | Meaning                                      |
| --------- | -------------------------------------------- |
| Top Entry | The entry holding that rating, and its event |`,table:`table-1`},{heading:`schools-tab`,content:`| Column     | Meaning                                                                       |
| ---------- | ----------------------------------------------------------------------------- |
| Avg Rating | Mean adjusted rating across every ranked team (or LD debater) from the school |`,table:`table-1`},{heading:`schools-tab`,content:`| Column   | Meaning                                                                                                                                                                                                                                                                                        |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Balanced | What the rank is sorted on: 1.1 \u00D7 (0.7 \u00D7 the average of the school's top three entries + 0.3 \u00D7 (\u00BD Avg Rating + \u00BD depth)), capped at 109. Depth grows with the number of teams and reaches 100 at 15. Schools under four teams are diluted (\u00D70.80 for one team, \u00D70.87 for two, \u00D70.93 for three) |`,table:`table-1`},{heading:`schools-tab`,content:`| Column | Meaning                  |
| ------ | ------------------------ |
| Teams  | Number of ranked entries |`,table:`table-1`},{heading:`schools-tab`,content:`| Column | Meaning                          |
| ------ | -------------------------------- |
| Events | Events the school has entries in |`,table:`table-1`},{heading:`schools-tab`,content:`Ranking on **Balanced** is led by a school's best three entries, with
average quality and depth as the rest. A school with one or two strong
entries is diluted, so it doesn't top the table over a deep program whose top
three are just as strong.`},{heading:`legendary-and-gold-rows`,content:`In every division table and on the Schools tab, a small group at the top is
**Legendary**: a thicker gold border, a soft glow and a small crowned
label naming the format, such as "PF Legend", "LD Legend" or "NDT Legend"
(after the team's name in division tables, beside the rank on the Schools
tab, where it reads just "Legend" with all events shown). Each list sets its own cutoff: it counts the
rows rated 90 or more and the rows rated 80 or more, and uses whichever count
is closer to five (on a list with no 80s it keeps going down by tens). So LD,
with four teams in the 90s and fourteen in the 80s, has four legendary teams,
while a list whose best rating is in the 80s takes everyone rated 80+. A list
never has more than seven legendary rows, and searching doesn't change who is
legendary. Any other row whose rating reads 80 or more (a bold leading **8**
or **9**) gets a thin gold border. The division tables use the adjusted
rating; the Schools tab uses the Balanced score.`},{heading:`legendary-and-gold-rows`,content:`In the division tables, the School column also shows each school's rank on the
Schools tab for that division as a small **#N** after the school's name.`},{heading:`legendary-and-gold-rows`,content:`LD has a second tab, **Sep\u2013Oct topic**, rated only from the tournaments on
the September\u2013October resolution.`},{heading:`legendary-and-gold-rows`,content:`The season selector still changes the champion and topic banner. Ratings
exist for the current season only, so earlier seasons show the banner alone,
with one exception: on **College NDT**, the 2009-10 through 2025-26 seasons
also show that season's top 100 teams as
debatedata rated them. Those tables come from
a different model (a skill estimate, Mu, with an uncertainty, Sigma, ranked on
a conservative Rating below Mu), so their numbers are on that site's own scale
and can't be compared with current-season ratings. Seasons from 2010-11 through
2012-13 list schools by the short names the source used ("Georgetown",
"Cal State Fullerton").`},{heading:`legendary-and-gold-rows`,content:`Each of those seasons has a **Win probability** calculator above the table.
Pick an aff and a neg team, or type any Mu and Sigma, and it shows the aff's
chance of winning one round: each side's performance is drawn around its Mu,
spread by its Sigma plus a fixed 4.17 points of round-to-round noise, and the
higher draw wins. 2025-26 also shows debatedata's season stats for all
divisions, Open, Junior Varsity and Novice (schools, teams, debaters, rounds,
aff win rate overall and in elims, and speaker points), and lists the 27
tournaments its ratings come from under the table.`},{heading:`team-and-school-pages`,content:`Clicking a team or school opens its profile (\`/teams/<team>\`,
\`/schools/<school>\`): its stats per division, its radar chart, the round
videos it debated in, and its caselist documents. A school page also shows
its logo and its roster of teams and students when a coach or administrator
has claimed it \u2014 see Claiming a School Page.`},{heading:`team-and-school-pages`,content:`A team page opens with a blue record card: the team name, school and Follow
button, a pill per division it is ranked in (click one to switch the card and
radar to that division), and each division's rating. Below that the stats are
grouped into three bands: **Standing** (rating, rank, field percentile,
matches), **Win rates** (aff, neg, elim aff and elim neg) and **Rating model**
(raw rating, deviation, field size, divisions ranked).`},{heading:`team-and-school-pages`,content:`Under a team's radar chart, a **Show school average** checkbox (off by default)
overlays a dashed polygon with the average of every ranked team from the same
school in that division, so you can see where the team beats its school. The
checkbox only appears when the school has another ranked team in the division.`},{heading:`team-and-school-pages`,content:`The **Videos** section lists rounds, not lectures, and only in the divisions
the team or school is ranked in \u2014 a school ranked only in Policy shows only
Policy rounds, one ranked only in NDT only college rounds. A round counts when
its recorded aff or neg team names the school as whole words; the title is
searched only for a round with no teams recorded, and the description and
channel never are. The school is matched by its full name and by its short
forms: trailing words like *HS*, *Independent* or *College Prep* are dropped
(\`Gunn HS Independent\` \u2192 \`Gunn\`) and known circuit shorthand is added
(\`Glenbrook North\` \u2192 \`GBN\`). A team page also requires the team's initials
after the school (\`Strake Jesuit FS\`, in either order), and an LD debater
also matches by full name. Clicking a card's badge narrows the list further.`},{heading:`following-a-team-or-school`,content:`Every team and school page has a **Follow** button with its follower count
beside it. Signed out, the count still shows and the button reads *Sign in to
follow*. Following adds that team or school to the **Following** filter of
the News Stream (\`/news\`), which posts:`},{heading:`following-a-team-or-school`,content:`**New rounds**: its three latest round videos, with who won on which side.`},{heading:`following-a-team-or-school`,content:`**New research**: its two latest caselist documents.`},{heading:`following-a-team-or-school`,content:`**Tournament results**: one line per tournament in the last 120 days, with
the record and how far it went (*reached Quarterfinals*, *finished
runner-up*, *won the tournament*).`},{heading:`following-a-team-or-school`,content:`**Monthly recaps**: for each of the last three completed months it debated
in, the month's record, its deep elim runs called out as big results, and
an estimated rating change.`},{heading:`following-a-team-or-school`,content:"A user can follow up to 50 teams and schools. Follows are stored in the\n`profile_follows` table (migration in `packages/debate-videos/migrations`)\nand served by `/api/follows`; the feed items are built in `debate-videos`'\n`lib/follows/follow-feed.ts` and loaded by its `useFollowingNews` hook."},{heading:`picking-an-opponent-when-creating-a-round`,content:`The Create New Round dialog reads the same rankings. Once a school is
entered on either side, up to five of that school's teams in the round's
format appear as round badges under the field, best rank first. Clicking a
badge fills that side's debater names (\`Falk & Sabnani\` fills 1st and 2nd
speaker; an LD entry fills the one debater). A side's badges go away once its
debaters are filled in, so after both teams are entered none are left.`},{heading:`picking-an-opponent-when-creating-a-round`,content:"The tournament field suggests Tabroom tournaments running now or coming up\nas soon as it is clicked, running ones first. When the round's tournament is\none of them, its schools in the round's format are listed first in the\n(scrollable) school dropdown, and the badges show that school's entries at\nthe tournament instead of its ranked teams. Badges stay hidden for formats\nwithout rankings and for schools with no teams. The lookups live in\n`debate-round`'s `round/school-teams.ts` and `round/tournament-field.ts`; the\ntournament data is read through `@debate/tournaments/client` from the app's\n`/api/tabroom-beta` proxy."},{heading:`matchup-simulator`,content:`Pair any two ranked teams in a division and see who the ratings favour. The
simulator reads each division's full-season rankings
(\`<division>_full_rankings.csv\`), so every ranked team can be picked \u2014 filter
by name or school, or hit **Random opponent**.`},{heading:`matchup-simulator`,content:`Each side is simulated separately: team A locked **aff**, then team A locked
**neg**, so you can see which side a team does better on. Pick **Aff**,
**Neg** or **Both**, and **Prelim** (one judge), **Elim** (3- and 5-judge
panels) or **Both**. With both sides shown, it says which side team A should
take on a coin flip, and by how many points. **Simulate 1,000 rounds per
side** plays each side out to show the spread a percentage hides.`},{heading:`what-goes-into-the-rating`,content:`Each team's rating is a blend of three signals, set by two sliders:`},{heading:`what-goes-into-the-rating`,content:`**Team**: the pairing's own rating.`},{heading:`what-goes-into-the-rating`,content:`**Individual performance**: how each debater rates in their *other*
entries at the same school, in any division (other partners, or LD). A
pair that only does well together, or a debater who carries every partner,
shows up here. Teams whose debaters have no other entries just use the
team rating.`},{heading:`what-goes-into-the-rating`,content:`**School performance**: the average rating of every entry the school has
in the division. This is program strength (coaching, shared files) rather
than the pair itself.`},{heading:`what-goes-into-the-rating`,content:`Under each team the simulator shows all three numbers, the blend, and a
**recommended** mix for that team. A team with few rounds of its own leans
more on its school (15 rounds \u2192 50%, 60 \u2192 20%). A team whose debaters have
other entries leans more on those, up to half. Click it to apply it.`},{heading:`what-goes-into-the-rating`,content:`The side effect has two parts: the field's aff/neg split for the stage (elims
often lean further than prelims), and each team's own aff-vs-neg record
beyond the field's, shrunk toward zero for teams with few rounds. A team's
elim-only rates come from a handful of rounds, so its tilt always comes from
its overall record.`},{heading:`what-goes-into-the-rating`,content:"The base probability is Glicko-2's expected score, the same formula as\nupstream's `simulate_round.py` (skelo's `Glicko2Model.compute_prob`): ratings\nare converted back to Glicko-2's 1500 scale, and the result is\n`1 / (1 + exp(\u2212g(\u03C6_opp) \u00B7 (\u03BC \u2212 \u03BC_opp)))`. The side shift is added in\nlog-odds. Panel odds assume each ballot is independent at that probability."},{heading:`your-team-pre-filled`,content:"**Settings \u2192 My team** sets your role (debater, coach, or assistant/judge),\nyour partner, and the ranked team you represent in each division. It's saved\nin this browser and, when you're signed in, to your account\n(`/api/settings`' `myRankedTeams`). The simulator starts from it."},{heading:`your-team-pre-filled`,content:`It appears in two places:`},{heading:`your-team-pre-filled`,content:"**Practice round** (`/practice`): side A starts as your team for the\ndivision, and both sides can be changed."},{heading:`your-team-pre-filled`,content:`**Every team profile** (\`/teams/<team>\`): if you have a team set for that
division, **Simulate vs. any ranked team** pits your team (side A) against
the profile's team. On your own profile, or with no team set, the profile's
team is locked in as side A and any other ranked team can be its opponent.`},{heading:`your-team-pre-filled`,content:"The math lives in `@debate/rankings-adapter`: `match-simulation.ts` (Glicko-2)\nand `matchup-model.ts` (blending, side terms, recommendations). The UI is\n`debate-videos`' `MatchupSimulator`, composed on the practice page by\n`debate-practice-rounds`' `TeamMatchupSimulatorPanel`. The setting is\n`debate-videos`' `lib/my-ranked-teams` and `MyRankedTeamsSettings`."},{heading:`known-gaps`,content:`The matchup simulator's individual rating finds a debater's other entries by
surname and school, so two debaters with the same surname at one school are
merged, and someone who changed schools isn't linked. The rankings carry no
speaker points, so individual skill is only inferred from other pairings.
The partner name in **My team** is informational and doesn't change the
model.`},{heading:`known-gaps`,content:`A profile's Videos section only finds a round whose team label or title spells
the school the way the rankings do, or by one of the short forms above. A
round recorded under an unlisted abbreviation is missed, and a school whose
short name another school shares (two *Memorial* high schools) can show the
other's rounds.`},{heading:`known-gaps`,content:`Followed teams' results and recaps come from the round video library, so a
tournament's record counts only the rounds someone recorded, and a round is
dated by its upload, not the day it was debated. The rankings keep no
history, so a recap's rating change is an estimate: each decided round moves
the rating by 32 \u00D7 (result \u2212 expected) on the upstream scale, the expected
score coming from both teams' current ratings. Nothing is emailed; the recap
only appears in the News Stream.`},{heading:`known-gaps`,content:`Ratings cover only the tournaments listed above the table; a team that hasn't
attended one of them is not ranked. The list updates when the rankings are
recomputed, not live.`}],headings:[{id:`team-rankings`,content:`Team Rankings`},{id:`what-it-shows`,content:`What it shows`},{id:`schools-tab`,content:`Schools tab`},{id:`legendary-and-gold-rows`,content:`Legendary and gold rows`},{id:`team-and-school-pages`,content:`Team and school pages`},{id:`following-a-team-or-school`,content:`Following a team or school`},{id:`picking-an-opponent-when-creating-a-round`,content:`Picking an opponent when creating a round`},{id:`matchup-simulator`,content:`Matchup simulator`},{id:`what-goes-into-the-rating`,content:`What goes into the rating`},{id:`your-team-pre-filled`,content:`Your team, pre-filled`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#team-rankings`,title:(0,t.jsx)(t.Fragment,{children:`Team Rankings`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:3,url:`#schools-tab`,title:(0,t.jsx)(t.Fragment,{children:`Schools tab`})},{depth:3,url:`#legendary-and-gold-rows`,title:(0,t.jsx)(t.Fragment,{children:`Legendary and gold rows`})},{depth:2,url:`#team-and-school-pages`,title:(0,t.jsx)(t.Fragment,{children:`Team and school pages`})},{depth:2,url:`#following-a-team-or-school`,title:(0,t.jsx)(t.Fragment,{children:`Following a team or school`})},{depth:2,url:`#picking-an-opponent-when-creating-a-round`,title:(0,t.jsx)(t.Fragment,{children:`Picking an opponent when creating a round`})},{depth:2,url:`#matchup-simulator`,title:(0,t.jsx)(t.Fragment,{children:`Matchup simulator`})},{depth:3,url:`#what-goes-into-the-rating`,title:(0,t.jsx)(t.Fragment,{children:`What goes into the rating`})},{depth:3,url:`#your-team-pre-filled`,title:(0,t.jsx)(t.Fragment,{children:`Your team, pre-filled`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,h3:`h3`,li:`li`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`team-rankings`,children:`Team Rankings`}),`
`,(0,t.jsxs)(n.p,{children:[`A current-season leaderboard of debate teams and debaters for PF, LD, Policy
(CX) and college policy (NDT), rated with a ballot-level Bradley-Terry model
fit to every tournament result of the season \u2014 see
`,(0,t.jsx)(n.a,{href:`/docs/features/ai-coaching/bradley-terry-debate-rankings`,children:`How Team Ratings Are Computed`}),`.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/coaching/rankings`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-videos`}),` (the page), `,(0,t.jsx)(n.code,{children:`debate-rankings`}),` (the ratings)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`Pick a division tab. Every column below can be sorted by clicking its
header, and the \u24D8 next to a header explains how the number is worked out.`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Column`}),(0,t.jsx)(n.th,{children:`Meaning`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Rank`}),(0,t.jsx)(n.td,{children:`Position by adjusted rating`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Name / School`}),(0,t.jsxs)(n.td,{children:[`The team (`,(0,t.jsx)(n.code,{children:`Last & Last`}),`) or LD debater, and their school`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Adj. Rating`}),(0,t.jsx)(n.td,{children:`Bradley-Terry rating \u2212 2 \u00D7 its deviation (the skill's standard error), rounded to a whole number \u2014 what the rank is sorted on, so a team with only a few rounds can't top the list on luck`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Matches`}),(0,t.jsx)(n.td,{children:`Decided rounds debated, aff plus neg (ballots at major tournaments weigh double in the rating, not in this count)`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Aff Win / Neg Win`}),(0,t.jsx)(n.td,{children:`Share of rounds won on each side (raw \u2014 the rating itself weights each side's ballots so neither aff nor neg is favored, in prelims and elims separately)`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Aff Elim Win / Neg Elim Win`}),(0,t.jsx)(n.td,{children:`Share of elimination rounds won on each side; a dash means no elims on that side`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`ID`}),(0,t.jsx)(n.td,{children:`A short stable id for the entry across tournaments`})]})]})]}),`
`,(0,t.jsx)(n.p,{children:`Above the table: the number of ranked entries, the side bias across the
whole field (one chart with two aff vs. neg bars, prelims and elims, and the aff
side's rating advantage from the model's side term), and the list of
tournaments the ratings come from, with majors marked. A filter box narrows
the table by name or school.`}),`
`,(0,t.jsx)(n.h3,{id:`schools-tab`,children:`Schools tab`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Schools`}),` tab rolls every ranked entry up by school (All events, or one
division). Schools are ranked by their `,(0,t.jsx)(n.strong,{children:`Balanced`}),` score (below).`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Column`}),(0,t.jsx)(n.th,{children:`Meaning`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Best Rating`}),(0,t.jsx)(n.td,{children:`Highest adjusted rating among the school's entries`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Top Entry`}),(0,t.jsx)(n.td,{children:`The entry holding that rating, and its event`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Avg Rating`}),(0,t.jsx)(n.td,{children:`Mean adjusted rating across every ranked team (or LD debater) from the school`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Balanced`}),(0,t.jsx)(n.td,{children:`What the rank is sorted on: 1.1 \u00D7 (0.7 \u00D7 the average of the school's top three entries + 0.3 \u00D7 (\u00BD Avg Rating + \u00BD depth)), capped at 109. Depth grows with the number of teams and reaches 100 at 15. Schools under four teams are diluted (\u00D70.80 for one team, \u00D70.87 for two, \u00D70.93 for three)`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Teams`}),(0,t.jsx)(n.td,{children:`Number of ranked entries`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Events`}),(0,t.jsx)(n.td,{children:`Events the school has entries in`})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`Ranking on `,(0,t.jsx)(n.strong,{children:`Balanced`}),` is led by a school's best three entries, with
average quality and depth as the rest. A school with one or two strong
entries is diluted, so it doesn't top the table over a deep program whose top
three are just as strong.`]}),`
`,(0,t.jsx)(n.h3,{id:`legendary-and-gold-rows`,children:`Legendary and gold rows`}),`
`,(0,t.jsxs)(n.p,{children:[`In every division table and on the Schools tab, a small group at the top is
`,(0,t.jsx)(n.strong,{children:`Legendary`}),`: a thicker gold border, a soft glow and a small crowned
label naming the format, such as "PF Legend", "LD Legend" or "NDT Legend"
(after the team's name in division tables, beside the rank on the Schools
tab, where it reads just "Legend" with all events shown). Each list sets its own cutoff: it counts the
rows rated 90 or more and the rows rated 80 or more, and uses whichever count
is closer to five (on a list with no 80s it keeps going down by tens). So LD,
with four teams in the 90s and fourteen in the 80s, has four legendary teams,
while a list whose best rating is in the 80s takes everyone rated 80+. A list
never has more than seven legendary rows, and searching doesn't change who is
legendary. Any other row whose rating reads 80 or more (a bold leading `,(0,t.jsx)(n.strong,{children:`8`}),`
or `,(0,t.jsx)(n.strong,{children:`9`}),`) gets a thin gold border. The division tables use the adjusted
rating; the Schools tab uses the Balanced score.`]}),`
`,(0,t.jsxs)(n.p,{children:[`In the division tables, the School column also shows each school's rank on the
Schools tab for that division as a small `,(0,t.jsx)(n.strong,{children:`#N`}),` after the school's name.`]}),`
`,(0,t.jsxs)(n.p,{children:[`LD has a second tab, `,(0,t.jsx)(n.strong,{children:`Sep\u2013Oct topic`}),`, rated only from the tournaments on
the September\u2013October resolution.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The season selector still changes the champion and topic banner. Ratings
exist for the current season only, so earlier seasons show the banner alone,
with one exception: on `,(0,t.jsx)(n.strong,{children:`College NDT`}),`, the 2009-10 through 2025-26 seasons
also show that season's top 100 teams as
`,(0,t.jsx)(n.a,{href:`https://debatedata.weebly.com`,children:`debatedata`}),` rated them. Those tables come from
a different model (a skill estimate, Mu, with an uncertainty, Sigma, ranked on
a conservative Rating below Mu), so their numbers are on that site's own scale
and can't be compared with current-season ratings. Seasons from 2010-11 through
2012-13 list schools by the short names the source used ("Georgetown",
"Cal State Fullerton").`]}),`
`,(0,t.jsxs)(n.p,{children:[`Each of those seasons has a `,(0,t.jsx)(n.strong,{children:`Win probability`}),` calculator above the table.
Pick an aff and a neg team, or type any Mu and Sigma, and it shows the aff's
chance of winning one round: each side's performance is drawn around its Mu,
spread by its Sigma plus a fixed 4.17 points of round-to-round noise, and the
higher draw wins. 2025-26 also shows debatedata's season stats for all
divisions, Open, Junior Varsity and Novice (schools, teams, debaters, rounds,
aff win rate overall and in elims, and speaker points), and lists the 27
tournaments its ratings come from under the table.`]}),`
`,(0,t.jsx)(n.h2,{id:`team-and-school-pages`,children:`Team and school pages`}),`
`,(0,t.jsxs)(n.p,{children:[`Clicking a team or school opens its profile (`,(0,t.jsx)(n.code,{children:`/teams/<team>`}),`,
`,(0,t.jsx)(n.code,{children:`/schools/<school>`}),`): its stats per division, its radar chart, the round
videos it debated in, and its caselist documents. A school page also shows
its logo and its roster of teams and students when a coach or administrator
has claimed it \u2014 see `,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/school-pages`,children:`Claiming a School Page`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`A team page opens with a blue record card: the team name, school and Follow
button, a pill per division it is ranked in (click one to switch the card and
radar to that division), and each division's rating. Below that the stats are
grouped into three bands: `,(0,t.jsx)(n.strong,{children:`Standing`}),` (rating, rank, field percentile,
matches), `,(0,t.jsx)(n.strong,{children:`Win rates`}),` (aff, neg, elim aff and elim neg) and `,(0,t.jsx)(n.strong,{children:`Rating model`}),`
(raw rating, deviation, field size, divisions ranked).`]}),`
`,(0,t.jsxs)(n.p,{children:[`Under a team's radar chart, a `,(0,t.jsx)(n.strong,{children:`Show school average`}),` checkbox (off by default)
overlays a dashed polygon with the average of every ranked team from the same
school in that division, so you can see where the team beats its school. The
checkbox only appears when the school has another ranked team in the division.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Videos`}),` section lists rounds, not lectures, and only in the divisions
the team or school is ranked in \u2014 a school ranked only in Policy shows only
Policy rounds, one ranked only in NDT only college rounds. A round counts when
its recorded aff or neg team names the school as whole words; the title is
searched only for a round with no teams recorded, and the description and
channel never are. The school is matched by its full name and by its short
forms: trailing words like `,(0,t.jsx)(n.em,{children:`HS`}),`, `,(0,t.jsx)(n.em,{children:`Independent`}),` or `,(0,t.jsx)(n.em,{children:`College Prep`}),` are dropped
(`,(0,t.jsx)(n.code,{children:`Gunn HS Independent`}),` \u2192 `,(0,t.jsx)(n.code,{children:`Gunn`}),`) and known circuit shorthand is added
(`,(0,t.jsx)(n.code,{children:`Glenbrook North`}),` \u2192 `,(0,t.jsx)(n.code,{children:`GBN`}),`). A team page also requires the team's initials
after the school (`,(0,t.jsx)(n.code,{children:`Strake Jesuit FS`}),`, in either order), and an LD debater
also matches by full name. Clicking a card's badge narrows the list further.`]}),`
`,(0,t.jsx)(n.h2,{id:`following-a-team-or-school`,children:`Following a team or school`}),`
`,(0,t.jsxs)(n.p,{children:[`Every team and school page has a `,(0,t.jsx)(n.strong,{children:`Follow`}),` button with its follower count
beside it. Signed out, the count still shows and the button reads `,(0,t.jsx)(n.em,{children:`Sign in to
follow`}),`. Following adds that team or school to the `,(0,t.jsx)(n.strong,{children:`Following`}),` filter of
the `,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/news-stream`,children:`News Stream`}),` (`,(0,t.jsx)(n.code,{children:`/news`}),`), which posts:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`New rounds`}),`: its three latest round videos, with who won on which side.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`New research`}),`: its two latest caselist documents.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Tournament results`}),`: one line per tournament in the last 120 days, with
the record and how far it went (`,(0,t.jsx)(n.em,{children:`reached Quarterfinals`}),`, `,(0,t.jsx)(n.em,{children:`finished
runner-up`}),`, `,(0,t.jsx)(n.em,{children:`won the tournament`}),`).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Monthly recaps`}),`: for each of the last three completed months it debated
in, the month's record, its deep elim runs called out as big results, and
an estimated rating change.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`A user can follow up to 50 teams and schools. Follows are stored in the
`,(0,t.jsx)(n.code,{children:`profile_follows`}),` table (migration in `,(0,t.jsx)(n.code,{children:`packages/debate-videos/migrations`}),`)
and served by `,(0,t.jsx)(n.code,{children:`/api/follows`}),`; the feed items are built in `,(0,t.jsx)(n.code,{children:`debate-videos`}),`'
`,(0,t.jsx)(n.code,{children:`lib/follows/follow-feed.ts`}),` and loaded by its `,(0,t.jsx)(n.code,{children:`useFollowingNews`}),` hook.`]}),`
`,(0,t.jsx)(n.h2,{id:`picking-an-opponent-when-creating-a-round`,children:`Picking an opponent when creating a round`}),`
`,(0,t.jsxs)(n.p,{children:[`The Create New Round dialog reads the same rankings. Once a school is
entered on either side, up to five of that school's teams in the round's
format appear as round badges under the field, best rank first. Clicking a
badge fills that side's debater names (`,(0,t.jsx)(n.code,{children:`Falk & Sabnani`}),` fills 1st and 2nd
speaker; an LD entry fills the one debater). A side's badges go away once its
debaters are filled in, so after both teams are entered none are left.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The tournament field suggests Tabroom tournaments running now or coming up
as soon as it is clicked, running ones first. When the round's tournament is
one of them, its schools in the round's format are listed first in the
(scrollable) school dropdown, and the badges show that school's entries at
the tournament instead of its ranked teams. Badges stay hidden for formats
without rankings and for schools with no teams. The lookups live in
`,(0,t.jsx)(n.code,{children:`debate-round`}),`'s `,(0,t.jsx)(n.code,{children:`round/school-teams.ts`}),` and `,(0,t.jsx)(n.code,{children:`round/tournament-field.ts`}),`; the
tournament data is read through `,(0,t.jsx)(n.code,{children:`@debate/tournaments/client`}),` from the app's
`,(0,t.jsx)(n.code,{children:`/api/tabroom-beta`}),` proxy.`]}),`
`,(0,t.jsx)(n.h2,{id:`matchup-simulator`,children:`Matchup simulator`}),`
`,(0,t.jsxs)(n.p,{children:[`Pair any two ranked teams in a division and see who the ratings favour. The
simulator reads each division's full-season rankings
(`,(0,t.jsx)(n.code,{children:`<division>_full_rankings.csv`}),`), so every ranked team can be picked \u2014 filter
by name or school, or hit `,(0,t.jsx)(n.strong,{children:`Random opponent`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Each side is simulated separately: team A locked `,(0,t.jsx)(n.strong,{children:`aff`}),`, then team A locked
`,(0,t.jsx)(n.strong,{children:`neg`}),`, so you can see which side a team does better on. Pick `,(0,t.jsx)(n.strong,{children:`Aff`}),`,
`,(0,t.jsx)(n.strong,{children:`Neg`}),` or `,(0,t.jsx)(n.strong,{children:`Both`}),`, and `,(0,t.jsx)(n.strong,{children:`Prelim`}),` (one judge), `,(0,t.jsx)(n.strong,{children:`Elim`}),` (3- and 5-judge
panels) or `,(0,t.jsx)(n.strong,{children:`Both`}),`. With both sides shown, it says which side team A should
take on a coin flip, and by how many points. `,(0,t.jsx)(n.strong,{children:`Simulate 1,000 rounds per
side`}),` plays each side out to show the spread a percentage hides.`]}),`
`,(0,t.jsx)(n.h3,{id:`what-goes-into-the-rating`,children:`What goes into the rating`}),`
`,(0,t.jsx)(n.p,{children:`Each team's rating is a blend of three signals, set by two sliders:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Team`}),`: the pairing's own rating.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Individual performance`}),`: how each debater rates in their `,(0,t.jsx)(n.em,{children:`other`}),`
entries at the same school, in any division (other partners, or LD). A
pair that only does well together, or a debater who carries every partner,
shows up here. Teams whose debaters have no other entries just use the
team rating.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`School performance`}),`: the average rating of every entry the school has
in the division. This is program strength (coaching, shared files) rather
than the pair itself.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`Under each team the simulator shows all three numbers, the blend, and a
`,(0,t.jsx)(n.strong,{children:`recommended`}),` mix for that team. A team with few rounds of its own leans
more on its school (15 rounds \u2192 50%, 60 \u2192 20%). A team whose debaters have
other entries leans more on those, up to half. Click it to apply it.`]}),`
`,(0,t.jsx)(n.p,{children:`The side effect has two parts: the field's aff/neg split for the stage (elims
often lean further than prelims), and each team's own aff-vs-neg record
beyond the field's, shrunk toward zero for teams with few rounds. A team's
elim-only rates come from a handful of rounds, so its tilt always comes from
its overall record.`}),`
`,(0,t.jsxs)(n.p,{children:[`The base probability is Glicko-2's expected score, the same formula as
upstream's `,(0,t.jsx)(n.code,{children:`simulate_round.py`}),` (skelo's `,(0,t.jsx)(n.code,{children:`Glicko2Model.compute_prob`}),`): ratings
are converted back to Glicko-2's 1500 scale, and the result is
`,(0,t.jsx)(n.code,{children:`1 / (1 + exp(\u2212g(\u03C6_opp) \u00B7 (\u03BC \u2212 \u03BC_opp)))`}),`. The side shift is added in
log-odds. Panel odds assume each ballot is independent at that probability.`]}),`
`,(0,t.jsx)(n.h3,{id:`your-team-pre-filled`,children:`Your team, pre-filled`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Settings \u2192 My team`}),` sets your role (debater, coach, or assistant/judge),
your partner, and the ranked team you represent in each division. It's saved
in this browser and, when you're signed in, to your account
(`,(0,t.jsx)(n.code,{children:`/api/settings`}),`' `,(0,t.jsx)(n.code,{children:`myRankedTeams`}),`). The simulator starts from it.`]}),`
`,(0,t.jsx)(n.p,{children:`It appears in two places:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Practice round`}),` (`,(0,t.jsx)(n.code,{children:`/practice`}),`): side A starts as your team for the
division, and both sides can be changed.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Every team profile`}),` (`,(0,t.jsx)(n.code,{children:`/teams/<team>`}),`): if you have a team set for that
division, `,(0,t.jsx)(n.strong,{children:`Simulate vs. any ranked team`}),` pits your team (side A) against
the profile's team. On your own profile, or with no team set, the profile's
team is locked in as side A and any other ranked team can be its opponent.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`The math lives in `,(0,t.jsx)(n.code,{children:`@debate/rankings-adapter`}),`: `,(0,t.jsx)(n.code,{children:`match-simulation.ts`}),` (Glicko-2)
and `,(0,t.jsx)(n.code,{children:`matchup-model.ts`}),` (blending, side terms, recommendations). The UI is
`,(0,t.jsx)(n.code,{children:`debate-videos`}),`' `,(0,t.jsx)(n.code,{children:`MatchupSimulator`}),`, composed on the practice page by
`,(0,t.jsx)(n.code,{children:`debate-practice-rounds`}),`' `,(0,t.jsx)(n.code,{children:`TeamMatchupSimulatorPanel`}),`. The setting is
`,(0,t.jsx)(n.code,{children:`debate-videos`}),`' `,(0,t.jsx)(n.code,{children:`lib/my-ranked-teams`}),` and `,(0,t.jsx)(n.code,{children:`MyRankedTeamsSettings`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`The matchup simulator's individual rating finds a debater's other entries by
surname and school, so two debaters with the same surname at one school are
merged, and someone who changed schools isn't linked. The rankings carry no
speaker points, so individual skill is only inferred from other pairings.
The partner name in `,(0,t.jsx)(n.strong,{children:`My team`}),` is informational and doesn't change the
model.`]}),`
`,(0,t.jsxs)(n.p,{children:[`A profile's Videos section only finds a round whose team label or title spells
the school the way the rankings do, or by one of the short forms above. A
round recorded under an unlisted abbreviation is missed, and a school whose
short name another school shares (two `,(0,t.jsx)(n.em,{children:`Memorial`}),` high schools) can show the
other's rounds.`]}),`
`,(0,t.jsx)(n.p,{children:`Followed teams' results and recaps come from the round video library, so a
tournament's record counts only the rounds someone recorded, and a round is
dated by its upload, not the day it was debated. The rankings keep no
history, so a recap's rating change is an estimate: each decided round moves
the rating by 32 \u00D7 (result \u2212 expected) on the upstream scale, the expected
score coming from both teams' current ratings. Nothing is emailed; the recap
only appears in the News Stream.`}),`
`,(0,t.jsx)(n.p,{children:`Ratings cover only the tournaments listed above the table; a team that hasn't
attended one of them is not ranked. The list updates when the rankings are
recomputed, not live.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};