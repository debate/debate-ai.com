# Database schema

Every table in the app's Cloudflare D1 database (`debate-ai-db`, binding `debate_db`).
Locally the same schema runs on SQLite through libSQL.

- **Source of truth:** `apps/debate-ai.com/lib/database/schema.ts` (Drizzle ORM, SQLite dialect).
  The column lists below were generated from it; line numbers were current when generated.
- **Tables owned by packages** (prediction markets, YouTube channels, topic polls,
  profile follows) are also shipped as SQL in `packages/*/migrations/`, which the
  deploy applies. The Tabroom tournament tables live only there and are listed in
  [tabroom-schema.md](./tabroom-schema.md).
- **Types** are SQLite storage types. Drizzle maps `integer` columns declared with
  `mode: "timestamp"` to JavaScript `Date` (stored as Unix seconds) and
  `mode: "boolean"` to `true`/`false` (stored as 1/0). JSON columns are `text`.
- **Conventions:** `user_id` always references `user.id` and almost always cascades
  on delete, so deleting an account removes its data. The many `saved_*` tables share
  one shape: account sync for a client-side store, one row per record, upserted on
  `(user_id, client_id)`, with the record itself JSON-encoded in `data`.

See [self-hosting.md](./self-hosting.md#database-setup-and-migrations) for how these tables
get created.

## Contents

- **Accounts and auth:** [`user`](#user), [`session`](#session), [`account`](#account), [`verification`](#verification), [`organization`](#organization), [`member`](#member), [`invitation`](#invitation), [`staff_roles`](#staff_roles)
- **Editor documents:** [`documents`](#documents), [`topic_starter_items`](#topic_starter_items)
- **Flows and rounds:** [`flow_sync_edits`](#flow_sync_edits), [`flow_presence_heartbeats`](#flow_presence_heartbeats), [`saved_flows`](#saved_flows), [`saved_rounds`](#saved_rounds), [`saved_word_count_rounds`](#saved_word_count_rounds), [`saved_tournament_results`](#saved_tournament_results), [`saved_judge_decisions`](#saved_judge_decisions), [`saved_speech_send_log`](#saved_speech_send_log), [`saved_counsel_panel_assessments`](#saved_counsel_panel_assessments), [`saved_round_pairings`](#saved_round_pairings)
- **User settings and sync:** [`qwksearch_connection`](#qwksearch_connection), [`user_settings`](#user_settings), [`saved_tool_records`](#saved_tool_records)
- **Learn and cards:** [`saved_quick_cards`](#saved_quick_cards), [`saved_learn_cards`](#saved_learn_cards), [`saved_learn_decks`](#saved_learn_decks), [`saved_learn_review_log`](#saved_learn_review_log), [`saved_daily_best_card_comments`](#saved_daily_best_card_comments)
- **Practice:** [`saved_coach_materials`](#saved_coach_materials), [`saved_coach_material_versions`](#saved_coach_material_versions), [`saved_strategy_recommendations`](#saved_strategy_recommendations), [`saved_drill_sets`](#saved_drill_sets), [`saved_custom_opponent_personas`](#saved_custom_opponent_personas), [`practice_vs_ai_debates`](#practice_vs_ai_debates), [`saved_sprint_sessions`](#saved_sprint_sessions), [`practice_profiles`](#practice_profiles), [`practice_challenges`](#practice_challenges)
- **Video library:** [`youtube_round_videos`](#youtube_round_videos), [`youtube_video_exclusions`](#youtube_video_exclusions), [`youtube_sync_runs`](#youtube_sync_runs), [`youtube_channels`](#youtube_channels), [`videos`](#videos), [`video_durations`](#video_durations), [`video_transcripts`](#video_transcripts), [`video_documents`](#video_documents), [`video_relations`](#video_relations), [`video_issues`](#video_issues), [`video_ai_results`](#video_ai_results), [`topic_area_votes`](#topic_area_votes), [`topic_area_rankings`](#topic_area_rankings), [`profile_follows`](#profile_follows)
- **Evidence search:** [`evidence_reuse_index`](#evidence_reuse_index), [`reuse_check_log`](#reuse_check_log), [`detected_urls`](#detected_urls), [`debate_cards`](#debate_cards), [`caselist_documents`](#caselist_documents), [`debate_card_imports`](#debate_card_imports), [`card_ai_analyses`](#card_ai_analyses)
- **Social:** [`notifications`](#notifications), [`contacts`](#contacts), [`user_blocks`](#user_blocks), [`card_shares`](#card_shares), [`collab_relay_*`](#collab_relay_rooms), [`user_presence`](#user_presence), [`comments`](#comments), [`comment_likes`](#comment_likes), [`forum_threads`](#forum_threads)
- **Billing and teams:** [`stripe_subscriptions`](#stripe_subscriptions), [`usage_counters`](#usage_counters), [`team_students`](#team_students), [`team_assignments`](#team_assignments)
- **Prediction markets:** [`prediction_wallets`](#prediction_wallets), [`prediction_markets`](#prediction_markets), [`prediction_bets`](#prediction_bets)
- **Search index and bookkeeping:** [`debate_cards_fts`](#debate_cards_fts), [`debate_cards_vocab`](#debate_cards_vocab), [`debate_cards_fts_state`](#debate_cards_fts_state), [`_d1_applied_migrations`](#_d1_applied_migrations)

## Accounts and auth

### user

One row per account. Managed by better-auth (`lib/auth/index.ts`); every user-owned table references it, mostly with `ON DELETE CASCADE`.

_Drizzle export `user`, `schema.ts:13`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `name` | text | no |  | Display name. |
| `email` | text | no |  | Sign-in email, unique. _(unique)_ |
| `email_verified` | integer | no | `false` | Whether the email has been verified. |
| `image` | text | yes |  | Avatar URL. |
| `created_at` | integer | no |  | When the row was created. |
| `updated_at` | integer | no |  | When the row was last changed. |
| `is_anonymous` | integer | no | `false` | Required by better-auth's `anonymous` plugin, which reads and writes this column on every sign-in/sign-up/callback path (one-tap included) to detect and clean up anonymous sessions once they resolve to a real user. |

### session

better-auth sign-in sessions, one per signed-in browser.

_Drizzle export `session`, `schema.ts:31`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `expires_at` | integer | no |  | When the session stops being valid. |
| `token` | text | no |  | Session token (the cookie value), unique. _(unique)_ |
| `created_at` | integer | no |  | When the row was created. |
| `updated_at` | integer | no |  | When the row was last changed. |
| `ip_address` | text | yes |  | IP the session was created from. |
| `user_agent` | text | yes |  | Browser user agent at sign-in. |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `active_organization_id` | text | yes |  | better-auth `organization` plugin: the organization this session is working in, or null for the personal workspace. Contacts and shared cards narrow to its members while it is set (lib/organizations/server.ts). |

### account

better-auth linked sign-in methods: one row per provider (Google, Discord, LinkedIn, email) per user, holding the OAuth tokens.

_Drizzle export `account`, `schema.ts:50`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `account_id` | text | no |  | The user's id at the provider. |
| `provider_id` | text | no |  | Provider name, e.g. `google`. |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `access_token` | text | yes |  | OAuth access token. |
| `refresh_token` | text | yes |  | OAuth refresh token. |
| `id_token` | text | yes |  | OpenID id token. |
| `access_token_expires_at` | integer | yes |  | Access-token expiry. |
| `refresh_token_expires_at` | integer | yes |  | Refresh-token expiry. |
| `scope` | text | yes |  | Granted OAuth scopes. |
| `password` | text | yes |  | Password hash for credential accounts (unused by the current sign-in methods). |
| `created_at` | integer | no |  | When the row was created. |
| `updated_at` | integer | no |  | When the row was last changed. |

### verification

better-auth one-time values: magic-link and email-verification tokens.

_Drizzle export `verification`, `schema.ts:68`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `identifier` | text | no |  | What the value verifies (usually an email). |
| `value` | text | no |  | The token. |
| `expires_at` | integer | no |  | When it stops being accepted. |
| `created_at` | integer | yes |  | When the row was created. |
| `updated_at` | integer | yes |  | When the row was last changed. |

### organization

better-auth `organization` plugin: a shared group a user can switch into from the account menu. Created on a live D1 by `lib/organizations/ensure-tables.ts`.

_Drizzle export `organization`, `schema.ts:83`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `name` | text | no |  | Display name. |
| `slug` | text | no |  | URL slug, unique. _(unique)_ |
| `logo` | text | yes |  | Logo URL. |
| `created_at` | integer | no |  | When the row was created. |
| `metadata` | text | yes |  | Plugin metadata, JSON. |

### member

Membership of a user in an organization.

_Drizzle export `member`, `schema.ts:92`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `organization_id` | text | no |  | The organization (`organization.id`). _(→ `organization.id` (on delete cascade))_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `role` | text | no | `member` | `member`, `admin` or `owner`. |
| `created_at` | integer | no |  | When the row was created. |

- Indexes: `idx_member_organization` on (organization_id); `idx_member_user` on (user_id)

### invitation

Pending invitations to join an organization.

_Drizzle export `invitation`, `schema.ts:111`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `organization_id` | text | no |  | The organization (`organization.id`). _(→ `organization.id` (on delete cascade))_ |
| `email` | text | no |  | Invitee email. |
| `role` | text | yes |  | Role granted on acceptance. |
| `status` | text | no | `pending` | `pending`, `accepted`, `rejected` or `canceled`. |
| `expires_at` | integer | no |  | When the invitation lapses. |
| `created_at` | integer | no |  | When the row was created. |
| `inviter_id` | text | no |  | Who sent it (`user.id`). _(→ `user.id` (on delete cascade))_ |

- Indexes: `idx_invitation_organization` on (organization_id); `idx_invitation_email` on (email)

### staff_roles

Moderators invited from the admin panel. Admins themselves come from the `ADMIN_EMAIL` / `ADMIN_EMAILS` variables, not this table. Keyed by email so someone can be invited before they sign up.

_Drizzle export `staffRoles`, `schema.ts:2029`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `email` | text | no |  | Moderator's email (primary key). _(PK)_ |
| `role` | text | no | `moderator` | Currently always `moderator`. |
| `invited_by` | text | yes |  | Admin who invited them. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

## Editor documents

### documents

The user's own editor documents and folders (the Debate Editor / REASON editor file tree). Uploaded `.docx` files are stored converted to `.cmir`.

_Drizzle export `documents`, `schema.ts:140`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `title` | text | no | `Untitled` | File or folder name. |
| `content` | text | no | `` | Document body, encoded as `format` says. |
| `format` | text | no | `html` | How `content` is encoded: `"cmir"` for an uploaded file, which is kept in Debate Editor's native format for its whole life, or `"html"` for a document written in the editor. Same two values as `topic_starter_items.format` — see `lib/debate-editor/format.ts`. |
| `user_id` | text | yes |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `parent_id` | integer | yes |  | Containing folder (`documents.id`), null at the root. |
| `is_folder` | integer | no | `false` | True for a folder row. |
| `previous_slug` | text | yes |  | The file's own slug just before its most recent rename — lets a bookmarked `/reason-editor?doc=<old slug>` link keep resolving after a title edit changes it. `lib/reason-docs/doc-path.ts#findItemByRef` reads it as a fallback; null until the first rename, and only ever remembers one rename back (not a full history). |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_documents_user_id` on (user_id); `idx_documents_updated_at` on (updated_at); `idx_documents_parent_id` on (parent_id)

### topic_starter_items

Public, admin-curated evidence packs (folders and files), stored inline so they open without an account.

_Drizzle export `topicStarterItems`, `schema.ts:183`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `title` | text | no |  | File or folder name. |
| `content` | text | no | `` | File body: base64 gzipped `.cmir`, or card HTML for older rows. |
| `format` | text | no | `html` | Encoding of `content`. |
| `parent_id` | integer | yes |  | Containing folder, null at the root. |
| `is_folder` | integer | no | `false` | True for a folder row. |
| `tags` | text | no | `[]` | Tags, JSON array. |
| `published` | integer | no | `true` | Whether the item is visible to the public. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_topic_starter_items_parent_id` on (parent_id); `idx_topic_starter_items_published` on (published)

## Flows and rounds

### flow_sync_edits

Live-sync transport for shared flows: one row per `FlowEdit`, upserted by its caller-assigned id.

_Drizzle export `flowSyncEdits`, `schema.ts:211`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Caller-assigned edit id. _(PK)_ |
| `flow_id` | integer | no |  | The shared flow. |
| `box_path` | text | no |  | Cell path in the flow grid, JSON number array. |
| `author_id` | text | no |  | Collaborator who made the edit. |
| `content` | text | no | `` | New cell content. |
| `timestamp_ms` | integer | no |  | Client timestamp of the edit, ms. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_flow_sync_edits_flow_id` on (flow_id)

### flow_presence_heartbeats

"Who's editing now" presence for shared flows: one row per (flow, collaborator), upserted on every heartbeat.

_Drizzle export `flowPresenceHeartbeats`, `schema.ts:238`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `flow_id` | integer | no |  | The shared flow. |
| `author_id` | text | no |  | Collaborator id. |
| `last_seen_at` | integer | no |  | Latest heartbeat. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_flow_presence_heartbeats_flow_author` (unique) on (flow_id, author_id); `idx_flow_presence_heartbeats_flow_id` on (flow_id)

### saved_flows

Cloud save of the user's flows (otherwise kept in localStorage by `debate-round`).

_Drizzle export `savedFlows`, `schema.ts:479`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | integer | no |  | The flow's local numeric id. |
| `label` | text | no | `` | Flow name, for the list view without loading `data`. |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_flows_user_id` on (user_id); `idx_saved_flows_user_client` (unique) on (user_id, client_id)

### saved_rounds

Cloud save of the user's rounds (tournament, debaters, judges and references to their flows).

_Drizzle export `savedRounds`, `schema.ts:516`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | integer | no |  | The round's local numeric id. |
| `label` | text | no | `` | Round name for the list view. |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_rounds_user_id` on (user_id); `idx_saved_rounds_user_client` (unique) on (user_id, client_id)

### saved_word_count_rounds

Formerly account sync for word-count-format round history. The `/api/word-count-rounds` routes were removed; the table is no longer read or written.

_Drizzle export `savedWordCountRounds`, `schema.ts:557`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_word_count_rounds_user_id` on (user_id); `idx_saved_word_count_rounds_user_client` (unique) on (user_id, client_id)

### saved_tournament_results

Account sync for logged or imported tournament results used by team standings.

_Drizzle export `savedTournamentResults`, `schema.ts:595`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_tournament_results_user_id` on (user_id); `idx_saved_tournament_results_user_client` (unique) on (user_id, client_id)

### saved_judge_decisions

Append-only log of AI judge decisions per round.

_Drizzle export `savedJudgeDecisions`, `schema.ts:631`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `round_id` | text | no |  | Round the decision belongs to; many rows share one. |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_judge_decisions_user_id` on (user_id); `idx_saved_judge_decisions_user_client` (unique) on (user_id, client_id); `idx_saved_judge_decisions_round_id` on (round_id)

### saved_speech_send_log

Account sync for Debate Editor's speech-document send history (`/speech-documents`).

_Drizzle export `savedSpeechSendLog`, `schema.ts:666`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_speech_send_log_user_id` on (user_id); `idx_saved_speech_send_log_user_client` (unique) on (user_id, client_id)

### saved_counsel_panel_assessments

Append-only log of AI counsel-panel assessments per round.

_Drizzle export `savedCounselPanelAssessments`, `schema.ts:845`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `round_id` | text | no |  | Round the assessment belongs to. |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_counsel_panel_assessments_user_id` on (user_id); `idx_saved_counsel_panel_assessments_user_client` (unique) on (user_id, client_id); `idx_saved_counsel_panel_assessments_round_id` on (round_id)

### saved_round_pairings

Manually entered round pairings and room assignments, one per (user, round).

_Drizzle export `savedRoundPairings`, `schema.ts:881`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_round_pairings_user_id` on (user_id); `idx_saved_round_pairings_user_client` (unique) on (user_id, client_id)

## User settings and sync

### qwksearch_connection

The QwkSearch account a user linked via "Sign in with QwkSearch". Created on first use by `lib/qwksearch/store.ts`.

_Drizzle export `qwksearchConnection`, `schema.ts:303`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `connection` | text | no |  | JSON `QwkSearchConnection`: API key, profile and plan. Treat as a secret. |
| `updated_at` | integer | no |  | When the row was last changed. |

### user_settings

One row per user of account-linked preferences (`/api/settings`, `/settings`). Every column is nullable: null means "use the client default". New columns reach a live D1 through `ensureTableColumns`.

_Drizzle export `userSettings`, `schema.ts:311`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `debate_style` | integer | yes |  | Preferred debate format (numeric style id). |
| `font_size` | integer | yes |  | Preferred flow font size. |
| `color_theme` | text | yes |  | Color theme name. |
| `theme_mode` | text | yes |  | Light/dark mode preference. |
| `favorite_tools` | text | yes |  | Starred `/tools` entries, JSON array of route paths. |
| `recent_tools` | text | yes |  | Recently opened tools, JSON array, most recent first. |
| `editor_preferences` | text | yes |  | JSON-serialized map of Debate Editor-setting keys (e.g. `displayColors`, `bodyFont`, `reduceMotion`, `smartQuotes`) to their current values, for every category /settings hosts — that page is the editor's settings surface (see lib/editor-preferences.ts's EDITOR_PREFERENCE_KEYS, which is both the allow-list and the r… |
| `flow_editor_settings` | text | yes |  | JSON-serialized subset of the ebb flow editor's display and keymap settings (see packages/debate-flow/src/lib/config/accountSettings.ts, which is both the validator and the read-back filter). Device-specific values (flowsDir, collab identity, contacts, panel layout) never sync. |
| `font_family` | text | yes |  | App-wide font family: a `FONT_OPTIONS` value (see packages/debate-round/src/state/fontSettings.ts). Null means none chosen on any device yet. |
| `flow_auto_save` | text | yes |  | Flow auto-save mode: "off" \| "saved" \| "all" (see packages/debate-round/src/state/flowAutoSaveSettings.ts). Null means the client default ("saved"). |
| `news_read` | text | yes |  | JSON-serialized arrays of News Stream item ids the signed-in user has read/liked (see packages/debate-card-search/src/lib/news-stream-sync.ts and TODO.md's Product Feature Idea "Community-Rated Summaries" / packages/debate-help-docs/content/docs/internals/news-stream.mdx's "Read/like state is per-browser" Known gap). |
| `news_liked` | text | yes |  | News Stream item ids the user liked, JSON array. |
| `word_limit_presets` | text | yes |  | JSON-serialized array of `{ name, wordLimit }` custom word-limit presets (see packages/debate-round/src/state/wordLimitPresets.ts and TODO.md idea #2's "a per-style word-limit preset manager (add/edit/ remove custom limits instead of only the built-in registry)" follow-up), checked ahead of @debate-ai/timer's hardcoded `w… |
| `outline_filter_presets` | text | yes |  | JSON-serialized array of `{ name, filter }` named Outline filter presets (see packages/debate-round/src/state/outlineFilterPresets.ts and TODO.md idea #10's "Save and reuse named filter presets instead of re-picking filters each visit" follow-up). |
| `saved_argument_collections` | text | yes |  | JSON-serialized array of `{ name, tags }` named Argument Library collections (see packages/debate-card-search/src/lib/argument-library-collections.ts and TODO.md's "📚 Common Argument Library" bullet's "saved custom collections per user" follow-up). |
| `research_progress_goal` | text | yes |  | JSON-serialized `{ targetCompletedTaskCount, topic?, targetDate? }` personal research-progress goal (see packages/debate-card-search/src/lib/research-progress-goal-sync.ts and TODO.md's "📈 Research Progress Tracking" bullet's "account-syncing the goal across devices" follow-up). |
| `quest_streak_sync` | text | yes |  | JSON-serialized `{ lapseReminderEnabled, freezeDayKeys }` personal quest-streak preferences (see packages/debate-contributor-progress/src/lib/quest-streak-sync.ts and TODO.md's "🎮 Gamified Quests" bullet's "account-syncing reminder opt-ins/streak freezes across devices" follow-up). |
| `qualification_points_table` | text | yes |  | JSON-serialized `QualificationPointsTable` override (see packages/debate-data-sync/src/state/qualificationPointsTable.ts and packages/debate-help-docs/content/docs/features/team-rankings.mdx's "Standings data... |
| `qualification_cutoff` | text | yes |  | Qualification cutoff override for team standings. |
| `brainstorm_session_timer` | text | yes |  | JSON-serialized `BrainstormSessionTimerState` (see packages/debate-team-collaboration/src/lib/brainstorm-session-timer.ts and packages/debate-help-docs/content/docs/features/brainstorm-board.mdx's "The session timer is localStorage-only, not account-synced" Known gap). |
| `practice_vs_ai_score` | integer | yes |  | Practice vs AI's gamification score and JSON-serialized array of earned badge ids (see packages/debate-round-practice-ai/src/backend/gamification.ts and packages/debate-help-docs/content/docs/internals/practice-vs-ai.mdx). |
| `practice_vs_ai_badges` | text | yes |  | Earned Practice vs AI badge ids, JSON array. |
| `practice_vs_ai_last_played_day_key` | text | yes |  | The UTC calendar day ("YYYY-MM-DD") of the most recent scored round and the day-over-day streak as of that round, the dated activity log the comment above used to say this table didn't have. |
| `practice_vs_ai_current_streak` | integer | yes |  | Current day-over-day Practice vs AI streak. |
| `my_team_profile` | text | yes |  | JSON-serialized `MyTeamProfile` (`{ school, email1, email2 }`) — the Create Round dialog's "My Team" quick-fill profile (see packages/debate-round/src/state/myTeamProfile.ts and dialogs/CreateRoundDialog/TeamSection.tsx), previously localStorage-only per that file's own header comment. |
| `my_ranked_teams` | text | yes |  | JSON-serialized `MyRankedTeams` (`{ role, partner, teams: { <division>: teamSlug } }`) — Settings → My team, the ranked team the viewer debates on, coaches or assists per division, which the matchup simulator pre-fills (packages/debate-videos/src/lib/my-ranked-teams). Whole-value replace, like `myTeamProfile` above. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

### saved_tool_records

Account sync for the sidebar tools that keep a JSON array in localStorage (judge profiles, prep notes, …). One table for all of them, keyed by (user_id, collection, client_id), served by `/api/tool-records/[collection]`.

_Drizzle export `savedToolRecords`, `schema.ts:1989`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `collection` | text | no |  | Which tool the record belongs to; must be in `debate-data-sync`'s `TOOL_RECORD_COLLECTIONS`. |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_tool_records_user_collection` on (user_id, collection); `idx_saved_tool_records_user_collection_client` (unique) on (user_id, collection, client_id)

## Learn and cards

### saved_quick_cards

Account sync for the editor's Quick Cards snippet library.

_Drizzle export `savedQuickCards`, `schema.ts:699`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_quick_cards_user_id` on (user_id); `idx_saved_quick_cards_user_client` (unique) on (user_id, client_id)

### saved_learn_cards

Account sync for Learn spaced-repetition flashcards.

_Drizzle export `savedLearnCards`, `schema.ts:738`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_learn_cards_user_id` on (user_id); `idx_saved_learn_cards_user_client` (unique) on (user_id, client_id)

### saved_learn_decks

Account sync for custom Learn decks.

_Drizzle export `savedLearnDecks`, `schema.ts:772`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_learn_decks_user_id` on (user_id); `idx_saved_learn_decks_user_client` (unique) on (user_id, client_id)

### saved_learn_review_log

Account sync for the Learn grading history; `client_id` is `cardId:at`.

_Drizzle export `savedLearnReviewLog`, `schema.ts:808`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_learn_review_log_user_id` on (user_id); `idx_saved_learn_review_log_user_client` (unique) on (user_id, client_id)

### saved_daily_best_card_comments

Comments on each day's Daily Best Card winner.

_Drizzle export `savedDailyBestCardComments`, `schema.ts:982`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `day_key` | text | no |  | The challenge day (`YYYY-MM-DD`). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_daily_best_card_comments_user_id` on (user_id); `idx_saved_daily_best_card_comments_user_client` (unique) on (user_id, client_id); `idx_saved_daily_best_card_comments_day_key` on (day_key)

## Practice

### saved_coach_materials

Account sync for AI coach materials, one per material.

_Drizzle export `savedCoachMaterials`, `schema.ts:911`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_coach_materials_user_id` on (user_id); `idx_saved_coach_materials_user_client` (unique) on (user_id, client_id)

### saved_coach_material_versions

Append-only version history of coach materials.

_Drizzle export `savedCoachMaterialVersions`, `schema.ts:944`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `material_id` | text | no |  | Material this version belongs to. |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_coach_material_versions_user_id` on (user_id); `idx_saved_coach_material_versions_user_client` (unique) on (user_id, client_id); `idx_saved_coach_material_versions_material_id` on (material_id)

### saved_strategy_recommendations

Append-only log of strategy recommendations per matchup.

_Drizzle export `savedStrategyRecommendations`, `schema.ts:1020`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `matchup_id` | text | no |  | Matchup the recommendation is for. |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_strategy_recommendations_user_id` on (user_id); `idx_saved_strategy_recommendations_user_client` (unique) on (user_id, client_id); `idx_saved_strategy_recommendations_matchup_id` on (matchup_id)

### saved_drill_sets

Account sync for generated practice drill sets, one per (user, round).

_Drizzle export `savedDrillSets`, `schema.ts:1562`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_drill_sets_user_id` on (user_id); `idx_saved_drill_sets_user_client` (unique) on (user_id, client_id)

### saved_custom_opponent_personas

User-authored AI opponent personas.

_Drizzle export `savedCustomOpponentPersonas`, `schema.ts:1595`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `shared` | integer | no | `false` | Whether the persona is shared with the user's team. |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_custom_opponent_personas_user_id` on (user_id); `idx_saved_custom_opponent_personas_user_client` (unique) on (user_id, client_id); `idx_saved_custom_opponent_personas_shared` on (shared)

### practice_vs_ai_debates

Rounds played against the AI opponent (`debate-round-practice-ai`), replacing the Go server's Mongo collection.

_Drizzle export `practiceVsAiDebates`, `schema.ts:1628`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `email` | text | no | `` | The Go schema keyed debates by email; kept so ported queries match. |
| `bot_name` | text | no | `` | Which AI opponent persona ran the round. |
| `topic` | text | no | `` | Resolution debated. |
| `outcome` | text | no | `` | Free-text outcome: "User conceded", or the judge's raw JSON reply. |
| `result` | text | no | `pending` | Judged status — "win" \| "loss" \| "draw" \| "pending". |
| `data` | text | no |  | The full `DebateVsBotRecord`, JSON-encoded. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_practice_vs_ai_debates_user_id` on (user_id); `idx_practice_vs_ai_debates_user_created` on (user_id, created_at)

### saved_sprint_sessions

Scheduled team sprint sessions; added or cancelled, never edited.

_Drizzle export `savedSprintSessions`, `schema.ts:1670`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `client_id` | text | no |  | The record's id on the client that created it; upserts are keyed on (user_id, client_id). |
| `topic` | text | no |  | Session topic, kept as a column for listing. |
| `data` | text | no |  | The whole client record, JSON-encoded. Its fields belong to the feature that owns it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_saved_sprint_sessions_user_id` on (user_id); `idx_saved_sprint_sessions_user_client` (unique) on (user_id, client_id); `idx_saved_sprint_sessions_topic` on (topic)

### practice_profiles

Practice Partners board: one profile per user saying whether they will debate or judge a practice round.

_Drizzle export `practiceProfiles`, `schema.ts:2328`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `as_competitor` | integer | no | `false` | Available to be challenged as a debater. |
| `as_judge` | integer | no | `false` | Available to judge. |
| `preferences` | text | no |  | `PracticePreferences` as JSON — formats, styles, speed, level, availability, note. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_practice_profiles_updated` on (updated_at)

### practice_challenges

Challenges between Practice Partners, with an optional judge seat. Never deleted; declines and cancels are statuses.

_Drizzle export `practiceChallenges`, `schema.ts:2354`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | A UUID minted by the API. _(PK)_ |
| `challenger_id` | text | no |  | Who sent the challenge. _(→ `user.id` (on delete cascade))_ |
| `opponent_id` | text | no |  | Who was challenged. _(→ `user.id` (on delete cascade))_ |
| `judge_id` | text | yes |  | Invited judge, null if none (set null when that account is deleted). _(→ `user.id` (on delete set null))_ |
| `judge_status` | text | yes |  | `invited` \| `confirmed`, or null with no judge. |
| `status` | text | no | `pending` | `pending` \| `accepted` \| `declined` \| `cancelled`. |
| `format` | text | no |  | Debate format. |
| `topic` | text | no |  | Resolution. |
| `message` | text | no | `` | Note from the challenger. |
| `proposed_at` | integer | yes |  | Proposed start time. |
| `room_id` | text | no |  | The webcam room code everyone in the round joins. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_practice_challenges_challenger` on (challenger_id, status); `idx_practice_challenges_opponent` on (opponent_id, status); `idx_practice_challenges_judge` on (judge_id); `idx_practice_challenges_open` on (status, judge_id, created_at)

## Video library

### youtube_round_videos

Admin "Round videos" queue: rounds fetched from subscribed YouTube channels by the resync, waiting to be published or removed.

_Drizzle export `youtubeRoundVideos`, `schema.ts:1053`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | YouTube video id _(PK)_ |
| `title` | text | no |  | Video title. |
| `published_at` | text | no |  | ISO date (YYYY-MM-DD), sorts lexically |
| `channel` | text | no |  | Channel. |
| `views` | integer | no | `0` | View count. |
| `description` | text | no | `` | Description. |
| `style` | integer | no |  | 1=Policy, 2=PF, 3=LD, 4=College |
| `tournament` | text | yes |  | Tournament parsed from the title. |
| `round_level` | text | yes |  | Round parsed from the title. |
| `aff` | text | yes |  | Affirmative team. |
| `neg` | text | yes |  | Negative team. |
| `winner` | integer | yes |  | True when the Aff won, null if unknown. |
| `judge_decision` | text | yes |  | Decision text. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_youtube_round_videos_published_at` on (published_at); `idx_youtube_round_videos_channel` on (channel); `idx_youtube_round_videos_style` on (style)

### youtube_video_exclusions

Videos an admin removed, so a later resync does not bring them back.

_Drizzle export `youtubeVideoExclusions`, `schema.ts:1087`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `video_id` | text | no |  | YouTube id. _(PK)_ |
| `deleted_by` | text | yes |  | Admin who removed it. |
| `deleted_at` | integer | no | _(SQL expr)_ | When. |

- Indexes: `idx_youtube_video_exclusions_deleted_at` on (deleted_at)

### youtube_sync_runs

History of YouTube resync runs for the admin page.

_Drizzle export `youtubeSyncRuns`, `schema.ts:1105`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `status` | text | no | `running` | "running" \| "success" \| "error" |
| `triggered_by` | text | yes |  | admin email, when known |
| `channels_synced` | integer | no | `0` | Channels scanned. |
| `videos_fetched` | integer | no | `0` | Videos returned by the API. |
| `videos_upserted` | integer | no | `0` | Rows written. |
| `error` | text | yes |  | Error message on failure. |
| `started_at` | integer | no | _(SQL expr)_ | Start time. |
| `finished_at` | integer | yes |  | End time. |

- Indexes: `idx_youtube_sync_runs_started_at` on (started_at)

### youtube_channels

The YouTube channels the weekly resync scans, managed in `/admin`. Also shipped as `debate-data-sync` migration 0001.

_Drizzle export `youtubeChannels`, `schema.ts:1139`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `channel_id` | text | yes |  | YouTube channel id. |
| `name` | text | no |  | Handle/username passed to the API. |
| `enabled` | integer | no | `true` | Whether the resync scans it. |
| `added_by` | text | yes |  | Admin who added it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_youtube_channels_name` (unique) on (name); `idx_youtube_channels_channel_id` (unique) on (channel_id)

### videos

The public video library (`/api/videos`): rounds, lectures and top picks, seeded from `data/videos/*.json` by `db:seed:videos` and kept fresh by the daily YouTube scan and weekly view-count cron.

_Drizzle export `videos`, `schema.ts:1277`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `video_id` | text | no |  | YouTube video id (primary key). _(PK)_ |
| `source` | text | no |  | Which JSON asset the row came from (rounds-pf, debate-lectures, …). |
| `title` | text | no | `` | Video title. |
| `published_at` | text | no | `` | Publish date as stored in the JSON (not always ISO). |
| `published_ms` | integer | no | `0` | Parsed publish time in ms, used for ordering. |
| `channel` | text | no | `` | YouTube channel. |
| `view_count` | integer | no | `0` | View count. |
| `description` | text | no | `` | YouTube description. |
| `style` | integer | yes |  | Debate format: 1 Policy, 2 PF, 3 LD, 4 College; null for lectures. |
| `category` | text | yes |  | Lecture category label; null for rounds. |
| `category_key` | text | yes |  | Lecture category URL slug. |
| `tournament` | text | yes |  | Tournament name. |
| `round_level` | text | yes |  | Round (e.g. Finals). |
| `aff_team` | text | yes |  | Affirmative team. |
| `neg_team` | text | yes |  | Negative team. |
| `aff_win` | integer | yes |  | True when the Aff won, null if unknown. |
| `judge_decision` | text | yes |  | Decision text, e.g. 2-1. |
| `arg_1ac` | text | yes |  | Main 1AC argument. |
| `arg_2nr` | text | yes |  | Main 2NR argument. |
| `is_top_pick` | integer | no | `false` | Listed in Top Picks. |
| `speech_docs_url` | text | yes |  | Link to the round's speech docs. |
| `season_year` | integer | no | `0` | Competition season (June to June), 0 for pre-2010. |
| `stack_key` | text | yes |  | Stacked playlists: `stack_key` is the id of the group's primary video (a round, say) and is shared by every member, `stack_position` orders them within it. |
| `stack_position` | integer | no | `0` | Order within a stacked playlist group. |
| `search_text` | text | no | `` | Precomputed text the library search matches against. |
| `availability` | text | no | `available` | Whether YouTube still serves this video. The weekly resync asks the API for every stored id; an id the API declines to return has been deleted, made private, or region-blocked, and the row is marked here rather than silently left in the library pointing at a dead embed. |
| `availability_checked_at` | integer | yes |  | When availability was last confirmed by a sync, null if never. |
| `missing_checks` | integer | no | `0` | How many consecutive checks have failed to find the video. |
| `view_count_synced_at` | integer | yes |  | When the view count was last refreshed from YouTube. |
| `admin_edited` | integer | no | `false` | Set by an admin edit (`updateLibraryVideo`) and never cleared. Once set, `buildVideoSeedStatements` skips re-seeding this row's columns from the JSON assets, so a re-run of `db:seed:videos` can't silently overwrite an admin's correction with the asset's stale value. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_videos_published_ms` on (published_ms); `idx_videos_availability` on (availability); `idx_videos_view_count` on (view_count); `idx_videos_style` on (style); `idx_videos_season_year` on (season_year); `idx_videos_category_key` on (category_key); `idx_videos_source` on (source); `idx_videos_is_top_pick` on (is_top_pick); `idx_videos_stack_key` on (stack_key)

### video_durations

Video lengths, filled by the admin "Fetch video durations" action, which creates the table itself.

_Drizzle export `videoDurations`, `schema.ts:1357`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `video_id` | text | no |  | YouTube id. _(PK)_ |
| `duration_seconds` | integer | no |  | Length in seconds. |
| `fetched_at` | integer | no | _(SQL expr)_ | When fetched. |

### video_transcripts

Cache of YouTube caption tracks, one row per (video, language).

_Drizzle export `videoTranscripts`, `schema.ts:1376`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `video_id` | text | no |  | YouTube id. _(PK)_ |
| `lang` | text | no | `en` | Caption language. _(PK)_ |
| `snippets` | text | no |  | Caption cues as fetched, JSON. |
| `fetched_at` | integer | no | _(SQL expr)_ | When fetched. |

- Primary key: (`video_id`, `lang`)

### video_documents

Transcripts, summaries and analyses written about a video, one per (video, kind), shown in the watch page's tabs.

_Drizzle export `videoDocuments`, `schema.ts:1405`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `video_id` | text | no |  | YouTube id. _(PK)_ |
| `kind` | text | no |  | `transcript`, `summary` or `analysis` — see `VIDEO_DOCUMENT_KINDS`. _(PK)_ |
| `title` | text | yes |  | Heading shown on the tab's panel; falls back to the kind's label. |
| `body` | text | no | `` | Document text (Markdown). |
| `author` | text | no | `editor` | Who wrote it: `editor`, `ai`, or `youtube` for a cleaned-up caption dump. |
| `model` | text | yes |  | Model that generated an `ai` document, for the attribution line. |
| `word_count` | integer | no | `0` | Words in `body`, stored so the tab strip can say so without shipping it. |
| `updated_by` | text | yes |  | Admin email of the last editor, for the audit trail. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Primary key: (`video_id`, `kind`)

### video_relations

Admin-curated directed links between videos (a round and its analysis, a rematch).

_Drizzle export `videoRelations`, `schema.ts:1446`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `video_id` | text | no |  | The video being watched. _(PK)_ |
| `related_video_id` | text | no |  | The video linked from it. _(PK)_ |
| `relation` | text | no | `analysis` | `analysis`, `related`, `rematch` — see `VIDEO_RELATION_KINDS`. _(PK)_ |
| `note` | text | yes |  | Editor's one-line note on why these belong together. |
| `position` | integer | no | `0` | Order within the relation, lowest first. |
| `created_by` | text | yes |  | Admin who linked them. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Primary key: (`video_id`, `related_video_id`, `relation`)
- Indexes: `idx_video_relations_related` on (related_video_id)

### video_issues

Viewer-reported problems with a video, with a suggested fix and a moderation status.

_Drizzle export `videoIssues`, `schema.ts:1481`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `video_id` | text | no |  | YouTube id. |
| `title` | text | no | `` | Title as the reporter saw it, so a later retitle still reads sensibly. |
| `kind` | text | no | `other` | `miscategorized`, `unavailable`, `quality`, `metadata`, `transcript`, `edit`, `delete`, `submit-video`, `submit-channel` or `other`. A `submit-channel` row has no video, so its `videoId` is empty. |
| `issue` | text | no | `` | The reporter's own words; optional once a `kind` is chosen. |
| `suggested_style` | integer | yes |  | Numeric debate style the reporter says this should be filed under. |
| `suggested_category` | text | yes |  | Lecture category the reporter says this belongs to. |
| `suggested_round_level` | text | yes |  | `college`, `high-school` or an explicit round for a miscategorised round. |
| `reported_by` | text | yes |  | Account email when the reporter was signed in. |
| `status` | text | no | `open` | `open`, `applied` or `dismissed`. |
| `resolved_by` | text | yes |  | Moderator who applied or dismissed it. |
| `resolved_at` | integer | yes |  | When. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_video_issues_video` on (video_id); `idx_video_issues_status` on (status)

### video_ai_results

The watch page's AI results — detected speech starts, speech summaries and Outcomes runs — saved once per video and served to every viewer by `/api/video-ai-results`. First write wins; staff can replace or delete.

_Drizzle export `videoAiResults`, `schema.ts:2262`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | `${videoId}::${kind}::${itemKey}`. _(PK)_ |
| `video_id` | text | no |  | YouTube video id. |
| `kind` | text | no |  | `segmentation`, `summary` or `outcome`. |
| `item_key` | text | no | `''` | Empty for a segmentation, the speech key for a summary, `speechKey::panel` for an outcome. |
| `data` | text | no |  | The result as JSON. |
| `created_by` | text | yes |  | Who saved (or last replaced) it. FK → `user.id` (ON DELETE set null) |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When it was last replaced. |

- Indexes: `idx_video_ai_results_video` on (video_id)

### topic_area_votes

Legacy single-choice next-season topic-area poll. Superseded by `topic_area_rankings`. From `debate-videos` migration 0001.

_Drizzle export `topicAreaVotes`, `schema.ts:2500`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `season` | integer | no |  | Season the vote is for. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `area` | text | no |  | Topic area chosen. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Primary key: (`season`, `user_id`)

### topic_area_rankings

Ranked ballots for the next-season topic-area poll on `/practice/statistics`, up to five rows per (season, user). From `debate-videos` migration 0003.

_Drizzle export `topicAreaRankings`, `schema.ts:2528`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `season` | integer | no |  | Season. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `rank` | integer | no |  | 1 = first choice. _(PK)_ |
| `area` | text | no |  | Topic area. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Primary key: (`season`, `user_id`, `rank`)
- Indexes: `idx_topic_area_rankings_season` on (season)

### profile_follows

Users following a team or school profile; feeds the news stream. From `debate-videos` migration 0002.

_Drizzle export `profileFollows`, `schema.ts:2556`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `kind` | text | no |  | `team` or `school`. _(PK)_ |
| `slug` | text | no |  | Profile URL segment. _(PK)_ |
| `name` | text | no |  | Display name at follow time. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Primary key: (`user_id`, `kind`, `slug`)
- Indexes: `idx_profile_follows_target` on (kind, slug)

## Evidence search

### evidence_reuse_index

"This URL has already been cut" facts for the on-page reuse check, keyed by the caller's entry id.

_Drizzle export `evidenceReuseIndex`, `schema.ts:1170`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | Primary key. _(PK)_ |
| `source_url` | text | no |  | URL the card was cut from. |
| `normalized_url` | text | no |  | URL normalized for matching. |
| `cite` | text | no | `` | Card citation. |
| `arg_block` | text | no | `` | Argument block it was filed under. |
| `topic` | text | no | `` | Topic. |
| `contributor_id` | text | no | `` | Who registered it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_evidence_reuse_index_normalized_url` on (normalized_url)

### reuse_check_log

Log of every reuse-check lookup (web "Check this page" box or browser extension) for the team dashboard. Old rows are purged by the weekly cron.

_Drizzle export `reuseCheckLog`, `schema.ts:1201`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `url` | text | no |  | URL checked. |
| `normalized_url` | text | no |  | Normalized form. |
| `already_cut` | integer | no |  | Whether a match was found. |
| `match_count` | integer | no | `0` | Number of matches. |
| `source` | text | no | `web` | Where the check came from (web or extension). |
| `checked_at` | integer | no |  | When. |

- Indexes: `idx_reuse_check_log_normalized_url` on (normalized_url); `idx_reuse_check_log_already_cut` on (already_cut)

### detected_urls

Pages the browser extension reported a user visiting (`POST /api/url-detection`), one row per (user, URL).

_Drizzle export `detectedUrls`, `schema.ts:1225`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `url` | text | no |  | Page URL. |
| `normalized_url` | text | no |  | Normalized form, the upsert key with `user_id`. |
| `title` | text | yes |  | Page title. |
| `favicon` | text | yes |  | Favicon URL. |
| `visit_count` | integer | no | `1` | Visits recorded. |
| `last_visited_at` | integer | no | _(SQL expr)_ | Latest visit. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_detected_urls_user_id` on (user_id); `idx_detected_urls_normalized_url` on (normalized_url); `idx_detected_urls_user_url` (unique) on (user_id, normalized_url); `idx_detected_urls_last_visited` on (last_visited_at)

### debate_cards

The searchable card corpus behind `/cards`, imported from Parquet shards through `/api/admin/debate-cards`. `id` is the dump's own id, so re-importing a shard upserts. Indexed for full text by `debate_cards_fts` (see below).

_Drizzle export `debateCards`, `schema.ts:1846`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Card id from the source dump. _(PK)_ |
| `tag` | text | no | `` | The card's tag line. |
| `cite` | text | no | `` | Short citation. |
| `fullcite` | text | no | `` | Full citation. |
| `summary` | text | no | `` | Summary text. |
| `spoken` | text | no | `` | The highlighted text as read aloud. |
| `fulltext` | text | no | `` | The unhighlighted card body. |
| `text_length` | integer | no | `0` | Length of the body. |
| `markup` | text | no | `` | Card HTML with `<mark>`/`<u>` highlighting. |
| `pocket` | text | no | `` | Outline level 1 (pocket). |
| `hat` | text | no | `` | Outline level 2 (hat). |
| `block` | text | no | `` | Outline level 3 (block). |
| `bucket_id` | integer | no | `0` | Duplicate-group id from the dump. |
| `duplicate_count` | integer | no | `0` | How many copies of this card the dump holds. |
| `side` | text | no | `` | Aff or Neg. |
| `caselist_display_name` | text | no | `` | Caselist the card came from. |
| `year` | integer | no | `0` | Season year. |
| `event` | text | no | `` | Debate event (e.g. Policy, LD). |
| `level` | text | no | `` | Competition level (HS, college). |
| `source_file` | text | no | `` | Shard the row came from, so one file's import can be audited or replaced. |
| `source_url` | text | no | `` | Source URL `debate-card-parser` extracted from the citation, or "" when it names none. Written at import and backfilled by the admin panel's "Extract source URLs" run; the URL recheck reads it instead of re-parsing every cite. |
| `imported_at` | integer | no | _(SQL expr)_ | When this row was last imported. |

- Indexes: `idx_debate_cards_year` on (year); `idx_debate_cards_event` on (event); `idx_debate_cards_level` on (level); `idx_debate_cards_side` on (side); `idx_debate_cards_caselist` on (caselist_display_name); `idx_debate_cards_bucket` on (bucket_id); `idx_debate_cards_source_file` on (source_file); `idx_debate_cards_source_url` on (source_url); `idx_debate_cards_imported_at` on (imported_at, id); `idx_debate_cards_duplicate_count` on (duplicate_count)

### caselist_documents

Full `.docx` files unpacked from openCaselist archives, converted to HTML, with school/team provenance. Powers "files shared by this school/team" on profiles.

_Drizzle export `caselistDocuments`, `schema.ts:1903`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `path_hash` | text | no |  | Stable hash of the archive path (caselist slug + entry path). _(unique)_ |
| `caselist_slug` | text | no |  | Caselist slug, e.g. `hspolicy26`. |
| `caselist_label` | text | no |  | Caselist display label, e.g. "HS Policy 2025-26". |
| `school` | text | no |  | School folder from the archive path. |
| `team` | text | yes |  | Team folder under the school, nullable. |
| `side` | text | yes |  | Side from file name or path: "Aff" \| "Neg" \| null. |
| `file_name` | text | no |  | Original file name with extension. |
| `archive_path` | text | no |  | Full archive path, e.g. `hspolicy26/Glenbrook North/Chen-Patel/1AC.docx`. |
| `html` | text | no |  | Converted HTML content from the DOCX. |
| `card_count` | integer | no | `0` | Parsed cards count, when available. |
| `ingested_at` | integer | no | _(SQL expr)_ | ISO timestamp when this document was ingested. |
| `archive_date` | text | yes |  | ISO timestamp of the archive this document came from. |

- Indexes: `idx_caselist_documents_school` on (school); `idx_caselist_documents_team` on (team); `idx_caselist_documents_caselist_slug` on (caselist_slug); `idx_caselist_documents_path_hash` (unique) on (path_hash)

### debate_card_imports

One row per Parquet shard imported into `debate_cards`, for the admin panel's import history.

_Drizzle export `debateCardImports`, `schema.ts:1948`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `file_name` | text | no |  | Shard file name (primary key). _(PK)_ |
| `rows_imported` | integer | no | `0` | Cards written from this shard, summed across every batch. |
| `rows_skipped` | integer | no | `0` | Rows the importer refused, summed the same way. |
| `last_import_id` | text | no | `` | Run id shared by the batches, for correlating with the server logs. |
| `last_imported_by` | text | no | `` | Admin who started the most recent batch. |
| `first_imported_at` | integer | no | _(SQL expr)_ | First import of this shard. |
| `last_imported_at` | integer | no | _(SQL expr)_ | Most recent import. |

### card_ai_analyses

Cached "AI Analysis" results for a card, keyed by hashes of the card text and prompt, so each analysis is generated once.

_Drizzle export `cardAiAnalyses`, `schema.ts:2146`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `card_hash` | text | no |  | SHA-256 of the normalized card text sent to the model. |
| `prompt_hash` | text | no |  | SHA-256 of the normalized prompt. |
| `card_tag` | text | yes |  | The card's tag line, kept for the admin/debugging view only. |
| `result` | text | no |  | The model's analysis. |
| `model` | text | yes |  | Model that produced it. |
| `user_id` | text | yes |  | User whose request generated it. _(→ `user.id` (on delete set null))_ |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_card_ai_analyses_card_prompt` (unique) on (card_hash, prompt_hash)

## Social

### notifications

In-app notifications (round invites and the like) shown from the dock's Notifications menu.

_Drizzle export `notifications`, `schema.ts:1532`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `type` | text | no |  | Notification kind. |
| `title` | text | no |  | Headline. |
| `body` | text | yes |  | Text. |
| `link` | text | yes |  | Where clicking it goes. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `read_at` | integer | yes |  | When it was read, null if unread. |

- Indexes: `idx_notifications_user_id` on (user_id); `idx_notifications_user_created` on (user_id, created_at)

### contacts

Contact requests and accepted contacts, one row per pair of users.

_Drizzle export `contacts`, `schema.ts:1716`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `requester_id` | text | no |  | Who sent the request. _(→ `user.id` (on delete cascade))_ |
| `addressee_id` | text | no |  | Who received it. _(→ `user.id` (on delete cascade))_ |
| `status` | text | no | `pending` | "pending" \| "accepted". |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_contacts_pair` (unique) on (requester_id, addressee_id); `idx_contacts_addressee` on (addressee_id)

### user_blocks

One user blocking another from requests, shares and visibility.

_Drizzle export `userBlocks`, `schema.ts:1747`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `blocker_id` | text | no |  | Who blocked. _(→ `user.id` (on delete cascade))_ |
| `blocked_id` | text | no |  | Who was blocked. _(→ `user.id` (on delete cascade))_ |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_user_blocks_pair` (unique) on (blocker_id, blocked_id); `idx_user_blocks_blocked` on (blocked_id)

### card_shares

Live Debate Editor co-editing sessions shared from one account to a contact. Holds the room's join credentials, so treat rows as sensitive.

_Drizzle export `cardShares`, `schema.ts:1781`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `owner_id` | text | no |  | Sharer. _(→ `user.id` (on delete cascade))_ |
| `recipient_id` | text | no |  | Contact it was shared with. _(→ `user.id` (on delete cascade))_ |
| `room_id` | text | no |  | Collab relay room id. |
| `share_code` | text | no |  | `cmshare1.…` invite code, including the room key. |
| `guest_pass` | text | yes |  | Relay join credential. |
| `title` | text | no | `` | Document title. |
| `message` | text | yes |  | Note from the sharer. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |
| `opened_at` | integer | yes |  | When the recipient first opened it. |
| `revoked_at` | integer | yes |  | When the share was revoked. |

- Indexes: `idx_card_shares_owner` on (owner_id); `idx_card_shares_recipient` on (recipient_id); `idx_card_shares_room_recipient` (unique) on (room_id, recipient_id)

### collab_relay_rooms

The Debate Editor's co-editing sessions on the app's own collaboration relay (`lib/collab-relay`, `/api/collab-relay`). Shipped as `packages/debate-webview/migrations/0003_collab_relay.sql`. Times in this and the other `collab_relay_*` tables are epoch **milliseconds**.

_Drizzle export `collabRelayRooms`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `room_id` | text | no |  | 32 hex chars, the id inside a `cmshare…` share code. _(PK)_ |
| `owner_id` | text | no |  | Account that started the session; only it can end the room. _(→ `user.id` (on delete cascade))_ |
| `guest_pass` | text | no |  | Bearer a signed-out invitee joins with (room data only). Sensitive. |
| `snapshot_covers` | integer | no | `0` | Highest update seq the stored snapshot covers; 0 = none. |
| `created_at` / `updated_at` | integer | no |  | Ms. Rooms untouched for 60 days are deleted when a new room opens. |
| `ended_at` | integer | yes |  | Set when the host ends the session; the room answers 410. |

### collab_relay_blobs

A room's encrypted update log (`kind = 'u'`, `seq` = update seq) and snapshot (`kind = 's'`, `seq` = what it covers), as base64 split into ≤1.5 MB `part`s so one row stays under D1's 2 MB cap. PK (room_id, kind, seq, part); `parts` repeats the part count on every row.

### collab_relay_presence

Cursor / selection frames (`data`, base64 ciphertext) with the sender's stream id (`from_sid`), pruned after 30 seconds. Index on (room_id, id).

### collab_relay_mailboxes

Card-sharing mailboxes: a pairing code's routing id (`recipient`, PK) and the account that claimed it by reading it first (`user_id` → `user.id`, on delete cascade).

### collab_relay_messages

Sealed cards waiting for their recipient: `msg_id` (unique), `recipient`, `sender_id` (→ `user.id`), `body` (the sealed bundle JSON), `created_at`. Deleted on delivery; expire after 7 days. Index on (recipient, id).

### user_presence

Last-seen heartbeat per user, bumped by the contacts poll, for online indicators.

_Drizzle export `userPresence`, `schema.ts:1820`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `last_seen_at` | integer | no | _(SQL expr)_ | Latest heartbeat. |

### comments

Threaded comments on any resource (video, file, lecture, forum thread). Soft-deleted via `deleted_at`.

_Drizzle export `comments`, `schema.ts:2189`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | A UUID minted by the API, not an autoincrement rowid. An id that counts up tells a reader how much discussion exists on a resource before they have read any of it, and it makes a comment's URL guessable by anyone who has seen one. _(PK)_ |
| `resource_type` | text | no |  | One of `debate-comments`' `COMMENT_RESOURCE_TYPES`; see `@debate-ai/webview/src/lib/comments/validation.ts`. |
| `resource_id` | text | no |  | The resource's own id — a YouTube video id here, a `debate_cards` id there. |
| `parent_id` | text | yes |  | Null for a top-level comment; otherwise the comment this one answers. _(→ `comments.id` (on delete cascade))_ |
| `author_id` | text | no |  | Comment author. _(→ `user.id` (on delete cascade))_ |
| `body` | text | no |  | Comment text. |
| `deleted_at` | integer | yes |  | Set when the author (or a moderator) removes the comment; see above. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_comments_resource` on (resource_type, resource_id, created_at); `idx_comments_parent` on (parent_id, created_at)

### comment_likes

One like per user per comment; the composite key prevents double counting.

_Drizzle export `commentLikes`, `schema.ts:2242`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `comment_id` | text | no |  | Liked comment. _(PK, → `comments.id` (on delete cascade))_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Primary key: (`comment_id`, `user_id`)
- Indexes: `idx_comment_likes_comment` on (comment_id)

### forum_threads

Forum threads; replies are `comments` rows with `resource_type = 'thread'`.

_Drizzle export `forumThreads`, `schema.ts:2278`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | A UUID minted by the API, like every other id a reader could type. _(PK)_ |
| `title` | text | no |  | The one line that names the thread; capped at `MAX_THREAD_TITLE_LENGTH`. |
| `body` | text | no |  | The opening post. |
| `author_id` | text | no |  | Thread author. _(→ `user.id` (on delete cascade))_ |
| `deleted_at` | integer | yes |  | Set when the author removes the thread; the row stays, the feed skips it. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |
| `last_activity_at` | integer | no | _(SQL expr)_ | When the thread was last posted to, which is the order the feed reads in. Seeded with the row's own creation time rather than left to the column default, so the two can never disagree about when a thread was opened. |

- Indexes: `idx_forum_threads_activity` on (last_activity_at, id); `idx_forum_threads_author` on (author_id, created_at)

## Billing and teams

### stripe_subscriptions

Stripe subscriptions, written only by `/api/stripe/webhook`. `user_id` can be briefly null when Stripe delivers events out of order.

_Drizzle export `stripeSubscriptions`, `schema.ts:2047`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `subscription_id` | text | no |  | Stripe subscription id (primary key). _(PK)_ |
| `user_id` | text | yes |  | Owning account (`user.id`). _(→ `user.id` (on delete set null))_ |
| `customer_id` | text | yes |  | Stripe customer id. |
| `email` | text | yes |  | Customer email. |
| `price_id` | text | yes |  | Stripe price id. |
| `plan` | text | yes |  | A `PlanId` from `@debate-ai/webview/src/lib/stripe/plans.ts`, or `unknown` for an unlisted price. |
| `status` | text | yes |  | Stripe's subscription status — `active`, `trialing`, `past_due`, `canceled`, … |
| `current_period_end` | integer | yes |  | End of the paid period. |
| `cancel_at_period_end` | integer | no | `false` | Whether it cancels at period end. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_stripe_subscriptions_user` on (user_id); `idx_stripe_subscriptions_customer` on (customer_id)

### usage_counters

Per-day usage counts that enforce plan limits (`lib/stripe/usage.ts`).

_Drizzle export `usageCounters`, `schema.ts:2080`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `subject` | text | no |  | A user id, or `ip:<address>` for signed-out callers. _(PK)_ |
| `metric` | text | no |  | What is counted (e.g. an AI feature). _(PK)_ |
| `day` | text | no |  | UTC date, `YYYY-MM-DD`. _(PK)_ |
| `count` | integer | no | `0` | Uses that day. |

- Primary key: (`subject`, `metric`, `day`)

### team_students

A Research Team coach's roster, matched to accounts by email.

_Drizzle export `teamStudents`, `schema.ts:2096`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `owner_user_id` | text | no |  | The coach. _(PK, → `user.id` (on delete cascade))_ |
| `student_email` | text | no |  | Student's lowercased email. _(PK)_ |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Primary key: (`owner_user_id`, `student_email`)
- Indexes: `idx_team_students_email` on (student_email)

### team_assignments

Lesson plans and drills a coach assigns to their roster.

_Drizzle export `teamAssignments`, `schema.ts:2116`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | integer | no | _(SQL expr)_ | Primary key. _(PK)_ |
| `owner_user_id` | text | no |  | The coach. _(→ `user.id` (on delete cascade))_ |
| `kind` | text | no |  | `lesson-plan` or `practice-drill`. |
| `title` | text | no |  | Assignment title. |
| `body` | text | no | `` | Instructions. |
| `student_emails` | text | yes |  | Targeted students, JSON array; null means the whole roster. |
| `due_at` | integer | yes |  | Due date. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_team_assignments_owner` on (owner_user_id)

## Prediction markets

### prediction_wallets

Play-money balance per user for prediction markets. From `debate-predictions` migration 0001.

_Drizzle export `predictionWallets`, `schema.ts:2403`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `user_id` | text | no |  | Owning account (`user.id`). _(PK, → `user.id` (on delete cascade))_ |
| `balance` | integer | no |  | Points available. |
| `granted_at` | integer | no | _(SQL expr)_ | When the starting grant was paid. |
| `updated_at` | integer | no | _(SQL expr)_ | When the row was last changed. |

- Indexes: `idx_prediction_wallets_balance` on (balance)

### prediction_markets

One prediction market priced by LMSR (`debate-predictions`). Auto-markets are opened by the weekly cron.

_Drizzle export `predictionMarkets`, `schema.ts:2428`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | A UUID minted by the API. _(PK)_ |
| `kind` | text | no |  | `debate` \| `tournament` \| `rating`. |
| `title` | text | no |  | Market question. |
| `description` | text | no | `` | Details. |
| `creator_id` | text | yes |  | Who opened it; null for auto-markets or a deleted account. _(→ `user.id` (on delete set null))_ |
| `status` | text | no | `open` | `open` \| `resolved` \| `void`. |
| `outcomes` | text | no |  | `MarketOutcome[]`, JSON. |
| `shares` | text | no |  | LMSR share vector in outcome order, JSON. |
| `liquidity` | real | no |  | LMSR liquidity parameter b. |
| `version` | integer | no | `0` | Bumped by every bet for optimistic concurrency. |
| `volume` | integer | no | `0` | Total points staked. |
| `source` | text | no |  | Where the result comes from, JSON `MarketSource`. |
| `closes_at` | integer | no |  | When betting closes. |
| `resolved_outcome` | text | yes |  | Winning outcome id. |
| `resolved_at` | integer | yes |  | When settled. |
| `resolution_note` | text | yes |  | Why it settled that way. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_prediction_markets_status` on (status, closes_at); `idx_prediction_markets_creator` on (creator_id, status)

### prediction_bets

Individual bets; never deleted.

_Drizzle export `predictionBets`, `schema.ts:2466`._

| Column | Type | Null | Default | Purpose |
| --- | --- | --- | --- | --- |
| `id` | text | no |  | A UUID minted by the API. _(PK)_ |
| `market_id` | text | no |  | The market. _(→ `prediction_markets.id` (on delete cascade))_ |
| `user_id` | text | no |  | Owning account (`user.id`). _(→ `user.id` (on delete cascade))_ |
| `outcome_id` | text | no |  | Outcome bet on. |
| `stake` | integer | no |  | Points staked. |
| `shares` | real | no |  | Shares bought. |
| `payout` | integer | yes |  | Points paid on settlement (0 for a loss), null until settled. |
| `created_at` | integer | no | _(SQL expr)_ | When the row was created. |

- Indexes: `idx_prediction_bets_market` on (market_id, user_id); `idx_prediction_bets_user` on (user_id, created_at)

## Search index and bookkeeping

These are not in `schema.ts`. They are created at runtime or by the migration runner.

### debate_cards_fts

FTS5 full-text index over `debate_cards` (external content, `content_rowid = id`), created by
`apps/debate-ai.com/lib/search/card-fts.ts` and kept in step by three triggers
(`debate_cards_fts_ai`, `_ad`, `_au`). Indexed columns and their BM25 weights: `tag` 8,
`spoken` 4, `summary` 3, `cite` 3, `block` 3, `pocket` 2, `hat` 2, `fulltext` 1,
`fullcite` 1. A search request never builds the index for a large corpus; the weekly cron
finishes it (`lib/search/card-search-maintenance.ts`).

### debate_cards_vocab

`fts5vocab` view over `debate_cards_fts`: one row per indexed word, used for suggestions.

### debate_cards_fts_state

One-row table (`id = 1`) with `complete` (whether the index covers the whole corpus) and
`updated_at`.

### _d1_applied_migrations

Written by `.github/scripts/migrate-d1.ts`: one row per applied migration file.

| Column | Type | Purpose |
| --- | --- | --- |
| `name` | text, PK | File name, prefixed with `<package>/` for package migrations. |
| `applied_at` | integer | Unix time it was applied. |
