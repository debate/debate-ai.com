# Contacts & Shared Cards

The account-linked half of the CardMirror editor's real-time collaboration.
The engine's co-editing sessions (Loro CRDT, share codes, invite links,
version recovery — `packages/debate-editor/src/editor/collab/`) used to reach
a partner only over the clipboard: start a session, copy the
`cmshare…` code or `#join=…` link, paste it somewhere. Contacts key that to
**better-auth user ids** instead: a signed-in user has a contacts list, can
share the document they're editing straight to a contact's account, and the
shared card shows up as **available** on that account on every device they
sign in on.

- **Route:** `/contacts` (tabs: Contacts, Shared cards; `?tab=shared` lands
  on the second)
- **Nav:** the dock's Settings menu ("Contacts", with a count of pending
  requests); the Tools page's Prep & Practice group; the Reason Editor's
  header ("Share with contacts")
- **Package:** [`debate-team-collaboration`](../../packages/debate-team-collaboration/README.md)
  (`lib/contacts.ts` rules, `state/contacts.ts` + `state/cardShares.ts`
  clients, `useContacts` / `useCardShares` hooks, `ContactsPanel` /
  `SharedCardsPanel`); the engine bridge is
  [`debate-editor/collab-bridge`](../../packages/debate-editor/src/react/collab-bridge.ts)

## Contacts list

A typical friends list, all of it server-side and per account:

| Action | What happens |
| --- | --- |
| Add by name/email search (`/api/users/search`) or by typing an email | A **pending** request. If that person already sent *you* one, it's accepted on the spot. |
| Accept / Decline (incoming) | Accept flips the pair to **accepted**; decline deletes it. |
| Cancel (outgoing) / Remove (accepted) | Deletes the row; either side can remove an accepted contact. |
| Block | Unilateral. Deletes any contact row *and revokes every shared card* between the two accounts, both directions. Blocked users can't send you requests or shares; their attempts get the same generic refusal as any other, so blocking is invisible to them. |
| Unblock | Lifts the block. Nothing severed by it is restored. |

Contacts show an **online / away** dot. There's no push channel in this repo,
so presence is a heartbeat: the contacts poll (`GET /api/contacts`, every
30 s while a tab is visible — run from the dock on every page, not just
`/contacts`) bumps the caller's `user_presence` row, and a contact is online
while their last poll is inside `PRESENCE_ONLINE_WINDOW_MS` (2 min).

Requests and accepts write ordinary account notifications (`contact_request`,
`contact_accepted`; see [Notifications](../../apps/debate-ai.com/app/api/notifications/route.ts)).

## Sharing a card

In the Reason Editor, **Share with contacts** (header, signed-in only) opens
a picker of your contacts plus an optional note. On Share:

1. If the open document has no live session, the engine's own Start
   Collaboration Session flow runs (same confirm dialog); the 'Enable
   collaboration' master toggle is switched on if it was off, since sharing
   *is* the opt-in.
2. The session's share code and relay guest pass — exactly what the editor's
   Copy Invite Link would put on the clipboard — are posted to
   `POST /api/card-shares` for each picked contact.
3. Each recipient gets a `card_shared` notification linking to
   `/contacts?tab=shared`, and the card appears there marked **Available**
   (and **New** until first opened).

Shares only ever reach **accepted contacts** with no block in either
direction; anyone else in the picked list is reported back as skipped.
Re-sharing the same room to the same contact refreshes the row (new code/
pass, un-revoked, re-notified) rather than duplicating it — rows are unique
on `(room_id, recipient_id)`. The owner can **Stop sharing** (revoke) from
the Shared cards tab; the recipient can **Dismiss** their copy.

The Shared cards tab also has a paste box: a `cmshare…` code or a full
invite link copied from the editor can be shared to contacts from there, for
hosts who started the session the old way.

### On the trust model

The share code carries the room's end-to-end encryption key, which the
collab relay itself never sees. Storing it in this app's database is a
deliberate trade: a share that follows a *person* across devices has to
live somewhere their account can read it, and the only alternative — the
desktop pairing mailbox — seals to a per-browser key, not to an account.
The database already holds the full content of every Reason Editor document,
so the key adds no new class of exposure.

## Opening a shared card

**Open** on a received share navigates to `/reason-editor?share=<id>`. The
editor page's `SharedCardOpener` then:

1. creates a **fresh document** to hold the joined copy — the engine binds
   a session to whichever document is focused and the page autosaves it,
   so joining into the document that was open would overwrite it with the
   room's content;
2. waits for the engine to boot, then joins with the code + guest pass
   through the same flow as pasting an invite link (the user confirms);
3. marks the share opened.

A share that arrives while the editor is open toasts with its own Open
action. Co-editing is a desktop-layout feature: on the mobile shell the
engine's collab gate is closed and the open is refused with a message.

## Presence name

The engine's partner cursor shows `pairingDisplayName`, defaulting to a
random "Guest NNN" on the web. The opener seeds it from the signed-in
account's name once, and never overwrites a name the user typed into the
editor's settings.

## Data

`apps/debate-ai.com/lib/database/schema.ts`, migration
`drizzle/0034_contacts_and_card_shares.sql`:

| Table | Row |
| --- | --- |
| `contacts` | One per unordered pair: `requester_id`, `addressee_id`, `status` (`pending` / `accepted`). Unique on the directed pair; the route checks both directions before inserting. |
| `user_blocks` | One per `(blocker_id, blocked_id)`. |
| `card_shares` | One per `(room_id, recipient_id)`: `owner_id`, `share_code`, `guest_pass`, `title`, `message`, `opened_at`, `revoked_at`. |
| `user_presence` | `user_id` → `last_seen_at`. |

All four cascade-delete with the account. Until the migration has run
against an environment, the list endpoints degrade to empty (same "no such
table" handling as `/api/notifications`).

## API

| Endpoint | Body / query | Notes |
| --- | --- | --- |
| `GET /api/contacts` | — | `{ contacts, incoming, outgoing, blocked }`; bumps presence. |
| `POST /api/contacts` | `{ userId }` \| `{ email }` | `{ status: "requested" \| "accepted" \| "already-requested" \| "already-contacts" }` |
| `PATCH /api/contacts` | `{ id, action: "accept" \| "decline" }` | Addressee only. |
| `DELETE /api/contacts?id=` | — | Remove a contact / cancel your request. |
| `POST` / `DELETE /api/contacts/block` | `{ userId }` | Block / unblock. |
| `GET /api/card-shares` | — | `{ received, sent }`, live shares only. |
| `POST /api/card-shares` | `{ shareCode, guestPass?, title?, message?, recipientIds }` | `{ shared, skipped }` |
| `PATCH /api/card-shares` | `{ id, action: "opened" }` | Recipient only. |
| `DELETE /api/card-shares?id=` | — | Owner revokes; recipient dismisses. |

Every endpoint requires a session (401 otherwise).

## Follow-ups

- Presence is poll-based; a real push channel would make "online" instant
  and let a share open without the recipient reloading.
- The `documents` table doesn't record which document holds a joined copy,
  so reopening a shared card always creates another fresh document; the
  engine's own IndexedDB session record does dedupe the *room* (a second
  join resumes instead of re-joining).
- Groups/teams: today a share is one owner → one recipient; a team roster
  (see Coaching Programs) could fan out the same share.
