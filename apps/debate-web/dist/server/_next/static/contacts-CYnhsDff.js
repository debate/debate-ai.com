import{t as e}from"./framework~index~page~page~page~page~page~page~page~page~page~layout~layout~page~page~page~p~smt8a5un-DUd-kn8W.js";var t=e(),n={title:`Contacts & Shared Cards`},r=`# Contacts & Shared Cards [#contacts--shared-cards]

The account-linked half of the CardMirror editor's real-time collaboration.
The engine's co-editing sessions (Loro CRDT, share codes, invite links,
version recovery \u2014 \`packages/debate-editor/src/editor/collab/\`) used to reach
a partner only over the clipboard: start a session, copy the
\`cmshare\u2026\` code or \`#join=\u2026\` link, paste it somewhere. Contacts key that to
**better-auth user ids** instead: a signed-in user has a contacts list, can
share the document they're editing straight to a contact's account, and the
shared card shows up as **available** on that account on every device they
sign in on.

- **Route:** \`/contacts\` (tabs: Contacts, Shared cards; \`?tab=shared\` lands
  on the second)
- **Nav:** the dock's Settings menu ("Contacts", with a count of pending
  requests); the Tools page's Prep & Practice group; the Reason Editor
  sidebar's Documents row (the share glyph beside Upload) and \`t contacts\`
  in Ctrl/Cmd-K's search palette
- **Package:** \`debate-team-collaboration\`
  (\`lib/contacts.ts\` rules, \`state/contacts.ts\` + \`state/cardShares.ts\`
  clients, \`useContacts\` / \`useCardShares\` hooks, \`ContactsPanel\` /
  \`SharedCardsPanel\`); the engine bridge is
  [\`debate-editor/collab-bridge\`](https://github.com/debate/debate-ai.com/blob/master/packages/debate-editor/overlay/react/collab-bridge.ts)

## Contacts list [#contacts-list]

A typical friends list, all of it server-side and per account:

| Action | What happens |
| --- | --- |
| Add by name/email search (\`/api/users/search\`) or by typing an email | A **pending** request. If that person already sent *you* one, it's accepted on the spot. |
| Accept / Decline (incoming) | Accept flips the pair to **accepted**; decline deletes it. |
| Cancel (outgoing) / Remove (accepted) | Deletes the row; either side can remove an accepted contact. |
| Block | Unilateral. Deletes any contact row *and revokes every shared card* between the two accounts, both directions. Blocked users can't send you requests or shares; their attempts get the same generic refusal as any other, so blocking is invisible to them. |
| Unblock | Lifts the block. Nothing severed by it is restored. |

Contacts show an **online / away** dot. There's no push channel in this repo,
so presence is a heartbeat: the contacts poll (\`GET /api/contacts\`, every
30 s while a tab is visible \u2014 run from the dock on every page, not just
\`/contacts\`, and shared by every mounted copy so a page sends one request per
tick) bumps the caller's \`user_presence\` row, and a contact is online
while their last poll is inside \`PRESENCE_ONLINE_WINDOW_MS\` (2 min).

Requests and accepts write ordinary account notifications (\`contact_request\`,
\`contact_accepted\`; see [Notifications](https://github.com/debate/debate-ai.com/blob/master/apps/debate-ai.com/app/api/notifications/route.ts)).

## Organizations [#organizations]

An **organization** is a shared group, like a team or a school squad
(better-auth's \`organization\` plugin, registered in
\`apps/debate-ai.com/lib/auth/index.ts\`). The sidebar's account menu has an
**Organizations** submenu: **Personal**, every organization you belong to,
**Members of \u2026** for the active one, and **New organization**. Creating one
makes you its owner and switches to it.

The organization you pick is stored on your session
(\`session.active_organization_id\`), and it changes what this page shows:

| | Personal | An organization |
| --- | --- | --- |
| Contacts list | Your accepted contacts | The organization's other members (minus blocks either way); Remove is hidden, since membership is not a contact row |
| Shared cards | Every live share | Only shares with its members |
| Who you can share with | Accepted contacts | Accepted contacts and its members |

Members are added by an owner or admin from **their own contacts** (Members of
\u2026 \u2192 Add), so nobody lands in a group without a contact who trusts them; there
are no invitation emails. An id on the session is only honoured after the
caller is confirmed to be a member (\`lib/organizations/server.ts\`), so a stale
or forged id falls back to Personal.

## Sharing a card [#sharing-a-card]

In the Reason Editor, **Share with contacts** opens a picker of your contacts
plus an optional note. It is the share glyph in the sidebar's Documents row,
beside New file / New folder / Upload \u2014 sharing is something done to the open
file, so it sits with that file's other actions rather than in a header strip
of its own. Shown only when you are signed in and a document is open, and only
on the editor route: sharing starts a live co-editing session through the
CardMirror engine, which that page is what mounts. On Share:

1. If the open document has no live session, the engine's own Start
   Collaboration Session flow runs (same confirm dialog); the 'Enable
   collaboration' master toggle is switched on if it was off, since sharing
   *is* the opt-in.
2. The session's share code and relay guest pass \u2014 exactly what the editor's
   Copy Invite Link would put on the clipboard \u2014 are posted to
   \`POST /api/card-shares\` for each picked contact.
3. Each recipient gets a \`card_shared\` notification linking to
   \`/contacts?tab=shared\`, and the card appears there marked **Available**
   (and **New** until first opened).

Shares only ever reach **accepted contacts** with no block in either
direction; anyone else in the picked list is reported back as skipped.
Re-sharing the same room to the same contact refreshes the row (new code/
pass, un-revoked, re-notified) rather than duplicating it \u2014 rows are unique
on \`(room_id, recipient_id)\`. The owner can **Stop sharing** (revoke) from
the Shared cards tab; the recipient can **Dismiss** their copy.

The Shared cards tab also has a paste box: a \`cmshare\u2026\` code or a full
invite link copied from the editor can be shared to contacts from there, for
hosts who started the session the old way.

### On the trust model [#on-the-trust-model]

The share code carries the room's end-to-end encryption key, which the
collab relay itself never sees. Storing it in this app's database is a
deliberate trade: a share that follows a *person* across devices has to
live somewhere their account can read it, and the only alternative \u2014 the
desktop pairing mailbox \u2014 seals to a per-browser key, not to an account.
The database already holds the full content of every Reason Editor document,
so the key adds no new class of exposure.

## Opening a shared card [#opening-a-shared-card]

**Open** on a received share navigates to \`/reason-editor?share=<id>\`. The
editor page's \`SharedCardOpener\` then:

1. creates a **fresh document** to hold the joined copy \u2014 the engine binds
   a session to whichever document is focused and the page autosaves it,
   so joining into the document that was open would overwrite it with the
   room's content;
2. waits for the engine to boot, then joins with the code + guest pass
   through the same flow as pasting an invite link (the user confirms);
3. marks the share opened.

A share that arrives while the editor is open toasts with its own Open
action. Co-editing is a desktop-layout feature: on the mobile shell the
engine's collab gate is closed and the open is refused with a message.

## Presence name [#presence-name]

The engine's partner cursor shows \`pairingDisplayName\`, defaulting to a
random "Guest NNN" on the web. The opener seeds it from the signed-in
account's name once, and never overwrites a name the user typed into the
editor's settings.

## Data [#data]

\`apps/debate-ai.com/lib/database/schema.ts\`, migration
\`drizzle/0034_contacts_and_card_shares.sql\`:

| Table | Row |
| --- | --- |
| \`contacts\` | One per unordered pair: \`requester_id\`, \`addressee_id\`, \`status\` (\`pending\` / \`accepted\`). Unique on the directed pair; the route checks both directions before inserting. |
| \`user_blocks\` | One per \`(blocker_id, blocked_id)\`. |
| \`card_shares\` | One per \`(room_id, recipient_id)\`: \`owner_id\`, \`share_code\`, \`guest_pass\`, \`title\`, \`message\`, \`opened_at\`, \`revoked_at\`. |
| \`user_presence\` | \`user_id\` \u2192 \`last_seen_at\`. |

All four cascade-delete with the account. Until the migration has run
against an environment, the list endpoints degrade to empty (same "no such
table" handling as \`/api/notifications\`).

The organization plugin adds \`organization\`, \`member\` and \`invitation\`, and
\`session.active_organization_id\`. The app ships no migrations, and better-auth
names that session column in every sign-in insert, so \`getAuth()\` creates them
idempotently before it builds the auth instance
(\`lib/organizations/ensure-tables.ts\`, whose \`ORGANIZATION_DDL\` an operator
can also run with \`wrangler d1 execute\`).

## API [#api]

| Endpoint | Body / query | Notes |
| --- | --- | --- |
| \`GET /api/contacts\` | \u2014 | \`{ organization, contacts, incoming, outgoing, blocked }\`; bumps presence. With an active organization, \`contacts\` is its members and \`organization\` is \`{ id, name, role }\`. |
| \`POST /api/contacts\` | \`{ userId }\` \\| \`{ email }\` | \`{ status: "requested" \\| "accepted" \\| "already-requested" \\| "already-contacts" }\` |
| \`PATCH /api/contacts\` | \`{ id, action: "accept" \\| "decline" }\` | Addressee only. |
| \`DELETE /api/contacts?id=\` | \u2014 | Remove a contact / cancel your request. |
| \`POST\` / \`DELETE /api/contacts/block\` | \`{ userId }\` | Block / unblock. |
| \`GET /api/card-shares\` | \u2014 | \`{ received, sent }\`, live shares only. |
| \`POST /api/card-shares\` | \`{ shareCode, guestPass?, title?, message?, recipientIds }\` | \`{ shared, skipped }\` |
| \`PATCH /api/card-shares\` | \`{ id, action: "opened" }\` | Recipient only. |
| \`DELETE /api/card-shares?id=\` | \u2014 | Owner revokes; recipient dismisses. |
| \`GET /api/organizations/members\` | \u2014 | \`{ organization, members, candidates }\` for the active organization; \`candidates\` (your contacts who are not members) only for owners/admins. |
| \`POST /api/organizations/members\` | \`{ userId }\` | Owner/admin adds one of their shareable contacts. |
| \`/api/auth/organization/*\` | \u2014 | better-auth's own create / list / set-active endpoints, called by the account menu. |

Every endpoint requires a session (401 otherwise).

## Follow-ups [#follow-ups]

- Presence is poll-based; a real push channel would make "online" instant
  and let a share open without the recipient reloading.
- The \`documents\` table doesn't record which document holds a joined copy,
  so reopening a shared card always creates another fresh document; the
  engine's own IndexedDB session record does dedupe the *room* (a second
  join resumes instead of re-joining).
- Groups/teams: a share is still one owner \u2192 one recipient; sharing to a
  whole organization at once would fan the same share out to its members.
- Organizations have no rename, leave, remove-member or role-change UI yet,
  and no invitation by email; better-auth's endpoints for all of these exist.
- The Reason Editor's documents are not scoped by organization.
`,i={contents:[{heading:`contacts--shared-cards`,content:`The account-linked half of the CardMirror editor's real-time collaboration.
The engine's co-editing sessions (Loro CRDT, share codes, invite links,
version recovery \u2014 \`packages/debate-editor/src/editor/collab/\`) used to reach
a partner only over the clipboard: start a session, copy the
\`cmshare\u2026\` code or \`#join=\u2026\` link, paste it somewhere. Contacts key that to
**better-auth user ids** instead: a signed-in user has a contacts list, can
share the document they're editing straight to a contact's account, and the
shared card shows up as **available** on that account on every device they
sign in on.`},{heading:`contacts--shared-cards`,content:"**Route:** `/contacts` (tabs: Contacts, Shared cards; `?tab=shared` lands\non the second)"},{heading:`contacts--shared-cards`,content:`**Nav:** the dock's Settings menu ("Contacts", with a count of pending
requests); the Tools page's Prep & Practice group; the Reason Editor
sidebar's Documents row (the share glyph beside Upload) and \`t contacts\`
in Ctrl/Cmd-K's search palette`},{heading:`contacts--shared-cards`,content:"**Package:** `debate-team-collaboration`\n(`lib/contacts.ts` rules, `state/contacts.ts` + `state/cardShares.ts`\nclients, `useContacts` / `useCardShares` hooks, `ContactsPanel` /\n`SharedCardsPanel`); the engine bridge is\n`debate-editor/collab-bridge`"},{heading:`contacts-list`,content:`A typical friends list, all of it server-side and per account:`},{heading:`contacts-list`,content:`| Action                                                               | What happens                                                                             |
| -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Add by name/email search (\`/api/users/search\`) or by typing an email | A **pending** request. If that person already sent *you* one, it's accepted on the spot. |`,table:`table-0`},{heading:`contacts-list`,content:`| Action                      | What happens                                               |
| --------------------------- | ---------------------------------------------------------- |
| Accept / Decline (incoming) | Accept flips the pair to **accepted**; decline deletes it. |`,table:`table-0`},{heading:`contacts-list`,content:`| Action                                | What happens                                                 |
| ------------------------------------- | ------------------------------------------------------------ |
| Cancel (outgoing) / Remove (accepted) | Deletes the row; either side can remove an accepted contact. |`,table:`table-0`},{heading:`contacts-list`,content:`| Action | What happens                                                                                                                                                                                                                                                |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Block  | Unilateral. Deletes any contact row *and revokes every shared card* between the two accounts, both directions. Blocked users can't send you requests or shares; their attempts get the same generic refusal as any other, so blocking is invisible to them. |`,table:`table-0`},{heading:`contacts-list`,content:`| Action  | What happens                                        |
| ------- | --------------------------------------------------- |
| Unblock | Lifts the block. Nothing severed by it is restored. |`,table:`table-0`},{heading:`contacts-list`,content:"Contacts show an **online / away** dot. There's no push channel in this repo,\nso presence is a heartbeat: the contacts poll (`GET /api/contacts`, every\n30 s while a tab is visible \u2014 run from the dock on every page, not just\n`/contacts`, and shared by every mounted copy so a page sends one request per\ntick) bumps the caller's `user_presence` row, and a contact is online\nwhile their last poll is inside `PRESENCE_ONLINE_WINDOW_MS` (2 min)."},{heading:`contacts-list`,content:"Requests and accepts write ordinary account notifications (`contact_request`,\n`contact_accepted`; see Notifications)."},{heading:`organizations`,content:`An **organization** is a shared group, like a team or a school squad
(better-auth's \`organization\` plugin, registered in
\`apps/debate-ai.com/lib/auth/index.ts\`). The sidebar's account menu has an
**Organizations** submenu: **Personal**, every organization you belong to,
**Members of \u2026** for the active one, and **New organization**. Creating one
makes you its owner and switches to it.`},{heading:`organizations`,content:"The organization you pick is stored on your session\n(`session.active_organization_id`), and it changes what this page shows:"},{heading:`organizations`,content:`|               | Personal               | An organization                                                                                                     |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Contacts list | Your accepted contacts | The organization's other members (minus blocks either way); Remove is hidden, since membership is not a contact row |`,table:`table-1`},{heading:`organizations`,content:`|              | Personal         | An organization              |
| ------------ | ---------------- | ---------------------------- |
| Shared cards | Every live share | Only shares with its members |`,table:`table-1`},{heading:`organizations`,content:`|                        | Personal          | An organization                   |
| ---------------------- | ----------------- | --------------------------------- |
| Who you can share with | Accepted contacts | Accepted contacts and its members |`,table:`table-1`},{heading:`organizations`,content:`Members are added by an owner or admin from **their own contacts** (Members of
\u2026 \u2192 Add), so nobody lands in a group without a contact who trusts them; there
are no invitation emails. An id on the session is only honoured after the
caller is confirmed to be a member (\`lib/organizations/server.ts\`), so a stale
or forged id falls back to Personal.`},{heading:`sharing-a-card`,content:`In the Reason Editor, **Share with contacts** opens a picker of your contacts
plus an optional note. It is the share glyph in the sidebar's Documents row,
beside New file / New folder / Upload \u2014 sharing is something done to the open
file, so it sits with that file's other actions rather than in a header strip
of its own. Shown only when you are signed in and a document is open, and only
on the editor route: sharing starts a live co-editing session through the
CardMirror engine, which that page is what mounts. On Share:`},{heading:`sharing-a-card`,content:`If the open document has no live session, the engine's own Start
Collaboration Session flow runs (same confirm dialog); the 'Enable
collaboration' master toggle is switched on if it was off, since sharing
*is* the opt-in.`},{heading:`sharing-a-card`,content:`The session's share code and relay guest pass \u2014 exactly what the editor's
Copy Invite Link would put on the clipboard \u2014 are posted to
\`POST /api/card-shares\` for each picked contact.`},{heading:`sharing-a-card`,content:"Each recipient gets a `card_shared` notification linking to\n`/contacts?tab=shared`, and the card appears there marked **Available**\n(and **New** until first opened)."},{heading:`sharing-a-card`,content:`Shares only ever reach **accepted contacts** with no block in either
direction; anyone else in the picked list is reported back as skipped.
Re-sharing the same room to the same contact refreshes the row (new code/
pass, un-revoked, re-notified) rather than duplicating it \u2014 rows are unique
on \`(room_id, recipient_id)\`. The owner can **Stop sharing** (revoke) from
the Shared cards tab; the recipient can **Dismiss** their copy.`},{heading:`sharing-a-card`,content:`The Shared cards tab also has a paste box: a \`cmshare\u2026\` code or a full
invite link copied from the editor can be shared to contacts from there, for
hosts who started the session the old way.`},{heading:`on-the-trust-model`,content:`The share code carries the room's end-to-end encryption key, which the
collab relay itself never sees. Storing it in this app's database is a
deliberate trade: a share that follows a *person* across devices has to
live somewhere their account can read it, and the only alternative \u2014 the
desktop pairing mailbox \u2014 seals to a per-browser key, not to an account.
The database already holds the full content of every Reason Editor document,
so the key adds no new class of exposure.`},{heading:`opening-a-shared-card`,content:"**Open** on a received share navigates to `/reason-editor?share=<id>`. The\neditor page's `SharedCardOpener` then:"},{heading:`opening-a-shared-card`,content:`creates a **fresh document** to hold the joined copy \u2014 the engine binds
a session to whichever document is focused and the page autosaves it,
so joining into the document that was open would overwrite it with the
room's content;`},{heading:`opening-a-shared-card`,content:`waits for the engine to boot, then joins with the code + guest pass
through the same flow as pasting an invite link (the user confirms);`},{heading:`opening-a-shared-card`,content:`marks the share opened.`},{heading:`opening-a-shared-card`,content:`A share that arrives while the editor is open toasts with its own Open
action. Co-editing is a desktop-layout feature: on the mobile shell the
engine's collab gate is closed and the open is refused with a message.`},{heading:`presence-name`,content:`The engine's partner cursor shows \`pairingDisplayName\`, defaulting to a
random "Guest NNN" on the web. The opener seeds it from the signed-in
account's name once, and never overwrites a name the user typed into the
editor's settings.`},{heading:`data`,content:"`apps/debate-ai.com/lib/database/schema.ts`, migration\n`drizzle/0034_contacts_and_card_shares.sql`:"},{heading:`data`,content:"| Table      | Row                                                                                                                                                                        |\n| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| `contacts` | One per unordered pair: `requester_id`, `addressee_id`, `status` (`pending` / `accepted`). Unique on the directed pair; the route checks both directions before inserting. |",table:`table-2`},{heading:`data`,content:"| Table         | Row                                 |\n| ------------- | ----------------------------------- |\n| `user_blocks` | One per `(blocker_id, blocked_id)`. |",table:`table-2`},{heading:`data`,content:"| Table         | Row                                                                                                                       |\n| ------------- | ------------------------------------------------------------------------------------------------------------------------- |\n| `card_shares` | One per `(room_id, recipient_id)`: `owner_id`, `share_code`, `guest_pass`, `title`, `message`, `opened_at`, `revoked_at`. |",table:`table-2`},{heading:`data`,content:"| Table           | Row                         |\n| --------------- | --------------------------- |\n| `user_presence` | `user_id` \u2192 `last_seen_at`. |",table:`table-2`},{heading:`data`,content:`All four cascade-delete with the account. Until the migration has run
against an environment, the list endpoints degrade to empty (same "no such
table" handling as \`/api/notifications\`).`},{heading:`data`,content:"The organization plugin adds `organization`, `member` and `invitation`, and\n`session.active_organization_id`. The app ships no migrations, and better-auth\nnames that session column in every sign-in insert, so `getAuth()` creates them\nidempotently before it builds the auth instance\n(`lib/organizations/ensure-tables.ts`, whose `ORGANIZATION_DDL` an operator\ncan also run with `wrangler d1 execute`)."},{heading:`api`,content:"| Endpoint            | Body / query | Notes                                                                                                                                                                         |\n| ------------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |\n| `GET /api/contacts` | \u2014            | `{ organization, contacts, incoming, outgoing, blocked }`; bumps presence. With an active organization, `contacts` is its members and `organization` is `{ id, name, role }`. |",table:`table-3`},{heading:`api`,content:'| Endpoint             | Body / query                | Notes                                                                                |\n| -------------------- | --------------------------- | ------------------------------------------------------------------------------------ |\n| `POST /api/contacts` | `{ userId }` \\| `{ email }` | `{ status: "requested" \\| "accepted" \\| "already-requested" \\| "already-contacts" }` |',table:`table-3`},{heading:`api`,content:'| Endpoint              | Body / query                            | Notes           |\n| --------------------- | --------------------------------------- | --------------- |\n| `PATCH /api/contacts` | `{ id, action: "accept" \\| "decline" }` | Addressee only. |',table:`table-3`},{heading:`api`,content:`| Endpoint                   | Body / query | Notes                                   |
| -------------------------- | ------------ | --------------------------------------- |
| \`DELETE /api/contacts?id=\` | \u2014            | Remove a contact / cancel your request. |`,table:`table-3`},{heading:`api`,content:"| Endpoint                              | Body / query | Notes            |\n| ------------------------------------- | ------------ | ---------------- |\n| `POST` / `DELETE /api/contacts/block` | `{ userId }` | Block / unblock. |",table:`table-3`},{heading:`api`,content:"| Endpoint               | Body / query | Notes                                   |\n| ---------------------- | ------------ | --------------------------------------- |\n| `GET /api/card-shares` | \u2014            | `{ received, sent }`, live shares only. |",table:`table-3`},{heading:`api`,content:"| Endpoint                | Body / query                                                | Notes                 |\n| ----------------------- | ----------------------------------------------------------- | --------------------- |\n| `POST /api/card-shares` | `{ shareCode, guestPass?, title?, message?, recipientIds }` | `{ shared, skipped }` |",table:`table-3`},{heading:`api`,content:'| Endpoint                 | Body / query               | Notes           |\n| ------------------------ | -------------------------- | --------------- |\n| `PATCH /api/card-shares` | `{ id, action: "opened" }` | Recipient only. |',table:`table-3`},{heading:`api`,content:`| Endpoint                      | Body / query | Notes                               |
| ----------------------------- | ------------ | ----------------------------------- |
| \`DELETE /api/card-shares?id=\` | \u2014            | Owner revokes; recipient dismisses. |`,table:`table-3`},{heading:`api`,content:"| Endpoint                         | Body / query | Notes                                                                                                                                         |\n| -------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------- |\n| `GET /api/organizations/members` | \u2014            | `{ organization, members, candidates }` for the active organization; `candidates` (your contacts who are not members) only for owners/admins. |",table:`table-3`},{heading:`api`,content:"| Endpoint                          | Body / query | Notes                                             |\n| --------------------------------- | ------------ | ------------------------------------------------- |\n| `POST /api/organizations/members` | `{ userId }` | Owner/admin adds one of their shareable contacts. |",table:`table-3`},{heading:`api`,content:`| Endpoint                   | Body / query | Notes                                                                               |
| -------------------------- | ------------ | ----------------------------------------------------------------------------------- |
| \`/api/auth/organization/*\` | \u2014            | better-auth's own create / list / set-active endpoints, called by the account menu. |`,table:`table-3`},{heading:`api`,content:`Every endpoint requires a session (401 otherwise).`},{heading:`follow-ups`,content:`Presence is poll-based; a real push channel would make "online" instant
and let a share open without the recipient reloading.`},{heading:`follow-ups`,content:`The \`documents\` table doesn't record which document holds a joined copy,
so reopening a shared card always creates another fresh document; the
engine's own IndexedDB session record does dedupe the *room* (a second
join resumes instead of re-joining).`},{heading:`follow-ups`,content:`Groups/teams: a share is still one owner \u2192 one recipient; sharing to a
whole organization at once would fan the same share out to its members.`},{heading:`follow-ups`,content:`Organizations have no rename, leave, remove-member or role-change UI yet,
and no invitation by email; better-auth's endpoints for all of these exist.`},{heading:`follow-ups`,content:`The Reason Editor's documents are not scoped by organization.`}],headings:[{id:`contacts--shared-cards`,content:`Contacts & Shared Cards`},{id:`contacts-list`,content:`Contacts list`},{id:`organizations`,content:`Organizations`},{id:`sharing-a-card`,content:`Sharing a card`},{id:`on-the-trust-model`,content:`On the trust model`},{id:`opening-a-shared-card`,content:`Opening a shared card`},{id:`presence-name`,content:`Presence name`},{id:`data`,content:`Data`},{id:`api`,content:`API`},{id:`follow-ups`,content:`Follow-ups`}]},a=[{depth:1,url:`#contacts--shared-cards`,title:(0,t.jsx)(t.Fragment,{children:`Contacts & Shared Cards`})},{depth:2,url:`#contacts-list`,title:(0,t.jsx)(t.Fragment,{children:`Contacts list`})},{depth:2,url:`#organizations`,title:(0,t.jsx)(t.Fragment,{children:`Organizations`})},{depth:2,url:`#sharing-a-card`,title:(0,t.jsx)(t.Fragment,{children:`Sharing a card`})},{depth:3,url:`#on-the-trust-model`,title:(0,t.jsx)(t.Fragment,{children:`On the trust model`})},{depth:2,url:`#opening-a-shared-card`,title:(0,t.jsx)(t.Fragment,{children:`Opening a shared card`})},{depth:2,url:`#presence-name`,title:(0,t.jsx)(t.Fragment,{children:`Presence name`})},{depth:2,url:`#data`,title:(0,t.jsx)(t.Fragment,{children:`Data`})},{depth:2,url:`#api`,title:(0,t.jsx)(t.Fragment,{children:`API`})},{depth:2,url:`#follow-ups`,title:(0,t.jsx)(t.Fragment,{children:`Follow-ups`})}];function o(e){let n={a:`a`,code:`code`,em:`em`,h1:`h1`,h2:`h2`,h3:`h3`,li:`li`,ol:`ol`,p:`p`,strong:`strong`,table:`table`,tbody:`tbody`,td:`td`,th:`th`,thead:`thead`,tr:`tr`,ul:`ul`,...e.components};return(0,t.jsxs)(t.Fragment,{children:[(0,t.jsx)(n.h1,{id:`contacts--shared-cards`,children:`Contacts & Shared Cards`}),`
`,(0,t.jsxs)(n.p,{children:[`The account-linked half of the CardMirror editor's real-time collaboration.
The engine's co-editing sessions (Loro CRDT, share codes, invite links,
version recovery \u2014 `,(0,t.jsx)(n.code,{children:`packages/debate-editor/src/editor/collab/`}),`) used to reach
a partner only over the clipboard: start a session, copy the
`,(0,t.jsx)(n.code,{children:`cmshare\u2026`}),` code or `,(0,t.jsx)(n.code,{children:`#join=\u2026`}),` link, paste it somewhere. Contacts key that to
`,(0,t.jsx)(n.strong,{children:`better-auth user ids`}),` instead: a signed-in user has a contacts list, can
share the document they're editing straight to a contact's account, and the
shared card shows up as `,(0,t.jsx)(n.strong,{children:`available`}),` on that account on every device they
sign in on.`]}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Route:`}),` `,(0,t.jsx)(n.code,{children:`/contacts`}),` (tabs: Contacts, Shared cards; `,(0,t.jsx)(n.code,{children:`?tab=shared`}),` lands
on the second)`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Nav:`}),` the dock's Settings menu ("Contacts", with a count of pending
requests); the Tools page's Prep & Practice group; the Reason Editor
sidebar's Documents row (the share glyph beside Upload) and `,(0,t.jsx)(n.code,{children:`t contacts`}),`
in Ctrl/Cmd-K's search palette`]}),`
`,(0,t.jsxs)(n.li,{children:[(0,t.jsx)(n.strong,{children:`Package:`}),` `,(0,t.jsx)(n.code,{children:`debate-team-collaboration`}),`
(`,(0,t.jsx)(n.code,{children:`lib/contacts.ts`}),` rules, `,(0,t.jsx)(n.code,{children:`state/contacts.ts`}),` + `,(0,t.jsx)(n.code,{children:`state/cardShares.ts`}),`
clients, `,(0,t.jsx)(n.code,{children:`useContacts`}),` / `,(0,t.jsx)(n.code,{children:`useCardShares`}),` hooks, `,(0,t.jsx)(n.code,{children:`ContactsPanel`}),` /
`,(0,t.jsx)(n.code,{children:`SharedCardsPanel`}),`); the engine bridge is
`,(0,t.jsx)(n.a,{href:`https://github.com/debate/debate-ai.com/blob/master/packages/debate-editor/overlay/react/collab-bridge.ts`,children:(0,t.jsx)(n.code,{children:`debate-editor/collab-bridge`})})]}),`
`]}),`
`,(0,t.jsx)(n.h2,{id:`contacts-list`,children:`Contacts list`}),`
`,(0,t.jsx)(n.p,{children:`A typical friends list, all of it server-side and per account:`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Action`}),(0,t.jsx)(n.th,{children:`What happens`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsxs)(n.td,{children:[`Add by name/email search (`,(0,t.jsx)(n.code,{children:`/api/users/search`}),`) or by typing an email`]}),(0,t.jsxs)(n.td,{children:[`A `,(0,t.jsx)(n.strong,{children:`pending`}),` request. If that person already sent `,(0,t.jsx)(n.em,{children:`you`}),` one, it's accepted on the spot.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Accept / Decline (incoming)`}),(0,t.jsxs)(n.td,{children:[`Accept flips the pair to `,(0,t.jsx)(n.strong,{children:`accepted`}),`; decline deletes it.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Cancel (outgoing) / Remove (accepted)`}),(0,t.jsx)(n.td,{children:`Deletes the row; either side can remove an accepted contact.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Block`}),(0,t.jsxs)(n.td,{children:[`Unilateral. Deletes any contact row `,(0,t.jsx)(n.em,{children:`and revokes every shared card`}),` between the two accounts, both directions. Blocked users can't send you requests or shares; their attempts get the same generic refusal as any other, so blocking is invisible to them.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Unblock`}),(0,t.jsx)(n.td,{children:`Lifts the block. Nothing severed by it is restored.`})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`Contacts show an `,(0,t.jsx)(n.strong,{children:`online / away`}),` dot. There's no push channel in this repo,
so presence is a heartbeat: the contacts poll (`,(0,t.jsx)(n.code,{children:`GET /api/contacts`}),`, every
30 s while a tab is visible \u2014 run from the dock on every page, not just
`,(0,t.jsx)(n.code,{children:`/contacts`}),`, and shared by every mounted copy so a page sends one request per
tick) bumps the caller's `,(0,t.jsx)(n.code,{children:`user_presence`}),` row, and a contact is online
while their last poll is inside `,(0,t.jsx)(n.code,{children:`PRESENCE_ONLINE_WINDOW_MS`}),` (2 min).`]}),`
`,(0,t.jsxs)(n.p,{children:[`Requests and accepts write ordinary account notifications (`,(0,t.jsx)(n.code,{children:`contact_request`}),`,
`,(0,t.jsx)(n.code,{children:`contact_accepted`}),`; see `,(0,t.jsx)(n.a,{href:`https://github.com/debate/debate-ai.com/blob/master/apps/debate-ai.com/app/api/notifications/route.ts`,children:`Notifications`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`organizations`,children:`Organizations`}),`
`,(0,t.jsxs)(n.p,{children:[`An `,(0,t.jsx)(n.strong,{children:`organization`}),` is a shared group, like a team or a school squad
(better-auth's `,(0,t.jsx)(n.code,{children:`organization`}),` plugin, registered in
`,(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/auth/index.ts`}),`). The sidebar's account menu has an
`,(0,t.jsx)(n.strong,{children:`Organizations`}),` submenu: `,(0,t.jsx)(n.strong,{children:`Personal`}),`, every organization you belong to,
`,(0,t.jsx)(n.strong,{children:`Members of \u2026`}),` for the active one, and `,(0,t.jsx)(n.strong,{children:`New organization`}),`. Creating one
makes you its owner and switches to it.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The organization you pick is stored on your session
(`,(0,t.jsx)(n.code,{children:`session.active_organization_id`}),`), and it changes what this page shows:`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{}),(0,t.jsx)(n.th,{children:`Personal`}),(0,t.jsx)(n.th,{children:`An organization`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Contacts list`}),(0,t.jsx)(n.td,{children:`Your accepted contacts`}),(0,t.jsx)(n.td,{children:`The organization's other members (minus blocks either way); Remove is hidden, since membership is not a contact row`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Shared cards`}),(0,t.jsx)(n.td,{children:`Every live share`}),(0,t.jsx)(n.td,{children:`Only shares with its members`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:`Who you can share with`}),(0,t.jsx)(n.td,{children:`Accepted contacts`}),(0,t.jsx)(n.td,{children:`Accepted contacts and its members`})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`Members are added by an owner or admin from `,(0,t.jsx)(n.strong,{children:`their own contacts`}),` (Members of
\u2026 \u2192 Add), so nobody lands in a group without a contact who trusts them; there
are no invitation emails. An id on the session is only honoured after the
caller is confirmed to be a member (`,(0,t.jsx)(n.code,{children:`lib/organizations/server.ts`}),`), so a stale
or forged id falls back to Personal.`]}),`
`,(0,t.jsx)(n.h2,{id:`sharing-a-card`,children:`Sharing a card`}),`
`,(0,t.jsxs)(n.p,{children:[`In the Reason Editor, `,(0,t.jsx)(n.strong,{children:`Share with contacts`}),` opens a picker of your contacts
plus an optional note. It is the share glyph in the sidebar's Documents row,
beside New file / New folder / Upload \u2014 sharing is something done to the open
file, so it sits with that file's other actions rather than in a header strip
of its own. Shown only when you are signed in and a document is open, and only
on the editor route: sharing starts a live co-editing session through the
CardMirror engine, which that page is what mounts. On Share:`]}),`
`,(0,t.jsxs)(n.ol,{children:[`
`,(0,t.jsxs)(n.li,{children:[`If the open document has no live session, the engine's own Start
Collaboration Session flow runs (same confirm dialog); the 'Enable
collaboration' master toggle is switched on if it was off, since sharing
`,(0,t.jsx)(n.em,{children:`is`}),` the opt-in.`]}),`
`,(0,t.jsxs)(n.li,{children:[`The session's share code and relay guest pass \u2014 exactly what the editor's
Copy Invite Link would put on the clipboard \u2014 are posted to
`,(0,t.jsx)(n.code,{children:`POST /api/card-shares`}),` for each picked contact.`]}),`
`,(0,t.jsxs)(n.li,{children:[`Each recipient gets a `,(0,t.jsx)(n.code,{children:`card_shared`}),` notification linking to
`,(0,t.jsx)(n.code,{children:`/contacts?tab=shared`}),`, and the card appears there marked `,(0,t.jsx)(n.strong,{children:`Available`}),`
(and `,(0,t.jsx)(n.strong,{children:`New`}),` until first opened).`]}),`
`]}),`
`,(0,t.jsxs)(n.p,{children:[`Shares only ever reach `,(0,t.jsx)(n.strong,{children:`accepted contacts`}),` with no block in either
direction; anyone else in the picked list is reported back as skipped.
Re-sharing the same room to the same contact refreshes the row (new code/
pass, un-revoked, re-notified) rather than duplicating it \u2014 rows are unique
on `,(0,t.jsx)(n.code,{children:`(room_id, recipient_id)`}),`. The owner can `,(0,t.jsx)(n.strong,{children:`Stop sharing`}),` (revoke) from
the Shared cards tab; the recipient can `,(0,t.jsx)(n.strong,{children:`Dismiss`}),` their copy.`]}),`
`,(0,t.jsxs)(n.p,{children:[`The Shared cards tab also has a paste box: a `,(0,t.jsx)(n.code,{children:`cmshare\u2026`}),` code or a full
invite link copied from the editor can be shared to contacts from there, for
hosts who started the session the old way.`]}),`
`,(0,t.jsx)(n.h3,{id:`on-the-trust-model`,children:`On the trust model`}),`
`,(0,t.jsxs)(n.p,{children:[`The share code carries the room's end-to-end encryption key, which the
collab relay itself never sees. Storing it in this app's database is a
deliberate trade: a share that follows a `,(0,t.jsx)(n.em,{children:`person`}),` across devices has to
live somewhere their account can read it, and the only alternative \u2014 the
desktop pairing mailbox \u2014 seals to a per-browser key, not to an account.
The database already holds the full content of every Reason Editor document,
so the key adds no new class of exposure.`]}),`
`,(0,t.jsx)(n.h2,{id:`opening-a-shared-card`,children:`Opening a shared card`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.strong,{children:`Open`}),` on a received share navigates to `,(0,t.jsx)(n.code,{children:`/reason-editor?share=<id>`}),`. The
editor page's `,(0,t.jsx)(n.code,{children:`SharedCardOpener`}),` then:`]}),`
`,(0,t.jsxs)(n.ol,{children:[`
`,(0,t.jsxs)(n.li,{children:[`creates a `,(0,t.jsx)(n.strong,{children:`fresh document`}),` to hold the joined copy \u2014 the engine binds
a session to whichever document is focused and the page autosaves it,
so joining into the document that was open would overwrite it with the
room's content;`]}),`
`,(0,t.jsx)(n.li,{children:`waits for the engine to boot, then joins with the code + guest pass
through the same flow as pasting an invite link (the user confirms);`}),`
`,(0,t.jsx)(n.li,{children:`marks the share opened.`}),`
`]}),`
`,(0,t.jsx)(n.p,{children:`A share that arrives while the editor is open toasts with its own Open
action. Co-editing is a desktop-layout feature: on the mobile shell the
engine's collab gate is closed and the open is refused with a message.`}),`
`,(0,t.jsx)(n.h2,{id:`presence-name`,children:`Presence name`}),`
`,(0,t.jsxs)(n.p,{children:[`The engine's partner cursor shows `,(0,t.jsx)(n.code,{children:`pairingDisplayName`}),`, defaulting to a
random "Guest NNN" on the web. The opener seeds it from the signed-in
account's name once, and never overwrites a name the user typed into the
editor's settings.`]}),`
`,(0,t.jsx)(n.h2,{id:`data`,children:`Data`}),`
`,(0,t.jsxs)(n.p,{children:[(0,t.jsx)(n.code,{children:`apps/debate-ai.com/lib/database/schema.ts`}),`, migration
`,(0,t.jsx)(n.code,{children:`drizzle/0034_contacts_and_card_shares.sql`}),`:`]}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Table`}),(0,t.jsx)(n.th,{children:`Row`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`contacts`})}),(0,t.jsxs)(n.td,{children:[`One per unordered pair: `,(0,t.jsx)(n.code,{children:`requester_id`}),`, `,(0,t.jsx)(n.code,{children:`addressee_id`}),`, `,(0,t.jsx)(n.code,{children:`status`}),` (`,(0,t.jsx)(n.code,{children:`pending`}),` / `,(0,t.jsx)(n.code,{children:`accepted`}),`). Unique on the directed pair; the route checks both directions before inserting.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`user_blocks`})}),(0,t.jsxs)(n.td,{children:[`One per `,(0,t.jsx)(n.code,{children:`(blocker_id, blocked_id)`}),`.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`card_shares`})}),(0,t.jsxs)(n.td,{children:[`One per `,(0,t.jsx)(n.code,{children:`(room_id, recipient_id)`}),`: `,(0,t.jsx)(n.code,{children:`owner_id`}),`, `,(0,t.jsx)(n.code,{children:`share_code`}),`, `,(0,t.jsx)(n.code,{children:`guest_pass`}),`, `,(0,t.jsx)(n.code,{children:`title`}),`, `,(0,t.jsx)(n.code,{children:`message`}),`, `,(0,t.jsx)(n.code,{children:`opened_at`}),`, `,(0,t.jsx)(n.code,{children:`revoked_at`}),`.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`user_presence`})}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`user_id`}),` \u2192 `,(0,t.jsx)(n.code,{children:`last_seen_at`}),`.`]})]})]})]}),`
`,(0,t.jsxs)(n.p,{children:[`All four cascade-delete with the account. Until the migration has run
against an environment, the list endpoints degrade to empty (same "no such
table" handling as `,(0,t.jsx)(n.code,{children:`/api/notifications`}),`).`]}),`
`,(0,t.jsxs)(n.p,{children:[`The organization plugin adds `,(0,t.jsx)(n.code,{children:`organization`}),`, `,(0,t.jsx)(n.code,{children:`member`}),` and `,(0,t.jsx)(n.code,{children:`invitation`}),`, and
`,(0,t.jsx)(n.code,{children:`session.active_organization_id`}),`. The app ships no migrations, and better-auth
names that session column in every sign-in insert, so `,(0,t.jsx)(n.code,{children:`getAuth()`}),` creates them
idempotently before it builds the auth instance
(`,(0,t.jsx)(n.code,{children:`lib/organizations/ensure-tables.ts`}),`, whose `,(0,t.jsx)(n.code,{children:`ORGANIZATION_DDL`}),` an operator
can also run with `,(0,t.jsx)(n.code,{children:`wrangler d1 execute`}),`).`]}),`
`,(0,t.jsx)(n.h2,{id:`api`,children:`API`}),`
`,(0,t.jsxs)(n.table,{children:[(0,t.jsx)(n.thead,{children:(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.th,{children:`Endpoint`}),(0,t.jsx)(n.th,{children:`Body / query`}),(0,t.jsx)(n.th,{children:`Notes`})]})}),(0,t.jsxs)(n.tbody,{children:[(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`GET /api/contacts`})}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`{ organization, contacts, incoming, outgoing, blocked }`}),`; bumps presence. With an active organization, `,(0,t.jsx)(n.code,{children:`contacts`}),` is its members and `,(0,t.jsx)(n.code,{children:`organization`}),` is `,(0,t.jsx)(n.code,{children:`{ id, name, role }`}),`.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`POST /api/contacts`})}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`{ userId }`}),` | `,(0,t.jsx)(n.code,{children:`{ email }`})]}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`{ status: "requested" | "accepted" | "already-requested" | "already-contacts" }`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`PATCH /api/contacts`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`{ id, action: "accept" | "decline" }`})}),(0,t.jsx)(n.td,{children:`Addressee only.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`DELETE /api/contacts?id=`})}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsx)(n.td,{children:`Remove a contact / cancel your request.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`POST`}),` / `,(0,t.jsx)(n.code,{children:`DELETE /api/contacts/block`})]}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`{ userId }`})}),(0,t.jsx)(n.td,{children:`Block / unblock.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`GET /api/card-shares`})}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`{ received, sent }`}),`, live shares only.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`POST /api/card-shares`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`{ shareCode, guestPass?, title?, message?, recipientIds }`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`{ shared, skipped }`})})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`PATCH /api/card-shares`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`{ id, action: "opened" }`})}),(0,t.jsx)(n.td,{children:`Recipient only.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`DELETE /api/card-shares?id=`})}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsx)(n.td,{children:`Owner revokes; recipient dismisses.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`GET /api/organizations/members`})}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsxs)(n.td,{children:[(0,t.jsx)(n.code,{children:`{ organization, members, candidates }`}),` for the active organization; `,(0,t.jsx)(n.code,{children:`candidates`}),` (your contacts who are not members) only for owners/admins.`]})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`POST /api/organizations/members`})}),(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`{ userId }`})}),(0,t.jsx)(n.td,{children:`Owner/admin adds one of their shareable contacts.`})]}),(0,t.jsxs)(n.tr,{children:[(0,t.jsx)(n.td,{children:(0,t.jsx)(n.code,{children:`/api/auth/organization/*`})}),(0,t.jsx)(n.td,{children:`\u2014`}),(0,t.jsx)(n.td,{children:`better-auth's own create / list / set-active endpoints, called by the account menu.`})]})]})]}),`
`,(0,t.jsx)(n.p,{children:`Every endpoint requires a session (401 otherwise).`}),`
`,(0,t.jsx)(n.h2,{id:`follow-ups`,children:`Follow-ups`}),`
`,(0,t.jsxs)(n.ul,{children:[`
`,(0,t.jsx)(n.li,{children:`Presence is poll-based; a real push channel would make "online" instant
and let a share open without the recipient reloading.`}),`
`,(0,t.jsxs)(n.li,{children:[`The `,(0,t.jsx)(n.code,{children:`documents`}),` table doesn't record which document holds a joined copy,
so reopening a shared card always creates another fresh document; the
engine's own IndexedDB session record does dedupe the `,(0,t.jsx)(n.em,{children:`room`}),` (a second
join resumes instead of re-joining).`]}),`
`,(0,t.jsx)(n.li,{children:`Groups/teams: a share is still one owner \u2192 one recipient; sharing to a
whole organization at once would fan the same share out to its members.`}),`
`,(0,t.jsx)(n.li,{children:`Organizations have no rename, leave, remove-member or role-change UI yet,
and no invitation by email; better-auth's endpoints for all of these exist.`}),`
`,(0,t.jsx)(n.li,{children:`The Reason Editor's documents are not scoped by organization.`}),`
`]})]})}function s(e={}){let{wrapper:n}=e.components||{};return n?(0,t.jsx)(n,{...e,children:(0,t.jsx)(o,{...e})}):o(e)}export{r as _markdown,s as default,n as frontmatter,i as structuredData,a as toc};