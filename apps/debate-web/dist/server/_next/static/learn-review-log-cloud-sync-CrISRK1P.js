import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Learn Review Log Cloud Sync`},r=`# Learn Review Log Cloud Sync [#learn-review-log-cloud-sync]

Syncs CardMirror's Learn review log (\`cardId\`/\`at\`/\`grade\`/
\`intervalBefore\`/\`intervalAfter\` \u2014 the grading history \`grade()\` appends
to on every review) to a signed-in user's account, the same way
[Learn Flashcards Cloud Sync](/docs/features/research-evidence/learn-cards-cloud-sync)
syncs a card's own content and
[Learn Decks Cloud Sync](/docs/features/research-evidence/learn-decks-cloud-sync) syncs
custom decks \u2014 the Learn store
(\`packages/debate-editor/src/editor/learn-store.ts\`) was device-local
only, and before this the review log had no user-facing surface at all,
not even in the "Manage flashcards" overlay.

- **Package:** \`debate-editor\` (\`learnReviewLogSync\`, \`LearnReviewLogSync\`,
  \`learn-review-log-client\`, \`learn-review-log-ui\`), \`apps/debate-ai.com\`
  (\`/api/learn-review-log\`, \`saved_learn_review_log\` D1 table)

## What it does [#what-it-does]

On boot, once the local Learn store has loaded, \`learnReviewLogSync.init()\`
merges once against the account: any entry synced from another device but
missing locally is adopted (via \`LearnStore#adoptLogEntry\`), and any entry
that exists only on this device is best-effort pushed up \u2014 neither side
ever overwrites the other, it only fills gaps. After the merge, every
later graded review mirrors itself to the account the same way, including
an entry's removal when its card is deleted or a file's cards are pruned
via "forget this file" (both prune the local log too). Signed out, or
under the Electron desktop build, the review log keeps working exactly as
before, purely on-device.

A review-log entry has no id field of its own \u2014 \`reviewLogEntryId(entry)\`
(\`\` \`\${cardId}:\${at}\` \`\`) doubles as its synced record's key, since \`at\` is
a millisecond-precision ISO timestamp already unique per card. Unlike
[Learn Flashcards Cloud Sync](/docs/features/research-evidence/learn-cards-cloud-sync),
there's no optimistic-concurrency conflict to handle: an entry's content
for a given id never changes (\`grade()\` only ever appends a new entry,
never edits an existing one), so \`PUT /api/learn-review-log/[entryId]\` is
a plain idempotent upsert.

Adopting a remote entry is purely informational \u2014 it never replays into
\`schedules\`, which stays local-only and per-device exactly as the other
two Learn syncs already leave it. Restoring review history on a new
device is not meant to change that device's own due dates or intervals.

The "Manage flashcards" overlay's new **History** button
(\`learn-review-log-ui.ts\`'s \`openReviewLogHistory\`) lists every logged
review, newest first, with the card's current front text, the grade, and
when it happened, plus a coarse "Synced to your account" / "Not synced"
status line (not a per-entry badge \u2014 this sync has no per-record conflict
state worth surfacing).

## What's intentionally excluded [#whats-intentionally-excluded]

The remaining Learn sub-collections (schedules, anchors, AI threads,
notes, doc registry) stay local-only for the same reason
\`learn-cards-cloud-sync.mdx\` documents: they live in one shared blob per
device, not one row per record, so they don't fit this sync's per-record
shape.

## Known gaps [#known-gaps]

- An entry adopted from another device can reference a card that hasn't
  reached this device yet (the same soft-reference gap
  [Learn Decks Cloud Sync](/docs/features/research-evidence/learn-decks-cloud-sync) already
  accepts for a deck's \`cardIds\`) \u2014 the History list shows
  "(deleted card)" for it rather than the card's front text.
`,i={contents:[{heading:`learn-review-log-cloud-sync`,content:"Syncs CardMirror's Learn review log (`cardId`/`at`/`grade`/\n`intervalBefore`/`intervalAfter` \u2014 the grading history `grade()` appends\nto on every review) to a signed-in user's account, the same way\nLearn Flashcards Cloud Sync\nsyncs a card's own content and\nLearn Decks Cloud Sync syncs\ncustom decks \u2014 the Learn store\n(`packages/debate-editor/src/editor/learn-store.ts`) was device-local\nonly, and before this the review log had no user-facing surface at all,\nnot even in the \"Manage flashcards\" overlay."},{heading:`learn-review-log-cloud-sync`,content:"**Package:** `debate-editor` (`learnReviewLogSync`, `LearnReviewLogSync`,\n`learn-review-log-client`, `learn-review-log-ui`), `apps/debate-ai.com`\n(`/api/learn-review-log`, `saved_learn_review_log` D1 table)"},{heading:`what-it-does`,content:`On boot, once the local Learn store has loaded, \`learnReviewLogSync.init()\`
merges once against the account: any entry synced from another device but
missing locally is adopted (via \`LearnStore#adoptLogEntry\`), and any entry
that exists only on this device is best-effort pushed up \u2014 neither side
ever overwrites the other, it only fills gaps. After the merge, every
later graded review mirrors itself to the account the same way, including
an entry's removal when its card is deleted or a file's cards are pruned
via "forget this file" (both prune the local log too). Signed out, or
under the Electron desktop build, the review log keeps working exactly as
before, purely on-device.`},{heading:`what-it-does`,content:"A review-log entry has no id field of its own \u2014 `reviewLogEntryId(entry)`\n(`` `${cardId}:${at}` ``) doubles as its synced record's key, since `at` is\na millisecond-precision ISO timestamp already unique per card. Unlike\nLearn Flashcards Cloud Sync,\nthere's no optimistic-concurrency conflict to handle: an entry's content\nfor a given id never changes (`grade()` only ever appends a new entry,\nnever edits an existing one), so `PUT /api/learn-review-log/[entryId]` is\na plain idempotent upsert."},{heading:`what-it-does`,content:`Adopting a remote entry is purely informational \u2014 it never replays into
\`schedules\`, which stays local-only and per-device exactly as the other
two Learn syncs already leave it. Restoring review history on a new
device is not meant to change that device's own due dates or intervals.`},{heading:`what-it-does`,content:`The "Manage flashcards" overlay's new **History** button
(\`learn-review-log-ui.ts\`'s \`openReviewLogHistory\`) lists every logged
review, newest first, with the card's current front text, the grade, and
when it happened, plus a coarse "Synced to your account" / "Not synced"
status line (not a per-entry badge \u2014 this sync has no per-record conflict
state worth surfacing).`},{heading:`whats-intentionally-excluded`,content:`The remaining Learn sub-collections (schedules, anchors, AI threads,
notes, doc registry) stay local-only for the same reason
\`learn-cards-cloud-sync.mdx\` documents: they live in one shared blob per
device, not one row per record, so they don't fit this sync's per-record
shape.`},{heading:`known-gaps`,content:`An entry adopted from another device can reference a card that hasn't
reached this device yet (the same soft-reference gap
Learn Decks Cloud Sync already
accepts for a deck's \`cardIds\`) \u2014 the History list shows
"(deleted card)" for it rather than the card's front text.`}],headings:[{id:`learn-review-log-cloud-sync`,content:`Learn Review Log Cloud Sync`},{id:`what-it-does`,content:`What it does`},{id:`whats-intentionally-excluded`,content:`What's intentionally excluded`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#learn-review-log-cloud-sync`,title:(0,t.jsx)(t.Fragment,{children:`Learn Review Log Cloud Sync`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#whats-intentionally-excluded`,title:(0,t.jsx)(t.Fragment,{children:`What's intentionally excluded`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`learn-review-log-cloud-sync`,children:`Learn Review Log Cloud Sync`}),`
`,(0,t.jsxs)(n.p,{children:[`Syncs CardMirror's Learn review log (`,(0,t.jsx)(n.code,{children:`cardId`}),`/`,(0,t.jsx)(n.code,{children:`at`}),`/`,(0,t.jsx)(n.code,{children:`grade`}),`/
`,(0,t.jsx)(n.code,{children:`intervalBefore`}),`/`,(0,t.jsx)(n.code,{children:`intervalAfter`}),` \u2014 the grading history `,(0,t.jsx)(n.code,{children:`grade()`}),` appends
to on every review) to a signed-in user's account, the same way
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-cards-cloud-sync`,children:`Learn Flashcards Cloud Sync`}),`
syncs a card's own content and
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-decks-cloud-sync`,children:`Learn Decks Cloud Sync`}),` syncs
custom decks \u2014 the Learn store
(`,(0,t.jsx)(n.code,{children:`packages/debate-editor/src/editor/learn-store.ts`}),`) was device-local
only, and before this the review log had no user-facing surface at all,
not even in the "Manage flashcards" overlay.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`}),` (`,(0,t.jsx)(n.code,{children:`learnReviewLogSync`}),`, `,(0,t.jsx)(n.code,{children:`LearnReviewLogSync`}),`,
`,(0,t.jsx)(n.code,{children:`learn-review-log-client`}),`, `,(0,t.jsx)(n.code,{children:`learn-review-log-ui`}),`), `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),`
(`,(0,t.jsx)(n.code,{children:`/api/learn-review-log`}),`, `,(0,t.jsx)(n.code,{children:`saved_learn_review_log`}),` D1 table)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.p,{children:[`On boot, once the local Learn store has loaded, `,(0,t.jsx)(n.code,{children:`learnReviewLogSync.init()`}),`
merges once against the account: any entry synced from another device but
missing locally is adopted (via `,(0,t.jsx)(n.code,{children:`LearnStore#adoptLogEntry`}),`), and any entry
that exists only on this device is best-effort pushed up \u2014 neither side
ever overwrites the other, it only fills gaps. After the merge, every
later graded review mirrors itself to the account the same way, including
an entry's removal when its card is deleted or a file's cards are pruned
via "forget this file" (both prune the local log too). Signed out, or
under the Electron desktop build, the review log keeps working exactly as
before, purely on-device.`]}),`
`,(0,t.jsxs)(n.p,{children:[`A review-log entry has no id field of its own \u2014 `,(0,t.jsx)(n.code,{children:`reviewLogEntryId(entry)`}),`
(`,(0,t.jsx)(n.code,{children:"`${cardId}:${at}`"}),`) doubles as its synced record's key, since `,(0,t.jsx)(n.code,{children:`at`}),` is
a millisecond-precision ISO timestamp already unique per card. Unlike
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-cards-cloud-sync`,children:`Learn Flashcards Cloud Sync`}),`,
there's no optimistic-concurrency conflict to handle: an entry's content
for a given id never changes (`,(0,t.jsx)(n.code,{children:`grade()`}),` only ever appends a new entry,
never edits an existing one), so `,(0,t.jsx)(n.code,{children:`PUT /api/learn-review-log/[entryId]`}),` is
a plain idempotent upsert.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Adopting a remote entry is purely informational \u2014 it never replays into
`,(0,t.jsx)(n.code,{children:`schedules`}),`, which stays local-only and per-device exactly as the other
two Learn syncs already leave it. Restoring review history on a new
device is not meant to change that device's own due dates or intervals.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The "Manage flashcards" overlay's new `,(0,t.jsx)(n.strong,{children:`History`}),` button
(`,(0,t.jsx)(n.code,{children:`learn-review-log-ui.ts`}),`'s `,(0,t.jsx)(n.code,{children:`openReviewLogHistory`}),`) lists every logged
review, newest first, with the card's current front text, the grade, and
when it happened, plus a coarse "Synced to your account" / "Not synced"
status line (not a per-entry badge \u2014 this sync has no per-record conflict
state worth surfacing).`]}),`
`,(0,t.jsx)(n.h2,{id:`whats-intentionally-excluded`,children:`What's intentionally excluded`}),`
`,(0,t.jsxs)(n.p,{children:[`The remaining Learn sub-collections (schedules, anchors, AI threads,
notes, doc registry) stay local-only for the same reason
`,(0,t.jsx)(n.code,{children:`learn-cards-cloud-sync.mdx`}),` documents: they live in one shared blob per
device, not one row per record, so they don't fit this sync's per-record
shape.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`An entry adopted from another device can reference a card that hasn't
reached this device yet (the same soft-reference gap
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-decks-cloud-sync`,children:`Learn Decks Cloud Sync`}),` already
accepts for a deck's `,(0,t.jsx)(n.code,{children:`cardIds`}),`) \u2014 the History list shows
"(deleted card)" for it rather than the card's front text.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};