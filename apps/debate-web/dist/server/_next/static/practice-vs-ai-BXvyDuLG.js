import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Practice vs AI`},r=`# Practice vs AI [#practice-vs-ai]

![Practice vs AI \u2014 the opponent picker, a live timed round, and the scorecard](https://i.imgur.com/2awjrUp.png)

Lets a debater run a full timed round against an AI opponent. Setup is three
choices: **difficulty** (Easy through Legends), **topic** (a suggested one or
your own resolution, plus your side), and **opponent** (one of the 13
personas at that difficulty). Then the opponent preps: it finds evidence
cards and caselist outlines for the topic and writes a short brief, a summary
of the clash plus the main arguments for your side and the ones it plans to
run. After that you debate through opening statements, cross-examination and
closing statements, then get an AI-judged scorecard.

This page is also where the **Practice Round Simulator** lives now: its old
address, \`/practice\`, redirects here, and its saved rounds, judge paradigms,
replays and team matchups are in the collapsed **Round simulator** section
below the round (see [Practice Round Simulator](/docs/features/rounds/practice-round-simulator)).

- **Route:** \`/practice/versus-ai\` (\`/practice\` redirects here)
- **Package:** \`debate-practice-vs-ai\`, composed with \`debate-practice-rounds\`
  by \`debate-webview\`'s \`PracticeVsAiSections\`
- **API:** \`POST /api/vsbot/create\`, \`/prep\`, \`/debate\`, \`/judge\`, \`/concede\`;
  \`GET /api/vsbot/history\`; prep also reads \`GET /api/search\`

## What it shows [#what-it-shows]

A four-step setup (Difficulty, Topic, Opponent, Prep), the live round (two
side-by-side panels with countdowns, typed or dictated turns), and a
scorecard (each phase scored out of 10 for both sides, totals, a verdict, and
follow-up drill recommendations). Per-phase clocks sit in a collapsed
"Phase timings" box on the Prep step. During the round, the prep brief stays
one click away in a collapsed panel above it.

## The opponent's prep [#the-opponents-prep]

The Prep step searches the card corpus with the topic's key words (filler
words such as "should" and "be" dropped) and, separately, the caselist
outlines. Up to eight cards and four outlines go to \`POST /api/vsbot/prep\`,
which asks the model for a brief in a fixed JSON shape: a summary, then two
to four arguments per side, each citing the cards that back it. When no model
key is set, or the model's reply can't be read, the brief is built from the
cards alone: each card's tag becomes an argument on the side the corpus says
read it. A card search that is rate-limited or fails counts as finding
nothing, so prep still produces a brief.

A "View Debate History" button on the setup screen opens **Debate History**:
every past round (topic, opponent, result, date), newest first, each
expandable in place to its full transcript.

## How it works [#how-it-works]

A port of the Go \`arguehub\` vs-bot server and its Vite/React client (the
React client is kept as a reference source in the package; the Go server has
been removed). The 13 personas carry over field for
field from the Go \`GetBotPersonality\` switch. Text generation uses
\`ANTHROPIC_API_KEY\`, falling back to \`GEMINI_API_KEY\`; with neither set,
each persona answers with an in-character "my systems are offline" line.

## Known gaps [#known-gaps]

~~Gamification's score and badges are persisted (\`user_settings.practiceVsAiScore\`/
\`practiceVsAiBadges\`) and shown on the scorecard, but there is no real streak
yet: \`getGamificationProfile\` always reports \`currentStreak: 0\`, since a real
day-over-day streak needs a dated activity log this table doesn't have \u2014 so
the \`Streak5\` badge is currently unreachable.~~ **Fixed:** \`user_settings\` now
also carries \`practiceVsAiLastPlayedDayKey\`/\`practiceVsAiCurrentStreak\`, and
\`debate-practice-vs-ai\`'s \`advanceDailyStreak\` (\`apps/debate-ai.com/lib/practice-vs-ai/store.ts\`'s
\`applyGamificationAward\`) advances the streak by one on the calendar day
after the last round, leaves it unchanged for a second round the same day,
and restarts it at 1 after a missed day \u2014 so five days running now actually
earns \`Streak5\`. \`getGamificationProfile\` (\`currentDisplayStreak\`) reports the
streak as lapsed (0) once a day has been missed, without needing a round
played to reset the stored value first. The Go original never actually
incremented its own \`CurrentStreak\` field either (see
\`debatevsbot_controller.go\`), so this isn't a regression from the port \u2014 the
bug was already there. ~~A reload during a round returns to the picker.~~
**Fixed:** reloading mid-round now resumes the same round instead of
dropping back to the picker. Only the vs-bot slice of the Go server is
ported.

The prep brief is not yet fed into the opponent's turns: the bot argues from
its persona and the topic, not from the cards it found. The brief is kept with
the in-progress round in the browser only, so it is not part of Debate
History.
`,i={contents:[{heading:`practice-vs-ai`,content:`Lets a debater run a full timed round against an AI opponent. Setup is three
choices: **difficulty** (Easy through Legends), **topic** (a suggested one or
your own resolution, plus your side), and **opponent** (one of the 13
personas at that difficulty). Then the opponent preps: it finds evidence
cards and caselist outlines for the topic and writes a short brief, a summary
of the clash plus the main arguments for your side and the ones it plans to
run. After that you debate through opening statements, cross-examination and
closing statements, then get an AI-judged scorecard.`},{heading:`practice-vs-ai`,content:`This page is also where the **Practice Round Simulator** lives now: its old
address, \`/practice\`, redirects here, and its saved rounds, judge paradigms,
replays and team matchups are in the collapsed **Round simulator** section
below the round (see Practice Round Simulator).`},{heading:`practice-vs-ai`,content:"**Route:** `/practice/versus-ai` (`/practice` redirects here)"},{heading:`practice-vs-ai`,content:"**Package:** `debate-practice-vs-ai`, composed with `debate-practice-rounds`\nby `debate-webview`'s `PracticeVsAiSections`"},{heading:`practice-vs-ai`,content:"**API:** `POST /api/vsbot/create`, `/prep`, `/debate`, `/judge`, `/concede`;\n`GET /api/vsbot/history`; prep also reads `GET /api/search`"},{heading:`what-it-shows`,content:`A four-step setup (Difficulty, Topic, Opponent, Prep), the live round (two
side-by-side panels with countdowns, typed or dictated turns), and a
scorecard (each phase scored out of 10 for both sides, totals, a verdict, and
follow-up drill recommendations). Per-phase clocks sit in a collapsed
"Phase timings" box on the Prep step. During the round, the prep brief stays
one click away in a collapsed panel above it.`},{heading:`the-opponents-prep`,content:`The Prep step searches the card corpus with the topic's key words (filler
words such as "should" and "be" dropped) and, separately, the caselist
outlines. Up to eight cards and four outlines go to \`POST /api/vsbot/prep\`,
which asks the model for a brief in a fixed JSON shape: a summary, then two
to four arguments per side, each citing the cards that back it. When no model
key is set, or the model's reply can't be read, the brief is built from the
cards alone: each card's tag becomes an argument on the side the corpus says
read it. A card search that is rate-limited or fails counts as finding
nothing, so prep still produces a brief.`},{heading:`the-opponents-prep`,content:`A "View Debate History" button on the setup screen opens **Debate History**:
every past round (topic, opponent, result, date), newest first, each
expandable in place to its full transcript.`},{heading:`how-it-works`,content:'A port of the Go `arguehub` vs-bot server and its Vite/React client (the\nReact client is kept as a reference source in the package; the Go server has\nbeen removed). The 13 personas carry over field for\nfield from the Go `GetBotPersonality` switch. Text generation uses\n`ANTHROPIC_API_KEY`, falling back to `GEMINI_API_KEY`; with neither set,\neach persona answers with an in-character "my systems are offline" line.'},{heading:`known-gaps`,content:"~~Gamification's score and badges are persisted (`user_settings.practiceVsAiScore`/\n`practiceVsAiBadges`) and shown on the scorecard, but there is no real streak\nyet: `getGamificationProfile` always reports `currentStreak: 0`, since a real\nday-over-day streak needs a dated activity log this table doesn't have \u2014 so\nthe `Streak5` badge is currently unreachable.~~ **Fixed:** `user_settings` now\nalso carries `practiceVsAiLastPlayedDayKey`/`practiceVsAiCurrentStreak`, and\n`debate-practice-vs-ai`'s `advanceDailyStreak` (`apps/debate-ai.com/lib/practice-vs-ai/store.ts`'s\n`applyGamificationAward`) advances the streak by one on the calendar day\nafter the last round, leaves it unchanged for a second round the same day,\nand restarts it at 1 after a missed day \u2014 so five days running now actually\nearns `Streak5`. `getGamificationProfile` (`currentDisplayStreak`) reports the\nstreak as lapsed (0) once a day has been missed, without needing a round\nplayed to reset the stored value first. The Go original never actually\nincremented its own `CurrentStreak` field either (see\n`debatevsbot_controller.go`), so this isn't a regression from the port \u2014 the\nbug was already there. ~~A reload during a round returns to the picker.~~\n**Fixed:** reloading mid-round now resumes the same round instead of\ndropping back to the picker. Only the vs-bot slice of the Go server is\nported."},{heading:`known-gaps`,content:`The prep brief is not yet fed into the opponent's turns: the bot argues from
its persona and the topic, not from the cards it found. The brief is kept with
the in-progress round in the browser only, so it is not part of Debate
History.`}],headings:[{id:`practice-vs-ai`,content:`Practice vs AI`},{id:`what-it-shows`,content:`What it shows`},{id:`the-opponents-prep`,content:`The opponent's prep`},{id:`how-it-works`,content:`How it works`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#practice-vs-ai`,title:(0,t.jsx)(t.Fragment,{children:`Practice vs AI`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#the-opponents-prep`,title:(0,t.jsx)(t.Fragment,{children:`The opponent's prep`})},{depth:2,url:`#how-it-works`,title:(0,t.jsx)(t.Fragment,{children:`How it works`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,del:`del`,h1:`h1`,h2:`h2`,img:`img`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`practice-vs-ai`,children:`Practice vs AI`}),`
`,(0,t.jsx)(n.p,{children:(0,t.jsx)(n.img,{src:`https://i.imgur.com/2awjrUp.png`,alt:`Practice vs AI \u2014 the opponent picker, a live timed round, and the scorecard`,width:`700`,height:`263`})}),`
`,(0,t.jsxs)(n.p,{children:[`Lets a debater run a full timed round against an AI opponent. Setup is three
choices: `,(0,t.jsx)(n.strong,{children:`difficulty`}),` (Easy through Legends), `,(0,t.jsx)(n.strong,{children:`topic`}),` (a suggested one or
your own resolution, plus your side), and `,(0,t.jsx)(n.strong,{children:`opponent`}),` (one of the 13
personas at that difficulty). Then the opponent preps: it finds evidence
cards and caselist outlines for the topic and writes a short brief, a summary
of the clash plus the main arguments for your side and the ones it plans to
run. After that you debate through opening statements, cross-examination and
closing statements, then get an AI-judged scorecard.`]}),`
`,(0,t.jsxs)(n.p,{children:[`This page is also where the `,(0,t.jsx)(n.strong,{children:`Practice Round Simulator`}),` lives now: its old
address, `,(0,t.jsx)(n.code,{children:`/practice`}),`, redirects here, and its saved rounds, judge paradigms,
replays and team matchups are in the collapsed `,(0,t.jsx)(n.strong,{children:`Round simulator`}),` section
below the round (see `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/practice-round-simulator`,children:`Practice Round Simulator`}),`).`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/practice/versus-ai`}),` (`,(0,t.jsx)(n.code,{children:`/practice`}),` redirects here)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-practice-vs-ai`}),`, composed with `,(0,t.jsx)(n.code,{children:`debate-practice-rounds`}),`
by `,(0,t.jsx)(n.code,{children:`debate-webview`}),`'s `,(0,t.jsx)(n.code,{children:`PracticeVsAiSections`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`API:`}),` `,(0,t.jsx)(n.code,{children:`POST /api/vsbot/create`}),`, `,(0,t.jsx)(n.code,{children:`/prep`}),`, `,(0,t.jsx)(n.code,{children:`/debate`}),`, `,(0,t.jsx)(n.code,{children:`/judge`}),`, `,(0,t.jsx)(n.code,{children:`/concede`}),`;
`,(0,t.jsx)(n.code,{children:`GET /api/vsbot/history`}),`; prep also reads `,(0,t.jsx)(n.code,{children:`GET /api/search`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsx)(n.p,{children:`A four-step setup (Difficulty, Topic, Opponent, Prep), the live round (two
side-by-side panels with countdowns, typed or dictated turns), and a
scorecard (each phase scored out of 10 for both sides, totals, a verdict, and
follow-up drill recommendations). Per-phase clocks sit in a collapsed
"Phase timings" box on the Prep step. During the round, the prep brief stays
one click away in a collapsed panel above it.`}),`
`,(0,t.jsx)(n.h2,{id:`the-opponents-prep`,children:`The opponent's prep`}),`
`,(0,t.jsxs)(n.p,{children:[`The Prep step searches the card corpus with the topic's key words (filler
words such as "should" and "be" dropped) and, separately, the caselist
outlines. Up to eight cards and four outlines go to `,(0,t.jsx)(n.code,{children:`POST /api/vsbot/prep`}),`,
which asks the model for a brief in a fixed JSON shape: a summary, then two
to four arguments per side, each citing the cards that back it. When no model
key is set, or the model's reply can't be read, the brief is built from the
cards alone: each card's tag becomes an argument on the side the corpus says
read it. A card search that is rate-limited or fails counts as finding
nothing, so prep still produces a brief.`]}),`
`,(0,t.jsxs)(n.p,{children:[`A "View Debate History" button on the setup screen opens `,(0,t.jsx)(n.strong,{children:`Debate History`}),`:
every past round (topic, opponent, result, date), newest first, each
expandable in place to its full transcript.`]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-works`,children:`How it works`}),`
`,(0,t.jsxs)(n.p,{children:[`A port of the Go `,(0,t.jsx)(n.code,{children:`arguehub`}),` vs-bot server and its Vite/React client (the
React client is kept as a reference source in the package; the Go server has
been removed). The 13 personas carry over field for
field from the Go `,(0,t.jsx)(n.code,{children:`GetBotPersonality`}),` switch. Text generation uses
`,(0,t.jsx)(n.code,{children:`ANTHROPIC_API_KEY`}),`, falling back to `,(0,t.jsx)(n.code,{children:`GEMINI_API_KEY`}),`; with neither set,
each persona answers with an in-character "my systems are offline" line.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsxs)(n.del,{children:[`Gamification's score and badges are persisted (`,(0,t.jsx)(n.code,{children:`user_settings.practiceVsAiScore`}),`/
`,(0,t.jsx)(n.code,{children:`practiceVsAiBadges`}),`) and shown on the scorecard, but there is no real streak
yet: `,(0,t.jsx)(n.code,{children:`getGamificationProfile`}),` always reports `,(0,t.jsx)(n.code,{children:`currentStreak: 0`}),`, since a real
day-over-day streak needs a dated activity log this table doesn't have \u2014 so
the `,(0,t.jsx)(n.code,{children:`Streak5`}),` badge is currently unreachable.`]}),` `,(0,t.jsx)(n.strong,{children:`Fixed:`}),` `,(0,t.jsx)(n.code,{children:`user_settings`}),` now
also carries `,(0,t.jsx)(n.code,{children:`practiceVsAiLastPlayedDayKey`}),`/`,(0,t.jsx)(n.code,{children:`practiceVsAiCurrentStreak`}),`, and
`,(0,t.jsx)(n.code,{children:`debate-practice-vs-ai`}),`'s `,(0,t.jsx)(n.code,{children:`advanceDailyStreak`}),` (`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/practice-vs-ai/store.ts`}),`'s
`,(0,t.jsx)(n.code,{children:`applyGamificationAward`}),`) advances the streak by one on the calendar day
after the last round, leaves it unchanged for a second round the same day,
and restarts it at 1 after a missed day \u2014 so five days running now actually
earns `,(0,t.jsx)(n.code,{children:`Streak5`}),`. `,(0,t.jsx)(n.code,{children:`getGamificationProfile`}),` (`,(0,t.jsx)(n.code,{children:`currentDisplayStreak`}),`) reports the
streak as lapsed (0) once a day has been missed, without needing a round
played to reset the stored value first. The Go original never actually
incremented its own `,(0,t.jsx)(n.code,{children:`CurrentStreak`}),` field either (see
`,(0,t.jsx)(n.code,{children:`debatevsbot_controller.go`}),`), so this isn't a regression from the port \u2014 the
bug was already there. `,(0,t.jsx)(n.del,{children:`A reload during a round returns to the picker.`}),`
`,(0,t.jsx)(n.strong,{children:`Fixed:`}),` reloading mid-round now resumes the same round instead of
dropping back to the picker. Only the vs-bot slice of the Go server is
ported.`]}),`
`,(0,t.jsx)(n.p,{children:`The prep brief is not yet fed into the opponent's turns: the bot argues from
its persona and the topic, not from the cards it found. The brief is kept with
the in-progress round in the browser only, so it is not part of Debate
History.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};