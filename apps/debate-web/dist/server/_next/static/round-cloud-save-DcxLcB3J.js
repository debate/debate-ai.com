import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Round Cloud Save`},r=`# Round Cloud Save [#round-cloud-save]

Lets a signed-in user save a whole round (the tournament/debaters/judges
wrapper around a set of flows) to their account and load it back on any
device.

- **Nav:** \`FlowHistoryDialog\`'s "Rounds" tab \u2014 a cloud-upload icon per
  round, "Save all rounds" and "Save flows not in a round" buttons
- **Package:** \`debate-round\` (dialog + validation + fetch client),
  \`apps/debate-ai.com\` (\`/api/rounds\`, \`saved_rounds\` D1 table)

## What it does [#what-it-does]

A \`Round\` only references its flows indirectly via \`flowIds\`, so saving a
round also saves each flow it references first. "Save all rounds" and
"Save flows not in a round" cover the bulk cases. The "Saved to account"
tab's Flows section badges a flow "via round" when it was only saved as
part of a round's cascade.

The round save is optimistic-concurrency checked, mirroring [Flow Cloud
Save](/docs/features/flow-speech/flow-cloud-save): it sends along the \`updatedAt\` of
the cloud copy this browser last knew about (from the last list/load/save
response it saw). If that doesn't match what's actually saved \u2014 someone
else saved a newer version since \u2014 the save is rejected with a conflict
instead of silently overwriting it, and the round's cloud icon turns into a
warning that a second click (an explicit "save anyway") resolves. This
covers the round row itself; each referenced flow's own save still goes
through flow cloud save's own conflict check independently.

Pinned ("Featured") debates follow the account too: pinning a round is stored
as a \`pinnedDebates\` tool record (\`{ id: "<round id>", pinnedAt }\`, via
\`/api/tool-records/pinnedDebates\`), so the Featured section on the start screen
matches across devices. Pins from before this change are plain numbers in
\`localStorage\`; they are still read, and are upgraded (and start syncing) the
next time any pin is toggled on that browser.

## Data flow [#data-flow]

\`\`\`
state/bulkRoundSave.ts (pure) \u2014 collectFlowsForRounds / collectUnreferencedFlows
state/savedRounds.ts (pure) \u2014 isValidRound / deriveRoundLabel / hasRoundSaveConflict
round/saved-rounds-client.ts (fetch) \u2014 list/fetch/save/delete
apps/debate-ai.com/app/api/rounds/[route.ts, [clientId]/route.ts]
\`\`\`

## Dirty tracking on bulk saves [#dirty-tracking-on-bulk-saves]

"Save all rounds" and "Save flows not in a round" skip re-PUTting a flow or
round whose content hasn't changed since it was last saved successfully this
session: \`state/bulkRoundSave.ts\`'s \`hashFlowContent\`/\`hashRoundContent\`
fingerprint each item's JSON payload, and \`filterDirtyFlows\`/
\`filterDirtyRounds\` compare that against a hash recorded after each
successful save (\`FlowHistoryDialog\`'s \`lastSavedFlowHashes\`/
\`lastSavedRoundHashes\` state, which \u2014 unlike the per-item save-status maps \u2014
survives the dialog closing and reopening). A clean item is reported as
"saved" in the bulk summary without a network round-trip. The per-item cloud
icon is unaffected and always saves, since that's an explicit user action.
This closes the "no dirty tracking" half of the gap this section used to
record (#810); the hash cache only lives for the current page session, so a
fresh page load re-saves everything once, same as before.

## Pinned debates follow your account [#pinned-debates-follow-your-account]

The star on a round in the history dialog (and the **Featured** section of the
debate start screen it feeds) used to live only in one browser. Pins are now
\`{ id, roundId, pinnedAt }\` records under the \`pinnedDebates\` key, one entry in
the Tool Data Sync catalog (\`@debate/data-sync\`), so a signed-in user's
featured rounds appear on every device. A round's local id is also its
\`saved_rounds.client_id\`, so a pin resolves to the same round once that round
has been saved to the account. A pin whose round is not saved or present on the
current device is skipped rather than shown. The older \`pinned-debates\` id list
is read once as a fallback and replaced on the first pin change. When pins from
two devices add up to more than 12, the start screen shows the newest 12.

## Flow editor settings follow your account [#flow-editor-settings-follow-your-account]

The flow editor's preferences - font, default zoom, theme, side colors, vim in
the RFD editor, paste/append behavior, scroll zoom, tooltips, CardMirror options
and your custom keyboard shortcuts - are stored as two records (\`display\` and
\`keymap\`) under the \`ebbSyncedSettings\` key, one entry in the Tool Data Sync
catalog. Signing in on another device applies them there, live. Settings that
describe a machine rather than you stay local: the flows folder, panel layout
(sidebar, RFD drawer) and the live-collab toggles, name and contacts. When a
device syncs, the account's copy of a record replaces the local one as a whole,
so the last device to sync wins for all synced settings at once.
`,i={contents:[{heading:`round-cloud-save`,content:`Lets a signed-in user save a whole round (the tournament/debaters/judges
wrapper around a set of flows) to their account and load it back on any
device.`},{heading:`round-cloud-save`,content:`**Nav:** \`FlowHistoryDialog\`'s "Rounds" tab \u2014 a cloud-upload icon per
round, "Save all rounds" and "Save flows not in a round" buttons`},{heading:`round-cloud-save`,content:"**Package:** `debate-round` (dialog + validation + fetch client),\n`apps/debate-ai.com` (`/api/rounds`, `saved_rounds` D1 table)"},{heading:`what-it-does`,content:`A \`Round\` only references its flows indirectly via \`flowIds\`, so saving a
round also saves each flow it references first. "Save all rounds" and
"Save flows not in a round" cover the bulk cases. The "Saved to account"
tab's Flows section badges a flow "via round" when it was only saved as
part of a round's cascade.`},{heading:`what-it-does`,content:`The round save is optimistic-concurrency checked, mirroring Flow Cloud
Save: it sends along the \`updatedAt\` of
the cloud copy this browser last knew about (from the last list/load/save
response it saw). If that doesn't match what's actually saved \u2014 someone
else saved a newer version since \u2014 the save is rejected with a conflict
instead of silently overwriting it, and the round's cloud icon turns into a
warning that a second click (an explicit "save anyway") resolves. This
covers the round row itself; each referenced flow's own save still goes
through flow cloud save's own conflict check independently.`},{heading:`what-it-does`,content:'Pinned ("Featured") debates follow the account too: pinning a round is stored\nas a `pinnedDebates` tool record (`{ id: "<round id>", pinnedAt }`, via\n`/api/tool-records/pinnedDebates`), so the Featured section on the start screen\nmatches across devices. Pins from before this change are plain numbers in\n`localStorage`; they are still read, and are upgraded (and start syncing) the\nnext time any pin is toggled on that browser.'},{heading:`dirty-tracking-on-bulk-saves`,content:`"Save all rounds" and "Save flows not in a round" skip re-PUTting a flow or
round whose content hasn't changed since it was last saved successfully this
session: \`state/bulkRoundSave.ts\`'s \`hashFlowContent\`/\`hashRoundContent\`
fingerprint each item's JSON payload, and \`filterDirtyFlows\`/
\`filterDirtyRounds\` compare that against a hash recorded after each
successful save (\`FlowHistoryDialog\`'s \`lastSavedFlowHashes\`/
\`lastSavedRoundHashes\` state, which \u2014 unlike the per-item save-status maps \u2014
survives the dialog closing and reopening). A clean item is reported as
"saved" in the bulk summary without a network round-trip. The per-item cloud
icon is unaffected and always saves, since that's an explicit user action.
This closes the "no dirty tracking" half of the gap this section used to
record (#810); the hash cache only lives for the current page session, so a
fresh page load re-saves everything once, same as before.`},{heading:`pinned-debates-follow-your-account`,content:"The star on a round in the history dialog (and the **Featured** section of the\ndebate start screen it feeds) used to live only in one browser. Pins are now\n`{ id, roundId, pinnedAt }` records under the `pinnedDebates` key, one entry in\nthe Tool Data Sync catalog (`@debate/data-sync`), so a signed-in user's\nfeatured rounds appear on every device. A round's local id is also its\n`saved_rounds.client_id`, so a pin resolves to the same round once that round\nhas been saved to the account. A pin whose round is not saved or present on the\ncurrent device is skipped rather than shown. The older `pinned-debates` id list\nis read once as a fallback and replaced on the first pin change. When pins from\ntwo devices add up to more than 12, the start screen shows the newest 12."},{heading:`flow-editor-settings-follow-your-account`,content:`The flow editor's preferences - font, default zoom, theme, side colors, vim in
the RFD editor, paste/append behavior, scroll zoom, tooltips, CardMirror options
and your custom keyboard shortcuts - are stored as two records (\`display\` and
\`keymap\`) under the \`ebbSyncedSettings\` key, one entry in the Tool Data Sync
catalog. Signing in on another device applies them there, live. Settings that
describe a machine rather than you stay local: the flows folder, panel layout
(sidebar, RFD drawer) and the live-collab toggles, name and contacts. When a
device syncs, the account's copy of a record replaces the local one as a whole,
so the last device to sync wins for all synced settings at once.`}],headings:[{id:`round-cloud-save`,content:`Round Cloud Save`},{id:`what-it-does`,content:`What it does`},{id:`data-flow`,content:`Data flow`},{id:`dirty-tracking-on-bulk-saves`,content:`Dirty tracking on bulk saves`},{id:`pinned-debates-follow-your-account`,content:`Pinned debates follow your account`},{id:`flow-editor-settings-follow-your-account`,content:`Flow editor settings follow your account`}]},a=[{depth:1,url:`#round-cloud-save`,title:(0,t.jsx)(t.Fragment,{children:`Round Cloud Save`})},{depth:2,url:`#what-it-does`,title:(0,t.jsx)(t.Fragment,{children:`What it does`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#dirty-tracking-on-bulk-saves`,title:(0,t.jsx)(t.Fragment,{children:`Dirty tracking on bulk saves`})},{depth:2,url:`#pinned-debates-follow-your-account`,title:(0,t.jsx)(t.Fragment,{children:`Pinned debates follow your account`})},{depth:2,url:`#flow-editor-settings-follow-your-account`,title:(0,t.jsx)(t.Fragment,{children:`Flow editor settings follow your account`})}];function o(e){let n={a:`a`,code:`code`,h1:`h1`,h2:`h2`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`round-cloud-save`,children:`Round Cloud Save`}),`
`,(0,t.jsx)(n.p,{children:`Lets a signed-in user save a whole round (the tournament/debaters/judges
wrapper around a set of flows) to their account and load it back on any
device.`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` `,(0,t.jsx)(n.code,{children:`FlowHistoryDialog`}),`'s "Rounds" tab \u2014 a cloud-upload icon per
round, "Save all rounds" and "Save flows not in a round" buttons`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-round`}),` (dialog + validation + fetch client),
`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),` (`,(0,t.jsx)(n.code,{children:`/api/rounds`}),`, `,(0,t.jsx)(n.code,{children:`saved_rounds`}),` D1 table)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-does`,children:`What it does`}),`
`,(0,t.jsxs)(n.p,{children:[`A `,(0,t.jsx)(n.code,{children:`Round`}),` only references its flows indirectly via `,(0,t.jsx)(n.code,{children:`flowIds`}),`, so saving a
round also saves each flow it references first. "Save all rounds" and
"Save flows not in a round" cover the bulk cases. The "Saved to account"
tab's Flows section badges a flow "via round" when it was only saved as
part of a round's cascade.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The round save is optimistic-concurrency checked, mirroring `,(0,t.jsx)(n.a,{href:`/docs/features/flow-speech/flow-cloud-save`,children:`Flow Cloud
Save`}),`: it sends along the `,(0,t.jsx)(n.code,{children:`updatedAt`}),` of
the cloud copy this browser last knew about (from the last list/load/save
response it saw). If that doesn't match what's actually saved \u2014 someone
else saved a newer version since \u2014 the save is rejected with a conflict
instead of silently overwriting it, and the round's cloud icon turns into a
warning that a second click (an explicit "save anyway") resolves. This
covers the round row itself; each referenced flow's own save still goes
through flow cloud save's own conflict check independently.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Pinned ("Featured") debates follow the account too: pinning a round is stored
as a `,(0,t.jsx)(n.code,{children:`pinnedDebates`}),` tool record (`,(0,t.jsx)(n.code,{children:`{ id: "<round id>", pinnedAt }`}),`, via
`,(0,t.jsx)(n.code,{children:`/api/tool-records/pinnedDebates`}),`), so the Featured section on the start screen
matches across devices. Pins from before this change are plain numbers in
`,(0,t.jsx)(n.code,{children:`localStorage`}),`; they are still read, and are upgraded (and start syncing) the
next time any pin is toggled on that browser.`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/bulkRoundSave.ts (pure) \u2014 collectFlowsForRounds / collectUnreferencedFlows`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`state/savedRounds.ts (pure) \u2014 isValidRound / deriveRoundLabel / hasRoundSaveConflict`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`round/saved-rounds-client.ts (fetch) \u2014 list/fetch/save/delete`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`apps/debate-ai.com/app/api/rounds/[route.ts, [clientId]/route.ts]`})})]})})}),`
`,(0,t.jsx)(n.h2,{id:`dirty-tracking-on-bulk-saves`,children:`Dirty tracking on bulk saves`}),`
`,(0,t.jsxs)(n.p,{children:[`"Save all rounds" and "Save flows not in a round" skip re-PUTting a flow or
round whose content hasn't changed since it was last saved successfully this
session: `,(0,t.jsx)(n.code,{children:`state/bulkRoundSave.ts`}),`'s `,(0,t.jsx)(n.code,{children:`hashFlowContent`}),`/`,(0,t.jsx)(n.code,{children:`hashRoundContent`}),`
fingerprint each item's JSON payload, and `,(0,t.jsx)(n.code,{children:`filterDirtyFlows`}),`/
`,(0,t.jsx)(n.code,{children:`filterDirtyRounds`}),` compare that against a hash recorded after each
successful save (`,(0,t.jsx)(n.code,{children:`FlowHistoryDialog`}),`'s `,(0,t.jsx)(n.code,{children:`lastSavedFlowHashes`}),`/
`,(0,t.jsx)(n.code,{children:`lastSavedRoundHashes`}),` state, which \u2014 unlike the per-item save-status maps \u2014
survives the dialog closing and reopening). A clean item is reported as
"saved" in the bulk summary without a network round-trip. The per-item cloud
icon is unaffected and always saves, since that's an explicit user action.
This closes the "no dirty tracking" half of the gap this section used to
record (#810); the hash cache only lives for the current page session, so a
fresh page load re-saves everything once, same as before.`]}),`
`,(0,t.jsx)(n.h2,{id:`pinned-debates-follow-your-account`,children:`Pinned debates follow your account`}),`
`,(0,t.jsxs)(n.p,{children:[`The star on a round in the history dialog (and the `,(0,t.jsx)(n.strong,{children:`Featured`}),` section of the
debate start screen it feeds) used to live only in one browser. Pins are now
`,(0,t.jsx)(n.code,{children:`{ id, roundId, pinnedAt }`}),` records under the `,(0,t.jsx)(n.code,{children:`pinnedDebates`}),` key, one entry in
the Tool Data Sync catalog (`,(0,t.jsx)(n.code,{children:`@debate/data-sync`}),`), so a signed-in user's
featured rounds appear on every device. A round's local id is also its
`,(0,t.jsx)(n.code,{children:`saved_rounds.client_id`}),`, so a pin resolves to the same round once that round
has been saved to the account. A pin whose round is not saved or present on the
current device is skipped rather than shown. The older `,(0,t.jsx)(n.code,{children:`pinned-debates`}),` id list
is read once as a fallback and replaced on the first pin change. When pins from
two devices add up to more than 12, the start screen shows the newest 12.`]}),`
`,(0,t.jsx)(n.h2,{id:`flow-editor-settings-follow-your-account`,children:`Flow editor settings follow your account`}),`
`,(0,t.jsxs)(n.p,{children:[`The flow editor's preferences - font, default zoom, theme, side colors, vim in
the RFD editor, paste/append behavior, scroll zoom, tooltips, CardMirror options
and your custom keyboard shortcuts - are stored as two records (`,(0,t.jsx)(n.code,{children:`display`}),` and
`,(0,t.jsx)(n.code,{children:`keymap`}),`) under the `,(0,t.jsx)(n.code,{children:`ebbSyncedSettings`}),` key, one entry in the Tool Data Sync
catalog. Signing in on another device applies them there, live. Settings that
describe a machine rather than you stay local: the flows folder, panel layout
(sidebar, RFD drawer) and the live-collab toggles, name and contacts. When a
device syncs, the account's copy of a record replaces the local one as a whole,
so the last device to sync wins for all synced settings at once.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};