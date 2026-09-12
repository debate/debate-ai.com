# CLAUDE.md — `apps/debate-web-ext`

The Debate AI **browser extension**: a debate round timer with prep clocks.

## It is not a workspace

The root `workspaces` globs are `["packages/*", "apps/debate-ai.com"]` — this
app is deliberately outside them. That means:

- A root `bun install` does **not** install it.
- `turbo` never fans out into it; `bun run test`, `bun run typecheck` and
  `bun run coverage` at the root never touch it.
- **Nothing in the repo's CI will tell you that you broke it.**

So: install and build from inside this directory, and say explicitly in the PR
that you changed the extension and how you verified it.

## Extension constraints

- **Manifest permissions are the security surface.** Adding a host permission or
  a broad content-script match widens what the extension can read on every page
  a user visits. Keep permissions minimal and justify any addition in the PR.
- No remote code. Extension stores reject it and it is a real risk — bundle
  everything.
- A background/service worker in MV3 is **not persistent**: it is torn down and
  restarted. A timer implemented with in-memory interval state will lose time.
  Compute elapsed time from a stored timestamp.
- Versioning is store-visible: the extension is at `5.2.0`, independent of the
  web app's version.
