import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DnyErxv7.js";var t=e(),n={title:`User Settings`},r=`# User Settings [#user-settings]

\`/settings\` is the CardMirror editor's settings page, and a signed-in user's
choices there follow them across devices instead of staying in one browser's
localStorage.

- **Route:** \`/settings\` (the panel itself renders in an isolated iframe at
  \`/settings/editor-panel\`)
- **Research agent settings:** tabs of \`/settings\` itself, listed after the
  editor's under a **Research agent** heading in the same sidebar \u2014 one per
  section (account, language models, connectors, skills and memory, search
  sources, search settings, cloud storage, rewrite modes, voice). Each is
  linkable as \`/settings?category=research-<section>\`. The section list is
  \`research-agent-ui\`'s own (\`research-agent-ui/settings\`); the panes load
  lazily, the first time one of those tabs is opened. The old
  \`/settings/research\` and \`/settings/research/<section>\` pages now redirect to
  the matching tab (\`editor-<tab>\` sections to the editor's own tab).
- **Package:** \`debate-editor\` (the settings store, \`SETTING_METADATA\`, and
  the embedded panel builder), \`apps/debate-ai.com\`
  (\`lib/editor-preferences.ts\`, \`/api/settings\`, \`user_settings\` D1 table)

## What it shows [#what-it-shows]

The editor's whole category set, listed in a searchable sidebar \u2014 **General**, **Files**, **Appearance**,
**Accessibility**, **Editing**, **Keyboard**, **Comments & AI**,
**Collaboration** \u2014 from \`debate-editor\`'s exported tab list
(\`CARDMIRROR_SETTINGS_TABS\`, \`@debate/editor/settings-tabs\`) and rendered by its
\`CardMirrorSettingsSection\` (\`@debate/editor/settings-section\`), which wraps
\`buildEmbeddedSettingsPanel\`, so each tab is the same rows the editor's
gear-icon modal renders under it, minus the dialog chrome. General also
carries the personal dictionary, the performance benchmark and this install's
version info.

The page fills the whole window with no padding around it. The sidebar runs
its full height: the **Settings** title and a **Back** link sit at its top, and
the site's footer links (**Docs**, **Github**, **Support**, **Privacy**,
**Reddit** \u2014 the same \`FOOTER_LINKS\` list the app sidebar's footer reads) sit
at its bottom.

Appearance and Accessibility appear *only* here: they moved out of that modal
when they moved to this page. Everything else is a second surface onto the
same local store, so a change here shows up in the editor and the other way
round.

\`EDITOR_SETTINGS_TABS\` (\`apps/debate-ai.com/lib/editor-preferences.ts\`) is the
one list of which categories those are, read both by the panel route that
renders them and by the API route that validates what they save. \`plugins\` is
deliberately not among them \u2014 every row in it is Electron-only, so the tab
would render empty on the web.

## What it no longer shows [#what-it-no-longer-shows]

The page used to be this app's own account form, and that whole section is
gone:

- the Debate style / Font size / Font family / Colour theme / Light-dark
  pickers (\`debate-round\`'s \`UserSettingsPanel\`) \u2014 the dock's gear-icon menu
  still carries the colour theme and light/dark rows. The whole form is
  back as the first tab of \`/settings\`, **Preferences** (still
  \`UserSettingsPanel\`), ahead of the editor's own tabs;
  \`/settings/preferences\` now redirects to it
- **Favorite tools** \u2014 a tool is starred from its own page or the command palette (the \`/tools\` page was removed), which is also
  where a renamed or removed tool now gets pruned from the saved list
- **Tool data** \u2014 each tool page's header now carries a small badge
  (*Saved to account* / *Syncing\u2026* / *Not synced \u00B7 Retry* / *Saved on this
  browser* when signed out) for tools whose data syncs; see
  Tool Data Sync's Known gaps for what went
  with it (the sync itself is untouched and still runs app-wide)
- **Word limit presets** (\`debate-round\`'s \`WordLimitPresetsPanel\`) \u2014 now
  editable directly on \`/word-count\`, in a collapsible "Manage word limit
  presets" section below the word-count form, rather than from here
- **Ebb Flow preferences** \u2014 reachable with \`Cmd/Ctrl+,\` inside a flow, where
  they apply
- **Default format for new speech documents** (Files \u2192 New documents) \u2014 a
  new speech document is now always created as \`.cmir\`, CardMirror's native
  format, so autosave always applies to it (autosave only writes \`.cmir\`).
  Save As still exports a \`.docx\` for teammates on Verbatim. The format is
  \`SPEECH_DOC_FORMAT\` in \`debate-editor\`'s \`src/editor/speech-filename.ts\`

Their \`/api/settings\` fields (\`debateStyle\`, \`fontSize\`, \`wordLimitPresets\`, \u2026)
are all still stored and served; what changed is that nothing writes them from
here any more.

## Your own AI key [#your-own-ai-key]

The **Preferences** tab has a **Your own AI key** box. Paste an
[OpenRouter key](https://openrouter.ai/settings/keys) (\`sk-or-\u2026\`) or an
Anthropic key (\`sk-ant-\u2026\`) and the AI features \u2014 card AI analysis, AI coach and
judge, citation and OCR fixes, every caller of \`/api/reason-ai\` and
\`/api/card-ai-analysis\` \u2014 run on your key instead of Debate AI's shared one.
You set your own spending limit on that key with OpenRouter (or Anthropic), and
Debate AI's daily AI request and card-analysis limits stop applying to you.

The same box appears:

- in the pricing dialog when you hit a daily AI limit, as an alternative to
  upgrading, and
- in an **AI limit reached** dialog when Debate AI's shared key itself has run
  out of credit or hit its spending cap (the route answers \`503\` with an
  \`x-ai-key-needed\` header). That dialog is an upgrade box: it offers the plan
  cards to upgrade your account first, with bringing your own key as the other
  option. If the plans can't be loaded, only the key option shows.

The key is kept in this browser's \`localStorage\` only \u2014 never in your account's
settings row \u2014 and is sent, as the \`x-user-ai-key\` header, only on same-origin
requests to the two AI routes. The server uses it for that one request and
never stores or logs it. Remove it to go back to the shared key.

- **Packages:** \`debate-webview\` (\`lib/ai/own-ai-key.ts\`,
  \`components/settings/OwnAiKeySection.tsx\`,
  \`components/pricing/OwnAiKeyDialog.tsx\`), \`apps/debate-ai.com\`
  (\`lib/ai/provider-key.ts\`)

## Flow editor preferences follow your account [#flow-editor-preferences-follow-your-account]

The Ebb flow editor's display preferences (\`Cmd/Ctrl+,\`) and keybinding
overrides sync to your account when you are signed in, through the same tool
data sync as the other tools (\`flowEditorDisplaySettings\` and
\`flowKeymap\` in \`debate-data-sync\`'s catalog). What follows you:
flow font, default grid zoom, the editing toggles (insert-paste, append-edit,
scroll-zoom, align speeches, tooltips, Vim in the RFD pane), CardMirror
options, light/dark theme, side colours, and every keymap override.

What stays on the device it was set on: the flows folder, whether the sidebar
and RFD pane are open, and the live-collaboration switches, display name and
contacts. A pull from the account never resets those. Engineering notes:
\`debate-data-sync\`'s \`state/flow-editor-settings-codec.ts\` \u2014 a field joins the
account only by being added to \`SYNCED_FLOW_DISPLAY_FIELDS\`.

## Saved-to-account marker on flow tabs [#saved-to-account-marker-on-flow-tabs]

Each flow tab in the sidebar's **Open Tabs** group shows a small cloud icon
once that flow has been saved to your account from the Flow History dialog
(including bulk saves): a plain cloud means the account copy matches what you
see, a crossed-out amber cloud means you've edited it since. A tab with no icon
has no baseline yet. The marker survives a reload: each save remembers the
version the account stamped on it, and opening the \`/debate\` start screen or a
round's flow tabs (or the **Saved to account** tab in Flow History) re-adopts
that baseline only if your account still holds exactly that version, so edits made elsewhere (or by a different account on the same
browser) never show as saved. Engineering notes: \`debate-round\`'s
\`state/flowAccountStatus.ts\`; the on-mount restore is \`state/restoreAccountBaselines.ts\`
(one fetch per page session, silent when signed out).

The same cloud icon appears on the round cards of the \`/debate\` start screen
(Featured and Recent) once the round itself has been saved to your account from
the Flow History dialog, and flips to the amber crossed-out cloud when the round
is edited afterwards. Saving a round's flows does not by itself mark the round.

### Auto-save for flows already on your account [#auto-save-for-flows-already-on-your-account]

Once a flow has been saved to your account, further edits to it are saved
automatically about five seconds after you stop typing, and the tab's cloud
icon flips back to saved. Flows you have never saved are never uploaded
automatically, and archived flows are skipped. Auto-save never overwrites: if
the account holds a newer copy (saved from another device) the flow stays
amber and you resolve it from Flow History. A failed save is retried only after
the flow changes again. Turn it off with **Auto-save flows to my account** on the
**Preferences** tab; it is on by default, applies immediately, and is stored in
this browser only (not synced to other devices). Turning it off discards any
save still waiting on the timer. Engineering notes: \`debate-round\`'s
\`state/flowAutoSave.ts\`, mounted by \`useFlowAutoSave\` in \`OpenTabsGroup\`; the
preference lives in \`state/flowAutoSavePreference.ts\`.

Choose how far auto-save goes under **Flow auto-save** in Settings \u2192 Preferences:

- **Flows already on my account** (default) \u2014 the behavior above.
- **All flows** \u2014 also uploads flows you have never saved. If your account
  already holds a flow with that id, it is treated as a conflict and left alone.
- **Off** \u2014 nothing is saved automatically; use Save now or Flow History.

The choice applies immediately in this browser. When you are signed in it is
also saved to your account (\`PUT /api/settings { flowAutoSave }\`, the
\`user_settings.flow_auto_save\` column) and adopted on your other devices the
next time Settings loads. Engineering notes:
\`state/flowAutoSaveSettings.ts\` (\`debate:flow-auto-save\` in \`localStorage\`,
\`normalizeFlowAutoSavePatch\`/\`parseFlowAutoSave\` for the route), read at each
run by \`createFlowAutoSaver\`'s \`getMode\`. Deploy must add the new nullable
column (\`schema.ts\` is the only source of truth).

## Data flow [#data-flow]

\`\`\`
debate-editor/settings.ts (the store, SETTING_METADATA, SECRET_SETTING_KEYS)
debate-editor/settings-ui.ts (buildEmbeddedSettingsPanel)
app/settings/editor-panel/page.tsx (iframe document: category sidebar, hydrate, debounced push)
  \u2192 GET/PUT /api/settings { editorPreferences }
lib/editor-preferences.ts (EDITOR_SETTINGS_TABS, EDITOR_PREFERENCE_KEYS, validation)
components/settings/CardMirrorSettingsPanel.tsx (the iframe wrapper, self-sizing)
\`\`\`

The local store stays authoritative: the page hydrates from the account on
load (a \`401\` just means signed out), and every change writes localStorage
immediately and mirrors to the account on a 600ms debounce. A failed mirror
never undoes the local change.

## Credentials stay in the browser [#credentials-stay-in-the-browser]

The mirrored keys are the hosted categories' settings **minus** the
credentials among them \u2014 the provider API keys and the translation key that
\`debate-editor\`'s \`SECRET_SETTING_KEYS\` already keeps out of a settings
export, plus the self-hosted relay's bearer token. \`EDITOR_PREFERENCE_KEYS\`
excludes them, so they are refused on the way in (reported as unknown keys,
not silently dropped) and filtered on the way back out of a stored row.
\`apps/debate-ai.com/lib/__tests__/editor-preferences.test.ts\` pins that.

The push is also limited to the rows that actually rendered \u2014 each one tagged
\`data-setting-key\` by the editor \u2014 rather than to every key in a hosted
category. A row this host hides (desktop-only card sharing, say) would
otherwise be mirrored at its default and overwrite whatever the account holds
for it.

## Flow editor preferences follow your account [#flow-editor-preferences-follow-your-account-1]

Signed in, the Ebb flow editor's look-and-behaviour preferences (font, default
grid zoom, theme, Aff/Neg colours, the Vim/insert-paste/append-edit/scroll-zoom/
align-speeches/tooltip toggles, the CardMirror options and your custom
keybindings) are saved to your account as \`flowEditorSettings\` and applied the
next time you open a flow on any device. Anything specific to one device \u2014 the
flows folder, collaboration name and relay toggles, contacts, and panel layout \u2014
stays in that browser. Signed out, nothing changes: settings stay in
localStorage.

## The welcome dialog shows once per account [#the-welcome-dialog-shows-once-per-account]

The "Welcome to Debate AI" dialog of key links appears the first time an
account signs in, and never again on any device. Showing it records
\`user_settings.welcome_dismissed_at\` through \`GET\`/\`POST
/api/settings/welcome\` (\`FirstLoginWelcomeProvider\` in \`@debate/webview\`,
helpers in \`lib/first-login-welcome.ts\`). A \`localStorage\` copy of the flag
saves the request on browsers that already know, and a browser that showed
the dialog before the flag moved to the account records it there once. If the
account's answer cannot be read (offline, an error), the dialog stays hidden
rather than risk showing it twice. A second account signing in on a browser
that already showed it does not see it.

## Privacy [#privacy]

The **Privacy** tab (\`/settings?category=privacy\`) is where you decide what
Debate AI may publish of your recordings and how you are named on them.

- **Recording release.** A few paragraphs explain what publishing means. Until
  you pick **I agree**, nothing you record is published; **Don't publish my
  recordings** is the default and withdraws an earlier agreement. Agreeing
  records the date and the version of the wording you agreed to, and if the
  wording changes you are asked again.
- **What is published:** **Audio and video**, or **Audio only**, which leaves
  your camera out.
- **How you are credited:** **Anonymous contributor** (the default, your name
  hidden), a **Username** you type in, or your **Real name**, either in full
  or as first name and last initial ("Ada L."). The tab previews how you will
  appear.
- **Privacy policy:** a link to \`/legal/privacy\`.
- **Request deletion of your data:** ask for everything (including your
  account) or only some of it (published recordings, saved speech audio,
  flows, documents, comments, account settings), with a box for suggested
  deletions such as links to specific recordings. Requests go to the site's
  admins as a notification, and your past requests and their status are
  listed under the form. Nothing is deleted automatically.

Engineering notes: the rules live in \`@debate/webview\`'s
\`lib/privacy/recording-release.ts\` (\`mayPublishRecording\`, \`includeVideo\`,
\`publicCreditName\`, the validators and the release text). The choices are
stored as JSON in \`user_settings.recording_privacy\` through \`GET\`/\`PUT
/api/settings/privacy\`; requests go to \`GET\`/\`POST
/api/settings/privacy/deletion-requests\` and the \`data_deletion_requests\`
table, created on first use by \`apps/debate-ai.com/lib/privacy/store.ts\`,
which also exports \`getRecordingPrivacy(db, userId)\` for any server code that
publishes a recording.

Known gaps: the release text is a plain-language placeholder that has not had
legal review. No feature publishes user recordings yet, so the settings take
effect as publishing features read them. There is no admin screen for the
deletion queue yet; admins see the notification and work the
\`data_deletion_requests\` table by hand.

## Known gaps [#known-gaps]

No optimistic-concurrency handling in general \u2014 two tabs editing the *same*
field at once has the last PUT win. \`favoriteTools\` no longer has this
problem: every code path that changes it (\`toggleFavorite\`/\`removeFavorite\`'s
single add/remove op, and \`pruneUnknown\`'s batch \`removeFavoriteTools\` op)
now resolves against the account's row as it stands at write time, not a
client-computed whole-list replace, so two tabs adding, removing or pruning
different entries at once can no longer drop each other's change. A plain
whole-list \`favoriteTools\` replace is still accepted by the route for a
caller that genuinely needs one, but nothing in the app sends one anymore.
\`recentTools\` (see Command Palette's
"Recent" section) joins it as an op-based field \u2014 each tool visit sends a
single \`recordRecentTool\` op, resolved the same read-then-write way \u2014 since
it writes far more often than any picker-style field here (every tool open,
not just an explicit Save) and two tabs opening different tools in quick
succession would otherwise race the same way favorites used to.

\`editorPreferences\` is a plain merge of whatever the page last pushed, so it
has the same last-write-wins property: the editor's settings open in two
tabs, changed in both, end at whichever debounce landed second. Every other
field (\`debateStyle\`, \`colorTheme\`, etc.) is a plain whole-value replace with
no such protection \u2014 \`debateStyle\`/\`fontSize\`/\`colorTheme\`/\`themeMode\` are
written from \`/settings\`' Preferences tab and the dock's Theme submenu, both of
which apply and (when signed in) sync a single field at a time rather than a
whole form Save, so this mostly shows up as "two tabs pick a different
Debate style within the same second."

\`wordLimitPresets\` (\`debate-round\`'s \`WordLimitPresetsPanel\`, rendered from
\`/word-count\` rather than from this page \u2014 see "What it no longer shows"
above) is also op-based now: \`addPreset\`/\`updatePreset\`/\`removePreset\` each
send a single \`addWordLimitPreset\`/\`updateWordLimitPreset\`/
\`removeWordLimitPreset\` op, resolved against the account's current list at
write time instead of a client-computed whole-list replace, mirroring
\`favoriteTools\`'s fix above. A duplicate name, an unknown preset, or an
invalid word limit is refused with a \`400\` rather than silently corrupting
the stored list. A plain whole-list \`wordLimitPresets\` replace is still
accepted by the route for a caller that genuinely needs one, but
\`useWordLimitPresets.ts\` no longer sends one.

\`outlineFilterPresets\` (\`debate-practice-drills\`'s named Outline filter
presets bar \u2014 see Argument Tree Outline)
is op-based the same way: \`addPreset\`/\`removePreset\` each send a single
\`addOutlineFilterPreset\`/\`removeOutlineFilterPreset\` op, resolved against
the account's current list at write time instead of a client-computed
whole-list replace, mirroring \`wordLimitPresets\`'s fix above. A duplicate
name, an at-capacity list, or an invalid filter is refused with a \`400\`
rather than silently corrupting the stored list. A plain whole-list
\`outlineFilterPresets\` replace is still accepted by the route for a caller
that genuinely needs one, but \`useOutlineFilterPresets.ts\` no longer sends
one.

## Pinned debates [#pinned-debates]

The debates you pin to the start screen's **Featured** section follow your
account. Each pin is a \`{ roundId, pinnedAt }\` record in the \`pinnedDebates\`
collection of the tool-record sync (\`debate-data-sync\`'s
\`TOOL_RECORD_COLLECTIONS\`, stored in \`saved_tool_records\`), so it syncs like
every other tool store and appears under **Settings \u2192 Account \u2192 Tool data**
as "Pinned Debates". A round's id is its \`saved_rounds.client_id\`, which a
cloud save keeps, so the pin names the same round on every device; a pin whose
round isn't on this device yet is skipped until the round arrives. Browsers
that stored pins as a bare list of ids are upgraded to records the first time
the list is read.

Known gap: pins are capped at 12 per browser, and the merge on sign-in is a
union, so a pin removed on one device while another is offline can reappear
until that device syncs.

## Flow editor shortcuts [#flow-editor-shortcuts]

Shortcuts you rebind in the flow editor sync to your account as the
\`flowKeymap\` collection (listed in **Tool data** as "Flow Editor Shortcuts"),
one record per rebound action. They are stored under \`ebb-keymap-settings\` and
adapted by \`flow-keymap-codec.ts\` in \`debate-data-sync\`.

Known gap: the flow editor reads shortcuts once at startup, so a rebinding made
on another device applies the next time the editor loads. Display preferences
(\`ebb-display-settings\`) are not synced: they include device-local values such
as the flows folder path.

## Save status on each tool [#save-status-on-each-tool]

A tool page whose data syncs shows a small badge in its header: **Saved to your
account** once everything the tool stores has reached your account, **Saving to
your account\u2026** while recent changes are on their way, **Syncing\u2026** during the
first merge after you sign in, and **Saved on this device** when you're signed
out. It is read from the same auto-sync that powers **Tool data** (see
\`getToolRecordCollectionSyncStatus\` in \`debate-data-sync\`), so it never starts a
second sync, and it refreshes every few seconds rather than instantly.

While changes are waiting to be saved, a **Save now** button appears next to the
badge and pushes that tool's data to your account immediately instead of waiting
for the next automatic save. If the save fails the button turns into **Retry
save** and its tooltip says why. Starring a tool as a favorite uses the star at
the end of the same header row.

The \`/debate\` start screen has its own header, so it shows the same badge (and
**Save now**) beside its **New flow** button; \`DebateFlowPage\` takes it as a
\`startScreenActions\` prop because \`debate-round\` can't import the webview's
component. Once a round or flow is open, the same badge sits at the start of the
speech controls bar above the workspace (\`roundActions\`, handed to
\`SpeechControlsTopBar\` as \`leadingActions\`).

The shared-cards sub-pages (Evidence Library, Argument Library and Card Revision
History) keep their data under the \`/research/cards\` hub rather than under their
own route, so their headers name the collections explicitly
(\`ToolPageHeader\`'s \`syncCollections\` prop, resolved by \`resolveToolSyncKeys\`)
and show the badge too.

The video library at \`/videos\` (and each \`/videos/<category>\` view of it) shows the badge (and **Save now**) beside its
search bar; \`LecturesPage\` takes it as a \`headerActionsSlot\` prop because
\`debate-videos\` can't import the webview's component.

The \`/research/cards\` search workspace has no \`ToolPageHeader\`, so its route
renders a slim strip above the workspace holding the badge (and **Save now**) for
the Evidence Library collections.

Known gap: the open-flow tabs and the \`/doc\` header are custom too and don't
show the badge yet.
`,i={contents:[{heading:`user-settings`,content:`\`/settings\` is the CardMirror editor's settings page, and a signed-in user's
choices there follow them across devices instead of staying in one browser's
localStorage.`},{heading:`user-settings`,content:"**Route:** `/settings` (the panel itself renders in an isolated iframe at\n`/settings/editor-panel`)"},{heading:`user-settings`,content:"**Research agent settings:** tabs of `/settings` itself, listed after the\neditor's under a **Research agent** heading in the same sidebar \u2014 one per\nsection (account, language models, connectors, skills and memory, search\nsources, search settings, cloud storage, rewrite modes, voice). Each is\nlinkable as `/settings?category=research-<section>`. The section list is\n`research-agent-ui`'s own (`research-agent-ui/settings`); the panes load\nlazily, the first time one of those tabs is opened. The old\n`/settings/research` and `/settings/research/<section>` pages now redirect to\nthe matching tab (`editor-<tab>` sections to the editor's own tab)."},{heading:`user-settings`,content:"**Package:** `debate-editor` (the settings store, `SETTING_METADATA`, and\nthe embedded panel builder), `apps/debate-ai.com`\n(`lib/editor-preferences.ts`, `/api/settings`, `user_settings` D1 table)"},{heading:`what-it-shows`,content:"The editor's whole category set, listed in a searchable sidebar \u2014 **General**, **Files**, **Appearance**,\n**Accessibility**, **Editing**, **Keyboard**, **Comments & AI**,\n**Collaboration** \u2014 from `debate-editor`'s exported tab list\n(`CARDMIRROR_SETTINGS_TABS`, `@debate/editor/settings-tabs`) and rendered by its\n`CardMirrorSettingsSection` (`@debate/editor/settings-section`), which wraps\n`buildEmbeddedSettingsPanel`, so each tab is the same rows the editor's\ngear-icon modal renders under it, minus the dialog chrome. General also\ncarries the personal dictionary, the performance benchmark and this install's\nversion info."},{heading:`what-it-shows`,content:`The page fills the whole window with no padding around it. The sidebar runs
its full height: the **Settings** title and a **Back** link sit at its top, and
the site's footer links (**Docs**, **Github**, **Support**, **Privacy**,
**Reddit** \u2014 the same \`FOOTER_LINKS\` list the app sidebar's footer reads) sit
at its bottom.`},{heading:`what-it-shows`,content:`Appearance and Accessibility appear *only* here: they moved out of that modal
when they moved to this page. Everything else is a second surface onto the
same local store, so a change here shows up in the editor and the other way
round.`},{heading:`what-it-shows`,content:"`EDITOR_SETTINGS_TABS` (`apps/debate-ai.com/lib/editor-preferences.ts`) is the\none list of which categories those are, read both by the panel route that\nrenders them and by the API route that validates what they save. `plugins` is\ndeliberately not among them \u2014 every row in it is Electron-only, so the tab\nwould render empty on the web."},{heading:`what-it-no-longer-shows`,content:`The page used to be this app's own account form, and that whole section is
gone:`},{heading:`what-it-no-longer-shows`,content:"the Debate style / Font size / Font family / Colour theme / Light-dark\npickers (`debate-round`'s `UserSettingsPanel`) \u2014 the dock's gear-icon menu\nstill carries the colour theme and light/dark rows. The whole form is\nback as the first tab of `/settings`, **Preferences** (still\n`UserSettingsPanel`), ahead of the editor's own tabs;\n`/settings/preferences` now redirects to it"},{heading:`what-it-no-longer-shows`,content:"**Favorite tools** \u2014 a tool is starred from its own page or the command palette (the `/tools` page was removed), which is also\nwhere a renamed or removed tool now gets pruned from the saved list"},{heading:`what-it-no-longer-shows`,content:`**Tool data** \u2014 each tool page's header now carries a small badge
(*Saved to account* / *Syncing\u2026* / *Not synced \u00B7 Retry* / *Saved on this
browser* when signed out) for tools whose data syncs; see
Tool Data Sync's Known gaps for what went
with it (the sync itself is untouched and still runs app-wide)`},{heading:`what-it-no-longer-shows`,content:'**Word limit presets** (`debate-round`\'s `WordLimitPresetsPanel`) \u2014 now\neditable directly on `/word-count`, in a collapsible "Manage word limit\npresets" section below the word-count form, rather than from here'},{heading:`what-it-no-longer-shows`,content:"**Ebb Flow preferences** \u2014 reachable with `Cmd/Ctrl+,` inside a flow, where\nthey apply"},{heading:`what-it-no-longer-shows`,content:"**Default format for new speech documents** (Files \u2192 New documents) \u2014 a\nnew speech document is now always created as `.cmir`, CardMirror's native\nformat, so autosave always applies to it (autosave only writes `.cmir`).\nSave As still exports a `.docx` for teammates on Verbatim. The format is\n`SPEECH_DOC_FORMAT` in `debate-editor`'s `src/editor/speech-filename.ts`"},{heading:`what-it-no-longer-shows`,content:"Their `/api/settings` fields (`debateStyle`, `fontSize`, `wordLimitPresets`, \u2026)\nare all still stored and served; what changed is that nothing writes them from\nhere any more."},{heading:`your-own-ai-key`,content:"The **Preferences** tab has a **Your own AI key** box. Paste an\nOpenRouter key (`sk-or-\u2026`) or an\nAnthropic key (`sk-ant-\u2026`) and the AI features \u2014 card AI analysis, AI coach and\njudge, citation and OCR fixes, every caller of `/api/reason-ai` and\n`/api/card-ai-analysis` \u2014 run on your key instead of Debate AI's shared one.\nYou set your own spending limit on that key with OpenRouter (or Anthropic), and\nDebate AI's daily AI request and card-analysis limits stop applying to you."},{heading:`your-own-ai-key`,content:`The same box appears:`},{heading:`your-own-ai-key`,content:`in the pricing dialog when you hit a daily AI limit, as an alternative to
upgrading, and`},{heading:`your-own-ai-key`,content:`in an **AI limit reached** dialog when Debate AI's shared key itself has run
out of credit or hit its spending cap (the route answers \`503\` with an
\`x-ai-key-needed\` header). That dialog is an upgrade box: it offers the plan
cards to upgrade your account first, with bringing your own key as the other
option. If the plans can't be loaded, only the key option shows.`},{heading:`your-own-ai-key`,content:"The key is kept in this browser's `localStorage` only \u2014 never in your account's\nsettings row \u2014 and is sent, as the `x-user-ai-key` header, only on same-origin\nrequests to the two AI routes. The server uses it for that one request and\nnever stores or logs it. Remove it to go back to the shared key."},{heading:`your-own-ai-key`,content:"**Packages:** `debate-webview` (`lib/ai/own-ai-key.ts`,\n`components/settings/OwnAiKeySection.tsx`,\n`components/pricing/OwnAiKeyDialog.tsx`), `apps/debate-ai.com`\n(`lib/ai/provider-key.ts`)"},{heading:`flow-editor-preferences-follow-your-account`,content:"The Ebb flow editor's display preferences (`Cmd/Ctrl+,`) and keybinding\noverrides sync to your account when you are signed in, through the same tool\ndata sync as the other tools (`flowEditorDisplaySettings` and\n`flowKeymap` in `debate-data-sync`'s catalog). What follows you:\nflow font, default grid zoom, the editing toggles (insert-paste, append-edit,\nscroll-zoom, align speeches, tooltips, Vim in the RFD pane), CardMirror\noptions, light/dark theme, side colours, and every keymap override."},{heading:`flow-editor-preferences-follow-your-account`,content:"What stays on the device it was set on: the flows folder, whether the sidebar\nand RFD pane are open, and the live-collaboration switches, display name and\ncontacts. A pull from the account never resets those. Engineering notes:\n`debate-data-sync`'s `state/flow-editor-settings-codec.ts` \u2014 a field joins the\naccount only by being added to `SYNCED_FLOW_DISPLAY_FIELDS`."},{heading:`saved-to-account-marker-on-flow-tabs`,content:`Each flow tab in the sidebar's **Open Tabs** group shows a small cloud icon
once that flow has been saved to your account from the Flow History dialog
(including bulk saves): a plain cloud means the account copy matches what you
see, a crossed-out amber cloud means you've edited it since. A tab with no icon
has no baseline yet. The marker survives a reload: each save remembers the
version the account stamped on it, and opening the \`/debate\` start screen or a
round's flow tabs (or the **Saved to account** tab in Flow History) re-adopts
that baseline only if your account still holds exactly that version, so edits made elsewhere (or by a different account on the same
browser) never show as saved. Engineering notes: \`debate-round\`'s
\`state/flowAccountStatus.ts\`; the on-mount restore is \`state/restoreAccountBaselines.ts\`
(one fetch per page session, silent when signed out).`},{heading:`saved-to-account-marker-on-flow-tabs`,content:`The same cloud icon appears on the round cards of the \`/debate\` start screen
(Featured and Recent) once the round itself has been saved to your account from
the Flow History dialog, and flips to the amber crossed-out cloud when the round
is edited afterwards. Saving a round's flows does not by itself mark the round.`},{heading:`auto-save-for-flows-already-on-your-account`,content:`Once a flow has been saved to your account, further edits to it are saved
automatically about five seconds after you stop typing, and the tab's cloud
icon flips back to saved. Flows you have never saved are never uploaded
automatically, and archived flows are skipped. Auto-save never overwrites: if
the account holds a newer copy (saved from another device) the flow stays
amber and you resolve it from Flow History. A failed save is retried only after
the flow changes again. Turn it off with **Auto-save flows to my account** on the
**Preferences** tab; it is on by default, applies immediately, and is stored in
this browser only (not synced to other devices). Turning it off discards any
save still waiting on the timer. Engineering notes: \`debate-round\`'s
\`state/flowAutoSave.ts\`, mounted by \`useFlowAutoSave\` in \`OpenTabsGroup\`; the
preference lives in \`state/flowAutoSavePreference.ts\`.`},{heading:`auto-save-for-flows-already-on-your-account`,content:`Choose how far auto-save goes under **Flow auto-save** in Settings \u2192 Preferences:`},{heading:`auto-save-for-flows-already-on-your-account`,content:`**Flows already on my account** (default) \u2014 the behavior above.`},{heading:`auto-save-for-flows-already-on-your-account`,content:`**All flows** \u2014 also uploads flows you have never saved. If your account
already holds a flow with that id, it is treated as a conflict and left alone.`},{heading:`auto-save-for-flows-already-on-your-account`,content:`**Off** \u2014 nothing is saved automatically; use Save now or Flow History.`},{heading:`auto-save-for-flows-already-on-your-account`,content:"The choice applies immediately in this browser. When you are signed in it is\nalso saved to your account (`PUT /api/settings { flowAutoSave }`, the\n`user_settings.flow_auto_save` column) and adopted on your other devices the\nnext time Settings loads. Engineering notes:\n`state/flowAutoSaveSettings.ts` (`debate:flow-auto-save` in `localStorage`,\n`normalizeFlowAutoSavePatch`/`parseFlowAutoSave` for the route), read at each\nrun by `createFlowAutoSaver`'s `getMode`. Deploy must add the new nullable\ncolumn (`schema.ts` is the only source of truth)."},{heading:`data-flow`,content:`The local store stays authoritative: the page hydrates from the account on
load (a \`401\` just means signed out), and every change writes localStorage
immediately and mirrors to the account on a 600ms debounce. A failed mirror
never undoes the local change.`},{heading:`credentials-stay-in-the-browser`,content:"The mirrored keys are the hosted categories' settings **minus** the\ncredentials among them \u2014 the provider API keys and the translation key that\n`debate-editor`'s `SECRET_SETTING_KEYS` already keeps out of a settings\nexport, plus the self-hosted relay's bearer token. `EDITOR_PREFERENCE_KEYS`\nexcludes them, so they are refused on the way in (reported as unknown keys,\nnot silently dropped) and filtered on the way back out of a stored row.\n`apps/debate-ai.com/lib/__tests__/editor-preferences.test.ts` pins that."},{heading:`credentials-stay-in-the-browser`,content:`The push is also limited to the rows that actually rendered \u2014 each one tagged
\`data-setting-key\` by the editor \u2014 rather than to every key in a hosted
category. A row this host hides (desktop-only card sharing, say) would
otherwise be mirrored at its default and overwrite whatever the account holds
for it.`},{heading:`flow-editor-preferences-follow-your-account-1`,content:`Signed in, the Ebb flow editor's look-and-behaviour preferences (font, default
grid zoom, theme, Aff/Neg colours, the Vim/insert-paste/append-edit/scroll-zoom/
align-speeches/tooltip toggles, the CardMirror options and your custom
keybindings) are saved to your account as \`flowEditorSettings\` and applied the
next time you open a flow on any device. Anything specific to one device \u2014 the
flows folder, collaboration name and relay toggles, contacts, and panel layout \u2014
stays in that browser. Signed out, nothing changes: settings stay in
localStorage.`},{heading:`the-welcome-dialog-shows-once-per-account`,content:'The "Welcome to Debate AI" dialog of key links appears the first time an\naccount signs in, and never again on any device. Showing it records\n`user_settings.welcome_dismissed_at` through `GET`/`POST\n/api/settings/welcome` (`FirstLoginWelcomeProvider` in `@debate/webview`,\nhelpers in `lib/first-login-welcome.ts`). A `localStorage` copy of the flag\nsaves the request on browsers that already know, and a browser that showed\nthe dialog before the flag moved to the account records it there once. If the\naccount\'s answer cannot be read (offline, an error), the dialog stays hidden\nrather than risk showing it twice. A second account signing in on a browser\nthat already showed it does not see it.'},{heading:`privacy`,content:"The **Privacy** tab (`/settings?category=privacy`) is where you decide what\nDebate AI may publish of your recordings and how you are named on them."},{heading:`privacy`,content:`**Recording release.** A few paragraphs explain what publishing means. Until
you pick **I agree**, nothing you record is published; **Don't publish my
recordings** is the default and withdraws an earlier agreement. Agreeing
records the date and the version of the wording you agreed to, and if the
wording changes you are asked again.`},{heading:`privacy`,content:`**What is published:** **Audio and video**, or **Audio only**, which leaves
your camera out.`},{heading:`privacy`,content:`**How you are credited:** **Anonymous contributor** (the default, your name
hidden), a **Username** you type in, or your **Real name**, either in full
or as first name and last initial ("Ada L."). The tab previews how you will
appear.`},{heading:`privacy`,content:"**Privacy policy:** a link to `/legal/privacy`."},{heading:`privacy`,content:`**Request deletion of your data:** ask for everything (including your
account) or only some of it (published recordings, saved speech audio,
flows, documents, comments, account settings), with a box for suggested
deletions such as links to specific recordings. Requests go to the site's
admins as a notification, and your past requests and their status are
listed under the form. Nothing is deleted automatically.`},{heading:`privacy`,content:"Engineering notes: the rules live in `@debate/webview`'s\n`lib/privacy/recording-release.ts` (`mayPublishRecording`, `includeVideo`,\n`publicCreditName`, the validators and the release text). The choices are\nstored as JSON in `user_settings.recording_privacy` through `GET`/`PUT\n/api/settings/privacy`; requests go to `GET`/`POST\n/api/settings/privacy/deletion-requests` and the `data_deletion_requests`\ntable, created on first use by `apps/debate-ai.com/lib/privacy/store.ts`,\nwhich also exports `getRecordingPrivacy(db, userId)` for any server code that\npublishes a recording."},{heading:`privacy`,content:`Known gaps: the release text is a plain-language placeholder that has not had
legal review. No feature publishes user recordings yet, so the settings take
effect as publishing features read them. There is no admin screen for the
deletion queue yet; admins see the notification and work the
\`data_deletion_requests\` table by hand.`},{heading:`known-gaps`,content:`No optimistic-concurrency handling in general \u2014 two tabs editing the *same*
field at once has the last PUT win. \`favoriteTools\` no longer has this
problem: every code path that changes it (\`toggleFavorite\`/\`removeFavorite\`'s
single add/remove op, and \`pruneUnknown\`'s batch \`removeFavoriteTools\` op)
now resolves against the account's row as it stands at write time, not a
client-computed whole-list replace, so two tabs adding, removing or pruning
different entries at once can no longer drop each other's change. A plain
whole-list \`favoriteTools\` replace is still accepted by the route for a
caller that genuinely needs one, but nothing in the app sends one anymore.
\`recentTools\` (see Command Palette's
"Recent" section) joins it as an op-based field \u2014 each tool visit sends a
single \`recordRecentTool\` op, resolved the same read-then-write way \u2014 since
it writes far more often than any picker-style field here (every tool open,
not just an explicit Save) and two tabs opening different tools in quick
succession would otherwise race the same way favorites used to.`},{heading:`known-gaps`,content:"`editorPreferences` is a plain merge of whatever the page last pushed, so it\nhas the same last-write-wins property: the editor's settings open in two\ntabs, changed in both, end at whichever debounce landed second. Every other\nfield (`debateStyle`, `colorTheme`, etc.) is a plain whole-value replace with\nno such protection \u2014 `debateStyle`/`fontSize`/`colorTheme`/`themeMode` are\nwritten from `/settings`' Preferences tab and the dock's Theme submenu, both of\nwhich apply and (when signed in) sync a single field at a time rather than a\nwhole form Save, so this mostly shows up as \"two tabs pick a different\nDebate style within the same second.\""},{heading:`known-gaps`,content:"`wordLimitPresets` (`debate-round`'s `WordLimitPresetsPanel`, rendered from\n`/word-count` rather than from this page \u2014 see \"What it no longer shows\"\nabove) is also op-based now: `addPreset`/`updatePreset`/`removePreset` each\nsend a single `addWordLimitPreset`/`updateWordLimitPreset`/\n`removeWordLimitPreset` op, resolved against the account's current list at\nwrite time instead of a client-computed whole-list replace, mirroring\n`favoriteTools`'s fix above. A duplicate name, an unknown preset, or an\ninvalid word limit is refused with a `400` rather than silently corrupting\nthe stored list. A plain whole-list `wordLimitPresets` replace is still\naccepted by the route for a caller that genuinely needs one, but\n`useWordLimitPresets.ts` no longer sends one."},{heading:`known-gaps`,content:"`outlineFilterPresets` (`debate-practice-drills`'s named Outline filter\npresets bar \u2014 see Argument Tree Outline)\nis op-based the same way: `addPreset`/`removePreset` each send a single\n`addOutlineFilterPreset`/`removeOutlineFilterPreset` op, resolved against\nthe account's current list at write time instead of a client-computed\nwhole-list replace, mirroring `wordLimitPresets`'s fix above. A duplicate\nname, an at-capacity list, or an invalid filter is refused with a `400`\nrather than silently corrupting the stored list. A plain whole-list\n`outlineFilterPresets` replace is still accepted by the route for a caller\nthat genuinely needs one, but `useOutlineFilterPresets.ts` no longer sends\none."},{heading:`pinned-debates`,content:"The debates you pin to the start screen's **Featured** section follow your\naccount. Each pin is a `{ roundId, pinnedAt }` record in the `pinnedDebates`\ncollection of the tool-record sync (`debate-data-sync`'s\n`TOOL_RECORD_COLLECTIONS`, stored in `saved_tool_records`), so it syncs like\nevery other tool store and appears under **Settings \u2192 Account \u2192 Tool data**\nas \"Pinned Debates\". A round's id is its `saved_rounds.client_id`, which a\ncloud save keeps, so the pin names the same round on every device; a pin whose\nround isn't on this device yet is skipped until the round arrives. Browsers\nthat stored pins as a bare list of ids are upgraded to records the first time\nthe list is read."},{heading:`pinned-debates`,content:`Known gap: pins are capped at 12 per browser, and the merge on sign-in is a
union, so a pin removed on one device while another is offline can reappear
until that device syncs.`},{heading:`flow-editor-shortcuts`,content:'Shortcuts you rebind in the flow editor sync to your account as the\n`flowKeymap` collection (listed in **Tool data** as "Flow Editor Shortcuts"),\none record per rebound action. They are stored under `ebb-keymap-settings` and\nadapted by `flow-keymap-codec.ts` in `debate-data-sync`.'},{heading:`flow-editor-shortcuts`,content:`Known gap: the flow editor reads shortcuts once at startup, so a rebinding made
on another device applies the next time the editor loads. Display preferences
(\`ebb-display-settings\`) are not synced: they include device-local values such
as the flows folder path.`},{heading:`save-status-on-each-tool`,content:`A tool page whose data syncs shows a small badge in its header: **Saved to your
account** once everything the tool stores has reached your account, **Saving to
your account\u2026** while recent changes are on their way, **Syncing\u2026** during the
first merge after you sign in, and **Saved on this device** when you're signed
out. It is read from the same auto-sync that powers **Tool data** (see
\`getToolRecordCollectionSyncStatus\` in \`debate-data-sync\`), so it never starts a
second sync, and it refreshes every few seconds rather than instantly.`},{heading:`save-status-on-each-tool`,content:`While changes are waiting to be saved, a **Save now** button appears next to the
badge and pushes that tool's data to your account immediately instead of waiting
for the next automatic save. If the save fails the button turns into **Retry
save** and its tooltip says why. Starring a tool as a favorite uses the star at
the end of the same header row.`},{heading:`save-status-on-each-tool`,content:"The `/debate` start screen has its own header, so it shows the same badge (and\n**Save now**) beside its **New flow** button; `DebateFlowPage` takes it as a\n`startScreenActions` prop because `debate-round` can't import the webview's\ncomponent. Once a round or flow is open, the same badge sits at the start of the\nspeech controls bar above the workspace (`roundActions`, handed to\n`SpeechControlsTopBar` as `leadingActions`)."},{heading:`save-status-on-each-tool`,content:"The shared-cards sub-pages (Evidence Library, Argument Library and Card Revision\nHistory) keep their data under the `/research/cards` hub rather than under their\nown route, so their headers name the collections explicitly\n(`ToolPageHeader`'s `syncCollections` prop, resolved by `resolveToolSyncKeys`)\nand show the badge too."},{heading:`save-status-on-each-tool`,content:"The video library at `/videos` (and each `/videos/<category>` view of it) shows the badge (and **Save now**) beside its\nsearch bar; `LecturesPage` takes it as a `headerActionsSlot` prop because\n`debate-videos` can't import the webview's component."},{heading:`save-status-on-each-tool`,content:"The `/research/cards` search workspace has no `ToolPageHeader`, so its route\nrenders a slim strip above the workspace holding the badge (and **Save now**) for\nthe Evidence Library collections."},{heading:`save-status-on-each-tool`,content:"Known gap: the open-flow tabs and the `/doc` header are custom too and don't\nshow the badge yet."}],headings:[{id:`user-settings`,content:`User Settings`},{id:`what-it-shows`,content:`What it shows`},{id:`what-it-no-longer-shows`,content:`What it no longer shows`},{id:`your-own-ai-key`,content:`Your own AI key`},{id:`flow-editor-preferences-follow-your-account`,content:`Flow editor preferences follow your account`},{id:`saved-to-account-marker-on-flow-tabs`,content:`Saved-to-account marker on flow tabs`},{id:`auto-save-for-flows-already-on-your-account`,content:`Auto-save for flows already on your account`},{id:`data-flow`,content:`Data flow`},{id:`credentials-stay-in-the-browser`,content:`Credentials stay in the browser`},{id:`flow-editor-preferences-follow-your-account-1`,content:`Flow editor preferences follow your account`},{id:`the-welcome-dialog-shows-once-per-account`,content:`The welcome dialog shows once per account`},{id:`privacy`,content:`Privacy`},{id:`known-gaps`,content:`Known gaps`},{id:`pinned-debates`,content:`Pinned debates`},{id:`flow-editor-shortcuts`,content:`Flow editor shortcuts`},{id:`save-status-on-each-tool`,content:`Save status on each tool`}]},a=[{depth:1,url:`#user-settings`,title:(0,t.jsx)(t.Fragment,{children:`User Settings`})},{depth:2,url:`#what-it-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it shows`})},{depth:2,url:`#what-it-no-longer-shows`,title:(0,t.jsx)(t.Fragment,{children:`What it no longer shows`})},{depth:2,url:`#your-own-ai-key`,title:(0,t.jsx)(t.Fragment,{children:`Your own AI key`})},{depth:2,url:`#flow-editor-preferences-follow-your-account`,title:(0,t.jsx)(t.Fragment,{children:`Flow editor preferences follow your account`})},{depth:2,url:`#saved-to-account-marker-on-flow-tabs`,title:(0,t.jsx)(t.Fragment,{children:`Saved-to-account marker on flow tabs`})},{depth:3,url:`#auto-save-for-flows-already-on-your-account`,title:(0,t.jsx)(t.Fragment,{children:`Auto-save for flows already on your account`})},{depth:2,url:`#data-flow`,title:(0,t.jsx)(t.Fragment,{children:`Data flow`})},{depth:2,url:`#credentials-stay-in-the-browser`,title:(0,t.jsx)(t.Fragment,{children:`Credentials stay in the browser`})},{depth:2,url:`#flow-editor-preferences-follow-your-account-1`,title:(0,t.jsx)(t.Fragment,{children:`Flow editor preferences follow your account`})},{depth:2,url:`#the-welcome-dialog-shows-once-per-account`,title:(0,t.jsx)(t.Fragment,{children:`The welcome dialog shows once per account`})},{depth:2,url:`#privacy`,title:(0,t.jsx)(t.Fragment,{children:`Privacy`})},{depth:2,url:`#known-gaps`,title:(0,t.jsx)(t.Fragment,{children:`Known gaps`})},{depth:2,url:`#pinned-debates`,title:(0,t.jsx)(t.Fragment,{children:`Pinned debates`})},{depth:2,url:`#flow-editor-shortcuts`,title:(0,t.jsx)(t.Fragment,{children:`Flow editor shortcuts`})},{depth:2,url:`#save-status-on-each-tool`,title:(0,t.jsx)(t.Fragment,{children:`Save status on each tool`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,h3:`h3`,li:`li`,p:`p`,pre:`pre`,span:`span`,strong:`strong`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`user-settings`,children:`User Settings`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`/settings`}),` is the CardMirror editor's settings page, and a signed-in user's
choices there follow them across devices instead of staying in one browser's
localStorage.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/settings`}),` (the panel itself renders in an isolated iframe at
`,(0,t.jsx)(n.code,{children:`/settings/editor-panel`}),`)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Research agent settings:`}),` tabs of `,(0,t.jsx)(n.code,{children:`/settings`}),` itself, listed after the
editor's under a `,(0,t.jsx)(n.strong,{children:`Research agent`}),` heading in the same sidebar \u2014 one per
section (account, language models, connectors, skills and memory, search
sources, search settings, cloud storage, rewrite modes, voice). Each is
linkable as `,(0,t.jsx)(n.code,{children:`/settings?category=research-<section>`}),`. The section list is
`,(0,t.jsx)(n.code,{children:`research-agent-ui`}),`'s own (`,(0,t.jsx)(n.code,{children:`research-agent-ui/settings`}),`); the panes load
lazily, the first time one of those tabs is opened. The old
`,(0,t.jsx)(n.code,{children:`/settings/research`}),` and `,(0,t.jsx)(n.code,{children:`/settings/research/<section>`}),` pages now redirect to
the matching tab (`,(0,t.jsx)(n.code,{children:`editor-<tab>`}),` sections to the editor's own tab).`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-editor`}),` (the settings store, `,(0,t.jsx)(n.code,{children:`SETTING_METADATA`}),`, and
the embedded panel builder), `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),`
(`,(0,t.jsx)(n.code,{children:`lib/editor-preferences.ts`}),`, `,(0,t.jsx)(n.code,{children:`/api/settings`}),`, `,(0,t.jsx)(n.code,{children:`user_settings`}),` D1 table)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-shows`,children:`What it shows`}),`
`,(0,t.jsxs)(n.p,{children:[`The editor's whole category set, listed in a searchable sidebar \u2014 `,(0,t.jsx)(n.strong,{children:`General`}),`, `,(0,t.jsx)(n.strong,{children:`Files`}),`, `,(0,t.jsx)(n.strong,{children:`Appearance`}),`,
`,(0,t.jsx)(n.strong,{children:`Accessibility`}),`, `,(0,t.jsx)(n.strong,{children:`Editing`}),`, `,(0,t.jsx)(n.strong,{children:`Keyboard`}),`, `,(0,t.jsx)(n.strong,{children:`Comments & AI`}),`,
`,(0,t.jsx)(n.strong,{children:`Collaboration`}),` \u2014 from `,(0,t.jsx)(n.code,{children:`debate-editor`}),`'s exported tab list
(`,(0,t.jsx)(n.code,{children:`CARDMIRROR_SETTINGS_TABS`}),`, `,(0,t.jsx)(n.code,{children:`@debate/editor/settings-tabs`}),`) and rendered by its
`,(0,t.jsx)(n.code,{children:`CardMirrorSettingsSection`}),` (`,(0,t.jsx)(n.code,{children:`@debate/editor/settings-section`}),`), which wraps
`,(0,t.jsx)(n.code,{children:`buildEmbeddedSettingsPanel`}),`, so each tab is the same rows the editor's
gear-icon modal renders under it, minus the dialog chrome. General also
carries the personal dictionary, the performance benchmark and this install's
version info.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The page fills the whole window with no padding around it. The sidebar runs
its full height: the `,(0,t.jsx)(n.strong,{children:`Settings`}),` title and a `,(0,t.jsx)(n.strong,{children:`Back`}),` link sit at its top, and
the site's footer links (`,(0,t.jsx)(n.strong,{children:`Docs`}),`, `,(0,t.jsx)(n.strong,{children:`Github`}),`, `,(0,t.jsx)(n.strong,{children:`Support`}),`, `,(0,t.jsx)(n.strong,{children:`Privacy`}),`,
`,(0,t.jsx)(n.strong,{children:`Reddit`}),` \u2014 the same `,(0,t.jsx)(n.code,{children:`FOOTER_LINKS`}),` list the app sidebar's footer reads) sit
at its bottom.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Appearance and Accessibility appear `,(0,t.jsx)(n.em,{children:`only`}),` here: they moved out of that modal
when they moved to this page. Everything else is a second surface onto the
same local store, so a change here shows up in the editor and the other way
round.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`EDITOR_SETTINGS_TABS`}),` (`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/editor-preferences.ts`}),`) is the
one list of which categories those are, read both by the panel route that
renders them and by the API route that validates what they save. `,(0,t.jsx)(n.code,{children:`plugins`}),` is
deliberately not among them \u2014 every row in it is Electron-only, so the tab
would render empty on the web.`]}),`
`,(0,t.jsx)(n.h2,{id:`what-it-no-longer-shows`,children:`What it no longer shows`}),`
`,(0,t.jsx)(n.p,{children:`The page used to be this app's own account form, and that whole section is
gone:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[`the Debate style / Font size / Font family / Colour theme / Light-dark
pickers (`,(0,t.jsx)(n.code,{children:`debate-round`}),`'s `,(0,t.jsx)(n.code,{children:`UserSettingsPanel`}),`) \u2014 the dock's gear-icon menu
still carries the colour theme and light/dark rows. The whole form is
back as the first tab of `,(0,t.jsx)(n.code,{children:`/settings`}),`, `,(0,t.jsx)(n.strong,{children:`Preferences`}),` (still
`,(0,t.jsx)(n.code,{children:`UserSettingsPanel`}),`), ahead of the editor's own tabs;
`,(0,t.jsx)(n.code,{children:`/settings/preferences`}),` now redirects to it`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Favorite tools`}),` \u2014 a tool is starred from its own page or the command palette (the `,(0,t.jsx)(n.code,{children:`/tools`}),` page was removed), which is also
where a renamed or removed tool now gets pruned from the saved list`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Tool data`}),` \u2014 each tool page's header now carries a small badge
(`,(0,t.jsx)(n.em,{children:`Saved to account`}),` / `,(0,t.jsx)(n.em,{children:`Syncing\u2026`}),` / `,(0,t.jsx)(n.em,{children:`Not synced \u00B7 Retry`}),` / `,(0,t.jsx)(n.em,{children:`Saved on this
browser`}),` when signed out) for tools whose data syncs; see
Tool Data Sync's Known gaps for what went
with it (the sync itself is untouched and still runs app-wide)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Word limit presets`}),` (`,(0,t.jsx)(n.code,{children:`debate-round`}),`'s `,(0,t.jsx)(n.code,{children:`WordLimitPresetsPanel`}),`) \u2014 now
editable directly on `,(0,t.jsx)(n.code,{children:`/word-count`}),`, in a collapsible "Manage word limit
presets" section below the word-count form, rather than from here`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Ebb Flow preferences`}),` \u2014 reachable with `,(0,t.jsx)(n.code,{children:`Cmd/Ctrl+,`}),` inside a flow, where
they apply`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Default format for new speech documents`}),` (Files \u2192 New documents) \u2014 a
new speech document is now always created as `,(0,t.jsx)(n.code,{children:`.cmir`}),`, CardMirror's native
format, so autosave always applies to it (autosave only writes `,(0,t.jsx)(n.code,{children:`.cmir`}),`).
Save As still exports a `,(0,t.jsx)(n.code,{children:`.docx`}),` for teammates on Verbatim. The format is
`,(0,t.jsx)(n.code,{children:`SPEECH_DOC_FORMAT`}),` in `,(0,t.jsx)(n.code,{children:`debate-editor`}),`'s `,(0,t.jsx)(n.code,{children:`src/editor/speech-filename.ts`})]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`Their `,(0,t.jsx)(n.code,{children:`/api/settings`}),` fields (`,(0,t.jsx)(n.code,{children:`debateStyle`}),`, `,(0,t.jsx)(n.code,{children:`fontSize`}),`, `,(0,t.jsx)(n.code,{children:`wordLimitPresets`}),`, \u2026)
are all still stored and served; what changed is that nothing writes them from
here any more.`]}),`
`,(0,t.jsx)(n.h2,{id:`your-own-ai-key`,children:`Your own AI key`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Preferences`}),` tab has a `,(0,t.jsx)(n.strong,{children:`Your own AI key`}),` box. Paste an
`,(0,t.jsx)(n.a,{href:`https://openrouter.ai/settings/keys`,children:`OpenRouter key`}),` (`,(0,t.jsx)(n.code,{children:`sk-or-\u2026`}),`) or an
Anthropic key (`,(0,t.jsx)(n.code,{children:`sk-ant-\u2026`}),`) and the AI features \u2014 card AI analysis, AI coach and
judge, citation and OCR fixes, every caller of `,(0,t.jsx)(n.code,{children:`/api/reason-ai`}),` and
`,(0,t.jsx)(n.code,{children:`/api/card-ai-analysis`}),` \u2014 run on your key instead of Debate AI's shared one.
You set your own spending limit on that key with OpenRouter (or Anthropic), and
Debate AI's daily AI request and card-analysis limits stop applying to you.`]}),`
`,(0,t.jsx)(n.p,{children:`The same box appears:`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`in the pricing dialog when you hit a daily AI limit, as an alternative to
upgrading, and`}),`
`,(0,t.jsxs)(n.li,{children:[`in an `,(0,t.jsx)(n.strong,{children:`AI limit reached`}),` dialog when Debate AI's shared key itself has run
out of credit or hit its spending cap (the route answers `,(0,t.jsx)(n.code,{children:`503`}),` with an
`,(0,t.jsx)(n.code,{children:`x-ai-key-needed`}),` header). That dialog is an upgrade box: it offers the plan
cards to upgrade your account first, with bringing your own key as the other
option. If the plans can't be loaded, only the key option shows.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`The key is kept in this browser's `,(0,t.jsx)(n.code,{children:`localStorage`}),` only \u2014 never in your account's
settings row \u2014 and is sent, as the `,(0,t.jsx)(n.code,{children:`x-user-ai-key`}),` header, only on same-origin
requests to the two AI routes. The server uses it for that one request and
never stores or logs it. Remove it to go back to the shared key.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Packages:`}),` `,(0,t.jsx)(n.code,{children:`debate-webview`}),` (`,(0,t.jsx)(n.code,{children:`lib/ai/own-ai-key.ts`}),`,
`,(0,t.jsx)(n.code,{children:`components/settings/OwnAiKeySection.tsx`}),`,
`,(0,t.jsx)(n.code,{children:`components/pricing/OwnAiKeyDialog.tsx`}),`), `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com`}),`
(`,(0,t.jsx)(n.code,{children:`lib/ai/provider-key.ts`}),`)`]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`flow-editor-preferences-follow-your-account`,children:`Flow editor preferences follow your account`}),`
`,(0,t.jsxs)(n.p,{children:[`The Ebb flow editor's display preferences (`,(0,t.jsx)(n.code,{children:`Cmd/Ctrl+,`}),`) and keybinding
overrides sync to your account when you are signed in, through the same tool
data sync as the other tools (`,(0,t.jsx)(n.code,{children:`flowEditorDisplaySettings`}),` and
`,(0,t.jsx)(n.code,{children:`flowKeymap`}),` in `,(0,t.jsx)(n.code,{children:`debate-data-sync`}),`'s catalog). What follows you:
flow font, default grid zoom, the editing toggles (insert-paste, append-edit,
scroll-zoom, align speeches, tooltips, Vim in the RFD pane), CardMirror
options, light/dark theme, side colours, and every keymap override.`]}),`
`,(0,t.jsxs)(n.p,{children:[`What stays on the device it was set on: the flows folder, whether the sidebar
and RFD pane are open, and the live-collaboration switches, display name and
contacts. A pull from the account never resets those. Engineering notes:
`,(0,t.jsx)(n.code,{children:`debate-data-sync`}),`'s `,(0,t.jsx)(n.code,{children:`state/flow-editor-settings-codec.ts`}),` \u2014 a field joins the
account only by being added to `,(0,t.jsx)(n.code,{children:`SYNCED_FLOW_DISPLAY_FIELDS`}),`.`]}),`
`,(0,t.jsx)(n.h2,{id:`saved-to-account-marker-on-flow-tabs`,children:`Saved-to-account marker on flow tabs`}),`
`,(0,t.jsxs)(n.p,{children:[`Each flow tab in the sidebar's `,(0,t.jsx)(n.strong,{children:`Open Tabs`}),` group shows a small cloud icon
once that flow has been saved to your account from the Flow History dialog
(including bulk saves): a plain cloud means the account copy matches what you
see, a crossed-out amber cloud means you've edited it since. A tab with no icon
has no baseline yet. The marker survives a reload: each save remembers the
version the account stamped on it, and opening the `,(0,t.jsx)(n.code,{children:`/debate`}),` start screen or a
round's flow tabs (or the `,(0,t.jsx)(n.strong,{children:`Saved to account`}),` tab in Flow History) re-adopts
that baseline only if your account still holds exactly that version, so edits made elsewhere (or by a different account on the same
browser) never show as saved. Engineering notes: `,(0,t.jsx)(n.code,{children:`debate-round`}),`'s
`,(0,t.jsx)(n.code,{children:`state/flowAccountStatus.ts`}),`; the on-mount restore is `,(0,t.jsx)(n.code,{children:`state/restoreAccountBaselines.ts`}),`
(one fetch per page session, silent when signed out).`]}),`
`,(0,t.jsxs)(n.p,{children:[`The same cloud icon appears on the round cards of the `,(0,t.jsx)(n.code,{children:`/debate`}),` start screen
(Featured and Recent) once the round itself has been saved to your account from
the Flow History dialog, and flips to the amber crossed-out cloud when the round
is edited afterwards. Saving a round's flows does not by itself mark the round.`]}),`
`,(0,t.jsx)(n.h3,{id:`auto-save-for-flows-already-on-your-account`,children:`Auto-save for flows already on your account`}),`
`,(0,t.jsxs)(n.p,{children:[`Once a flow has been saved to your account, further edits to it are saved
automatically about five seconds after you stop typing, and the tab's cloud
icon flips back to saved. Flows you have never saved are never uploaded
automatically, and archived flows are skipped. Auto-save never overwrites: if
the account holds a newer copy (saved from another device) the flow stays
amber and you resolve it from Flow History. A failed save is retried only after
the flow changes again. Turn it off with `,(0,t.jsx)(n.strong,{children:`Auto-save flows to my account`}),` on the
`,(0,t.jsx)(n.strong,{children:`Preferences`}),` tab; it is on by default, applies immediately, and is stored in
this browser only (not synced to other devices). Turning it off discards any
save still waiting on the timer. Engineering notes: `,(0,t.jsx)(n.code,{children:`debate-round`}),`'s
`,(0,t.jsx)(n.code,{children:`state/flowAutoSave.ts`}),`, mounted by `,(0,t.jsx)(n.code,{children:`useFlowAutoSave`}),` in `,(0,t.jsx)(n.code,{children:`OpenTabsGroup`}),`; the
preference lives in `,(0,t.jsx)(n.code,{children:`state/flowAutoSavePreference.ts`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Choose how far auto-save goes under `,(0,t.jsx)(n.strong,{children:`Flow auto-save`}),` in Settings \u2192 Preferences:`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Flows already on my account`}),` (default) \u2014 the behavior above.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`All flows`}),` \u2014 also uploads flows you have never saved. If your account
already holds a flow with that id, it is treated as a conflict and left alone.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Off`}),` \u2014 nothing is saved automatically; use Save now or Flow History.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`The choice applies immediately in this browser. When you are signed in it is
also saved to your account (`,(0,t.jsx)(n.code,{children:`PUT /api/settings { flowAutoSave }`}),`, the
`,(0,t.jsx)(n.code,{children:`user_settings.flow_auto_save`}),` column) and adopted on your other devices the
next time Settings loads. Engineering notes:
`,(0,t.jsx)(n.code,{children:`state/flowAutoSaveSettings.ts`}),` (`,(0,t.jsx)(n.code,{children:`debate:flow-auto-save`}),` in `,(0,t.jsx)(n.code,{children:`localStorage`}),`,
`,(0,t.jsx)(n.code,{children:`normalizeFlowAutoSavePatch`}),`/`,(0,t.jsx)(n.code,{children:`parseFlowAutoSave`}),` for the route), read at each
run by `,(0,t.jsx)(n.code,{children:`createFlowAutoSaver`}),`'s `,(0,t.jsx)(n.code,{children:`getMode`}),`. Deploy must add the new nullable
column (`,(0,t.jsx)(n.code,{children:`schema.ts`}),` is the only source of truth).`]}),`
`,(0,t.jsx)(n.h2,{id:`data-flow`,children:`Data flow`}),`
`,(0,t.jsx)(t.Fragment,{children:(0,t.jsx)(n.pre,{className:`shiki shiki-themes github-light github-dark`,style:{"--shiki-light":`#24292e`,"--shiki-dark":`#e1e4e8`,"--shiki-light-bg":`#fff`,"--shiki-dark-bg":`#24292e`},tabIndex:`0`,icon:`<svg viewBox="0 0 24 24"><path d="M 6,1 C 4.354992,1 3,2.354992 3,4 v 16 c 0,1.645008 1.354992,3 3,3 h 12 c 1.645008,0 3,-1.354992 3,-3 V 8 7 A 1.0001,1.0001 0 0 0 20.707031,6.2929687 l -5,-5 A 1.0001,1.0001 0 0 0 15,1 h -1 z m 0,2 h 7 v 3 c 0,1.645008 1.354992,3 3,3 h 3 v 11 c 0,0.564129 -0.435871,1 -1,1 H 6 C 5.4358712,21 5,20.564129 5,20 V 4 C 5,3.4358712 5.4358712,3 6,3 Z M 15,3.4140625 18.585937,7 H 16 C 15.435871,7 15,6.5641288 15,6 Z" fill="currentColor" /></svg>`,children:(0,t.jsxs)(n.code,{children:[(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`debate-editor/settings.ts (the store, SETTING_METADATA, SECRET_SETTING_KEYS)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`debate-editor/settings-ui.ts (buildEmbeddedSettingsPanel)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`app/settings/editor-panel/page.tsx (iframe document: category sidebar, hydrate, debounced push)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`  \u2192 GET/PUT /api/settings { editorPreferences }`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`lib/editor-preferences.ts (EDITOR_SETTINGS_TABS, EDITOR_PREFERENCE_KEYS, validation)`})}),`
`,(0,t.jsx)(n.span,{className:`line`,children:(0,t.jsx)(n.span,{children:`components/settings/CardMirrorSettingsPanel.tsx (the iframe wrapper, self-sizing)`})})]})})}),`
`,(0,t.jsxs)(n.p,{children:[`The local store stays authoritative: the page hydrates from the account on
load (a `,(0,t.jsx)(n.code,{children:`401`}),` just means signed out), and every change writes localStorage
immediately and mirrors to the account on a 600ms debounce. A failed mirror
never undoes the local change.`]}),`
`,(0,t.jsx)(n.h2,{id:`credentials-stay-in-the-browser`,children:`Credentials stay in the browser`}),`
`,(0,t.jsxs)(n.p,{children:[`The mirrored keys are the hosted categories' settings `,(0,t.jsx)(n.strong,{children:`minus`}),` the
credentials among them \u2014 the provider API keys and the translation key that
`,(0,t.jsx)(n.code,{children:`debate-editor`}),`'s `,(0,t.jsx)(n.code,{children:`SECRET_SETTING_KEYS`}),` already keeps out of a settings
export, plus the self-hosted relay's bearer token. `,(0,t.jsx)(n.code,{children:`EDITOR_PREFERENCE_KEYS`}),`
excludes them, so they are refused on the way in (reported as unknown keys,
not silently dropped) and filtered on the way back out of a stored row.
`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/__tests__/editor-preferences.test.ts`}),` pins that.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The push is also limited to the rows that actually rendered \u2014 each one tagged
`,(0,t.jsx)(n.code,{children:`data-setting-key`}),` by the editor \u2014 rather than to every key in a hosted
category. A row this host hides (desktop-only card sharing, say) would
otherwise be mirrored at its default and overwrite whatever the account holds
for it.`]}),`
`,(0,t.jsx)(n.h2,{id:`flow-editor-preferences-follow-your-account-1`,children:`Flow editor preferences follow your account`}),`
`,(0,t.jsxs)(n.p,{children:[`Signed in, the Ebb flow editor's look-and-behaviour preferences (font, default
grid zoom, theme, Aff/Neg colours, the Vim/insert-paste/append-edit/scroll-zoom/
align-speeches/tooltip toggles, the CardMirror options and your custom
keybindings) are saved to your account as `,(0,t.jsx)(n.code,{children:`flowEditorSettings`}),` and applied the
next time you open a flow on any device. Anything specific to one device \u2014 the
flows folder, collaboration name and relay toggles, contacts, and panel layout \u2014
stays in that browser. Signed out, nothing changes: settings stay in
localStorage.`]}),`
`,(0,t.jsx)(n.h2,{id:`the-welcome-dialog-shows-once-per-account`,children:`The welcome dialog shows once per account`}),`
`,(0,t.jsxs)(n.p,{children:[`The "Welcome to Debate AI" dialog of key links appears the first time an
account signs in, and never again on any device. Showing it records
`,(0,t.jsx)(n.code,{children:`user_settings.welcome_dismissed_at`}),` through `,(0,t.jsx)(n.code,{children:`GET`}),`/`,(0,t.jsx)(n.code,{children:`POST /api/settings/welcome`}),` (`,(0,t.jsx)(n.code,{children:`FirstLoginWelcomeProvider`}),` in `,(0,t.jsx)(n.code,{children:`@debate/webview`}),`,
helpers in `,(0,t.jsx)(n.code,{children:`lib/first-login-welcome.ts`}),`). A `,(0,t.jsx)(n.code,{children:`localStorage`}),` copy of the flag
saves the request on browsers that already know, and a browser that showed
the dialog before the flag moved to the account records it there once. If the
account's answer cannot be read (offline, an error), the dialog stays hidden
rather than risk showing it twice. A second account signing in on a browser
that already showed it does not see it.`]}),`
`,(0,t.jsx)(n.h2,{id:`privacy`,children:`Privacy`}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.strong,{children:`Privacy`}),` tab (`,(0,t.jsx)(n.code,{children:`/settings?category=privacy`}),`) is where you decide what
Debate AI may publish of your recordings and how you are named on them.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Recording release.`}),` A few paragraphs explain what publishing means. Until
you pick `,(0,t.jsx)(n.strong,{children:`I agree`}),`, nothing you record is published; `,(0,t.jsx)(n.strong,{children:`Don't publish my
recordings`}),` is the default and withdraws an earlier agreement. Agreeing
records the date and the version of the wording you agreed to, and if the
wording changes you are asked again.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`What is published:`}),` `,(0,t.jsx)(n.strong,{children:`Audio and video`}),`, or `,(0,t.jsx)(n.strong,{children:`Audio only`}),`, which leaves
your camera out.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`How you are credited:`}),` `,(0,t.jsx)(n.strong,{children:`Anonymous contributor`}),` (the default, your name
hidden), a `,(0,t.jsx)(n.strong,{children:`Username`}),` you type in, or your `,(0,t.jsx)(n.strong,{children:`Real name`}),`, either in full
or as first name and last initial ("Ada L."). The tab previews how you will
appear.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Privacy policy:`}),` a link to `,(0,t.jsx)(n.code,{children:`/legal/privacy`}),`.`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Request deletion of your data:`}),` ask for everything (including your
account) or only some of it (published recordings, saved speech audio,
flows, documents, comments, account settings), with a box for suggested
deletions such as links to specific recordings. Requests go to the site's
admins as a notification, and your past requests and their status are
listed under the form. Nothing is deleted automatically.`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`Engineering notes: the rules live in `,(0,t.jsx)(n.code,{children:`@debate/webview`}),`'s
`,(0,t.jsx)(n.code,{children:`lib/privacy/recording-release.ts`}),` (`,(0,t.jsx)(n.code,{children:`mayPublishRecording`}),`, `,(0,t.jsx)(n.code,{children:`includeVideo`}),`,
`,(0,t.jsx)(n.code,{children:`publicCreditName`}),`, the validators and the release text). The choices are
stored as JSON in `,(0,t.jsx)(n.code,{children:`user_settings.recording_privacy`}),` through `,(0,t.jsx)(n.code,{children:`GET`}),`/`,(0,t.jsx)(n.code,{children:`PUT /api/settings/privacy`}),`; requests go to `,(0,t.jsx)(n.code,{children:`GET`}),`/`,(0,t.jsx)(n.code,{children:`POST /api/settings/privacy/deletion-requests`}),` and the `,(0,t.jsx)(n.code,{children:`data_deletion_requests`}),`
table, created on first use by `,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/privacy/store.ts`}),`,
which also exports `,(0,t.jsx)(n.code,{children:`getRecordingPrivacy(db, userId)`}),` for any server code that
publishes a recording.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Known gaps: the release text is a plain-language placeholder that has not had
legal review. No feature publishes user recordings yet, so the settings take
effect as publishing features read them. There is no admin screen for the
deletion queue yet; admins see the notification and work the
`,(0,t.jsx)(n.code,{children:`data_deletion_requests`}),` table by hand.`]}),`
`,(0,t.jsx)(n.h2,{id:`known-gaps`,children:`Known gaps`}),`
`,(0,t.jsxs)(n.p,{children:[`No optimistic-concurrency handling in general \u2014 two tabs editing the `,(0,t.jsx)(n.em,{children:`same`}),`
field at once has the last PUT win. `,(0,t.jsx)(n.code,{children:`favoriteTools`}),` no longer has this
problem: every code path that changes it (`,(0,t.jsx)(n.code,{children:`toggleFavorite`}),`/`,(0,t.jsx)(n.code,{children:`removeFavorite`}),`'s
single add/remove op, and `,(0,t.jsx)(n.code,{children:`pruneUnknown`}),`'s batch `,(0,t.jsx)(n.code,{children:`removeFavoriteTools`}),` op)
now resolves against the account's row as it stands at write time, not a
client-computed whole-list replace, so two tabs adding, removing or pruning
different entries at once can no longer drop each other's change. A plain
whole-list `,(0,t.jsx)(n.code,{children:`favoriteTools`}),` replace is still accepted by the route for a
caller that genuinely needs one, but nothing in the app sends one anymore.
`,(0,t.jsx)(n.code,{children:`recentTools`}),` (see Command Palette's
"Recent" section) joins it as an op-based field \u2014 each tool visit sends a
single `,(0,t.jsx)(n.code,{children:`recordRecentTool`}),` op, resolved the same read-then-write way \u2014 since
it writes far more often than any picker-style field here (every tool open,
not just an explicit Save) and two tabs opening different tools in quick
succession would otherwise race the same way favorites used to.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`editorPreferences`}),` is a plain merge of whatever the page last pushed, so it
has the same last-write-wins property: the editor's settings open in two
tabs, changed in both, end at whichever debounce landed second. Every other
field (`,(0,t.jsx)(n.code,{children:`debateStyle`}),`, `,(0,t.jsx)(n.code,{children:`colorTheme`}),`, etc.) is a plain whole-value replace with
no such protection \u2014 `,(0,t.jsx)(n.code,{children:`debateStyle`}),`/`,(0,t.jsx)(n.code,{children:`fontSize`}),`/`,(0,t.jsx)(n.code,{children:`colorTheme`}),`/`,(0,t.jsx)(n.code,{children:`themeMode`}),` are
written from `,(0,t.jsx)(n.code,{children:`/settings`}),`' Preferences tab and the dock's Theme submenu, both of
which apply and (when signed in) sync a single field at a time rather than a
whole form Save, so this mostly shows up as "two tabs pick a different
Debate style within the same second."`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`wordLimitPresets`}),` (`,(0,t.jsx)(n.code,{children:`debate-round`}),`'s `,(0,t.jsx)(n.code,{children:`WordLimitPresetsPanel`}),`, rendered from
`,(0,t.jsx)(n.code,{children:`/word-count`}),` rather than from this page \u2014 see "What it no longer shows"
above) is also op-based now: `,(0,t.jsx)(n.code,{children:`addPreset`}),`/`,(0,t.jsx)(n.code,{children:`updatePreset`}),`/`,(0,t.jsx)(n.code,{children:`removePreset`}),` each
send a single `,(0,t.jsx)(n.code,{children:`addWordLimitPreset`}),`/`,(0,t.jsx)(n.code,{children:`updateWordLimitPreset`}),`/
`,(0,t.jsx)(n.code,{children:`removeWordLimitPreset`}),` op, resolved against the account's current list at
write time instead of a client-computed whole-list replace, mirroring
`,(0,t.jsx)(n.code,{children:`favoriteTools`}),`'s fix above. A duplicate name, an unknown preset, or an
invalid word limit is refused with a `,(0,t.jsx)(n.code,{children:`400`}),` rather than silently corrupting
the stored list. A plain whole-list `,(0,t.jsx)(n.code,{children:`wordLimitPresets`}),` replace is still
accepted by the route for a caller that genuinely needs one, but
`,(0,t.jsx)(n.code,{children:`useWordLimitPresets.ts`}),` no longer sends one.`]}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`outlineFilterPresets`}),` (`,(0,t.jsx)(n.code,{children:`debate-practice-drills`}),`'s named Outline filter
presets bar \u2014 see Argument Tree Outline)
is op-based the same way: `,(0,t.jsx)(n.code,{children:`addPreset`}),`/`,(0,t.jsx)(n.code,{children:`removePreset`}),` each send a single
`,(0,t.jsx)(n.code,{children:`addOutlineFilterPreset`}),`/`,(0,t.jsx)(n.code,{children:`removeOutlineFilterPreset`}),` op, resolved against
the account's current list at write time instead of a client-computed
whole-list replace, mirroring `,(0,t.jsx)(n.code,{children:`wordLimitPresets`}),`'s fix above. A duplicate
name, an at-capacity list, or an invalid filter is refused with a `,(0,t.jsx)(n.code,{children:`400`}),`
rather than silently corrupting the stored list. A plain whole-list
`,(0,t.jsx)(n.code,{children:`outlineFilterPresets`}),` replace is still accepted by the route for a caller
that genuinely needs one, but `,(0,t.jsx)(n.code,{children:`useOutlineFilterPresets.ts`}),` no longer sends
one.`]}),`
`,(0,t.jsx)(n.h2,{id:`pinned-debates`,children:`Pinned debates`}),`
`,(0,t.jsxs)(n.p,{children:[`The debates you pin to the start screen's `,(0,t.jsx)(n.strong,{children:`Featured`}),` section follow your
account. Each pin is a `,(0,t.jsx)(n.code,{children:`{ roundId, pinnedAt }`}),` record in the `,(0,t.jsx)(n.code,{children:`pinnedDebates`}),`
collection of the tool-record sync (`,(0,t.jsx)(n.code,{children:`debate-data-sync`}),`'s
`,(0,t.jsx)(n.code,{children:`TOOL_RECORD_COLLECTIONS`}),`, stored in `,(0,t.jsx)(n.code,{children:`saved_tool_records`}),`), so it syncs like
every other tool store and appears under `,(0,t.jsx)(n.strong,{children:`Settings \u2192 Account \u2192 Tool data`}),`
as "Pinned Debates". A round's id is its `,(0,t.jsx)(n.code,{children:`saved_rounds.client_id`}),`, which a
cloud save keeps, so the pin names the same round on every device; a pin whose
round isn't on this device yet is skipped until the round arrives. Browsers
that stored pins as a bare list of ids are upgraded to records the first time
the list is read.`]}),`
`,(0,t.jsx)(n.p,{children:`Known gap: pins are capped at 12 per browser, and the merge on sign-in is a
union, so a pin removed on one device while another is offline can reappear
until that device syncs.`}),`
`,(0,t.jsx)(n.h2,{id:`flow-editor-shortcuts`,children:`Flow editor shortcuts`}),`
`,(0,t.jsxs)(n.p,{children:[`Shortcuts you rebind in the flow editor sync to your account as the
`,(0,t.jsx)(n.code,{children:`flowKeymap`}),` collection (listed in `,(0,t.jsx)(n.strong,{children:`Tool data`}),` as "Flow Editor Shortcuts"),
one record per rebound action. They are stored under `,(0,t.jsx)(n.code,{children:`ebb-keymap-settings`}),` and
adapted by `,(0,t.jsx)(n.code,{children:`flow-keymap-codec.ts`}),` in `,(0,t.jsx)(n.code,{children:`debate-data-sync`}),`.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Known gap: the flow editor reads shortcuts once at startup, so a rebinding made
on another device applies the next time the editor loads. Display preferences
(`,(0,t.jsx)(n.code,{children:`ebb-display-settings`}),`) are not synced: they include device-local values such
as the flows folder path.`]}),`
`,(0,t.jsx)(n.h2,{id:`save-status-on-each-tool`,children:`Save status on each tool`}),`
`,(0,t.jsxs)(n.p,{children:[`A tool page whose data syncs shows a small badge in its header: `,(0,t.jsx)(n.strong,{children:`Saved to your
account`}),` once everything the tool stores has reached your account, `,(0,t.jsx)(n.strong,{children:`Saving to
your account\u2026`}),` while recent changes are on their way, `,(0,t.jsx)(n.strong,{children:`Syncing\u2026`}),` during the
first merge after you sign in, and `,(0,t.jsx)(n.strong,{children:`Saved on this device`}),` when you're signed
out. It is read from the same auto-sync that powers `,(0,t.jsx)(n.strong,{children:`Tool data`}),` (see
`,(0,t.jsx)(n.code,{children:`getToolRecordCollectionSyncStatus`}),` in `,(0,t.jsx)(n.code,{children:`debate-data-sync`}),`), so it never starts a
second sync, and it refreshes every few seconds rather than instantly.`]}),`
`,(0,t.jsxs)(n.p,{children:[`While changes are waiting to be saved, a `,(0,t.jsx)(n.strong,{children:`Save now`}),` button appears next to the
badge and pushes that tool's data to your account immediately instead of waiting
for the next automatic save. If the save fails the button turns into `,(0,t.jsx)(n.strong,{children:`Retry
save`}),` and its tooltip says why. Starring a tool as a favorite uses the star at
the end of the same header row.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.code,{children:`/debate`}),` start screen has its own header, so it shows the same badge (and
`,(0,t.jsx)(n.strong,{children:`Save now`}),`) beside its `,(0,t.jsx)(n.strong,{children:`New flow`}),` button; `,(0,t.jsx)(n.code,{children:`DebateFlowPage`}),` takes it as a
`,(0,t.jsx)(n.code,{children:`startScreenActions`}),` prop because `,(0,t.jsx)(n.code,{children:`debate-round`}),` can't import the webview's
component. Once a round or flow is open, the same badge sits at the start of the
speech controls bar above the workspace (`,(0,t.jsx)(n.code,{children:`roundActions`}),`, handed to
`,(0,t.jsx)(n.code,{children:`SpeechControlsTopBar`}),` as `,(0,t.jsx)(n.code,{children:`leadingActions`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`The shared-cards sub-pages (Evidence Library, Argument Library and Card Revision
History) keep their data under the `,(0,t.jsx)(n.code,{children:`/research/cards`}),` hub rather than under their
own route, so their headers name the collections explicitly
(`,(0,t.jsx)(n.code,{children:`ToolPageHeader`}),`'s `,(0,t.jsx)(n.code,{children:`syncCollections`}),` prop, resolved by `,(0,t.jsx)(n.code,{children:`resolveToolSyncKeys`}),`)
and show the badge too.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The video library at `,(0,t.jsx)(n.code,{children:`/videos`}),` (and each `,(0,t.jsx)(n.code,{children:`/videos/<category>`}),` view of it) shows the badge (and `,(0,t.jsx)(n.strong,{children:`Save now`}),`) beside its
search bar; `,(0,t.jsx)(n.code,{children:`LecturesPage`}),` takes it as a `,(0,t.jsx)(n.code,{children:`headerActionsSlot`}),` prop because
`,(0,t.jsx)(n.code,{children:`debate-videos`}),` can't import the webview's component.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The `,(0,t.jsx)(n.code,{children:`/research/cards`}),` search workspace has no `,(0,t.jsx)(n.code,{children:`ToolPageHeader`}),`, so its route
renders a slim strip above the workspace holding the badge (and `,(0,t.jsx)(n.strong,{children:`Save now`}),`) for
the Evidence Library collections.`]}),`
`,(0,t.jsxs)(n.p,{children:[`Known gap: the open-flow tabs and the `,(0,t.jsx)(n.code,{children:`/doc`}),` header are custom too and don't
show the badge yet.`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};