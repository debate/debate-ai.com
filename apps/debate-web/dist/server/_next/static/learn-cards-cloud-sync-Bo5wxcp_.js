import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Learn Flashcards Cloud Sync`},r=`# Learn Flashcards Cloud Sync [#learn-flashcards-cloud-sync]

Syncs the CONTENT (\`id\`/\`type\`/\`front\`/\`back\`) of CardMirror's Learn
spaced-repetition flashcards to a signed-in user's account, closing the
same account-linking gap [Quick Cards Cloud Save](/docs/features/ui-navigation/quick-cards-cloud-save)
closed for the reusable-snippet library \u2014 the Learn store
(\`packages/debate-editor/src/editor/learn-store.ts\`) was device-local
only.

- **Package:** \`debate-editor\` (\`learnCardsSync\`, \`LearnCardsSync\`,
  \`learn-cards-client\`), \`apps/debate-ai.com\` (\`/api/learn-cards\`,
  \`saved_learn_cards\` D1 table)

## What it does [#what-it-does]

On boot, once the local Learn store has loaded, \`learnCardsSync.init()\`
merges once against the account: any card synced from another device but
missing locally is adopted under its own id (never duplicated), and any
card that exists only on this device is best-effort pushed up \u2014 neither
side ever overwrites the other, it only fills gaps. After the merge,
every later card create, edit, or delete (including a file's cards being
pruned via "forget this file") mirrors itself to the account the same
way. Signed out, or under the Electron desktop build, the Learn store
keeps working exactly as before, purely on-device.

## What's intentionally excluded [#whats-intentionally-excluded]

Only a card's portable content syncs \u2014 its review **schedule** (due date,
interval, lapses), file **anchors**, AI **threads**, and private **notes**
all stay local-only. A card adopted on a new device starts with no
schedule pressure, the same way the manage GUI's own JSON export/import
already treats a card whose carried schedule is absent \u2014 restoring a card
is not meant to restore a specific device's review history. **Custom
decks** and the **review log** each sync separately \u2014 see
[Learn Decks Cloud Sync](/docs/features/research-evidence/learn-decks-cloud-sync) and
[Learn Review Log Cloud Sync](/docs/features/research-evidence/learn-review-log-cloud-sync).
The remaining sub-collections (anchors, AI threads, notes, doc registry)
live in one shared blob per device (not one row per record), so they
don't fit this sync's per-record shape; syncing them would need a bespoke
schema of their own.

Every per-record push carries optimistic concurrency: \`PUT
/api/learn-cards/[cardId]\` compares the incoming card's own \`updatedAt\`
against whatever's already saved for that id, and rejects (409) instead of
overwriting when the saved version is newer \u2014 an edit made on another
device that hasn't reached this browser yet. On that rejection, this
browser adopts the newer version into its own \`LearnStore\` instead of
losing it, the same "never overwrite, only reconcile" rule \`init()\`'s merge
already follows \u2014 mirroring
[Quick Cards Cloud Save](/docs/features/ui-navigation/quick-cards-cloud-save)'s own fix
for the identical race. \`CardDef\` didn't carry an \`updatedAt\` field before
this: it's now stamped by \`upsertCard\`/\`importCards\` themselves (not by
callers), and stays optional on the type so a card written before this
field existed \u2014 locally, or already synced to the account \u2014 still
round-trips; a side with no \`updatedAt\` is treated as arbitrarily old
rather than blocking the sync, which is exactly the previous
last-write-wins behavior until both sides have a real timestamp.

## Known gaps [#known-gaps]

None open.
`,i={contents:[{heading:`learn-flashcards-cloud-sync`,content:"Syncs the CONTENT (`id`/`type`/`front`/`back`) of CardMirror's Learn\nspaced-repetition flashcards to a signed-in user's account, closing the\nsame account-linking gap Quick Cards Cloud Save\nclosed for the reusable-snippet library \u2014 the Learn store\n(`packages/debate-editor/src/editor/learn-store.ts`) was device-local\nonly."},{heading:`learn-flashcards-cloud-sync`,content:"**Package:** `debate-editor` (`learnCardsSync`, `LearnCardsSync`,\n`learn-cards-client`), `apps/debate-ai.com` (`/api/learn-cards`,\n`saved_learn_cards` D1 table)"},{heading:`what-it-does`,content:`On boot, once the local Learn store has loaded, \`learnCardsSync.init()\`
merges once against the account: any card synced from another device but
missing locally is adopted under its own id (never duplicated), and any
card that exists only on this device is best-effort pushed up \u2014 neither
side ever overwrites the other, it only fills gaps. After the merge,
every later card create, edit, or delete (including a file's cards being
pruned via "forget this file") mirrors itself to the account the same
way. Signed out, or under the Electron desktop build, the Learn store
keeps working exactly as before, purely on-device.`},{heading:`whats-intentionally-excluded`,content:`Only a card's portable content syncs \u2014 its review **schedule** (due date,
interval, lapses), file **anchors**, AI **threads**, and private **notes**
all stay local-only. A card adopted on a new device starts with no
schedule pressure, the same way the manage GUI's own JSON export/import
already treats a card whose carried schedule is absent \u2014 restoring a card
is not meant to restore a specific device's review history. **Custom
decks** and the **review log** each sync separately \u2014 see
Learn Decks Cloud Sync and
Learn Review Log Cloud Sync.
The remaining sub-collections (anchors, AI threads, notes, doc registry)
live in one shared blob per device (not one row per record), so they
don't fit this sync's per-record shape; syncing them would need a bespoke
schema of their own.`},{heading:`whats-intentionally-excluded`,content:"Every per-record push carries optimistic concurrency: `PUT\n/api/learn-cards/[cardId]` compares the incoming card's own `updatedAt`\nagainst whatever's already saved for that id, and rejects (409) instead of\noverwriting when the saved version is newer \u2014 an edit made on another\ndevice that hasn't reached this browser yet. On that rejection, this\nbrowser adopts the newer version into its own `LearnStore` instead of\nlosing it, the same \"never overwrite, only reconcile\" rule `init()`'s merge\nalready follows \u2014 mirroring\nQuick Cards Cloud Save's own fix\nfor the identical race. `CardDef` didn't carry an `updatedAt` field before\nthis: it's now stamped by `upsertCard`/`importCards` themselves (not by\ncallers), and stays optional on the type so a card written before this\nfield existed \u2014 locally, or already synced to the account \u2014 still\nround-trips; a side with no `updatedAt` is treated as arbitrarily old\nrather than blocking the sync, which is exactly the previous\nlast-write-wins behavior until both sides have a real timestamp."},{heading:`known-gaps`,content:`None open.`}],headings:[{id:`learn-flashcards-cloud-sync`,content:`Learn Flashcards Cloud Sync`},{id:`what-it-does`,content:`What it does`},{id:`whats-intentionally-excluded`,content:`What's intentionally excluded`},{id:`known-gaps`,content:`Known gaps`}]},a=[{depth:1,url:`#learn-flashcards-cloud-sync`,title:(0,t.jsx)(t.Fragment,{children:`Learn Flashcards Cloud Sync`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#whats-intentionally-excluded`,title:(0,t.jsx)(t.Fragment,{children:`What's intentionally excluded`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`learn-flashcards-cloud-sync`,children:`Learn Flashcards Cloud Sync`}),`
`,(0,t.jsxs)(n.p,{children:[`Syncs the CONTENT (`,(0,t.jsx)(n.code,{children:`id`}),`/`,(0,t.jsx)(n.code,{children:`type`}),`/`,(0,t.jsx)(n.code,{children:`front`}),`/`,(0,t.jsx)(n.code,{children:`back`}),`) of CardMirror's Learn
spaced-repetition flashcards to a signed-in user's account, closing the
same account-linking gap `,(0,t.jsx)(n.a,{href:`/docs/features/ui-navigation/quick-cards-cloud-save`,children:`Quick Cards Cloud Save`}),`
closed for the reusable-snippet library \u2014 the Learn store
(`,(0,t.jsx)(n.code,{children:`packages/debate-editor/src/editor/learn-store.ts`}),`) was device-local
only.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`}),` (`,(0,t.jsx)(n.code,{children:`learnCardsSync`}),`, `,(0,t.jsx)(n.code,{children:`LearnCardsSync`}),`,
`,(0,t.jsx)(n.code,{children:`learn-cards-client`}),`), `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),` (`,(0,t.jsx)(n.code,{children:`/api/learn-cards`}),`,
`,(0,t.jsx)(n.code,{children:`saved_learn_cards`}),` D1 table)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.p,{children:[`On boot, once the local Learn store has loaded, `,(0,t.jsx)(n.code,{children:`learnCardsSync.init()`}),`
merges once against the account: any card synced from another device but
missing locally is adopted under its own id (never duplicated), and any
card that exists only on this device is best-effort pushed up \u2014 neither
side ever overwrites the other, it only fills gaps. After the merge,
every later card create, edit, or delete (including a file's cards being
pruned via "forget this file") mirrors itself to the account the same
way. Signed out, or under the Electron desktop build, the Learn store
keeps working exactly as before, purely on-device.`]}),`
`,(0,t.jsx)(n.h2,{id:`whats-intentionally-excluded`,children:`What's intentionally excluded`}),`
`,(0,t.jsxs)(n.p,{children:[`Only a card's portable content syncs \u2014 its review `,(0,t.jsx)(n.strong,{children:`schedule`}),` (due date,
interval, lapses), file `,(0,t.jsx)(n.strong,{children:`anchors`}),`, AI `,(0,t.jsx)(n.strong,{children:`threads`}),`, and private `,(0,t.jsx)(n.strong,{children:`notes`}),`
all stay local-only. A card adopted on a new device starts with no
schedule pressure, the same way the manage GUI's own JSON export/import
already treats a card whose carried schedule is absent \u2014 restoring a card
is not meant to restore a specific device's review history. `,(0,t.jsx)(n.strong,{children:`Custom
decks`}),` and the `,(0,t.jsx)(n.strong,{children:`review log`}),` each sync separately \u2014 see
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-decks-cloud-sync`,children:`Learn Decks Cloud Sync`}),` and
`,(0,t.jsx)(n.a,{href:`/docs/features/research-evidence/learn-review-log-cloud-sync`,children:`Learn Review Log Cloud Sync`}),`.
The remaining sub-collections (anchors, AI threads, notes, doc registry)
live in one shared blob per device (not one row per record), so they
don't fit this sync's per-record shape; syncing them would need a bespoke
schema of their own.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Every per-record push carries optimistic concurrency: `,(0,t.jsx)(n.code,{children:`PUT /api/learn-cards/[cardId]`}),` compares the incoming card's own `,(0,t.jsx)(n.code,{children:`updatedAt`}),`
against whatever's already saved for that id, and rejects (409) instead of
overwriting when the saved version is newer \u2014 an edit made on another
device that hasn't reached this browser yet. On that rejection, this
browser adopts the newer version into its own `,(0,t.jsx)(n.code,{children:`LearnStore`}),` instead of
losing it, the same "never overwrite, only reconcile" rule `,(0,t.jsx)(n.code,{children:`init()`}),`'s merge
already follows \u2014 mirroring
`,(0,t.jsx)(n.a,{href:`/docs/features/ui-navigation/quick-cards-cloud-save`,children:`Quick Cards Cloud Save`}),`'s own fix
for the identical race. `,(0,t.jsx)(n.code,{children:`CardDef`}),` didn't carry an `,(0,t.jsx)(n.code,{children:`updatedAt`}),` field before
this: it's now stamped by `,(0,t.jsx)(n.code,{children:`upsertCard`}),`/`,(0,t.jsx)(n.code,{children:`importCards`}),` themselves (not by
callers), and stays optional on the type so a card written before this
field existed \u2014 locally, or already synced to the account \u2014 still
round-trips; a side with no `,(0,t.jsx)(n.code,{children:`updatedAt`}),` is treated as arbitrarily old
rather than blocking the sync, which is exactly the previous
last-write-wins behavior until both sides have a real timestamp.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsx)(n.p,{children:`None open.`})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};