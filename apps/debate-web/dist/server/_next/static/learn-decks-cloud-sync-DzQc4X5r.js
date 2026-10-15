import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Learn Decks Cloud Sync`},r="# Learn Decks Cloud Sync [#learn-decks-cloud-sync]\n\nSyncs CardMirror's Learn custom decks (`deckId`/`name`/`cardIds`/\n`createdAt`) to a signed-in user's account, the same way\n[Learn Flashcards Cloud Sync](/docs/features/research-evidence/learn-cards-cloud-sync)\nsyncs a card's own content \u2014 the Learn store\n(`packages/debate-editor/src/editor/learn-store.ts`) was device-local\nonly.\n\n- **Package:** `debate-editor` (`learnDecksSync`, `LearnDecksSync`,\n  `learn-decks-client`, `learn-deck-manage-ui`), `apps/debate-ai.com`\n  (`/api/learn-decks`, `saved_learn_decks` D1 table)\n\n## What it does [#what-it-does]\n\nOn boot, once the local Learn store has loaded, `learnDecksSync.init()`\nmerges once against the account: any deck synced from another device but\nmissing locally is adopted under its own id, and any deck that exists\nonly on this device is best-effort pushed up \u2014 neither side ever\noverwrites the other, it only fills gaps. After the merge, every later\ndeck create or delete mirrors itself to the account the same way; a rename\nor membership change instead sends one op\n(`addCardId`/`removeCardId`/`rename`, `PATCH /api/learn-decks/[deckId]`)\nper actual change, resolved against the account's current stored deck\nrather than a whole-deck replace \u2014 see **Known gaps**. Signed out, or\nunder the Electron desktop build, decks keep working exactly as before,\npurely on-device.\n\nA deck's `cardIds` reference cards synced separately by\n[Learn Flashcards Cloud Sync](/docs/features/research-evidence/learn-cards-cloud-sync); a\ndeck can legitimately reference a card that hasn't reached this device\nyet, the same soft-reference gap that sync already accepts for card\ncontent.\n\n## What's intentionally excluded [#whats-intentionally-excluded]\n\nThe other Learn sub-collections (schedules, anchors, AI threads, notes,\ndoc registry) stay local-only for the same reason\n`learn-cards-cloud-sync.mdx` documents: they live in one shared blob per\ndevice, not one row per record, so they don't fit this sync's per-record\nshape. The **review log** syncs separately \u2014 see\n[Learn Review Log Cloud Sync](/docs/features/research-evidence/learn-review-log-cloud-sync).\n\n## Known gaps [#known-gaps]\n\n- ~~No optimistic-concurrency handling \u2014 editing the same deck (renaming\n  it, or changing its members) from two signed-in devices at once has the\n  last write win.~~ **Fixed:** `LearnDecksSync#pushDeckChange`\n  (`learn-decks-sync.ts`) now diffs the previous vs. current deck and sends\n  one op per actual change \u2014 `addCardId`/`removeCardId` per card,\n  `rename` for a name change \u2014 instead of the whole `{name, cardIds}`\n  snapshot it used to push. `PATCH /api/learn-decks/[deckId]` resolves\n  each op against the row's *current* stored deck (read-then-write) via\n  `applyLearnDeckOp` (`debate-editor`'s `learn-deck-op.ts`), the same\n  shape `/api/settings`'s `favoriteTools`/`wordLimitPresets`/\n  `outlineFilterPresets`/`savedArgumentCollections` ops already use \u2014 so\n  two devices adding, removing, or renaming at once can no longer drop\n  each other's change. A brand-new deck still pushes in full (there is no\n  row to race against yet); if an op 404s \u2014 this deck's own create push\n  hasn't landed yet \u2014 `pushDeckChange` falls back to a full `PUT`, which\n  also covers every pending change in one call. `PUT` itself is unchanged\n  and still accepted for a caller that genuinely needs a whole-deck\n  replace, but nothing in this app sends one for a rename or membership\n  change anymore.\n- ~~No dedicated deck-management UI shows a per-deck sync status yet; decks\n  are currently created/edited from the home screen's scope picker, which\n  has no sync indicator.~~ **Fixed, and the old description was stale on\n  top of being incomplete:** the \"home screen's scope picker\" it referred\n  to (`home-screen.ts`'s per-scope \"due today\" rows) can only ever *display*\n  an existing deck \u2014 it never called `createDeck`/`renameDeck`/`deleteDeck`/\n  `setDeckMembership` \u2014 and that screen has been a permanent no-op since\n  2026-08-26 regardless (see its own `show()` doc comment), so it was never\n  a reachable path either way. Before this fix, a deck could only come to\n  exist on a device via account sync adopting one created *somewhere*, but\n  no device anywhere could create the first one \u2014 decks were fully\n  unreachable from the UI.\n  `learn-deck-manage-ui.ts`'s **Decks** button (next to **History** in the\n  \"Manage flashcards\" overlay's bar) opens create/rename/two-click-delete\n  for decks, and an expandable per-deck card picker (add from a dropdown of\n  cards not yet in the deck, remove with a per-card button) \u2014 the first UI\n  surface for any of `LearnStore`'s deck mutators. It shows the same coarse\n  \"Synced to your account\" / \"Not synced \u2014 sign in to sync\" line (via\n  `learnDecksSync.isSynced()`) the flashcard list and Review history already\n  do. ~~`LearnDecksSync` tracks no *per-deck* status (its pushes/deletes are\n  fire-and-forget), so a per-deck badge would need that state added to the\n  sync class first \u2014 a real follow-up, not done here.~~ **Fixed:**\n  `LearnDecksSync` now keeps a `landed` map of each deck's last *confirmed*\n  value \u2014 advanced only once a create/op/fallback push actually resolves,\n  distinct from the `baseline` map used purely to diff the next change \u2014 and\n  exposes it as `getDeckSyncStatus(deckId)` (`\"synced\"` / `\"pending\"` /\n  `\"unknown\"`, mirroring `debate-data-sync`'s `getToolRecordSyncStatus`\n  shape) plus an `onStatusChange` subscription so a caller can re-render once\n  a fire-and-forget push settles, since that alone doesn't mutate the store.\n  `learn-deck-manage-ui.ts` shows each deck's status as a small \"Synced\" /\n  \"Not yet synced\" badge next to its name \u2014 the same chip language\n  `user-dictionary-ui.ts` uses for `getToolRecordSyncStatus` \u2014 omitted\n  entirely while the coarse status is `\"unknown\"`.\n",i={contents:[{heading:`learn-decks-cloud-sync`,content:"Syncs CardMirror's Learn custom decks (`deckId`/`name`/`cardIds`/\n`createdAt`) to a signed-in user's account, the same way\nLearn Flashcards Cloud Sync\nsyncs a card's own content \u2014 the Learn store\n(`packages/debate-editor/src/editor/learn-store.ts`) was device-local\nonly."},{heading:`learn-decks-cloud-sync`,content:"**Package:** `debate-editor` (`learnDecksSync`, `LearnDecksSync`,\n`learn-decks-client`, `learn-deck-manage-ui`), `apps/debate-ai.com`\n(`/api/learn-decks`, `saved_learn_decks` D1 table)"},{heading:`what-it-does`,content:`On boot, once the local Learn store has loaded, \`learnDecksSync.init()\`
merges once against the account: any deck synced from another device but
missing locally is adopted under its own id, and any deck that exists
only on this device is best-effort pushed up \u2014 neither side ever
overwrites the other, it only fills gaps. After the merge, every later
deck create or delete mirrors itself to the account the same way; a rename
or membership change instead sends one op
(\`addCardId\`/\`removeCardId\`/\`rename\`, \`PATCH /api/learn-decks/[deckId]\`)
per actual change, resolved against the account's current stored deck
rather than a whole-deck replace \u2014 see **Known gaps**. Signed out, or
under the Electron desktop build, decks keep working exactly as before,
purely on-device.`},{heading:`what-it-does`,content:`A deck's \`cardIds\` reference cards synced separately by
Learn Flashcards Cloud Sync; a
deck can legitimately reference a card that hasn't reached this device
yet, the same soft-reference gap that sync already accepts for card
content.`},{heading:`whats-intentionally-excluded`,content:`The other Learn sub-collections (schedules, anchors, AI threads, notes,
doc registry) stay local-only for the same reason
\`learn-cards-cloud-sync.mdx\` documents: they live in one shared blob per
device, not one row per record, so they don't fit this sync's per-record
shape. The **review log** syncs separately \u2014 see
Learn Review Log Cloud Sync.`},{heading:`known-gaps`,content:"~~No optimistic-concurrency handling \u2014 editing the same deck (renaming\nit, or changing its members) from two signed-in devices at once has the\nlast write win.~~ **Fixed:** `LearnDecksSync#pushDeckChange`\n(`learn-decks-sync.ts`) now diffs the previous vs. current deck and sends\none op per actual change \u2014 `addCardId`/`removeCardId` per card,\n`rename` for a name change \u2014 instead of the whole `{name, cardIds}`\nsnapshot it used to push. `PATCH /api/learn-decks/[deckId]` resolves\neach op against the row's *current* stored deck (read-then-write) via\n`applyLearnDeckOp` (`debate-editor`'s `learn-deck-op.ts`), the same\nshape `/api/settings`'s `favoriteTools`/`wordLimitPresets`/\n`outlineFilterPresets`/`savedArgumentCollections` ops already use \u2014 so\ntwo devices adding, removing, or renaming at once can no longer drop\neach other's change. A brand-new deck still pushes in full (there is no\nrow to race against yet); if an op 404s \u2014 this deck's own create push\nhasn't landed yet \u2014 `pushDeckChange` falls back to a full `PUT`, which\nalso covers every pending change in one call. `PUT` itself is unchanged\nand still accepted for a caller that genuinely needs a whole-deck\nreplace, but nothing in this app sends one for a rename or membership\nchange anymore."},{heading:`known-gaps`,content:'~~No dedicated deck-management UI shows a per-deck sync status yet; decks\nare currently created/edited from the home screen\'s scope picker, which\nhas no sync indicator.~~ **Fixed, and the old description was stale on\ntop of being incomplete:** the "home screen\'s scope picker" it referred\nto (`home-screen.ts`\'s per-scope "due today" rows) can only ever *display*\nan existing deck \u2014 it never called `createDeck`/`renameDeck`/`deleteDeck`/\n`setDeckMembership` \u2014 and that screen has been a permanent no-op since\n2026-08-26 regardless (see its own `show()` doc comment), so it was never\na reachable path either way. Before this fix, a deck could only come to\nexist on a device via account sync adopting one created *somewhere*, but\nno device anywhere could create the first one \u2014 decks were fully\nunreachable from the UI.\n`learn-deck-manage-ui.ts`\'s **Decks** button (next to **History** in the\n"Manage flashcards" overlay\'s bar) opens create/rename/two-click-delete\nfor decks, and an expandable per-deck card picker (add from a dropdown of\ncards not yet in the deck, remove with a per-card button) \u2014 the first UI\nsurface for any of `LearnStore`\'s deck mutators. It shows the same coarse\n"Synced to your account" / "Not synced \u2014 sign in to sync" line (via\n`learnDecksSync.isSynced()`) the flashcard list and Review history already\ndo. ~~`LearnDecksSync` tracks no *per-deck* status (its pushes/deletes are\nfire-and-forget), so a per-deck badge would need that state added to the\nsync class first \u2014 a real follow-up, not done here.~~ **Fixed:**\n`LearnDecksSync` now keeps a `landed` map of each deck\'s last *confirmed*\nvalue \u2014 advanced only once a create/op/fallback push actually resolves,\ndistinct from the `baseline` map used purely to diff the next change \u2014 and\nexposes it as `getDeckSyncStatus(deckId)` (`"synced"` / `"pending"` /\n`"unknown"`, mirroring `debate-data-sync`\'s `getToolRecordSyncStatus`\nshape) plus an `onStatusChange` subscription so a caller can re-render once\na fire-and-forget push settles, since that alone doesn\'t mutate the store.\n`learn-deck-manage-ui.ts` shows each deck\'s status as a small "Synced" /\n"Not yet synced" badge next to its name \u2014 the same chip language\n`user-dictionary-ui.ts` uses for `getToolRecordSyncStatus` \u2014 omitted\nentirely while the coarse status is `"unknown"`.'}],headings:[{id:`learn-decks-cloud-sync`,content:`Learn Decks Cloud Sync`},{id:`what-it-does`,content:`What it does`},{id:`whats-intentionally-excluded`,content:`What's intentionally excluded`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#learn-decks-cloud-sync`,title:(0,t.jsx)(t.Fragment,{children:`Learn Decks Cloud Sync`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#whats-intentionally-excluded`,title:(0,t.jsx)(t.Fragment,{children:`What's intentionally excluded`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,del:`del`,em:`em`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`learn-decks-cloud-sync`,children:`Learn Decks Cloud Sync`}),`
`,(0,t.jsxs)(n.p,{children:[`Syncs CardMirror's Learn custom decks (`,(0,t.jsx)(n.code,{children:`deckId`}),`/`,(0,t.jsx)(n.code,{children:`name`}),`/`,(0,t.jsx)(n.code,{children:`cardIds`}),`/
`,(0,t.jsx)(n.code,{children:`createdAt`}),`) to a signed-in user's account, the same way
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-cards-cloud-sync`,children:`Learn Flashcards Cloud Sync`}),`
syncs a card's own content \u2014 the Learn store
(`,(0,t.jsx)(n.code,{children:`packages/debate-editor/src/editor/learn-store.ts`}),`) was device-local
only.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`}),` (`,(0,t.jsx)(n.code,{children:`learnDecksSync`}),`, `,(0,t.jsx)(n.code,{children:`LearnDecksSync`}),`,
`,(0,t.jsx)(n.code,{children:`learn-decks-client`}),`, `,(0,t.jsx)(n.code,{children:`learn-deck-manage-ui`}),`), `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),`
(`,(0,t.jsx)(n.code,{children:`/api/learn-decks`}),`, `,(0,t.jsx)(n.code,{children:`saved_learn_decks`}),` D1 table)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.p,{children:[`On boot, once the local Learn store has loaded, `,(0,t.jsx)(n.code,{children:`learnDecksSync.init()`}),`
merges once against the account: any deck synced from another device but
missing locally is adopted under its own id, and any deck that exists
only on this device is best-effort pushed up \u2014 neither side ever
overwrites the other, it only fills gaps. After the merge, every later
deck create or delete mirrors itself to the account the same way; a rename
or membership change instead sends one op
(`,(0,t.jsx)(n.code,{children:`addCardId`}),`/`,(0,t.jsx)(n.code,{children:`removeCardId`}),`/`,(0,t.jsx)(n.code,{children:`rename`}),`, `,(0,t.jsx)(n.code,{children:`PATCH /api/learn-decks/[deckId]`}),`)
per actual change, resolved against the account's current stored deck
rather than a whole-deck replace \u2014 see `,(0,t.jsx)(n.strong,{children:`Known gaps`}),`. Signed out, or
under the Electron desktop build, decks keep working exactly as before,
purely on-device.`]}),`
`,(0,t.jsxs)(n.p,{children:[`A deck's `,(0,t.jsx)(n.code,{children:`cardIds`}),` reference cards synced separately by
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-cards-cloud-sync`,children:`Learn Flashcards Cloud Sync`}),`; a
deck can legitimately reference a card that hasn't reached this device
yet, the same soft-reference gap that sync already accepts for card
content.`]}),`
`,(0,t.jsx)(n.h2,{id:`whats-intentionally-excluded`,children:`What's intentionally excluded`}),`
`,(0,t.jsxs)(n.p,{children:[`The other Learn sub-collections (schedules, anchors, AI threads, notes,
doc registry) stay local-only for the same reason
`,(0,t.jsx)(n.code,{children:`learn-cards-cloud-sync.mdx`}),` documents: they live in one shared blob per
device, not one row per record, so they don't fit this sync's per-record
shape. The `,(0,t.jsx)(n.strong,{children:`review log`}),` syncs separately \u2014 see
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-review-log-cloud-sync`,children:`Learn Review Log Cloud Sync`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.del,{children:`No optimistic-concurrency handling \u2014 editing the same deck (renaming
it, or changing its members) from two signed-in devices at once has the
last write win.`}),` `,(0,t.jsx)(n.strong,{children:`Fixed:`}),` `,(0,t.jsx)(n.code,{children:`LearnDecksSync#pushDeckChange`}),`
(`,(0,t.jsx)(n.code,{children:`learn-decks-sync.ts`}),`) now diffs the previous vs. current deck and sends
one op per actual change \u2014 `,(0,t.jsx)(n.code,{children:`addCardId`}),`/`,(0,t.jsx)(n.code,{children:`removeCardId`}),` per card,
`,(0,t.jsx)(n.code,{children:`rename`}),` for a name change \u2014 instead of the whole `,(0,t.jsx)(n.code,{children:`{name, cardIds}`}),`
snapshot it used to push. `,(0,t.jsx)(n.code,{children:`PATCH /api/learn-decks/[deckId]`}),` resolves
each op against the row's `,(0,t.jsx)(n.em,{children:`current`}),` stored deck (read-then-write) via
`,(0,t.jsx)(n.code,{children:`applyLearnDeckOp`}),` (`,(0,t.jsx)(n.code,{children:`debate-editor`}),`'s `,(0,t.jsx)(n.code,{children:`learn-deck-op.ts`}),`), the same
shape `,(0,t.jsx)(n.code,{children:`/api/settings`}),`'s `,(0,t.jsx)(n.code,{children:`favoriteTools`}),`/`,(0,t.jsx)(n.code,{children:`wordLimitPresets`}),`/
`,(0,t.jsx)(n.code,{children:`outlineFilterPresets`}),`/`,(0,t.jsx)(n.code,{children:`savedArgumentCollections`}),` ops already use \u2014 so
two devices adding, removing, or renaming at once can no longer drop
each other's change. A brand-new deck still pushes in full (there is no
row to race against yet); if an op 404s \u2014 this deck's own create push
hasn't landed yet \u2014 `,(0,t.jsx)(n.code,{children:`pushDeckChange`}),` falls back to a full `,(0,t.jsx)(n.code,{children:`PUT`}),`, which
also covers every pending change in one call. `,(0,t.jsx)(n.code,{children:`PUT`}),` itself is unchanged
and still accepted for a caller that genuinely needs a whole-deck
replace, but nothing in this app sends one for a rename or membership
change anymore.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.del,{children:`No dedicated deck-management UI shows a per-deck sync status yet; decks
are currently created/edited from the home screen's scope picker, which
has no sync indicator.`}),` `,(0,t.jsx)(n.strong,{children:`Fixed, and the old description was stale on
top of being incomplete:`}),` the "home screen's scope picker" it referred
to (`,(0,t.jsx)(n.code,{children:`home-screen.ts`}),`'s per-scope "due today" rows) can only ever `,(0,t.jsx)(n.em,{children:`display`}),`
an existing deck \u2014 it never called `,(0,t.jsx)(n.code,{children:`createDeck`}),`/`,(0,t.jsx)(n.code,{children:`renameDeck`}),`/`,(0,t.jsx)(n.code,{children:`deleteDeck`}),`/
`,(0,t.jsx)(n.code,{children:`setDeckMembership`}),` \u2014 and that screen has been a permanent no-op since
2026-08-26 regardless (see its own `,(0,t.jsx)(n.code,{children:`show()`}),` doc comment), so it was never
a reachable path either way. Before this fix, a deck could only come to
exist on a device via account sync adopting one created `,(0,t.jsx)(n.em,{children:`somewhere`}),`, but
no device anywhere could create the first one \u2014 decks were fully
unreachable from the UI.
`,(0,t.jsx)(n.code,{children:`learn-deck-manage-ui.ts`}),`'s `,(0,t.jsx)(n.strong,{children:`Decks`}),` button (next to `,(0,t.jsx)(n.strong,{children:`History`}),` in the
"Manage flashcards" overlay's bar) opens create/rename/two-click-delete
for decks, and an expandable per-deck card picker (add from a dropdown of
cards not yet in the deck, remove with a per-card button) \u2014 the first UI
surface for any of `,(0,t.jsx)(n.code,{children:`LearnStore`}),`'s deck mutators. It shows the same coarse
"Synced to your account" / "Not synced \u2014 sign in to sync" line (via
`,(0,t.jsx)(n.code,{children:`learnDecksSync.isSynced()`}),`) the flashcard list and Review history already
do. `,(0,t.jsxs)(n.del,{children:[(0,t.jsx)(n.code,{children:`LearnDecksSync`}),` tracks no `,(0,t.jsx)(n.em,{children:`per-deck`}),` status (its pushes/deletes are
fire-and-forget), so a per-deck badge would need that state added to the
sync class first \u2014 a real follow-up, not done here.`]}),` `,(0,t.jsx)(n.strong,{children:`Fixed:`}),`
`,(0,t.jsx)(n.code,{children:`LearnDecksSync`}),` now keeps a `,(0,t.jsx)(n.code,{children:`landed`}),` map of each deck's last `,(0,t.jsx)(n.em,{children:`confirmed`}),`
value \u2014 advanced only once a create/op/fallback push actually resolves,
distinct from the `,(0,t.jsx)(n.code,{children:`baseline`}),` map used purely to diff the next change \u2014 and
exposes it as `,(0,t.jsx)(n.code,{children:`getDeckSyncStatus(deckId)`}),` (`,(0,t.jsx)(n.code,{children:`"synced"`}),` / `,(0,t.jsx)(n.code,{children:`"pending"`}),` /
`,(0,t.jsx)(n.code,{children:`"unknown"`}),`, mirroring `,(0,t.jsx)(n.code,{children:`debate-data-sync`}),`'s `,(0,t.jsx)(n.code,{children:`getToolRecordSyncStatus`}),`
shape) plus an `,(0,t.jsx)(n.code,{children:`onStatusChange`}),` subscription so a caller can re-render once
a fire-and-forget push settles, since that alone doesn't mutate the store.
`,(0,t.jsx)(n.code,{children:`learn-deck-manage-ui.ts`}),` shows each deck's status as a small "Synced" /
"Not yet synced" badge next to its name \u2014 the same chip language
`,(0,t.jsx)(n.code,{children:`user-dictionary-ui.ts`}),` uses for `,(0,t.jsx)(n.code,{children:`getToolRecordSyncStatus`}),` \u2014 omitted
entirely while the coarse status is `,(0,t.jsx)(n.code,{children:`"unknown"`}),`.`]}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};