import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`Video Library`},r=`# Video Library \u2014 SQL-backed feed with scroll pagination [#video-library--sql-backed-feed-with-scroll-pagination]

The debate video library (rounds, lectures, top picks) is stored in SQL and
served one page at a time, instead of downloading the entire ~1.1 MB
dataset before a single card renders.

- **Where:** \`/videos\`, \`/videos/[category]\`, and the rounds grid
- **Package:** \`debate-videos\`, \`debate-data-sync\`

## How it fits together [#how-it-fits-together]

JSON assets under \`debate-data-sync/data/videos/\` are projected into a
\`videos\` SQL table via \`buildVideoRows()\`. \`GET /api/videos\` pushes
filtering, search, sorting, and pagination into SQL; \`GET /api/videos/meta\`
is a small fetch-once companion for counts/topics/champions. If the table
is missing or unseeded, both endpoints fall back to rebuilding from the
JSON assets in memory with identical semantics.

## Season and tournament addresses [#season-and-tournament-addresses]

A video's address starts with its season and tournament
(\`/videos/21-22/ndt/finals/\u2026\`). The season is written as the two years it
spans, because a season runs from summer to summer: \`21-22\` is the season that
ends in 2022. A publish date from July onward counts toward the next season.
Older links spelled the season as the year it ended (\`/videos/2022/\u2026\`); they
still work and forward to the new address.

An address can be trimmed: \`/videos/24-25\` opens the library filtered to that
season, and \`/videos/24-25/ndt\` filtered to that season with the tournament's
name as the search (\`/videos?year=2025&q=ndt\`). The bare-year forms
(\`/videos/2025\`) still work too. The Worker
does this with a redirect (\`apps/debate-ai.com/lib/redirects/video-listing.ts\`)
before the request reaches the app. \`/videos/archive/\u2026\` maps to the undated
(\`legacy\`) season.

## Lecture categories [#lecture-categories]

The sidebar has a single **Lectures** row under **Videos**. Opening it
(\`/lectures\`) shows the lecture categories as a bar of cards at the top of the
page, on every screen size: **All Lectures** first, then each category with
its icon and video count. A card's background highlights on hover, the open
category is drawn selected, and clicking a card switches the list to that
category (\`/lectures/<category>\`). The categories used to be a second,
expandable section of the sidebar; they now live only on the page
(\`LectureCategoryGridGallery\`, rendered by \`LecturesVideoGridView\`).

## Merged lecture categories [#merged-lecture-categories]

Topic analysis and topic lectures share one shelf, **Topic Lectures**. Videos
still stored under the old "Topic Analysis" label are folded into it when the
feed and its category cards are read (\`CATEGORY_LABEL_ALIASES\` in
\`debate-data-sync/src/videos/video-rows.ts\`), and old \`/lectures/topic_analysis\`
links open the merged shelf.

## Sidebar format badges and the Greatest of All-Time banner [#sidebar-format-badges-and-the-greatest-of-all-time-banner]

In the sidebar, College Policy, HS Policy, HS Policy 1v1 (LD) and Public Forum show lettered badges (NDT,
VP, PF, LD) instead of generic icons. The Greatest of All-Time collection
(\`/videos/topPicks\`) opens on an **All Time Greatest Legends** banner \u2014 the gold trophy-goat icon
over the title, which is drawn in dots that grow in and then shimmer (still
dotted, without the animation, if you've asked your device to reduce motion) \u2014 with
drifting sparkles above the search bar (\`GoatSparklesHeading\`, built on
\`SparklesCore\` in \`debate-videos/src/ui/effects/sparkles.tsx\`).

## Category search suggestions [#category-search-suggestions]

The search chips beneath the grid are specific to the category, debate format,
season, or top-picks view currently open. Their counts come from the titles and
metadata of videos in that selection, so choosing a chip never sends you to
unrelated lectures or rounds from elsewhere in the library.

## Client paging [#client-paging]

\`\`\`
hooks/useVideoFeed.ts \u2014 useVideoFeed(filters) / useVideoMeta()
hooks/useInfiniteScroll.ts \u2014 loads the next page as the grid is scrolled
components/video-grid/WindowedChunk.tsx \u2014 keeps only on-screen cards mounted
\`\`\`

Loading is automatic and has no ceiling: the grid asks for the next page as
you scroll, and the row (list) view keeps paging on its own, one page per idle
moment, until every group is complete. To keep a long feed from freezing the
page, the grid is drawn in blocks of 60 cards and the list in one table body
per top-level group; a block far from the viewport swaps its cards for an
empty box of the same height, so only the cards near the screen are ever
mounted.

Favourites and hidden videos are sent to the feed as explicit id lists rather
than columns the query already understands \u2014 favourites as an \`ids\`
allow-list, hidden videos as an \`excludeIds\` deny-list (so a hidden video also
stops inflating the season/style dropdown counts) \u2014 but they are no longer
*stored* only client-side: both are kept on your account and follow you to
another device. See Tool Data Sync.

My Favorites (\`/videos/favorites\`) lists starred rounds and lectures together,
in separate Rounds and Lectures tables. It shares the lectures view internally,
so \`isLecturesOnlyListing()\` in \`lectureRouteConfig.ts\` is what keeps the
"All Lectures" lectures-only filter off it; only \`/videos/favoritelectures\`
narrows favourites to lectures. No other library filter applies there either:
\`favoritesFeedFilters()\` in \`useVideoFeed.ts\` drops the style, season,
category, top-picks, search and hidden-video filters, so every starred video
is listed.

Signed out, they save in that browser alone, and favouriting a video says so
once \u2014 with an offer to sign in and keep the collection. Declining is fine: the
favourite is still saved, and signing in later pushes everything that browser
already holds up to the account rather than replacing it.

## Stacked playlists [#stacked-playlists]

Some videos are the same debate twice: a round, and the round-analysis video
made from it. They used to sit pages apart in the grid \u2014 and in a rounds
view the analysis was filtered out altogether \u2014 so the pair was there and
invisible. They now share one card (or one row, in the list layout) with
\`<\` / \`>\` arrows and a \`1/2\` counter to flip between them. The full round is
what the slot opens on, unless you arrived at the companion, in which case it
opens on that.

The same applies to a round split across uploads (a decision and a rebuttals
cut) and to the parts of a lecture series.

Nothing about this is hand-curated: a stack exists because one video's
YouTube description links to the other ("Full Debate:
\`https://www.youtube.com/watch?v=\u2026\`"). Linking two videos is therefore an
edit to a description on YouTube, not a change to the site.

Every card in the grid and every row in the list shows the video's length
(\`1h 05m\`, \`42m\`) on its own line under the action buttons \u2014 not as a column \u2014
and flipping a stack shows the length of the video now on top. Lengths come
from \`/api/videos/durations\`, which reads the \`video_durations\` table the admin
backfill fills (see Video durations below); the cards ask for them in batches
as they render (\`state/videoDurations.ts\`), so a video with no stored length
simply shows none.

The **Stacked playlists** button in the search panel (the layers icon) turns
it off, giving one card per video again.

On a video's own page the stack is spelled out as a **Playlist** under the
player \u2014 the round, its analysis, each part \u2014 with the one you are watching
marked, so the analysis of a round is one click away.

A video made from a round lives one level below the round's address: the
2022 NDT final is at \`/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr\`, and
its analysis at \`/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr/analysis\`.
Links shared under the older addresses (\`\u2026/dartmouth-sv-vs-michigan-pr-round-analysis\`)
still work and forward to the new one.

A video tagged with a round but no team would have an address that names no
one video (\`/videos/26-27/policy/finals\`), so its title is added after the
round: \`/videos/26-27/policy/finals-<title>\`, or just the title when it already
says the round. The short address still works and forwards to the video it
always opened.

## List layout [#list-layout]

Clicking a row opens that video's [watch page](/docs/features/video-library/video-watch-page)
(Ctrl/\u2318-click opens it in a new tab). To keep browsing while it plays, use
the row's **Watch in popout player** icon instead \u2014 it starts the video in
the floating player in the corner (\`PopoutPlayerButton\`). On a watch page the
same icon lines the video up for the popout instead, and it starts when you
leave the page \u2014 see [Up next in the popout player](/docs/features/video-library/video-watch-page#up-next-in-the-popout-player).

The dense table view (\`VideoListRows\`, the alternative to the card grid) shows
a cleaned-up Tournament column rather than the raw stored value: years, round
labels ("Quarterfinals", "R3", "Round Robin"), and generic org words
("Tournament", "Nationals", "Invitational") are stripped, and "Tournament of
Champions"/"National Debate Tournament" collapse to "TOC"/"NDT" \u2014
\`cleanTournamentName\` in \`VideoListRows.tsx\`. A round whose tournament cleans
to nothing (or that has no team on either side) shows its title across the
row instead of blank Tournament/Aff/Neg columns.

Rounds are grouped season \u2192 tournament, newest first at every level: the
newest season on top, within a season the tournament with the most recent
video on top, and within a tournament the newest video on top (rounds from
the same day read Finals down to the prelims). Rounds with no tournament go
into an **Unsorted** tournament group, which is placed by its own newest video
like any other tournament (\`buildVideoTree\` in \`video-tree.ts\`).

Top Picks mixes every format, so there each tournament row carries a format
badge (PF, LD, Policy, College) beside its name \u2014 one per format among its
rounds \u2014 and so does the tournament name on every round row under it
(\`showFormat\` on \`VideoListRows\`, drawn by \`FormatBadge\`). Single-format
listings such as \`/videos/pf\` leave it off.

On a screen wide enough to hold the table twice over, the list splits into two
side-by-side tables, each with its own header (the sort, collapse and column
widths are shared). Rows are dealt to whichever column is shorter, so a flat
list reads left, right, left, right like the card grid, and a page loading more
only adds to the bottom. A listing that is all one season splits that season's
tournaments and repeats the season row atop both columns. Narrower screens keep
the single table (\`splitVideoTreeColumns\` in \`video-tree.ts\`).

Because the groups are built from whatever has loaded, the row view keeps
paging on its own (up to the usual 600-video ceiling) instead of waiting for
you to scroll. Otherwise sorting by views would show only each season's
most-watched rounds until the rest of the feed arrived (\`LecturesPage.tsx\`).

Every column (Aff, Neg, Date, Views) shows at every screen width. On a phone
the table is wider than the screen, so swipe it left and right to reach the
columns beside the round; the first column is capped at three quarters of the
screen so the next one always peeks in.

A round's title wraps to up to three lines. When a round has no Aff or Neg
team recorded, its title cell spans the Aff and Neg columns instead of
leaving two empty dashes (\`VideoListRow.tsx\`).

### Team names and ratings [#team-names-and-ratings]

In the Aff and Neg columns, a team from the **current season** that the
[team rankings](/docs/features/team-collaboration/team-rankings) know shows its rating in a
small badge beside its name, and clicking the name opens that team's page.
Any other team \u2014 one from a past season, or one the rankings don't match \u2014
keeps the old behaviour: clicking its name searches the library for that
team's videos. The rankings cover the current season only, so an older
round's team code is never matched (it would name different debaters).

The match is the one the team pages use (\`findTeamRanking\` in
\`@debate/rankings-adapter\`): the school loosely, the initials exactly, in
the division the round's format is ranked in. The rankings load only when
a listing holds a current-season round (\`useVideoTeamRankings\`).

## Guest video limit [#guest-video-limit]

Signed out, a visitor can open ten different videos in a browser; opening an
eleventh new one pauses it behind a sign-in dialog. Videos already opened stay
watchable, and signing in returns to the same page with the video playing.
Closing the dialog closes the popout player, or leaves the watch page for the
library.

The count lives in \`localStorage\` (\`guestVideosWatched\`, in
\`debate-webview\`'s \`lib/videos/guest-video-limit.ts\`), and
\`GuestVideoLimitGate\` in the app shell watches the player store's
\`activeVideoId\` and \`theaterVideoId\`, so both players are covered without
either one knowing about it.

## Suggesting a fix to a video [#suggesting-a-fix-to-a-video]

Every watch page has a pencil button next to the video. Click it to open the
video's details \u2014 title, format, lecture category, tournament, teams, winner
and so on \u2014 change whatever is wrong, and press **Submit for approval**.
Nothing changes right away: your edit goes to the moderators, who are notified
and approve or dismiss it from the admin panel. **Request deletion** in the
same dialog asks them to take the video off the site instead. You need to be
signed in to suggest a change.

Admins and moderators get the same pencil button, but for them it saves
straight to the library.

## Submitting a video or channel [#submitting-a-video-or-channel]

The **+** button beside the library's search bar opens **Add to the library**.
On the **Video** tab, paste a YouTube link to a round or lecture \u2014 to share
your own, upload it to YouTube first (unlisted works) and paste that link. On
the **Channel** tab, paste a channel link or type its \`@handle\` to have the
library follow it. Add a note for the moderators if it helps, then press
**Submit for review**. Nothing is published right away: the submission goes to
the moderators, who are notified and approve or dismiss it from the admin
panel. You need to be signed in to submit.

## Fixing a video (admins) [#fixing-a-video-admins]

\`/admin\` has a **Video library** card listing every video already published to
the site, searchable by title, channel, tournament or YouTube id and filterable
by format. **Edit** opens the whole record \u2014 title, channel, publish date,
format, tournament, round level, teams, each side's arguments, winner, judge
decision, description, speech-docs link and the top-pick flag \u2014 and saving it
updates the public
library right away, including how the video sorts and what searches find it.
**Lecture category** is a dropdown prefilled with every lecture shelf the
library uses (Topic Lectures, Affirmative Strategy, Counterplans & Theory and
the rest), so a typo can't create a stray shelf; pick **None** for a round.
**Aff arguments** holds the affirmative's case \u2014 the plan or advocacy and its
advantages \u2014 and **Neg arguments** the positions the negative ran (ideally
what went for the 2NR); they are the 1AC and 2NR lines shown on the video's
card, and on the watch page they sit in small type under each team's name. **\u2728 Auto-fill with AI** reads YouTube's title and
description and fills the format, category, tournament, round, teams, both
sides' arguments, winner, decision and speech-docs link; anything the model
can't read leaves your field as it is. If it fails, the message under the form
says which AI provider refused and why.
**Remove** takes the video off the site for good: it is also added to the
resync exclusion list, so the daily YouTube sync will not quietly bring it
back.

Viewers' suggested edits and deletion requests land in the **Reports &
takedowns** card as **Suggested edit** and **Deletion request**, listing each
proposed field and the viewer's reason. **Apply** writes exactly those fields;
**Delete video** removes it as **Remove** does; **Dismiss** rejects it.

Submissions from the **+** button land in the same card as **Submitted video**
and **Submitted channel**, with the pasted link and the viewer's note. **Add to
library** publishes the video under the title and channel YouTube reports
(through the same endpoint as **Add video**); **Subscribe** adds the channel to
the subscribed list the resync scans, so its videos arrive on the next sync.
Subscribing is admin-only, like the YouTube channels tab, so a moderator sees
"Only admins can subscribe to a channel" and leaves it for an admin.

The **Subscribed YouTube channels** card lists those channels as a table, most
videos first. **Videos** counts each channel's videos in the library and the
round queue, and **Most recent video** links its newest upload with the date.
Videos record a channel's display name rather than its handle, so a channel
added by \`@handle\` may show 0 until the next resync learns its display name.

The same card's **Unavailable videos** list shows what YouTube no longer
serves: **Gone from YouTube** (deleted), **Made private**, and **Embedding
turned off**, each with a count. **Check YouTube now** runs the view-count
resync right away instead of waiting for the weekly run. Tick the states to
clear (only **Gone from YouTube** is ticked by default, since private videos
can come back) and press **Remove N unavailable videos**; after a confirmation
naming the counts, every flagged video in those states is removed the way
**Remove** removes one, exclusion included. Each row also has its own
**Remove**, and **It works now** clears a flag that is out of date. Only an
admin can bulk-remove (\`DELETE /api/admin/videos/availability\`).

Engineering note: both kinds ride the \`video_issues\` queue
(\`apps/debate-ai.com/lib/videos/video-submissions.ts\`) rather than a table of
their own. A \`submit-channel\` row has no video, so its \`videoId\` is empty.

### Reclassifying by title [#reclassifying-by-title]

**Reclassify videos by title**, below **Recompute video stacks**, sets the
format of every library video whose title contains a phrase (and of matching
rounds still in the queue), and with **Parse round info with AI** ticked
re-reads each title and description with the same model as the edit form's
**Auto-fill with AI**, filling tournament, round, teams, both sides'
arguments, winner, decision and speech-docs link. A field the model can't read keeps its current value. It
defaults to **Dartmouth RR** \u2192 **College**: those rounds are college, but their
titles name no format, so the YouTube sync used to file them as Policy. The
\`debate-data-sync\` migration \`0003_dartmouth_rr_college.sql\` moves them to
College on deploy, and the sync now files new ones there itself.

### Transcripts [#transcripts]

The card's **Transcript** column shows which videos have a typed-up transcript
(with its word count), which have only YouTube's captions cached, and which have
neither; the **Has transcript / No transcript** filter narrows the list to either
side. **Transcripts** on a row opens the editor, and **Import YouTube captions**
there fills it with the video's captions as a first draft \u2014 split into timed
"Part" sections at each long pause, which in a round is usually the gap between
speeches. Rename each part to its speech (\`## 1AC \u2014 Michigan (0:00)\`) and save.

When a video has no captions at all, **Transcribe audio** downloads the video's
audio in the cloud and transcribes it with Whisper, filling the editor the same
way \u2014 marked as AI generated, with the model named. It also gives the player's
synced captions panel something to show for that video. **Download MP3** saves
the audio itself, for transcribing by hand or in another tool. Both buttons stay
greyed out until the site's audio service and transcription key are set up;
hover them to see which is missing.

To write a transcript for a video that isn't in the list \u2014 say, a round not yet
published \u2014 paste its YouTube link or id into the box at the top of the card.

The **Round videos** queue further down the page is separate \u2014 those are
rounds still waiting to be published, not videos already on the site.
Publishing never overwrites a video that is already in the library: the older
version is kept and the queued copy is skipped. **Deduplicate**, next to
**Publish all**, clears every queued round (within the selected format) that
is already in the library or repeats another queued round, without
publishing anything. Two videos count as the same when their YouTube IDs match
\u2014 even if one was stored as a full YouTube link \u2014 or when their titles match
once case and punctuation are ignored (very short titles such as "Finals"
never match on title alone). The older copy is always the one kept.

### Speech AI \u2014 speeches, summaries and alternatives in bulk [#speech-ai--speeches-summaries-and-alternatives-in-bulk]

\`/admin\` opens on the **Round queue**; **Users** is now the last section.
The **Speech AI** section (admins only) runs the AI over many rounds at once,
so viewers don't have to press **Detect speeches** themselves. Pick
**Greatest of All-Time videos** (the top-pick collection) or **Every video**
and press **Process**. For each video it:

1. fetches the YouTube captions (or uses the ones already cached);
2. has the AI find the format and where every speech starts and ends, the
   same way **Detect speeches** does on the watch page;
3. runs the prompt in the box over the round, speech by speech. The default
   prompt asks for a summary of each speech and what the speaker could have
   done instead; edit it to ask for something else. The reply format is added
   after your prompt automatically.

The result is saved as the video's **Summary** and **Analysis** documents,
with one \`## 1AC (0:42\u20138:51)\` heading per speech. On the watch page those
become the speech buttons under the player, and each speech's tab in the
sidebar shows its summary and its alternative. Documents an editor wrote are
never replaced, and videos already analyzed are skipped unless **Redo videos
the AI already analyzed** is ticked. To try a prompt first, paste one video's
link into the box below the prompt and press **Preview**, which shows both
documents without saving them; **Process and save** does that one video for
real. Every video costs two AI calls on the site's shared key, so the run goes
one video per request and **Stop after this video** halts it.

### Video durations [#video-durations]

**Fetch video durations** looks up how long every stored video is \u2014 published
rounds and lectures plus the queue \u2014 and shows the library's total running time
in hours, split into published and queued. **Fetch missing durations** only
looks up videos that don't have a length yet, so it is quick to run again after
new videos arrive; **Refetch all** looks every video up again. Videos YouTube
no longer serves (deleted or private) are counted as unavailable and stay
without a duration.

## Known gaps [#known-gaps]

Stacks only exist where a description links the videos, so a round-analysis
video that names its round in the title alone is not paired with it. Search
is \`LIKE\`-based token matching, not fuzzy.

Curated rounds added to the queue from the \`video_metadata*.json\` records
(see \`.github/scripts/queue-test-videos.ts\`; the 506 rounds in those two files
are queued by the \`debate-data-sync\` migration \`0002_curated_round_queue.sql\`
on deploy, pending admin approval) carry their topic and argument tags in
the description, with \`Aff 1AC args:\` and \`Neg 2NR args:\` lines that become the
round's 1AC and 2NR arguments when it is published. The queue has no editor,
so a wrong split is corrected in the library after publishing, with the edit
form's **Aff arguments** and **Neg arguments** boxes. The records
have no upload date, so these rounds are dated January 1st of their event's
year.

Submitted videos have to be on YouTube: the library has no file hosting
behind its player, so the **+** dialog takes a link rather than an upload.

Reclassifying with AI parsing calls the model once per video, a page of 20
per request; a video whose call fails still gets its new format but keeps its
old round fields, and the result counts it as failed so it can be run again.

The watch page doesn't display a video's length yet, and a video only shows
one in the library after **Fetch video durations** has looked it up.

The guest video limit is a nudge, not access control: the count is per
browser, so a private window or cleared site data starts it over, and the
embeds are public YouTube videos.
`,i={contents:[{heading:`video-library--sql-backed-feed-with-scroll-pagination`,content:`The debate video library (rounds, lectures, top picks) is stored in SQL and
served one page at a time, instead of downloading the entire ~1.1 MB
dataset before a single card renders.`},{heading:`video-library--sql-backed-feed-with-scroll-pagination`,content:"**Where:** `/videos`, `/videos/[category]`, and the rounds grid"},{heading:`video-library--sql-backed-feed-with-scroll-pagination`,content:"**Package:** `debate-videos`, `debate-data-sync`"},{heading:`how-it-fits-together`,content:"JSON assets under `debate-data-sync/data/videos/` are projected into a\n`videos` SQL table via `buildVideoRows()`. `GET /api/videos` pushes\nfiltering, search, sorting, and pagination into SQL; `GET /api/videos/meta`\nis a small fetch-once companion for counts/topics/champions. If the table\nis missing or unseeded, both endpoints fall back to rebuilding from the\nJSON assets in memory with identical semantics."},{heading:`season-and-tournament-addresses`,content:"A video's address starts with its season and tournament\n(`/videos/21-22/ndt/finals/\u2026`). The season is written as the two years it\nspans, because a season runs from summer to summer: `21-22` is the season that\nends in 2022. A publish date from July onward counts toward the next season.\nOlder links spelled the season as the year it ended (`/videos/2022/\u2026`); they\nstill work and forward to the new address."},{heading:`season-and-tournament-addresses`,content:"An address can be trimmed: `/videos/24-25` opens the library filtered to that\nseason, and `/videos/24-25/ndt` filtered to that season with the tournament's\nname as the search (`/videos?year=2025&q=ndt`). The bare-year forms\n(`/videos/2025`) still work too. The Worker\ndoes this with a redirect (`apps/debate-ai.com/lib/redirects/video-listing.ts`)\nbefore the request reaches the app. `/videos/archive/\u2026` maps to the undated\n(`legacy`) season."},{heading:`lecture-categories`,content:"The sidebar has a single **Lectures** row under **Videos**. Opening it\n(`/lectures`) shows the lecture categories as a bar of cards at the top of the\npage, on every screen size: **All Lectures** first, then each category with\nits icon and video count. A card's background highlights on hover, the open\ncategory is drawn selected, and clicking a card switches the list to that\ncategory (`/lectures/<category>`). The categories used to be a second,\nexpandable section of the sidebar; they now live only on the page\n(`LectureCategoryGridGallery`, rendered by `LecturesVideoGridView`)."},{heading:`merged-lecture-categories`,content:'Topic analysis and topic lectures share one shelf, **Topic Lectures**. Videos\nstill stored under the old "Topic Analysis" label are folded into it when the\nfeed and its category cards are read (`CATEGORY_LABEL_ALIASES` in\n`debate-data-sync/src/videos/video-rows.ts`), and old `/lectures/topic_analysis`\nlinks open the merged shelf.'},{heading:`sidebar-format-badges-and-the-greatest-of-all-time-banner`,content:"In the sidebar, College Policy, HS Policy, HS Policy 1v1 (LD) and Public Forum show lettered badges (NDT,\nVP, PF, LD) instead of generic icons. The Greatest of All-Time collection\n(`/videos/topPicks`) opens on an **All Time Greatest Legends** banner \u2014 the gold trophy-goat icon\nover the title, which is drawn in dots that grow in and then shimmer (still\ndotted, without the animation, if you've asked your device to reduce motion) \u2014 with\ndrifting sparkles above the search bar (`GoatSparklesHeading`, built on\n`SparklesCore` in `debate-videos/src/ui/effects/sparkles.tsx`)."},{heading:`category-search-suggestions`,content:`The search chips beneath the grid are specific to the category, debate format,
season, or top-picks view currently open. Their counts come from the titles and
metadata of videos in that selection, so choosing a chip never sends you to
unrelated lectures or rounds from elsewhere in the library.`},{heading:`client-paging`,content:`Loading is automatic and has no ceiling: the grid asks for the next page as
you scroll, and the row (list) view keeps paging on its own, one page per idle
moment, until every group is complete. To keep a long feed from freezing the
page, the grid is drawn in blocks of 60 cards and the list in one table body
per top-level group; a block far from the viewport swaps its cards for an
empty box of the same height, so only the cards near the screen are ever
mounted.`},{heading:`client-paging`,content:`Favourites and hidden videos are sent to the feed as explicit id lists rather
than columns the query already understands \u2014 favourites as an \`ids\`
allow-list, hidden videos as an \`excludeIds\` deny-list (so a hidden video also
stops inflating the season/style dropdown counts) \u2014 but they are no longer
*stored* only client-side: both are kept on your account and follow you to
another device. See Tool Data Sync.`},{heading:`client-paging`,content:'My Favorites (`/videos/favorites`) lists starred rounds and lectures together,\nin separate Rounds and Lectures tables. It shares the lectures view internally,\nso `isLecturesOnlyListing()` in `lectureRouteConfig.ts` is what keeps the\n"All Lectures" lectures-only filter off it; only `/videos/favoritelectures`\nnarrows favourites to lectures. No other library filter applies there either:\n`favoritesFeedFilters()` in `useVideoFeed.ts` drops the style, season,\ncategory, top-picks, search and hidden-video filters, so every starred video\nis listed.'},{heading:`client-paging`,content:`Signed out, they save in that browser alone, and favouriting a video says so
once \u2014 with an offer to sign in and keep the collection. Declining is fine: the
favourite is still saved, and signing in later pushes everything that browser
already holds up to the account rather than replacing it.`},{heading:`stacked-playlists`,content:`Some videos are the same debate twice: a round, and the round-analysis video
made from it. They used to sit pages apart in the grid \u2014 and in a rounds
view the analysis was filtered out altogether \u2014 so the pair was there and
invisible. They now share one card (or one row, in the list layout) with
\`<\` / \`>\` arrows and a \`1/2\` counter to flip between them. The full round is
what the slot opens on, unless you arrived at the companion, in which case it
opens on that.`},{heading:`stacked-playlists`,content:`The same applies to a round split across uploads (a decision and a rebuttals
cut) and to the parts of a lecture series.`},{heading:`stacked-playlists`,content:`Nothing about this is hand-curated: a stack exists because one video's
YouTube description links to the other ("Full Debate:
\`https://www.youtube.com/watch?v=\u2026\`"). Linking two videos is therefore an
edit to a description on YouTube, not a change to the site.`},{heading:`stacked-playlists`,content:"Every card in the grid and every row in the list shows the video's length\n(`1h 05m`, `42m`) on its own line under the action buttons \u2014 not as a column \u2014\nand flipping a stack shows the length of the video now on top. Lengths come\nfrom `/api/videos/durations`, which reads the `video_durations` table the admin\nbackfill fills (see Video durations below); the cards ask for them in batches\nas they render (`state/videoDurations.ts`), so a video with no stored length\nsimply shows none."},{heading:`stacked-playlists`,content:`The **Stacked playlists** button in the search panel (the layers icon) turns
it off, giving one card per video again.`},{heading:`stacked-playlists`,content:`On a video's own page the stack is spelled out as a **Playlist** under the
player \u2014 the round, its analysis, each part \u2014 with the one you are watching
marked, so the analysis of a round is one click away.`},{heading:`stacked-playlists`,content:"A video made from a round lives one level below the round's address: the\n2022 NDT final is at `/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr`, and\nits analysis at `/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr/analysis`.\nLinks shared under the older addresses (`\u2026/dartmouth-sv-vs-michigan-pr-round-analysis`)\nstill work and forward to the new one."},{heading:`stacked-playlists`,content:`A video tagged with a round but no team would have an address that names no
one video (\`/videos/26-27/policy/finals\`), so its title is added after the
round: \`/videos/26-27/policy/finals-<title>\`, or just the title when it already
says the round. The short address still works and forwards to the video it
always opened.`},{heading:`list-layout`,content:`Clicking a row opens that video's watch page
(Ctrl/\u2318-click opens it in a new tab). To keep browsing while it plays, use
the row's **Watch in popout player** icon instead \u2014 it starts the video in
the floating player in the corner (\`PopoutPlayerButton\`). On a watch page the
same icon lines the video up for the popout instead, and it starts when you
leave the page \u2014 see Up next in the popout player.`},{heading:`list-layout`,content:`The dense table view (\`VideoListRows\`, the alternative to the card grid) shows
a cleaned-up Tournament column rather than the raw stored value: years, round
labels ("Quarterfinals", "R3", "Round Robin"), and generic org words
("Tournament", "Nationals", "Invitational") are stripped, and "Tournament of
Champions"/"National Debate Tournament" collapse to "TOC"/"NDT" \u2014
\`cleanTournamentName\` in \`VideoListRows.tsx\`. A round whose tournament cleans
to nothing (or that has no team on either side) shows its title across the
row instead of blank Tournament/Aff/Neg columns.`},{heading:`list-layout`,content:`Rounds are grouped season \u2192 tournament, newest first at every level: the
newest season on top, within a season the tournament with the most recent
video on top, and within a tournament the newest video on top (rounds from
the same day read Finals down to the prelims). Rounds with no tournament go
into an **Unsorted** tournament group, which is placed by its own newest video
like any other tournament (\`buildVideoTree\` in \`video-tree.ts\`).`},{heading:`list-layout`,content:"Top Picks mixes every format, so there each tournament row carries a format\nbadge (PF, LD, Policy, College) beside its name \u2014 one per format among its\nrounds \u2014 and so does the tournament name on every round row under it\n(`showFormat` on `VideoListRows`, drawn by `FormatBadge`). Single-format\nlistings such as `/videos/pf` leave it off."},{heading:`list-layout`,content:`On a screen wide enough to hold the table twice over, the list splits into two
side-by-side tables, each with its own header (the sort, collapse and column
widths are shared). Rows are dealt to whichever column is shorter, so a flat
list reads left, right, left, right like the card grid, and a page loading more
only adds to the bottom. A listing that is all one season splits that season's
tournaments and repeats the season row atop both columns. Narrower screens keep
the single table (\`splitVideoTreeColumns\` in \`video-tree.ts\`).`},{heading:`list-layout`,content:`Because the groups are built from whatever has loaded, the row view keeps
paging on its own (up to the usual 600-video ceiling) instead of waiting for
you to scroll. Otherwise sorting by views would show only each season's
most-watched rounds until the rest of the feed arrived (\`LecturesPage.tsx\`).`},{heading:`list-layout`,content:`Every column (Aff, Neg, Date, Views) shows at every screen width. On a phone
the table is wider than the screen, so swipe it left and right to reach the
columns beside the round; the first column is capped at three quarters of the
screen so the next one always peeks in.`},{heading:`list-layout`,content:`A round's title wraps to up to three lines. When a round has no Aff or Neg
team recorded, its title cell spans the Aff and Neg columns instead of
leaving two empty dashes (\`VideoListRow.tsx\`).`},{heading:`team-names-and-ratings`,content:`In the Aff and Neg columns, a team from the **current season** that the
team rankings know shows its rating in a
small badge beside its name, and clicking the name opens that team's page.
Any other team \u2014 one from a past season, or one the rankings don't match \u2014
keeps the old behaviour: clicking its name searches the library for that
team's videos. The rankings cover the current season only, so an older
round's team code is never matched (it would name different debaters).`},{heading:`team-names-and-ratings`,content:"The match is the one the team pages use (`findTeamRanking` in\n`@debate/rankings-adapter`): the school loosely, the initials exactly, in\nthe division the round's format is ranked in. The rankings load only when\na listing holds a current-season round (`useVideoTeamRankings`)."},{heading:`guest-video-limit`,content:`Signed out, a visitor can open ten different videos in a browser; opening an
eleventh new one pauses it behind a sign-in dialog. Videos already opened stay
watchable, and signing in returns to the same page with the video playing.
Closing the dialog closes the popout player, or leaves the watch page for the
library.`},{heading:`guest-video-limit`,content:"The count lives in `localStorage` (`guestVideosWatched`, in\n`debate-webview`'s `lib/videos/guest-video-limit.ts`), and\n`GuestVideoLimitGate` in the app shell watches the player store's\n`activeVideoId` and `theaterVideoId`, so both players are covered without\neither one knowing about it."},{heading:`suggesting-a-fix-to-a-video`,content:`Every watch page has a pencil button next to the video. Click it to open the
video's details \u2014 title, format, lecture category, tournament, teams, winner
and so on \u2014 change whatever is wrong, and press **Submit for approval**.
Nothing changes right away: your edit goes to the moderators, who are notified
and approve or dismiss it from the admin panel. **Request deletion** in the
same dialog asks them to take the video off the site instead. You need to be
signed in to suggest a change.`},{heading:`suggesting-a-fix-to-a-video`,content:`Admins and moderators get the same pencil button, but for them it saves
straight to the library.`},{heading:`submitting-a-video-or-channel`,content:`The **+** button beside the library's search bar opens **Add to the library**.
On the **Video** tab, paste a YouTube link to a round or lecture \u2014 to share
your own, upload it to YouTube first (unlisted works) and paste that link. On
the **Channel** tab, paste a channel link or type its \`@handle\` to have the
library follow it. Add a note for the moderators if it helps, then press
**Submit for review**. Nothing is published right away: the submission goes to
the moderators, who are notified and approve or dismiss it from the admin
panel. You need to be signed in to submit.`},{heading:`fixing-a-video-admins`,content:`\`/admin\` has a **Video library** card listing every video already published to
the site, searchable by title, channel, tournament or YouTube id and filterable
by format. **Edit** opens the whole record \u2014 title, channel, publish date,
format, tournament, round level, teams, each side's arguments, winner, judge
decision, description, speech-docs link and the top-pick flag \u2014 and saving it
updates the public
library right away, including how the video sorts and what searches find it.
**Lecture category** is a dropdown prefilled with every lecture shelf the
library uses (Topic Lectures, Affirmative Strategy, Counterplans & Theory and
the rest), so a typo can't create a stray shelf; pick **None** for a round.
**Aff arguments** holds the affirmative's case \u2014 the plan or advocacy and its
advantages \u2014 and **Neg arguments** the positions the negative ran (ideally
what went for the 2NR); they are the 1AC and 2NR lines shown on the video's
card, and on the watch page they sit in small type under each team's name. **\u2728 Auto-fill with AI** reads YouTube's title and
description and fills the format, category, tournament, round, teams, both
sides' arguments, winner, decision and speech-docs link; anything the model
can't read leaves your field as it is. If it fails, the message under the form
says which AI provider refused and why.
**Remove** takes the video off the site for good: it is also added to the
resync exclusion list, so the daily YouTube sync will not quietly bring it
back.`},{heading:`fixing-a-video-admins`,content:`Viewers' suggested edits and deletion requests land in the **Reports &
takedowns** card as **Suggested edit** and **Deletion request**, listing each
proposed field and the viewer's reason. **Apply** writes exactly those fields;
**Delete video** removes it as **Remove** does; **Dismiss** rejects it.`},{heading:`fixing-a-video-admins`,content:`Submissions from the **+** button land in the same card as **Submitted video**
and **Submitted channel**, with the pasted link and the viewer's note. **Add to
library** publishes the video under the title and channel YouTube reports
(through the same endpoint as **Add video**); **Subscribe** adds the channel to
the subscribed list the resync scans, so its videos arrive on the next sync.
Subscribing is admin-only, like the YouTube channels tab, so a moderator sees
"Only admins can subscribe to a channel" and leaves it for an admin.`},{heading:`fixing-a-video-admins`,content:`The **Subscribed YouTube channels** card lists those channels as a table, most
videos first. **Videos** counts each channel's videos in the library and the
round queue, and **Most recent video** links its newest upload with the date.
Videos record a channel's display name rather than its handle, so a channel
added by \`@handle\` may show 0 until the next resync learns its display name.`},{heading:`fixing-a-video-admins`,content:`The same card's **Unavailable videos** list shows what YouTube no longer
serves: **Gone from YouTube** (deleted), **Made private**, and **Embedding
turned off**, each with a count. **Check YouTube now** runs the view-count
resync right away instead of waiting for the weekly run. Tick the states to
clear (only **Gone from YouTube** is ticked by default, since private videos
can come back) and press **Remove N unavailable videos**; after a confirmation
naming the counts, every flagged video in those states is removed the way
**Remove** removes one, exclusion included. Each row also has its own
**Remove**, and **It works now** clears a flag that is out of date. Only an
admin can bulk-remove (\`DELETE /api/admin/videos/availability\`).`},{heading:`fixing-a-video-admins`,content:"Engineering note: both kinds ride the `video_issues` queue\n(`apps/debate-ai.com/lib/videos/video-submissions.ts`) rather than a table of\ntheir own. A `submit-channel` row has no video, so its `videoId` is empty."},{heading:`reclassifying-by-title`,content:`**Reclassify videos by title**, below **Recompute video stacks**, sets the
format of every library video whose title contains a phrase (and of matching
rounds still in the queue), and with **Parse round info with AI** ticked
re-reads each title and description with the same model as the edit form's
**Auto-fill with AI**, filling tournament, round, teams, both sides'
arguments, winner, decision and speech-docs link. A field the model can't read keeps its current value. It
defaults to **Dartmouth RR** \u2192 **College**: those rounds are college, but their
titles name no format, so the YouTube sync used to file them as Policy. The
\`debate-data-sync\` migration \`0003_dartmouth_rr_college.sql\` moves them to
College on deploy, and the sync now files new ones there itself.`},{heading:`transcripts`,content:`The card's **Transcript** column shows which videos have a typed-up transcript
(with its word count), which have only YouTube's captions cached, and which have
neither; the **Has transcript / No transcript** filter narrows the list to either
side. **Transcripts** on a row opens the editor, and **Import YouTube captions**
there fills it with the video's captions as a first draft \u2014 split into timed
"Part" sections at each long pause, which in a round is usually the gap between
speeches. Rename each part to its speech (\`## 1AC \u2014 Michigan (0:00)\`) and save.`},{heading:`transcripts`,content:`When a video has no captions at all, **Transcribe audio** downloads the video's
audio in the cloud and transcribes it with Whisper, filling the editor the same
way \u2014 marked as AI generated, with the model named. It also gives the player's
synced captions panel something to show for that video. **Download MP3** saves
the audio itself, for transcribing by hand or in another tool. Both buttons stay
greyed out until the site's audio service and transcription key are set up;
hover them to see which is missing.`},{heading:`transcripts`,content:`To write a transcript for a video that isn't in the list \u2014 say, a round not yet
published \u2014 paste its YouTube link or id into the box at the top of the card.`},{heading:`transcripts`,content:`The **Round videos** queue further down the page is separate \u2014 those are
rounds still waiting to be published, not videos already on the site.
Publishing never overwrites a video that is already in the library: the older
version is kept and the queued copy is skipped. **Deduplicate**, next to
**Publish all**, clears every queued round (within the selected format) that
is already in the library or repeats another queued round, without
publishing anything. Two videos count as the same when their YouTube IDs match
\u2014 even if one was stored as a full YouTube link \u2014 or when their titles match
once case and punctuation are ignored (very short titles such as "Finals"
never match on title alone). The older copy is always the one kept.`},{heading:`speech-ai--speeches-summaries-and-alternatives-in-bulk`,content:`\`/admin\` opens on the **Round queue**; **Users** is now the last section.
The **Speech AI** section (admins only) runs the AI over many rounds at once,
so viewers don't have to press **Detect speeches** themselves. Pick
**Greatest of All-Time videos** (the top-pick collection) or **Every video**
and press **Process**. For each video it:`},{heading:`speech-ai--speeches-summaries-and-alternatives-in-bulk`,content:`fetches the YouTube captions (or uses the ones already cached);`},{heading:`speech-ai--speeches-summaries-and-alternatives-in-bulk`,content:`has the AI find the format and where every speech starts and ends, the
same way **Detect speeches** does on the watch page;`},{heading:`speech-ai--speeches-summaries-and-alternatives-in-bulk`,content:`runs the prompt in the box over the round, speech by speech. The default
prompt asks for a summary of each speech and what the speaker could have
done instead; edit it to ask for something else. The reply format is added
after your prompt automatically.`},{heading:`speech-ai--speeches-summaries-and-alternatives-in-bulk`,content:`The result is saved as the video's **Summary** and **Analysis** documents,
with one \`## 1AC (0:42\u20138:51)\` heading per speech. On the watch page those
become the speech buttons under the player, and each speech's tab in the
sidebar shows its summary and its alternative. Documents an editor wrote are
never replaced, and videos already analyzed are skipped unless **Redo videos
the AI already analyzed** is ticked. To try a prompt first, paste one video's
link into the box below the prompt and press **Preview**, which shows both
documents without saving them; **Process and save** does that one video for
real. Every video costs two AI calls on the site's shared key, so the run goes
one video per request and **Stop after this video** halts it.`},{heading:`video-durations`,content:`**Fetch video durations** looks up how long every stored video is \u2014 published
rounds and lectures plus the queue \u2014 and shows the library's total running time
in hours, split into published and queued. **Fetch missing durations** only
looks up videos that don't have a length yet, so it is quick to run again after
new videos arrive; **Refetch all** looks every video up again. Videos YouTube
no longer serves (deleted or private) are counted as unavailable and stay
without a duration.`},{heading:`known-gaps`,content:`Stacks only exist where a description links the videos, so a round-analysis
video that names its round in the title alone is not paired with it. Search
is \`LIKE\`-based token matching, not fuzzy.`},{heading:`known-gaps`,content:"Curated rounds added to the queue from the `video_metadata*.json` records\n(see `.github/scripts/queue-test-videos.ts`; the 506 rounds in those two files\nare queued by the `debate-data-sync` migration `0002_curated_round_queue.sql`\non deploy, pending admin approval) carry their topic and argument tags in\nthe description, with `Aff 1AC args:` and `Neg 2NR args:` lines that become the\nround's 1AC and 2NR arguments when it is published. The queue has no editor,\nso a wrong split is corrected in the library after publishing, with the edit\nform's **Aff arguments** and **Neg arguments** boxes. The records\nhave no upload date, so these rounds are dated January 1st of their event's\nyear."},{heading:`known-gaps`,content:`Submitted videos have to be on YouTube: the library has no file hosting
behind its player, so the **+** dialog takes a link rather than an upload.`},{heading:`known-gaps`,content:`Reclassifying with AI parsing calls the model once per video, a page of 20
per request; a video whose call fails still gets its new format but keeps its
old round fields, and the result counts it as failed so it can be run again.`},{heading:`known-gaps`,content:`The watch page doesn't display a video's length yet, and a video only shows
one in the library after **Fetch video durations** has looked it up.`},{heading:`known-gaps`,content:`The guest video limit is a nudge, not access control: the count is per
browser, so a private window or cleared site data starts it over, and the
embeds are public YouTube videos.`}],headings:[{id:`video-library--sql-backed-feed-with-scroll-pagination`,content:`Video Library \u2014 SQL-backed feed with scroll pagination`},{id:`how-it-fits-together`,content:`How it fits together`},{id:`season-and-tournament-addresses`,content:`Season and tournament addresses`},{id:`lecture-categories`,content:`Lecture categories`},{id:`merged-lecture-categories`,content:`Merged lecture categories`},{id:`sidebar-format-badges-and-the-greatest-of-all-time-banner`,content:`Sidebar format badges and the Greatest of All-Time banner`},{id:`category-search-suggestions`,content:`Category search suggestions`},{id:`client-paging`,content:`Client paging`},{id:`stacked-playlists`,content:`Stacked playlists`},{id:`list-layout`,content:`List layout`},{id:`team-names-and-ratings`,content:`Team names and ratings`},{id:`guest-video-limit`,content:`Guest video limit`},{id:`suggesting-a-fix-to-a-video`,content:`Suggesting a fix to a video`},{id:`submitting-a-video-or-channel`,content:`Submitting a video or channel`},{id:`fixing-a-video-admins`,content:`Fixing a video (admins)`},{id:`reclassifying-by-title`,content:`Reclassifying by title`},{id:`transcripts`,content:`Transcripts`},{id:`speech-ai--speeches-summaries-and-alternatives-in-bulk`,content:`Speech AI \u2014 speeches, summaries and alternatives in bulk`},{id:`video-durations`,content:`Video durations`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#video-library--sql-backed-feed-with-scroll-pagination`,title:(0,t.jsx)(t.Fragment,{children:`Video Library \u2014 SQL-backed feed with scroll pagination`})},{depth:2,url:`#how-it-fits-together`,title:(0,t.jsx)(t.Fragment,{children:`How it fits together`})},{depth:2,url:`#season-and-tournament-addresses`,title:(0,t.jsx)(t.Fragment,{children:`Season and tournament addresses`})},{depth:2,url:`#lecture-categories`,title:(0,t.jsx)(t.Fragment,{children:`Lecture categories`})},{depth:2,url:`#merged-lecture-categories`,title:(0,t.jsx)(t.Fragment,{children:`Merged lecture categories`})},{depth:2,url:`#sidebar-format-badges-and-the-greatest-of-all-time-banner`,title:(0,t.jsx)(t.Fragment,{children:`Sidebar format badges and the Greatest of All-Time banner`})},{depth:2,url:`#category-search-suggestions`,title:(0,t.jsx)(t.Fragment,{children:`Category search suggestions`})},{depth:2,url:`#client-paging`,title:(0,t.jsx)(t.Fragment,{children:`Client paging`})},{depth:2,url:`#stacked-playlists`,title:(0,t.jsx)(t.Fragment,{children:`Stacked playlists`})},{depth:2,url:`#list-layout`,title:(0,t.jsx)(t.Fragment,{children:`List layout`})},{depth:3,url:`#team-names-and-ratings`,title:(0,t.jsx)(t.Fragment,{children:`Team names and ratings`})},{depth:2,url:`#guest-video-limit`,title:(0,t.jsx)(t.Fragment,{children:`Guest video limit`})},{depth:2,url:`#suggesting-a-fix-to-a-video`,title:(0,t.jsx)(t.Fragment,{children:`Suggesting a fix to a video`})},{depth:2,url:`#submitting-a-video-or-channel`,title:(0,t.jsx)(t.Fragment,{children:`Submitting a video or channel`})},{depth:2,url:`#fixing-a-video-admins`,title:(0,t.jsx)(t.Fragment,{children:`Fixing a video (admins)`})},{depth:3,url:`#reclassifying-by-title`,title:(0,t.jsx)(t.Fragment,{children:`Reclassifying by title`})},{depth:3,url:`#transcripts`,title:(0,t.jsx)(t.Fragment,{children:`Transcripts`})},{depth:3,url:`#speech-ai--speeches-summaries-and-alternatives-in-bulk`,title:(0,t.jsx)(t.Fragment,{children:`Speech AI \u2014 speeches, summaries and alternatives in bulk`})},{depth:3,url:`#video-durations`,title:(0,t.jsx)(t.Fragment,{children:`Video durations`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,h3:`h3`,li:`li`,ol:`ol`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`video-library--sql-backed-feed-with-scroll-pagination`,children:`Video Library \u2014 SQL-backed feed with scroll pagination`}),`
`,(0,t.jsx)(n.p,{children:`The debate video library (rounds, lectures, top picks) is stored in SQL and
served one page at a time, instead of downloading the entire ~1.1 MB
dataset before a single card renders.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Where:`}),` `,(0,t.jsx)(n.code,{children:`/videos`}),`, `,(0,t.jsx)(n.code,{children:`/videos/[category]`}),`, and the rounds grid`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-videos`}),`, `,(0,t.jsx)(n.code,{children:`debate-data-sync`})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`how-it-fits-together`,children:`How it fits together`}),`
`,(0,t.jsxs)(n.p,{children:[`JSON assets under `,(0,t.jsx)(n.code,{children:`debate-data-sync/data/videos/`}),` are projected into a
`,(0,t.jsx)(n.code,{children:`videos`}),` SQL table via `,(0,t.jsx)(n.code,{children:`buildVideoRows()`}),`. `,(0,t.jsx)(n.code,{children:`GET /api/videos`}),` pushes
filtering, search, sorting, and pagination into SQL; `,(0,t.jsx)(n.code,{children:`GET /api/videos/meta`}),`
is a small fetch-once companion for counts/topics/champions. If the table
is missing or unseeded, both endpoints fall back to rebuilding from the
JSON assets in memory with identical semantics.`]}),`
`,(0,t.jsx)(n.h2,{id:`season-and-tournament-addresses`,children:`Season and tournament addresses`}),`
`,(0,t.jsxs)(n.p,{children:[`A video's address starts with its season and tournament
(`,(0,t.jsx)(n.code,{children:`/videos/21-22/ndt/finals/\u2026`}),`). The season is written as the two years it
spans, because a season runs from summer to summer: `,(0,t.jsx)(n.code,{children:`21-22`}),` is the season that
ends in 2022. A publish date from July onward counts toward the next season.
Older links spelled the season as the year it ended (`,(0,t.jsx)(n.code,{children:`/videos/2022/\u2026`}),`); they
still work and forward to the new address.`]}),`
`,(0,t.jsxs)(n.p,{children:[`An address can be trimmed: `,(0,t.jsx)(n.code,{children:`/videos/24-25`}),` opens the library filtered to that
season, and `,(0,t.jsx)(n.code,{children:`/videos/24-25/ndt`}),` filtered to that season with the tournament's
name as the search (`,(0,t.jsx)(n.code,{children:`/videos?year=2025&q=ndt`}),`). The bare-year forms
(`,(0,t.jsx)(n.code,{children:`/videos/2025`}),`) still work too. The Worker
does this with a redirect (`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/redirects/video-listing.ts`}),`)
before the request reaches the app. `,(0,t.jsx)(n.code,{children:`/videos/archive/\u2026`}),` maps to the undated
(`,(0,t.jsx)(n.code,{children:`legacy`}),`) season.`]}),`
`,(0,t.jsx)(n.h2,{id:`lecture-categories`,children:`Lecture categories`}),`
`,(0,t.jsxs)(n.p,{children:[`The sidebar has a single `,(0,t.jsx)(n.strong,{children:`Lectures`}),` row under `,(0,t.jsx)(n.strong,{children:`Videos`}),`. Opening it
(`,(0,t.jsx)(n.code,{children:`/lectures`}),`) shows the lecture categories as a bar of cards at the top of the
page, on every screen size: `,(0,t.jsx)(n.strong,{children:`All Lectures`}),` first, then each category with
its icon and video count. A card's background highlights on hover, the open
category is drawn selected, and clicking a card switches the list to that
category (`,(0,t.jsx)(n.code,{children:`/lectures/<category>`}),`). The categories used to be a second,
expandable section of the sidebar; they now live only on the page
(`,(0,t.jsx)(n.code,{children:`LectureCategoryGridGallery`}),`, rendered by `,(0,t.jsx)(n.code,{children:`LecturesVideoGridView`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`merged-lecture-categories`,children:`Merged lecture categories`}),`
`,(0,t.jsxs)(n.p,{children:[`Topic analysis and topic lectures share one shelf, `,(0,t.jsx)(n.strong,{children:`Topic Lectures`}),`. Videos
still stored under the old "Topic Analysis" label are folded into it when the
feed and its category cards are read (`,(0,t.jsx)(n.code,{children:`CATEGORY_LABEL_ALIASES`}),` in
`,(0,t.jsx)(n.code,{children:`debate-data-sync/src/videos/video-rows.ts`}),`), and old `,(0,t.jsx)(n.code,{children:`/lectures/topic_analysis`}),`
links open the merged shelf.`]}),`
`,(0,t.jsx)(n.h2,{id:`sidebar-format-badges-and-the-greatest-of-all-time-banner`,children:`Sidebar format badges and the Greatest of All-Time banner`}),`
`,(0,t.jsxs)(n.p,{children:[`In the sidebar, College Policy, HS Policy, HS Policy 1v1 (LD) and Public Forum show lettered badges (NDT,
VP, PF, LD) instead of generic icons. The Greatest of All-Time collection
(`,(0,t.jsx)(n.code,{children:`/videos/topPicks`}),`) opens on an `,(0,t.jsx)(n.strong,{children:`All Time Greatest Legends`}),` banner \u2014 the gold trophy-goat icon
over the title, which is drawn in dots that grow in and then shimmer (still
dotted, without the animation, if you've asked your device to reduce motion) \u2014 with
drifting sparkles above the search bar (`,(0,t.jsx)(n.code,{children:`GoatSparklesHeading`}),`, built on
`,(0,t.jsx)(n.code,{children:`SparklesCore`}),` in `,(0,t.jsx)(n.code,{children:`debate-videos/src/ui/effects/sparkles.tsx`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`category-search-suggestions`,children:`Category search suggestions`}),`
`,(0,t.jsx)(n.p,{children:`The search chips beneath the grid are specific to the category, debate format,
season, or top-picks view currently open. Their counts come from the titles and
metadata of videos in that selection, so choosing a chip never sends you to
unrelated lectures or rounds from elsewhere in the library.`}),`
`,(0,t.jsx)(n.h2,{id:`client-paging`,children:`Client paging`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`hooks/useVideoFeed.ts \u2014 useVideoFeed(filters) / useVideoMeta()`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`hooks/useInfiniteScroll.ts \u2014 loads the next page as the grid is scrolled`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`components/video-grid/WindowedChunk.tsx \u2014 keeps only on-screen cards mounted`})})]})})}),`
`,(0,t.jsx)(n.p,{children:`Loading is automatic and has no ceiling: the grid asks for the next page as
you scroll, and the row (list) view keeps paging on its own, one page per idle
moment, until every group is complete. To keep a long feed from freezing the
page, the grid is drawn in blocks of 60 cards and the list in one table body
per top-level group; a block far from the viewport swaps its cards for an
empty box of the same height, so only the cards near the screen are ever
mounted.`}),`
`,(0,t.jsxs)(n.p,{children:[`Favourites and hidden videos are sent to the feed as explicit id lists rather
than columns the query already understands \u2014 favourites as an `,(0,t.jsx)(n.code,{children:`ids`}),`
allow-list, hidden videos as an `,(0,t.jsx)(n.code,{children:`excludeIds`}),` deny-list (so a hidden video also
stops inflating the season/style dropdown counts) \u2014 but they are no longer
`,(0,t.jsx)(n.em,{children:`stored`}),` only client-side: both are kept on your account and follow you to
another device. See Tool Data Sync.`]}),`
`,(0,t.jsxs)(n.p,{children:[`My Favorites (`,(0,t.jsx)(n.code,{children:`/videos/favorites`}),`) lists starred rounds and lectures together,
in separate Rounds and Lectures tables. It shares the lectures view internally,
so `,(0,t.jsx)(n.code,{children:`isLecturesOnlyListing()`}),` in `,(0,t.jsx)(n.code,{children:`lectureRouteConfig.ts`}),` is what keeps the
"All Lectures" lectures-only filter off it; only `,(0,t.jsx)(n.code,{children:`/videos/favoritelectures`}),`
narrows favourites to lectures. No other library filter applies there either:
`,(0,t.jsx)(n.code,{children:`favoritesFeedFilters()`}),` in `,(0,t.jsx)(n.code,{children:`useVideoFeed.ts`}),` drops the style, season,
category, top-picks, search and hidden-video filters, so every starred video
is listed.`]}),`
`,(0,t.jsx)(n.p,{children:`Signed out, they save in that browser alone, and favouriting a video says so
once \u2014 with an offer to sign in and keep the collection. Declining is fine: the
favourite is still saved, and signing in later pushes everything that browser
already holds up to the account rather than replacing it.`}),`
`,(0,t.jsx)(n.h2,{id:`stacked-playlists`,children:`Stacked playlists`}),`
`,(0,t.jsxs)(n.p,{children:[`Some videos are the same debate twice: a round, and the round-analysis video
made from it. They used to sit pages apart in the grid \u2014 and in a rounds
view the analysis was filtered out altogether \u2014 so the pair was there and
invisible. They now share one card (or one row, in the list layout) with
`,(0,t.jsx)(n.code,{children:`<`}),` / `,(0,t.jsx)(n.code,{children:`>`}),` arrows and a `,(0,t.jsx)(n.code,{children:`1/2`}),` counter to flip between them. The full round is
what the slot opens on, unless you arrived at the companion, in which case it
opens on that.`]}),`
`,(0,t.jsx)(n.p,{children:`The same applies to a round split across uploads (a decision and a rebuttals
cut) and to the parts of a lecture series.`}),`
`,(0,t.jsxs)(n.p,{children:[`Nothing about this is hand-curated: a stack exists because one video's
YouTube description links to the other ("Full Debate:
`,(0,t.jsx)(n.code,{children:`https://www.youtube.com/watch?v=\u2026`}),`"). Linking two videos is therefore an
edit to a description on YouTube, not a change to the site.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Every card in the grid and every row in the list shows the video's length
(`,(0,t.jsx)(n.code,{children:`1h 05m`}),`, `,(0,t.jsx)(n.code,{children:`42m`}),`) on its own line under the action buttons \u2014 not as a column \u2014
and flipping a stack shows the length of the video now on top. Lengths come
from `,(0,t.jsx)(n.code,{children:`/api/videos/durations`}),`, which reads the `,(0,t.jsx)(n.code,{children:`video_durations`}),` table the admin
backfill fills (see Video durations below); the cards ask for them in batches
as they render (`,(0,t.jsx)(n.code,{children:`state/videoDurations.ts`}),`), so a video with no stored length
simply shows none.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Stacked playlists`}),` button in the search panel (the layers icon) turns
it off, giving one card per video again.`]}),`
`,(0,t.jsxs)(n.p,{children:[`On a video's own page the stack is spelled out as a `,(0,t.jsx)(n.strong,{children:`Playlist`}),` under the
player \u2014 the round, its analysis, each part \u2014 with the one you are watching
marked, so the analysis of a round is one click away.`]}),`
`,(0,t.jsxs)(n.p,{children:[`A video made from a round lives one level below the round's address: the
2022 NDT final is at `,(0,t.jsx)(n.code,{children:`/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr`}),`, and
its analysis at `,(0,t.jsx)(n.code,{children:`/videos/21-22/ndt/finals/dartmouth-sv-michigan-pr/analysis`}),`.
Links shared under the older addresses (`,(0,t.jsx)(n.code,{children:`\u2026/dartmouth-sv-vs-michigan-pr-round-analysis`}),`)
still work and forward to the new one.`]}),`
`,(0,t.jsxs)(n.p,{children:[`A video tagged with a round but no team would have an address that names no
one video (`,(0,t.jsx)(n.code,{children:`/videos/26-27/policy/finals`}),`), so its title is added after the
round: `,(0,t.jsx)(n.code,{children:`/videos/26-27/policy/finals-<title>`}),`, or just the title when it already
says the round. The short address still works and forwards to the video it
always opened.`]}),`
`,(0,t.jsx)(n.h2,{id:`list-layout`,children:`List layout`}),`
`,(0,t.jsxs)(n.p,{children:[`Clicking a row opens that video's `,(0,t.jsx)(n.a,{href:`/docs/features/video-library/video-watch-page`,children:`watch page`}),`
(Ctrl/\u2318-click opens it in a new tab). To keep browsing while it plays, use
the row's `,(0,t.jsx)(n.strong,{children:`Watch in popout player`}),` icon instead \u2014 it starts the video in
the floating player in the corner (`,(0,t.jsx)(n.code,{children:`PopoutPlayerButton`}),`). On a watch page the
same icon lines the video up for the popout instead, and it starts when you
leave the page \u2014 see `,(0,t.jsx)(n.a,{href:`/docs/features/video-library/video-watch-page#up-next-in-the-popout-player`,children:`Up next in the popout player`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The dense table view (`,(0,t.jsx)(n.code,{children:`VideoListRows`}),`, the alternative to the card grid) shows
a cleaned-up Tournament column rather than the raw stored value: years, round
labels ("Quarterfinals", "R3", "Round Robin"), and generic org words
("Tournament", "Nationals", "Invitational") are stripped, and "Tournament of
Champions"/"National Debate Tournament" collapse to "TOC"/"NDT" \u2014
`,(0,t.jsx)(n.code,{children:`cleanTournamentName`}),` in `,(0,t.jsx)(n.code,{children:`VideoListRows.tsx`}),`. A round whose tournament cleans
to nothing (or that has no team on either side) shows its title across the
row instead of blank Tournament/Aff/Neg columns.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Rounds are grouped season \u2192 tournament, newest first at every level: the
newest season on top, within a season the tournament with the most recent
video on top, and within a tournament the newest video on top (rounds from
the same day read Finals down to the prelims). Rounds with no tournament go
into an `,(0,t.jsx)(n.strong,{children:`Unsorted`}),` tournament group, which is placed by its own newest video
like any other tournament (`,(0,t.jsx)(n.code,{children:`buildVideoTree`}),` in `,(0,t.jsx)(n.code,{children:`video-tree.ts`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`Top Picks mixes every format, so there each tournament row carries a format
badge (PF, LD, Policy, College) beside its name \u2014 one per format among its
rounds \u2014 and so does the tournament name on every round row under it
(`,(0,t.jsx)(n.code,{children:`showFormat`}),` on `,(0,t.jsx)(n.code,{children:`VideoListRows`}),`, drawn by `,(0,t.jsx)(n.code,{children:`FormatBadge`}),`). Single-format
listings such as `,(0,t.jsx)(n.code,{children:`/videos/pf`}),` leave it off.`]}),`
`,(0,t.jsxs)(n.p,{children:[`On a screen wide enough to hold the table twice over, the list splits into two
side-by-side tables, each with its own header (the sort, collapse and column
widths are shared). Rows are dealt to whichever column is shorter, so a flat
list reads left, right, left, right like the card grid, and a page loading more
only adds to the bottom. A listing that is all one season splits that season's
tournaments and repeats the season row atop both columns. Narrower screens keep
the single table (`,(0,t.jsx)(n.code,{children:`splitVideoTreeColumns`}),` in `,(0,t.jsx)(n.code,{children:`video-tree.ts`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`Because the groups are built from whatever has loaded, the row view keeps
paging on its own (up to the usual 600-video ceiling) instead of waiting for
you to scroll. Otherwise sorting by views would show only each season's
most-watched rounds until the rest of the feed arrived (`,(0,t.jsx)(n.code,{children:`LecturesPage.tsx`}),`).`]}),`
`,(0,t.jsx)(n.p,{children:`Every column (Aff, Neg, Date, Views) shows at every screen width. On a phone
the table is wider than the screen, so swipe it left and right to reach the
columns beside the round; the first column is capped at three quarters of the
screen so the next one always peeks in.`}),`
`,(0,t.jsxs)(n.p,{children:[`A round's title wraps to up to three lines. When a round has no Aff or Neg
team recorded, its title cell spans the Aff and Neg columns instead of
leaving two empty dashes (`,(0,t.jsx)(n.code,{children:`VideoListRow.tsx`}),`).`]}),`
`,(0,t.jsx)(n.h3,{id:`team-names-and-ratings`,children:`Team names and ratings`}),`
`,(0,t.jsxs)(n.p,{children:[`In the Aff and Neg columns, a team from the `,(0,t.jsx)(n.strong,{children:`current season`}),` that the
`,(0,t.jsx)(n.a,{href:`/docs/features/team-collaboration/team-rankings`,children:`team rankings`}),` know shows its rating in a
small badge beside its name, and clicking the name opens that team's page.
Any other team \u2014 one from a past season, or one the rankings don't match \u2014
keeps the old behaviour: clicking its name searches the library for that
team's videos. The rankings cover the current season only, so an older
round's team code is never matched (it would name different debaters).`]}),`
`,(0,t.jsxs)(n.p,{children:[`The match is the one the team pages use (`,(0,t.jsx)(n.code,{children:`findTeamRanking`}),` in
`,(0,t.jsx)(n.code,{children:`@debate/rankings-adapter`}),`): the school loosely, the initials exactly, in
the division the round's format is ranked in. The rankings load only when
a listing holds a current-season round (`,(0,t.jsx)(n.code,{children:`useVideoTeamRankings`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`guest-video-limit`,children:`Guest video limit`}),`
`,(0,t.jsx)(n.p,{children:`Signed out, a visitor can open ten different videos in a browser; opening an
eleventh new one pauses it behind a sign-in dialog. Videos already opened stay
watchable, and signing in returns to the same page with the video playing.
Closing the dialog closes the popout player, or leaves the watch page for the
library.`}),`
`,(0,t.jsxs)(n.p,{children:[`The count lives in `,(0,t.jsx)(n.code,{children:`localStorage`}),` (`,(0,t.jsx)(n.code,{children:`guestVideosWatched`}),`, in
`,(0,t.jsx)(n.code,{children:`debate-webview`}),`'s `,(0,t.jsx)(n.code,{children:`lib/videos/guest-video-limit.ts`}),`), and
`,(0,t.jsx)(n.code,{children:`GuestVideoLimitGate`}),` in the app shell watches the player store's
`,(0,t.jsx)(n.code,{children:`activeVideoId`}),` and `,(0,t.jsx)(n.code,{children:`theaterVideoId`}),`, so both players are covered without
either one knowing about it.`]}),`
`,(0,t.jsx)(n.h2,{id:`suggesting-a-fix-to-a-video`,children:`Suggesting a fix to a video`}),`
`,(0,t.jsxs)(n.p,{children:[`Every watch page has a pencil button next to the video. Click it to open the
video's details \u2014 title, format, lecture category, tournament, teams, winner
and so on \u2014 change whatever is wrong, and press `,(0,t.jsx)(n.strong,{children:`Submit for approval`}),`.
Nothing changes right away: your edit goes to the moderators, who are notified
and approve or dismiss it from the admin panel. `,(0,t.jsx)(n.strong,{children:`Request deletion`}),` in the
same dialog asks them to take the video off the site instead. You need to be
signed in to suggest a change.`]}),`
`,(0,t.jsx)(n.p,{children:`Admins and moderators get the same pencil button, but for them it saves
straight to the library.`}),`
`,(0,t.jsx)(n.h2,{id:`submitting-a-video-or-channel`,children:`Submitting a video or channel`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`+`}),` button beside the library's search bar opens `,(0,t.jsx)(n.strong,{children:`Add to the library`}),`.
On the `,(0,t.jsx)(n.strong,{children:`Video`}),` tab, paste a YouTube link to a round or lecture \u2014 to share
your own, upload it to YouTube first (unlisted works) and paste that link. On
the `,(0,t.jsx)(n.strong,{children:`Channel`}),` tab, paste a channel link or type its `,(0,t.jsx)(n.code,{children:`@handle`}),` to have the
library follow it. Add a note for the moderators if it helps, then press
`,(0,t.jsx)(n.strong,{children:`Submit for review`}),`. Nothing is published right away: the submission goes to
the moderators, who are notified and approve or dismiss it from the admin
panel. You need to be signed in to submit.`]}),`
`,(0,t.jsx)(n.h2,{id:`fixing-a-video-admins`,children:`Fixing a video (admins)`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/admin`}),` has a `,(0,t.jsx)(n.strong,{children:`Video library`}),` card listing every video already published to
the site, searchable by title, channel, tournament or YouTube id and filterable
by format. `,(0,t.jsx)(n.strong,{children:`Edit`}),` opens the whole record \u2014 title, channel, publish date,
format, tournament, round level, teams, each side's arguments, winner, judge
decision, description, speech-docs link and the top-pick flag \u2014 and saving it
updates the public
library right away, including how the video sorts and what searches find it.
`,(0,t.jsx)(n.strong,{children:`Lecture category`}),` is a dropdown prefilled with every lecture shelf the
library uses (Topic Lectures, Affirmative Strategy, Counterplans & Theory and
the rest), so a typo can't create a stray shelf; pick `,(0,t.jsx)(n.strong,{children:`None`}),` for a round.
`,(0,t.jsx)(n.strong,{children:`Aff arguments`}),` holds the affirmative's case \u2014 the plan or advocacy and its
advantages \u2014 and `,(0,t.jsx)(n.strong,{children:`Neg arguments`}),` the positions the negative ran (ideally
what went for the 2NR); they are the 1AC and 2NR lines shown on the video's
card, and on the watch page they sit in small type under each team's name. `,(0,t.jsx)(n.strong,{children:`\u2728 Auto-fill with AI`}),` reads YouTube's title and
description and fills the format, category, tournament, round, teams, both
sides' arguments, winner, decision and speech-docs link; anything the model
can't read leaves your field as it is. If it fails, the message under the form
says which AI provider refused and why.
`,(0,t.jsx)(n.strong,{children:`Remove`}),` takes the video off the site for good: it is also added to the
resync exclusion list, so the daily YouTube sync will not quietly bring it
back.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Viewers' suggested edits and deletion requests land in the `,(0,t.jsx)(n.strong,{children:`Reports &
takedowns`}),` card as `,(0,t.jsx)(n.strong,{children:`Suggested edit`}),` and `,(0,t.jsx)(n.strong,{children:`Deletion request`}),`, listing each
proposed field and the viewer's reason. `,(0,t.jsx)(n.strong,{children:`Apply`}),` writes exactly those fields;
`,(0,t.jsx)(n.strong,{children:`Delete video`}),` removes it as `,(0,t.jsx)(n.strong,{children:`Remove`}),` does; `,(0,t.jsx)(n.strong,{children:`Dismiss`}),` rejects it.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Submissions from the `,(0,t.jsx)(n.strong,{children:`+`}),` button land in the same card as `,(0,t.jsx)(n.strong,{children:`Submitted video`}),`
and `,(0,t.jsx)(n.strong,{children:`Submitted channel`}),`, with the pasted link and the viewer's note. `,(0,t.jsx)(n.strong,{children:`Add to
library`}),` publishes the video under the title and channel YouTube reports
(through the same endpoint as `,(0,t.jsx)(n.strong,{children:`Add video`}),`); `,(0,t.jsx)(n.strong,{children:`Subscribe`}),` adds the channel to
the subscribed list the resync scans, so its videos arrive on the next sync.
Subscribing is admin-only, like the YouTube channels tab, so a moderator sees
"Only admins can subscribe to a channel" and leaves it for an admin.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Subscribed YouTube channels`}),` card lists those channels as a table, most
videos first. `,(0,t.jsx)(n.strong,{children:`Videos`}),` counts each channel's videos in the library and the
round queue, and `,(0,t.jsx)(n.strong,{children:`Most recent video`}),` links its newest upload with the date.
Videos record a channel's display name rather than its handle, so a channel
added by `,(0,t.jsx)(n.code,{children:`@handle`}),` may show 0 until the next resync learns its display name.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The same card's `,(0,t.jsx)(n.strong,{children:`Unavailable videos`}),` list shows what YouTube no longer
serves: `,(0,t.jsx)(n.strong,{children:`Gone from YouTube`}),` (deleted), `,(0,t.jsx)(n.strong,{children:`Made private`}),`, and `,(0,t.jsx)(n.strong,{children:`Embedding
turned off`}),`, each with a count. `,(0,t.jsx)(n.strong,{children:`Check YouTube now`}),` runs the view-count
resync right away instead of waiting for the weekly run. Tick the states to
clear (only `,(0,t.jsx)(n.strong,{children:`Gone from YouTube`}),` is ticked by default, since private videos
can come back) and press `,(0,t.jsx)(n.strong,{children:`Remove N unavailable videos`}),`; after a confirmation
naming the counts, every flagged video in those states is removed the way
`,(0,t.jsx)(n.strong,{children:`Remove`}),` removes one, exclusion included. Each row also has its own
`,(0,t.jsx)(n.strong,{children:`Remove`}),`, and `,(0,t.jsx)(n.strong,{children:`It works now`}),` clears a flag that is out of date. Only an
admin can bulk-remove (`,(0,t.jsx)(n.code,{children:`DELETE /api/admin/videos/availability`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`Engineering note: both kinds ride the `,(0,t.jsx)(n.code,{children:`video_issues`}),` queue
(`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/videos/video-submissions.ts`}),`) rather than a table of
their own. A `,(0,t.jsx)(n.code,{children:`submit-channel`}),` row has no video, so its `,(0,t.jsx)(n.code,{children:`videoId`}),` is empty.`]}),`
`,(0,t.jsx)(n.h3,{id:`reclassifying-by-title`,children:`Reclassifying by title`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Reclassify videos by title`}),`, below `,(0,t.jsx)(n.strong,{children:`Recompute video stacks`}),`, sets the
format of every library video whose title contains a phrase (and of matching
rounds still in the queue), and with `,(0,t.jsx)(n.strong,{children:`Parse round info with AI`}),` ticked
re-reads each title and description with the same model as the edit form's
`,(0,t.jsx)(n.strong,{children:`Auto-fill with AI`}),`, filling tournament, round, teams, both sides'
arguments, winner, decision and speech-docs link. A field the model can't read keeps its current value. It
defaults to `,(0,t.jsx)(n.strong,{children:`Dartmouth RR`}),` \u2192 `,(0,t.jsx)(n.strong,{children:`College`}),`: those rounds are college, but their
titles name no format, so the YouTube sync used to file them as Policy. The
`,(0,t.jsx)(n.code,{children:`debate-data-sync`}),` migration `,(0,t.jsx)(n.code,{children:`0003_dartmouth_rr_college.sql`}),` moves them to
College on deploy, and the sync now files new ones there itself.`]}),`
`,(0,t.jsx)(n.h3,{id:`transcripts`,children:`Transcripts`}),`
`,(0,t.jsxs)(n.p,{children:[`The card's `,(0,t.jsx)(n.strong,{children:`Transcript`}),` column shows which videos have a typed-up transcript
(with its word count), which have only YouTube's captions cached, and which have
neither; the `,(0,t.jsx)(n.strong,{children:`Has transcript / No transcript`}),` filter narrows the list to either
side. `,(0,t.jsx)(n.strong,{children:`Transcripts`}),` on a row opens the editor, and `,(0,t.jsx)(n.strong,{children:`Import YouTube captions`}),`
there fills it with the video's captions as a first draft \u2014 split into timed
"Part" sections at each long pause, which in a round is usually the gap between
speeches. Rename each part to its speech (`,(0,t.jsx)(n.code,{children:`## 1AC \u2014 Michigan (0:00)`}),`) and save.`]}),`
`,(0,t.jsxs)(n.p,{children:[`When a video has no captions at all, `,(0,t.jsx)(n.strong,{children:`Transcribe audio`}),` downloads the video's
audio in the cloud and transcribes it with Whisper, filling the editor the same
way \u2014 marked as AI generated, with the model named. It also gives the player's
synced captions panel something to show for that video. `,(0,t.jsx)(n.strong,{children:`Download MP3`}),` saves
the audio itself, for transcribing by hand or in another tool. Both buttons stay
greyed out until the site's audio service and transcription key are set up;
hover them to see which is missing.`]}),`
`,(0,t.jsx)(n.p,{children:`To write a transcript for a video that isn't in the list \u2014 say, a round not yet
published \u2014 paste its YouTube link or id into the box at the top of the card.`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Round videos`}),` queue further down the page is separate \u2014 those are
rounds still waiting to be published, not videos already on the site.
Publishing never overwrites a video that is already in the library: the older
version is kept and the queued copy is skipped. `,(0,t.jsx)(n.strong,{children:`Deduplicate`}),`, next to
`,(0,t.jsx)(n.strong,{children:`Publish all`}),`, clears every queued round (within the selected format) that
is already in the library or repeats another queued round, without
publishing anything. Two videos count as the same when their YouTube IDs match
\u2014 even if one was stored as a full YouTube link \u2014 or when their titles match
once case and punctuation are ignored (very short titles such as "Finals"
never match on title alone). The older copy is always the one kept.`]}),`
`,(0,t.jsx)(n.h3,{id:`speech-ai--speeches-summaries-and-alternatives-in-bulk`,children:`Speech AI \u2014 speeches, summaries and alternatives in bulk`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/admin`}),` opens on the `,(0,t.jsx)(n.strong,{children:`Round queue`}),`; `,(0,t.jsx)(n.strong,{children:`Users`}),` is now the last section.
The `,(0,t.jsx)(n.strong,{children:`Speech AI`}),` section (admins only) runs the AI over many rounds at once,
so viewers don't have to press `,(0,t.jsx)(n.strong,{children:`Detect speeches`}),` themselves. Pick
`,(0,t.jsx)(n.strong,{children:`Greatest of All-Time videos`}),` (the top-pick collection) or `,(0,t.jsx)(n.strong,{children:`Every video`}),`
and press `,(0,t.jsx)(n.strong,{children:`Process`}),`. For each video it:`]}),`
`,(0,t.jsxs)(n.ol,{children:[`
`,(0,t.jsx)(n.li,{children:`fetches the YouTube captions (or uses the ones already cached);`}),`
`,(0,t.jsxs)(n.li,{children:[`has the AI find the format and where every speech starts and ends, the
same way `,(0,t.jsx)(n.strong,{children:`Detect speeches`}),` does on the watch page;`]}),`
`,(0,t.jsx)(n.li,{children:`runs the prompt in the box over the round, speech by speech. The default
prompt asks for a summary of each speech and what the speaker could have
done instead; edit it to ask for something else. The reply format is added
after your prompt automatically.`}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`The result is saved as the video's `,(0,t.jsx)(n.strong,{children:`Summary`}),` and `,(0,t.jsx)(n.strong,{children:`Analysis`}),` documents,
with one `,(0,t.jsx)(n.code,{children:`## 1AC (0:42\u20138:51)`}),` heading per speech. On the watch page those
become the speech buttons under the player, and each speech's tab in the
sidebar shows its summary and its alternative. Documents an editor wrote are
never replaced, and videos already analyzed are skipped unless `,(0,t.jsx)(n.strong,{children:`Redo videos
the AI already analyzed`}),` is ticked. To try a prompt first, paste one video's
link into the box below the prompt and press `,(0,t.jsx)(n.strong,{children:`Preview`}),`, which shows both
documents without saving them; `,(0,t.jsx)(n.strong,{children:`Process and save`}),` does that one video for
real. Every video costs two AI calls on the site's shared key, so the run goes
one video per request and `,(0,t.jsx)(n.strong,{children:`Stop after this video`}),` halts it.`]}),`
`,(0,t.jsx)(n.h3,{id:`video-durations`,children:`Video durations`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Fetch video durations`}),` looks up how long every stored video is \u2014 published
rounds and lectures plus the queue \u2014 and shows the library's total running time
in hours, split into published and queued. `,(0,t.jsx)(n.strong,{children:`Fetch missing durations`}),` only
looks up videos that don't have a length yet, so it is quick to run again after
new videos arrive; `,(0,t.jsx)(n.strong,{children:`Refetch all`}),` looks every video up again. Videos YouTube
no longer serves (deleted or private) are counted as unavailable and stay
without a duration.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`Stacks only exist where a description links the videos, so a round-analysis
video that names its round in the title alone is not paired with it. Search
is `,(0,t.jsx)(n.code,{children:`LIKE`}),`-based token matching, not fuzzy.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Curated rounds added to the queue from the `,(0,t.jsx)(n.code,{children:`video_metadata*.json`}),` records
(see `,(0,t.jsx)(n.code,{children:`.github/scripts/queue-test-videos.ts`}),`; the 506 rounds in those two files
are queued by the `,(0,t.jsx)(n.code,{children:`debate-data-sync`}),` migration `,(0,t.jsx)(n.code,{children:`0002_curated_round_queue.sql`}),`
on deploy, pending admin approval) carry their topic and argument tags in
the description, with `,(0,t.jsx)(n.code,{children:`Aff 1AC args:`}),` and `,(0,t.jsx)(n.code,{children:`Neg 2NR args:`}),` lines that become the
round's 1AC and 2NR arguments when it is published. The queue has no editor,
so a wrong split is corrected in the library after publishing, with the edit
form's `,(0,t.jsx)(n.strong,{children:`Aff arguments`}),` and `,(0,t.jsx)(n.strong,{children:`Neg arguments`}),` boxes. The records
have no upload date, so these rounds are dated January 1st of their event's
year.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Submitted videos have to be on YouTube: the library has no file hosting
behind its player, so the `,(0,t.jsx)(n.strong,{children:`+`}),` dialog takes a link rather than an upload.`]}),`
`,(0,t.jsx)(n.p,{children:`Reclassifying with AI parsing calls the model once per video, a page of 20
per request; a video whose call fails still gets its new format but keeps its
old round fields, and the result counts it as failed so it can be run again.`}),`
`,(0,t.jsxs)(n.p,{children:[`The watch page doesn't display a video's length yet, and a video only shows
one in the library after `,(0,t.jsx)(n.strong,{children:`Fetch video durations`}),` has looked it up.`]}),`
`,(0,t.jsx)(n.p,{children:`The guest video limit is a nudge, not access control: the count is per
browser, so a private window or cleared site data starts it over, and the
embeds are public YouTube videos.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};