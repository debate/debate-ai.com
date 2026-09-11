# CLAUDE.md — `debate-practice-vs-ai` (`packages/debate-round-practice-ai`)

**Package name:** `debate-practice-vs-ai` — filter on that, not the directory.
Private. Mounted at `/versus-ai`. Tests in `test/`.

A full timed debate round against an AI opponent: a Node/TypeScript port of the
Go `arguehub` vs-bot backend — 13 bot personalities, prompt construction, AI
judging, gamification — plus the React round UI.

## Public surface

`.` · `./backend` · `./client` · `./ui` — three deliberately separate entry
points. Keep them separate: `./backend` must stay runnable without the UI.

## The porting constraint

The original was Go + Gin + Mongo. **This port uses plain `fetch` and no Go,
Mongo or Gin**, and runs under Next.js *or* a Cloudflare Worker. That is the
whole point of the port, so:

- **No Node-only APIs in `./backend`.** No `fs`, no native modules, nothing that
  assumes a long-lived process. It has to run on a Worker.
- No database driver. Persistence goes through the app's D1 layer.
- When porting more behaviour from upstream `arguehub`, port the *logic*, not
  the runtime assumptions.

## On the bots

- The 13 personalities are a product surface — their prompts define how they
  argue. Don't merge or "clean up" personalities without saying so.
- **Opponents argue against students, including minors.** A persona is
  adversarial about the resolution, never about the debater. Keep that boundary
  in the prompt construction.
