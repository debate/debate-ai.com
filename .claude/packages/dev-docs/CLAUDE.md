# CLAUDE.md — `dev-docs`

Private, unpublished (`"private": true`). Markdown only: the database table reference
(`database-schema.md`, `tabroom-schema.md`) and the self-hosting guide (`self-hosting.md`).

- Keep it out of every publish and deploy path: no `build`/`typecheck`/`test` scripts, no
  exports, no imports from other packages, and don't add it to `debate-help-docs`.
- When a change adds or alters a table in `apps/debate-ai.com/lib/database/schema.ts` or a
  `packages/*/migrations/*.sql` file, update the table's entry here in the same change.
- When a change adds an environment variable, add it to `self-hosting.md` (name, purpose,
  where it is read, required or optional). Never write real secret values.
