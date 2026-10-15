import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Video Watch Page`},r=`# Video Watch Page \u2014 one video, its transcript, and what to watch next [#video-watch-page--one-video-its-transcript-and-what-to-watch-next]

Every video in the library has its own page: the player, the synced
transcript beside it, the round's metadata under it, and related videos
below that. It replaces the transcript dialog that used to open on top of
the grid, which had no address \u2014 nothing to send a teammate, nothing for
search to index, and no room for anything but the player and a narrow
column of sentences.

- **Where:** \`/videos/watch/<title-slug>\`
- **Reach it from:** clicking any row in the list layout, or the transcript (CC) button on a video card
- **Package:** \`debate-videos\`

## The URL [#the-url]

\`\`\`
/videos/watch/2022-ndt-finals-dartmouth-vs-michigan
                \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 title \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518
\`\`\`

The title half is for readers and for search engines. A video that gets
retitled gets a new address \u2014 old links stop working, which is the
trade-off for clean URLs without appended ids.

## Transcript [#transcript]

The transcript column is the same synced, clickable transcript the popout
player shows in its caption tray: sentences rather than caption fragments,
the spoken one highlighted and scrolled to, a word-level sweep across it,
and a click to seek. On a page there is also room to **search within the
transcript** \u2014 typing filters to matching lines and highlights each match
within them, and follow-the-playback pauses while you read your results so
the list doesn't scroll out from under you.

Most of the library has no captions. A video without them simply shows no
transcript column and the player takes the full width.

## By speech [#by-speech]

Every round gets a **By speech** tab beside the player, and it opens
first. When the round has an AI summary or written analysis that goes
speech by speech, the tabs come from it; otherwise they follow the
standard speech order for the round's format \u2014 LD, Public Forum or
Policy. Every speech is
its own tab \u2014 1AC, CX \u00B7 1AC, 1NC, and so on \u2014 coloured blue for the aff,
red for the neg and grey for cross-ex. Inside a speech you can switch
between its **Summary**, **Analysis** and **Transcript**, and the view you
pick stays chosen as you move from speech to speech.

- Clicking a speech's tab plays the video from where that speech starts.
  The arrow keys move between tabs without jumping the video.
- The speech playing now has a pulsing red dot. With **Auto-scroll** on,
  the tab moves to each speech as it begins; it leaves you alone while
  you read ahead, until the next speech starts.
- A **timeline** under the video shows the round as a bar, one segment
  per speech, as wide as that speech ran, with a playhead. Clicking a
  segment plays that speech and opens its tab.

Start times come from the documents themselves: a heading like
\`## 1AC \u2014 Michigan (2:15)\` in the transcript or summary is what places
the 1AC on the timeline. For a round without them, play to where a
speech begins and press **Mark start** on its tab; clear a mark with
the **\u00D7** beside it. Marked speeches get proportional timeline segments,
follow along as the video plays, and show the captions spoken during
them under **Transcript**. Marks are saved in this browser only. Until
any speech has a start, the timeline shows equal segments that still
open each speech.

### Detect speeches \u2014 let AI find where every speech starts [#detect-speeches--let-ai-find-where-every-speech-starts]

Instead of marking each start by hand, press **Detect speeches** at the
top of the By speech tab. The AI reads the video's whole caption track,
works out the format (Policy, LD, Public Forum, or another), and finds
when each speech begins and ends \u2014 1AC, 1AX (the cross-ex of the 1AC),
1NC, 1NX, 2AC, 2AX, 2NC, 2NX, 1NR, 1AR, 2NR, 2AR for Policy, and the
matching speeches for LD and PF.

- Each speech's tab is timed, the timeline fills in, and **Transcript**
  shows exactly the captions spoken during that speech \u2014 cut off at its
  end, so prep time and the judge's comments stay out.
- A round with a written summary keeps its own speeches and only gains
  the times it was missing. A **Mark start** you set yourself always
  wins over a detected one.
- The result is kept in this browser. **Detect again** re-runs it and
  **Clear** forgets it.

### LLM summary \u2014 a speech's key points and warrants [#llm-summary--a-speechs-key-points-and-warrants]

Every speech with a transcript has an **LLM summary** button. It outlines
the speech the way you'd flow it: each key point as a short bold tag, the
warrants behind it as nested bullet phrases, in the order the speaker
made them, ending with the speech's bottom line. The outline opens in its
own **LLM summary** view, is kept in this browser, and **Run again** asks
for a fresh one. On a round nobody typed up, the button turns on once the
speech has a start \u2014 marked or detected.

Both buttons need you to be signed in, and use the site's AI model \u2014 or
your own OpenRouter or Anthropic key if you've added one in settings.
They work from auto-generated captions, so check them against the video.

### Rounds the site has already processed [#rounds-the-site-has-already-processed]

Many rounds \u2014 starting with the Greatest of All-Time collection \u2014 have
been run through the site's speech AI ahead of time. Those open with the
speech buttons under the player already timed, and each speech's tab has a
**Summary** (what the speaker did) and an **Analysis** (what they could
have done instead) with no button to press. The **Summary** tab at the top
shows the whole round's write-up at once. These are AI-written from the
captions, and are marked as such.

### Outcomes \u2014 what else the speech could have done [#outcomes--what-else-the-speech-could-have-done]

Every speech tab also has an **Outcomes** view. Press **Simulate** and
Claude drafts two to four alternative responses the speaker could have
given instead \u2014 a different collapse, an impact turn, a framework
push, or for a cross-ex a different line of questioning \u2014 and predicts
the ballot after each one, next to its prediction for the speech as it
was actually given.

- Pick the **judges** first \u2014 one to five of: flow, lay, policymaker,
  critique-friendly, theory-first and traditional. Each judge on the panel
  votes separately with their own reason for decision and the argument
  that decided it, and the panel's decision is the vote tally (an odd
  panel avoids ties). Your panel is remembered.
- Optionally **steer** the alternatives \u2014 "go for the DA instead of
  theory" \u2014 before simulating.
- A bar chart shows the aff's chance of winning after each version, with
  the 50% line marked. The number beside each alternative is how much it
  helps or hurts the side that gave the speech.
- The alternative that helps most is marked **Strongest**; one that would
  change who wins is marked **Ballot flips**. Open a card for the outline
  in speaking order, what it gives up, and every judge's ballot.
- **Copy** puts the whole run on your clipboard as Markdown, ready for a
  doc or your team chat.
- The last run for each speech and panel is kept in this browser, and its
  tab gets a small sparkle. **Run again** asks for a fresh set.

Simulating needs you to be signed in. The alternatives and ballots are
Claude's predictions from a rough transcript and summary, not real
results \u2014 use them to think through options, not as a verdict. For a
round nobody has written up, Claude works from the video's captions: the
speech's own captions once you have marked its start, otherwise the
whole round's captions, so marking starts gives sharper results.

## Speech docs [#speech-docs]

A round that is also a [featured round](/docs/features/rounds/featured-rounds), like
the 2015 NDT Finals, gets a **Speech docs** tab first in the column beside the
player. Pick a speech, or use the arrows, to read the doc that speech was
given from. Docs open in read mode: each card shows its tag, its cite and only
the highlighted text that was read aloud. **Open in debate view** opens the whole round with its timers.

## Team rankings [#team-rankings]

Under the round's details, a round whose aff and neg teams are in the
[team rankings](/coaching/rankings) gets a **Team rankings** section: one card
per team with its rank in the division, rating and deviation, matches played,
and aff, neg and elim win rates, beside its radar chart. The opponent is drawn
on each radar as a dashed outline, so you can see where one team is stronger.
Each team name links to that team's profile.

When both teams are ranked, a **Simulated matchup** card above the team cards
predicts who wins. It uses the sides the teams actually debated (the
division's aff/neg split and each team's own aff and neg record) and the
round's stage: a prelim is one judge, an elim a 3-judge panel and finals a
5-judge panel, so a favorite's edge grows in elims. It shows each side's win
chance, the predicted winner and a 1,000-round simulation, and, when the
round's decision is recorded, whether the favorite won or it was an upset.
The math is the [matchup simulator](/coaching/rankings)'s, with the rating
mix each team's profile recommends. It is a simulation, not a ballot. When
the round label isn't recorded, the round is treated as a prelim.

Only rounds from the current season are matched, since the rankings cover
this season and a team code from an earlier year belongs to other debaters. A
team the rankings don't know is left out, and when neither team is found the
section doesn't appear.

## Controls [#controls]

The toolbar above the video is the popout player's toolbar: play/pause,
slow-the-spread, skip to the next queued video, captions, and
picture-in-picture all mean exactly what they mean there. A page can offer
three more \u2014 fullscreen, a permalink to copy, and a favourite toggle.

Two of them are about leaving:

- **Minimize** hands the video back to the floating popout player and
  returns you to the library. Playback continues from the same second.
- **Close** stops the video and returns to the library.

Only one video ever plays: opening a watch page takes playback over from
the floating player, and leaving hands it back.

## Search box [#search-box]

Under the round's details, just above the related videos, is a search box
for the whole library. Press Enter (or **Search**) and the list underneath
swaps to the library's matches, headed **Results for "\u2026"** \u2014 without leaving
the page, so the video above keeps playing. Clicking a team name in one of
those rows searches for that team the same way. **Clear** brings the related
videos back. It is on every watch page, including one with no related videos.

Use it to build a playlist: add matches one at a time with each row's
**Add to queue** button, or **Queue all** above the list to queue every
match not already queued, in the list's order. The queue panel beside the
list shows what's lined up, and the next video plays when this one ends.

## Related videos [#related-videos]

Underneath the player: the rest of the same tournament first, then the
same debate format or lecture category, then the most recent videos in the
library \u2014 enough passes to fill the row for a video with neither. Clicking
one opens *its* watch page, so the URL always names what is playing.

Each related row shows its video's length under its action buttons, and the
**Related videos** heading (or **Results for \u2026** during a search) shows the
combined length of every listed video that has one, e.g. \`6h 40m total\`. The
video's own length sits beside its date and view count under the title.
Lengths come from the stored durations the admin **Fetch video durations**
card fills; a video it hasn't reached shows none and adds nothing to the
total, though the page's own video picks up the player's reading once it
loads.

### Up next in the popout player [#up-next-in-the-popout-player]

A related row's popout icon does not take over from the video you are
watching. It lines that video up in the floating popout player instead: the
page's video keeps playing, a small **Up next in popout** card in the corner
names the lined-up video, and the popout starts playing it as soon as you
leave the page. Click the icon again, or the card's \u00D7, to cancel. Opening the
lined-up video's own watch page plays it there and clears it
(\`popoutNext\` in \`videoPlayerStore\`, \`PopoutPlayerButton\`).
`,i={contents:[{heading:`video-watch-page--one-video-its-transcript-and-what-to-watch-next`,content:`Every video in the library has its own page: the player, the synced
transcript beside it, the round's metadata under it, and related videos
below that. It replaces the transcript dialog that used to open on top of
the grid, which had no address \u2014 nothing to send a teammate, nothing for
search to index, and no room for anything but the player and a narrow
column of sentences.`},{heading:`video-watch-page--one-video-its-transcript-and-what-to-watch-next`,content:"**Where:** `/videos/watch/<title-slug>`"},{heading:`video-watch-page--one-video-its-transcript-and-what-to-watch-next`,content:`**Reach it from:** clicking any row in the list layout, or the transcript (CC) button on a video card`},{heading:`video-watch-page--one-video-its-transcript-and-what-to-watch-next`,content:"**Package:** `debate-videos`"},{heading:`the-url`,content:`The title half is for readers and for search engines. A video that gets
retitled gets a new address \u2014 old links stop working, which is the
trade-off for clean URLs without appended ids.`},{heading:`transcript`,content:`The transcript column is the same synced, clickable transcript the popout
player shows in its caption tray: sentences rather than caption fragments,
the spoken one highlighted and scrolled to, a word-level sweep across it,
and a click to seek. On a page there is also room to **search within the
transcript** \u2014 typing filters to matching lines and highlights each match
within them, and follow-the-playback pauses while you read your results so
the list doesn't scroll out from under you.`},{heading:`transcript`,content:`Most of the library has no captions. A video without them simply shows no
transcript column and the player takes the full width.`},{heading:`by-speech`,content:`Every round gets a **By speech** tab beside the player, and it opens
first. When the round has an AI summary or written analysis that goes
speech by speech, the tabs come from it; otherwise they follow the
standard speech order for the round's format \u2014 LD, Public Forum or
Policy. Every speech is
its own tab \u2014 1AC, CX \u00B7 1AC, 1NC, and so on \u2014 coloured blue for the aff,
red for the neg and grey for cross-ex. Inside a speech you can switch
between its **Summary**, **Analysis** and **Transcript**, and the view you
pick stays chosen as you move from speech to speech.`},{heading:`by-speech`,content:`Clicking a speech's tab plays the video from where that speech starts.
The arrow keys move between tabs without jumping the video.`},{heading:`by-speech`,content:`The speech playing now has a pulsing red dot. With **Auto-scroll** on,
the tab moves to each speech as it begins; it leaves you alone while
you read ahead, until the next speech starts.`},{heading:`by-speech`,content:`A **timeline** under the video shows the round as a bar, one segment
per speech, as wide as that speech ran, with a playhead. Clicking a
segment plays that speech and opens its tab.`},{heading:`by-speech`,content:`Start times come from the documents themselves: a heading like
\`## 1AC \u2014 Michigan (2:15)\` in the transcript or summary is what places
the 1AC on the timeline. For a round without them, play to where a
speech begins and press **Mark start** on its tab; clear a mark with
the **\u00D7** beside it. Marked speeches get proportional timeline segments,
follow along as the video plays, and show the captions spoken during
them under **Transcript**. Marks are saved in this browser only. Until
any speech has a start, the timeline shows equal segments that still
open each speech.`},{heading:`detect-speeches--let-ai-find-where-every-speech-starts`,content:`Instead of marking each start by hand, press **Detect speeches** at the
top of the By speech tab. The AI reads the video's whole caption track,
works out the format (Policy, LD, Public Forum, or another), and finds
when each speech begins and ends \u2014 1AC, 1AX (the cross-ex of the 1AC),
1NC, 1NX, 2AC, 2AX, 2NC, 2NX, 1NR, 1AR, 2NR, 2AR for Policy, and the
matching speeches for LD and PF.`},{heading:`detect-speeches--let-ai-find-where-every-speech-starts`,content:`Each speech's tab is timed, the timeline fills in, and **Transcript**
shows exactly the captions spoken during that speech \u2014 cut off at its
end, so prep time and the judge's comments stay out.`},{heading:`detect-speeches--let-ai-find-where-every-speech-starts`,content:`A round with a written summary keeps its own speeches and only gains
the times it was missing. A **Mark start** you set yourself always
wins over a detected one.`},{heading:`detect-speeches--let-ai-find-where-every-speech-starts`,content:`The result is kept in this browser. **Detect again** re-runs it and
**Clear** forgets it.`},{heading:`llm-summary--a-speechs-key-points-and-warrants`,content:`Every speech with a transcript has an **LLM summary** button. It outlines
the speech the way you'd flow it: each key point as a short bold tag, the
warrants behind it as nested bullet phrases, in the order the speaker
made them, ending with the speech's bottom line. The outline opens in its
own **LLM summary** view, is kept in this browser, and **Run again** asks
for a fresh one. On a round nobody typed up, the button turns on once the
speech has a start \u2014 marked or detected.`},{heading:`llm-summary--a-speechs-key-points-and-warrants`,content:`Both buttons need you to be signed in, and use the site's AI model \u2014 or
your own OpenRouter or Anthropic key if you've added one in settings.
They work from auto-generated captions, so check them against the video.`},{heading:`rounds-the-site-has-already-processed`,content:`Many rounds \u2014 starting with the Greatest of All-Time collection \u2014 have
been run through the site's speech AI ahead of time. Those open with the
speech buttons under the player already timed, and each speech's tab has a
**Summary** (what the speaker did) and an **Analysis** (what they could
have done instead) with no button to press. The **Summary** tab at the top
shows the whole round's write-up at once. These are AI-written from the
captions, and are marked as such.`},{heading:`outcomes--what-else-the-speech-could-have-done`,content:`Every speech tab also has an **Outcomes** view. Press **Simulate** and
Claude drafts two to four alternative responses the speaker could have
given instead \u2014 a different collapse, an impact turn, a framework
push, or for a cross-ex a different line of questioning \u2014 and predicts
the ballot after each one, next to its prediction for the speech as it
was actually given.`},{heading:`outcomes--what-else-the-speech-could-have-done`,content:`Pick the **judges** first \u2014 one to five of: flow, lay, policymaker,
critique-friendly, theory-first and traditional. Each judge on the panel
votes separately with their own reason for decision and the argument
that decided it, and the panel's decision is the vote tally (an odd
panel avoids ties). Your panel is remembered.`},{heading:`outcomes--what-else-the-speech-could-have-done`,content:`Optionally **steer** the alternatives \u2014 "go for the DA instead of
theory" \u2014 before simulating.`},{heading:`outcomes--what-else-the-speech-could-have-done`,content:`A bar chart shows the aff's chance of winning after each version, with
the 50% line marked. The number beside each alternative is how much it
helps or hurts the side that gave the speech.`},{heading:`outcomes--what-else-the-speech-could-have-done`,content:`The alternative that helps most is marked **Strongest**; one that would
change who wins is marked **Ballot flips**. Open a card for the outline
in speaking order, what it gives up, and every judge's ballot.`},{heading:`outcomes--what-else-the-speech-could-have-done`,content:`**Copy** puts the whole run on your clipboard as Markdown, ready for a
doc or your team chat.`},{heading:`outcomes--what-else-the-speech-could-have-done`,content:`The last run for each speech and panel is kept in this browser, and its
tab gets a small sparkle. **Run again** asks for a fresh set.`},{heading:`outcomes--what-else-the-speech-could-have-done`,content:`Simulating needs you to be signed in. The alternatives and ballots are
Claude's predictions from a rough transcript and summary, not real
results \u2014 use them to think through options, not as a verdict. For a
round nobody has written up, Claude works from the video's captions: the
speech's own captions once you have marked its start, otherwise the
whole round's captions, so marking starts gives sharper results.`},{heading:`speech-docs`,content:`A round that is also a featured round, like
the 2015 NDT Finals, gets a **Speech docs** tab first in the column beside the
player. Pick a speech, or use the arrows, to read the doc that speech was
given from. Docs open in read mode: each card shows its tag, its cite and only
the highlighted text that was read aloud. **Open in debate view** opens the whole round with its timers.`},{heading:`team-rankings`,content:`Under the round's details, a round whose aff and neg teams are in the
team rankings gets a **Team rankings** section: one card
per team with its rank in the division, rating and deviation, matches played,
and aff, neg and elim win rates, beside its radar chart. The opponent is drawn
on each radar as a dashed outline, so you can see where one team is stronger.
Each team name links to that team's profile.`},{heading:`team-rankings`,content:`When both teams are ranked, a **Simulated matchup** card above the team cards
predicts who wins. It uses the sides the teams actually debated (the
division's aff/neg split and each team's own aff and neg record) and the
round's stage: a prelim is one judge, an elim a 3-judge panel and finals a
5-judge panel, so a favorite's edge grows in elims. It shows each side's win
chance, the predicted winner and a 1,000-round simulation, and, when the
round's decision is recorded, whether the favorite won or it was an upset.
The math is the matchup simulator's, with the rating
mix each team's profile recommends. It is a simulation, not a ballot. When
the round label isn't recorded, the round is treated as a prelim.`},{heading:`team-rankings`,content:`Only rounds from the current season are matched, since the rankings cover
this season and a team code from an earlier year belongs to other debaters. A
team the rankings don't know is left out, and when neither team is found the
section doesn't appear.`},{heading:`controls`,content:`The toolbar above the video is the popout player's toolbar: play/pause,
slow-the-spread, skip to the next queued video, captions, and
picture-in-picture all mean exactly what they mean there. A page can offer
three more \u2014 fullscreen, a permalink to copy, and a favourite toggle.`},{heading:`controls`,content:`Two of them are about leaving:`},{heading:`controls`,content:`**Minimize** hands the video back to the floating popout player and
returns you to the library. Playback continues from the same second.`},{heading:`controls`,content:`**Close** stops the video and returns to the library.`},{heading:`controls`,content:`Only one video ever plays: opening a watch page takes playback over from
the floating player, and leaving hands it back.`},{heading:`search-box`,content:`Under the round's details, just above the related videos, is a search box
for the whole library. Press Enter (or **Search**) and the list underneath
swaps to the library's matches, headed **Results for "\u2026"** \u2014 without leaving
the page, so the video above keeps playing. Clicking a team name in one of
those rows searches for that team the same way. **Clear** brings the related
videos back. It is on every watch page, including one with no related videos.`},{heading:`search-box`,content:`Use it to build a playlist: add matches one at a time with each row's
**Add to queue** button, or **Queue all** above the list to queue every
match not already queued, in the list's order. The queue panel beside the
list shows what's lined up, and the next video plays when this one ends.`},{heading:`related-videos`,content:`Underneath the player: the rest of the same tournament first, then the
same debate format or lecture category, then the most recent videos in the
library \u2014 enough passes to fill the row for a video with neither. Clicking
one opens *its* watch page, so the URL always names what is playing.`},{heading:`related-videos`,content:`Each related row shows its video's length under its action buttons, and the
**Related videos** heading (or **Results for \u2026** during a search) shows the
combined length of every listed video that has one, e.g. \`6h 40m total\`. The
video's own length sits beside its date and view count under the title.
Lengths come from the stored durations the admin **Fetch video durations**
card fills; a video it hasn't reached shows none and adds nothing to the
total, though the page's own video picks up the player's reading once it
loads.`},{heading:`up-next-in-the-popout-player`,content:`A related row's popout icon does not take over from the video you are
watching. It lines that video up in the floating popout player instead: the
page's video keeps playing, a small **Up next in popout** card in the corner
names the lined-up video, and the popout starts playing it as soon as you
leave the page. Click the icon again, or the card's \u00D7, to cancel. Opening the
lined-up video's own watch page plays it there and clears it
(\`popoutNext\` in \`videoPlayerStore\`, \`PopoutPlayerButton\`).`}],headings:[{id:`video-watch-page--one-video-its-transcript-and-what-to-watch-next`,content:`Video Watch Page \u2014 one video, its transcript, and what to watch next`},{id:`the-url`,content:`The URL`},{id:`transcript`,content:`Transcript`},{id:`by-speech`,content:`By speech`},{id:`detect-speeches--let-ai-find-where-every-speech-starts`,content:`Detect speeches \u2014 let AI find where every speech starts`},{id:`llm-summary--a-speechs-key-points-and-warrants`,content:`LLM summary \u2014 a speech's key points and warrants`},{id:`rounds-the-site-has-already-processed`,content:`Rounds the site has already processed`},{id:`outcomes--what-else-the-speech-could-have-done`,content:`Outcomes \u2014 what else the speech could have done`},{id:`speech-docs`,content:`Speech docs`},{id:`team-rankings`,content:`Team rankings`},{id:`controls`,content:`Controls`},{id:`search-box`,content:`Search box`},{id:`related-videos`,content:`Related videos`},{id:`up-next-in-the-popout-player`,content:`Up next in the popout player`}]},a=[{depth:1,url:`#video-watch-page--one-video-its-transcript-and-what-to-watch-next`,title:(0,t.jsx)(t.Fragment,{children:`Video Watch Page \u2014 one video, its transcript, and what to watch next`})},{depth:2,url:`#the-url`,title:(0,t.jsx)(t.Fragment,{children:`The URL`})},{depth:2,url:`#transcript`,title:(0,t.jsx)(t.Fragment,{children:`Transcript`})},{depth:2,url:`#by-speech`,title:(0,t.jsx)(t.Fragment,{children:`By speech`})},{depth:3,url:`#detect-speeches--let-ai-find-where-every-speech-starts`,title:(0,t.jsx)(t.Fragment,{children:`Detect speeches \u2014 let AI find where every speech starts`})},{depth:3,url:`#llm-summary--a-speechs-key-points-and-warrants`,title:(0,t.jsx)(t.Fragment,{children:`LLM summary \u2014 a speech's key points and warrants`})},{depth:3,url:`#rounds-the-site-has-already-processed`,title:(0,t.jsx)(t.Fragment,{children:`Rounds the site has already processed`})},{depth:3,url:`#outcomes--what-else-the-speech-could-have-done`,title:(0,t.jsx)(t.Fragment,{children:`Outcomes \u2014 what else the speech could have done`})},{depth:2,url:`#speech-docs`,title:(0,t.jsx)(t.Fragment,{children:`Speech docs`})},{depth:2,url:`#team-rankings`,title:(0,t.jsx)(t.Fragment,{children:`Team rankings`})},{depth:2,url:`#controls`,title:(0,t.jsx)(t.Fragment,{children:`Controls`})},{depth:2,url:`#search-box`,title:(0,t.jsx)(t.Fragment,{children:`Search box`})},{depth:2,url:`#related-videos`,title:(0,t.jsx)(t.Fragment,{children:`Related videos`})},{depth:3,url:`#up-next-in-the-popout-player`,title:(0,t.jsx)(t.Fragment,{children:`Up next in the popout player`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,h3:`h3`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`video-watch-page--one-video-its-transcript-and-what-to-watch-next`,children:`Video Watch Page \u2014 one video, its transcript, and what to watch next`}),`
`,(0,t.jsx)(n.p,{children:`Every video in the library has its own page: the player, the synced
transcript beside it, the round's metadata under it, and related videos
below that. It replaces the transcript dialog that used to open on top of
the grid, which had no address \u2014 nothing to send a teammate, nothing for
search to index, and no room for anything but the player and a narrow
column of sentences.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Where:`}),` `,(0,t.jsx)(n.code,{children:`/videos/watch/<title-slug>`})]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Reach it from:`}),` clicking any row in the list layout, or the transcript (CC) button on a video card`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-videos`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`the-url`,children:`The URL`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`/videos/watch/2022-ndt-finals-dartmouth-vs-michigan`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`                \u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 title \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518`})})]})})}),`
`,(0,t.jsx)(n.p,{children:`The title half is for readers and for search engines. A video that gets
retitled gets a new address \u2014 old links stop working, which is the
trade-off for clean URLs without appended ids.`}),`
`,(0,t.jsx)(n.h2,{id:`transcript`,children:`Transcript`}),`
`,(0,t.jsxs)(n.p,{children:[`The transcript column is the same synced, clickable transcript the popout
player shows in its caption tray: sentences rather than caption fragments,
the spoken one highlighted and scrolled to, a word-level sweep across it,
and a click to seek. On a page there is also room to `,(0,t.jsx)(n.strong,{children:`search within the
transcript`}),` \u2014 typing filters to matching lines and highlights each match
within them, and follow-the-playback pauses while you read your results so
the list doesn't scroll out from under you.`]}),`
`,(0,t.jsx)(n.p,{children:`Most of the library has no captions. A video without them simply shows no
transcript column and the player takes the full width.`}),`
`,(0,t.jsx)(n.h2,{id:`by-speech`,children:`By speech`}),`
`,(0,t.jsxs)(n.p,{children:[`Every round gets a `,(0,t.jsx)(n.strong,{children:`By speech`}),` tab beside the player, and it opens
first. When the round has an AI summary or written analysis that goes
speech by speech, the tabs come from it; otherwise they follow the
standard speech order for the round's format \u2014 LD, Public Forum or
Policy. Every speech is
its own tab \u2014 1AC, CX \u00B7 1AC, 1NC, and so on \u2014 coloured blue for the aff,
red for the neg and grey for cross-ex. Inside a speech you can switch
between its `,(0,t.jsx)(n.strong,{children:`Summary`}),`, `,(0,t.jsx)(n.strong,{children:`Analysis`}),` and `,(0,t.jsx)(n.strong,{children:`Transcript`}),`, and the view you
pick stays chosen as you move from speech to speech.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Clicking a speech's tab plays the video from where that speech starts.
The arrow keys move between tabs without jumping the video.`}),`
`,(0,t.jsxs)(n.li,{children:[`The speech playing now has a pulsing red dot. With `,(0,t.jsx)(n.strong,{children:`Auto-scroll`}),` on,
the tab moves to each speech as it begins; it leaves you alone while
you read ahead, until the next speech starts.`]}),`
`,(0,t.jsxs)(n.li,{children:[`A `,(0,t.jsx)(n.strong,{children:`timeline`}),` under the video shows the round as a bar, one segment
per speech, as wide as that speech ran, with a playhead. Clicking a
segment plays that speech and opens its tab.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`Start times come from the documents themselves: a heading like
`,(0,t.jsx)(n.code,{children:`## 1AC \u2014 Michigan (2:15)`}),` in the transcript or summary is what places
the 1AC on the timeline. For a round without them, play to where a
speech begins and press `,(0,t.jsx)(n.strong,{children:`Mark start`}),` on its tab; clear a mark with
the `,(0,t.jsx)(n.strong,{children:`\u00D7`}),` beside it. Marked speeches get proportional timeline segments,
follow along as the video plays, and show the captions spoken during
them under `,(0,t.jsx)(n.strong,{children:`Transcript`}),`. Marks are saved in this browser only. Until
any speech has a start, the timeline shows equal segments that still
open each speech.`]}),`
`,(0,t.jsx)(n.h3,{id:`detect-speeches--let-ai-find-where-every-speech-starts`,children:`Detect speeches \u2014 let AI find where every speech starts`}),`
`,(0,t.jsxs)(n.p,{children:[`Instead of marking each start by hand, press `,(0,t.jsx)(n.strong,{children:`Detect speeches`}),` at the
top of the By speech tab. The AI reads the video's whole caption track,
works out the format (Policy, LD, Public Forum, or another), and finds
when each speech begins and ends \u2014 1AC, 1AX (the cross-ex of the 1AC),
1NC, 1NX, 2AC, 2AX, 2NC, 2NX, 1NR, 1AR, 2NR, 2AR for Policy, and the
matching speeches for LD and PF.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`Each speech's tab is timed, the timeline fills in, and `,(0,t.jsx)(n.strong,{children:`Transcript`}),`
shows exactly the captions spoken during that speech \u2014 cut off at its
end, so prep time and the judge's comments stay out.`]}),`
`,(0,t.jsxs)(n.li,{children:[`A round with a written summary keeps its own speeches and only gains
the times it was missing. A `,(0,t.jsx)(n.strong,{children:`Mark start`}),` you set yourself always
wins over a detected one.`]}),`
`,(0,t.jsxs)(n.li,{children:[`The result is kept in this browser. `,(0,t.jsx)(n.strong,{children:`Detect again`}),` re-runs it and
`,(0,t.jsx)(n.strong,{children:`Clear`}),` forgets it.`]}),`
`]}),`
`,(0,t.jsx)(n.h3,{id:`llm-summary--a-speechs-key-points-and-warrants`,children:`LLM summary \u2014 a speech's key points and warrants`}),`
`,(0,t.jsxs)(n.p,{children:[`Every speech with a transcript has an `,(0,t.jsx)(n.strong,{children:`LLM summary`}),` button. It outlines
the speech the way you'd flow it: each key point as a short bold tag, the
warrants behind it as nested bullet phrases, in the order the speaker
made them, ending with the speech's bottom line. The outline opens in its
own `,(0,t.jsx)(n.strong,{children:`LLM summary`}),` view, is kept in this browser, and `,(0,t.jsx)(n.strong,{children:`Run again`}),` asks
for a fresh one. On a round nobody typed up, the button turns on once the
speech has a start \u2014 marked or detected.`]}),`
`,(0,t.jsx)(n.p,{children:`Both buttons need you to be signed in, and use the site's AI model \u2014 or
your own OpenRouter or Anthropic key if you've added one in settings.
They work from auto-generated captions, so check them against the video.`}),`
`,(0,t.jsx)(n.h3,{id:`rounds-the-site-has-already-processed`,children:`Rounds the site has already processed`}),`
`,(0,t.jsxs)(n.p,{children:[`Many rounds \u2014 starting with the Greatest of All-Time collection \u2014 have
been run through the site's speech AI ahead of time. Those open with the
speech buttons under the player already timed, and each speech's tab has a
`,(0,t.jsx)(n.strong,{children:`Summary`}),` (what the speaker did) and an `,(0,t.jsx)(n.strong,{children:`Analysis`}),` (what they could
have done instead) with no button to press. The `,(0,t.jsx)(n.strong,{children:`Summary`}),` tab at the top
shows the whole round's write-up at once. These are AI-written from the
captions, and are marked as such.`]}),`
`,(0,t.jsx)(n.h3,{id:`outcomes--what-else-the-speech-could-have-done`,children:`Outcomes \u2014 what else the speech could have done`}),`
`,(0,t.jsxs)(n.p,{children:[`Every speech tab also has an `,(0,t.jsx)(n.strong,{children:`Outcomes`}),` view. Press `,(0,t.jsx)(n.strong,{children:`Simulate`}),` and
Claude drafts two to four alternative responses the speaker could have
given instead \u2014 a different collapse, an impact turn, a framework
push, or for a cross-ex a different line of questioning \u2014 and predicts
the ballot after each one, next to its prediction for the speech as it
was actually given.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`Pick the `,(0,t.jsx)(n.strong,{children:`judges`}),` first \u2014 one to five of: flow, lay, policymaker,
critique-friendly, theory-first and traditional. Each judge on the panel
votes separately with their own reason for decision and the argument
that decided it, and the panel's decision is the vote tally (an odd
panel avoids ties). Your panel is remembered.`]}),`
`,(0,t.jsxs)(n.li,{children:[`Optionally `,(0,t.jsx)(n.strong,{children:`steer`}),` the alternatives \u2014 "go for the DA instead of
theory" \u2014 before simulating.`]}),`
`,(0,t.jsx)(n.li,{children:`A bar chart shows the aff's chance of winning after each version, with
the 50% line marked. The number beside each alternative is how much it
helps or hurts the side that gave the speech.`}),`
`,(0,t.jsxs)(n.li,{children:[`The alternative that helps most is marked `,(0,t.jsx)(n.strong,{children:`Strongest`}),`; one that would
change who wins is marked `,(0,t.jsx)(n.strong,{children:`Ballot flips`}),`. Open a card for the outline
in speaking order, what it gives up, and every judge's ballot.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Copy`}),` puts the whole run on your clipboard as Markdown, ready for a
doc or your team chat.`]}),`
`,(0,t.jsxs)(n.li,{children:[`The last run for each speech and panel is kept in this browser, and its
tab gets a small sparkle. `,(0,t.jsx)(n.strong,{children:`Run again`}),` asks for a fresh set.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`Simulating needs you to be signed in. The alternatives and ballots are
Claude's predictions from a rough transcript and summary, not real
results \u2014 use them to think through options, not as a verdict. For a
round nobody has written up, Claude works from the video's captions: the
speech's own captions once you have marked its start, otherwise the
whole round's captions, so marking starts gives sharper results.`}),`
`,(0,t.jsx)(n.h2,{id:`speech-docs`,children:`Speech docs`}),`
`,(0,t.jsxs)(n.p,{children:[`A round that is also a `,(0,t.jsx)(n.a,{href:`/docs/features/rounds/featured-rounds`,children:`featured round`}),`, like
the 2015 NDT Finals, gets a `,(0,t.jsx)(n.strong,{children:`Speech docs`}),` tab first in the column beside the
player. Pick a speech, or use the arrows, to read the doc that speech was
given from. Docs open in read mode: each card shows its tag, its cite and only
the highlighted text that was read aloud. `,(0,t.jsx)(n.strong,{children:`Open in debate view`}),` opens the whole round with its timers.`]}),`
`,(0,t.jsx)(n.h2,{id:`team-rankings`,children:`Team rankings`}),`
`,(0,t.jsxs)(n.p,{children:[`Under the round's details, a round whose aff and neg teams are in the
`,(0,t.jsx)(n.a,{href:`/coaching/rankings`,children:`team rankings`}),` gets a `,(0,t.jsx)(n.strong,{children:`Team rankings`}),` section: one card
per team with its rank in the division, rating and deviation, matches played,
and aff, neg and elim win rates, beside its radar chart. The opponent is drawn
on each radar as a dashed outline, so you can see where one team is stronger.
Each team name links to that team's profile.`]}),`
`,(0,t.jsxs)(n.p,{children:[`When both teams are ranked, a `,(0,t.jsx)(n.strong,{children:`Simulated matchup`}),` card above the team cards
predicts who wins. It uses the sides the teams actually debated (the
division's aff/neg split and each team's own aff and neg record) and the
round's stage: a prelim is one judge, an elim a 3-judge panel and finals a
5-judge panel, so a favorite's edge grows in elims. It shows each side's win
chance, the predicted winner and a 1,000-round simulation, and, when the
round's decision is recorded, whether the favorite won or it was an upset.
The math is the `,(0,t.jsx)(n.a,{href:`/coaching/rankings`,children:`matchup simulator`}),`'s, with the rating
mix each team's profile recommends. It is a simulation, not a ballot. When
the round label isn't recorded, the round is treated as a prelim.`]}),`
`,(0,t.jsx)(n.p,{children:`Only rounds from the current season are matched, since the rankings cover
this season and a team code from an earlier year belongs to other debaters. A
team the rankings don't know is left out, and when neither team is found the
section doesn't appear.`}),`
`,(0,t.jsx)(n.h2,{id:`controls`,children:`Controls`}),`
`,(0,t.jsx)(n.p,{children:`The toolbar above the video is the popout player's toolbar: play/pause,
slow-the-spread, skip to the next queued video, captions, and
picture-in-picture all mean exactly what they mean there. A page can offer
three more \u2014 fullscreen, a permalink to copy, and a favourite toggle.`}),`
`,(0,t.jsx)(n.p,{children:`Two of them are about leaving:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Minimize`}),` hands the video back to the floating popout player and
returns you to the library. Playback continues from the same second.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Close`}),` stops the video and returns to the library.`]}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`Only one video ever plays: opening a watch page takes playback over from
the floating player, and leaving hands it back.`}),`
`,(0,t.jsx)(n.h2,{id:`search-box`,children:`Search box`}),`
`,(0,t.jsxs)(n.p,{children:[`Under the round's details, just above the related videos, is a search box
for the whole library. Press Enter (or `,(0,t.jsx)(n.strong,{children:`Search`}),`) and the list underneath
swaps to the library's matches, headed `,(0,t.jsx)(n.strong,{children:`Results for "\u2026"`}),` \u2014 without leaving
the page, so the video above keeps playing. Clicking a team name in one of
those rows searches for that team the same way. `,(0,t.jsx)(n.strong,{children:`Clear`}),` brings the related
videos back. It is on every watch page, including one with no related videos.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Use it to build a playlist: add matches one at a time with each row's
`,(0,t.jsx)(n.strong,{children:`Add to queue`}),` button, or `,(0,t.jsx)(n.strong,{children:`Queue all`}),` above the list to queue every
match not already queued, in the list's order. The queue panel beside the
list shows what's lined up, and the next video plays when this one ends.`]}),`
`,(0,t.jsx)(n.h2,{id:`related-videos`,children:`Related videos`}),`
`,(0,t.jsxs)(n.p,{children:[`Underneath the player: the rest of the same tournament first, then the
same debate format or lecture category, then the most recent videos in the
library \u2014 enough passes to fill the row for a video with neither. Clicking
one opens `,(0,t.jsx)(n.em,{children:`its`}),` watch page, so the URL always names what is playing.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Each related row shows its video's length under its action buttons, and the
`,(0,t.jsx)(n.strong,{children:`Related videos`}),` heading (or `,(0,t.jsx)(n.strong,{children:`Results for \u2026`}),` during a search) shows the
combined length of every listed video that has one, e.g. `,(0,t.jsx)(n.code,{children:`6h 40m total`}),`. The
video's own length sits beside its date and view count under the title.
Lengths come from the stored durations the admin `,(0,t.jsx)(n.strong,{children:`Fetch video durations`}),`
card fills; a video it hasn't reached shows none and adds nothing to the
total, though the page's own video picks up the player's reading once it
loads.`]}),`
`,(0,t.jsx)(n.h3,{id:`up-next-in-the-popout-player`,children:`Up next in the popout player`}),`
`,(0,t.jsxs)(n.p,{children:[`A related row's popout icon does not take over from the video you are
watching. It lines that video up in the floating popout player instead: the
page's video keeps playing, a small `,(0,t.jsx)(n.strong,{children:`Up next in popout`}),` card in the corner
names the lined-up video, and the popout starts playing it as soon as you
leave the page. Click the icon again, or the card's \u00D7, to cancel. Opening the
lined-up video's own watch page plays it there and clears it
(`,(0,t.jsx)(n.code,{children:`popoutNext`}),` in `,(0,t.jsx)(n.code,{children:`videoPlayerStore`}),`, `,(0,t.jsx)(n.code,{children:`PopoutPlayerButton`}),`).`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};