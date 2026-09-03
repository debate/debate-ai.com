# Create New Round — Registered-User Invites & Account Notifications

Links the Create New Round dialog's debater/judge/spectator fields to this
repo's real accounts instead of treating every field as a bare email
string: typing autocompletes against registered users, and submitting the
form invites everyone on the round — a registered user in-app, anyone else
by email.

- **Dialog:** `RoundEditorDialog` (`/debate`'s "Create New Round" action)
- **Notifications route:** `/notifications`
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it does

Every debater/judge/spectator email field in the Round Editor dialog
(`TeamSection`, `JudgesSection`, `SpectatorsSection`) is a `UserAutocomplete`
— a free-text input with a dropdown of registered users matching what's
typed by name or email. Picking a suggestion fills the field with that
user's email; typing anything else is kept as-is, same as before this
feature — an unregistered invitee still just works as a plain email.

On "Create Round & Invite", once the round is created locally, every
non-empty, non-self email across all three sections is sent to
`POST /api/rounds/invite`:

- An email matching a registered `user` row gets an in-app
  **notification** (no email sent — they'll see it next time they open the
  app).
- Everyone else gets an **email invite** via Resend, linking to the round
  (when it has a slug).

A one-line toast ("Notified N registered users, emailed M invites")
reports the outcome; a failed dispatch never blocks navigating to the
newly-created round.

On the receiving end, a signed-in user's notifications live in a new
account-linked `notifications` table (distinct from
`state/prepNoteNotifications.ts`'s pre-existing localStorage/free-form-
recipient-id notifications for Strategy Sync Notes task assignments — that
system has no real accounts to address). The dock's Settings menu shows a
"Notifications" entry with a "New" pill, plus a small red-dot badge on the
dock's own Settings icon, whenever there's an unread notification; clicking
through goes to `/notifications`, which renders `AccountNotificationsPanel`
above the pre-existing prep-note notifications panel. While signed in, a
polling hook toasts any notification newer than the last one already
seen — so an old unread backlog never toast-spams a fresh sign-in, but a
new invite that arrives while the tab is open does.

## Data flow

```
Autocomplete (typing in a debater/judge/spectator field):
dialogs/CreateRoundDialog/UserAutocomplete.tsx
  → searchUsers(query)  (cache/client-cache.ts)
  → GET /api/users/search?q=...  (session-gated; name/email substring match)

Submitting the dialog:
dialogs/CreateRoundDialog/useRoundEditorForm.ts#handleSubmit
  → createRound(...)                          — local round creation, unchanged
  → dispatchRoundInvites(...)
      → sendRoundInvites(...)  (round/round-invite-client.ts)
      → POST /api/rounds/invite
          — registered-user match  → insert into `notifications`
          — everyone else          → Resend email invite
  → toast.success("Notified N registered users, emailed M invites")

Receiving a notification:
hooks/useAccountNotifications.ts  (polls every 30s while the tab is visible)
  → fetchAccountNotifications()  (state/accountNotifications.ts)
  → GET /api/notifications
  → toast() for anything newer than the localStorage watermark id
  → CategoryDock.tsx's Settings menu "Notifications" entry + dock badge

Reading notifications:
panels/AccountNotificationsPanel.tsx  (mounted at /notifications)
  → useAccountNotifications(true)
  → markRead(id) / markAllRead()  → PATCH /api/notifications
```

## Known gaps

- Inviting someone doesn't sync the round itself server-side — the round
  stays in the creator's browser (`useFlowStore`'s localStorage-backed
  state) unless separately cloud-saved via the pre-existing, opt-in
  `/api/rounds` flow. An invitee's link only shows real round data if the
  creator has done that.
- Only round *creation* sends invites. Adding a judge or spectator to an
  already-created round (the "Edit Round" path) doesn't re-invite them.
- The unread count on the dock badge is derived from the most recent 50
  notifications, not a separate `count(*)` query — accurate unless a user
  somehow has more than 50 unread at once.
