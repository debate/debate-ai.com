# Practice vs AI

Lets a debater run a full timed round against an AI opponent: pick one of 13
opponent personas across five difficulty tiers, set the topic, stance and
per-phase clocks, debate through opening statements, cross-examination and
closing statements, then get an AI-judged scorecard.

- **Route:** `/versus-ai`
- **Nav:** the app dock ("Practice vs AI"); the Tools page's Prep & Practice group
- **Package:** [`debate-practice-vs-ai`](../../packages/debate-round-practice-ai/README.md)
- **API:** `POST /api/vsbot/create`, `/debate`, `/judge`, `/concede`

## What it shows

**Bot picker.** Difficulty tiers (Easy, Medium, Hard, Expert, Legends) expand
to the personas in each — Rookie Rick and Casual Casey through Grand Greg, and
the Legends tier's Yoda, Tony Stark, Professor Dumbledore, Rafiki and Darth
Vader. Selecting one shows its quote, tier and rating. Alongside it, a setup
panel takes the topic (a preset or free text, capped at 200 characters), the
user's stance (For, Against, or let the system decide), and a duration for
each of the three phases (60–600 seconds). The draft is kept in
`localStorage` so a reload doesn't lose it.

**The round.** Two panels side by side, the user's and the bot's, with the
active speaker's panel glowing and a countdown on each. Who speaks and what
kind of turn it is comes from the round's phase tables: opening statements
alternate For then Against; cross-examination runs question, answer, question,
answer; closing statements alternate again. The user types or dictates their
turn (Web Speech API), and the bot's turns are generated in persona. A
Concede button ends the round early as a loss.

**The scorecard.** Each phase is scored out of 10 for both sides with the
judge's reasoning, then totals out of 40, a verdict, and follow-up drill
recommendations picked from the user's weakest phases.

## How it works

The feature is a port of the Go `arguehub` vs-bot server and its Vite/React
client, both of which remain in `packages/debate-round-practice-ai/backend/`
and `frontend/` as the port's reference sources.

- The 13 personas come from the Go `GetBotPersonality` switch, carried over
  field for field: tone, rhetorical style, catchphrases, philosophical tenets,
  universe ties, signature moves, and per-opponent-style interaction
  modifiers. `inferOpponentStyle` classifies the user's latest message
  (aggressive, logical, emotional, confident, irrational) and the persona's
  matching modifier is folded into its prompt.
- The judge prompt asks for a strict-JSON scorecard and factors the bot's own
  persona adherence into the rubric.
- Rounds are stored in `practice_vs_ai_debates` (one row per round; the full
  record in a `data` JSON blob) through the `DebateStore` seam the package
  defines — see `apps/debate-ai.com/lib/practice-vs-ai/store.ts`.
- Text generation goes through `ANTHROPIC_API_KEY`, falling back to
  `GEMINI_API_KEY` (what the Go server used). With neither set the round still
  runs: each persona answers with its own in-character "my systems are
  offline" line, as the Go server did with an unset key.

## Known gaps

- Gamification is computed but not persisted. The package ports the Go
  controller's point values (win 50, draw 25, loss 10) and badge thresholds
  (`FirstWin`, `Novice`, `Streak5`, `FactMaster`) as
  `computeGamificationAward`, but this app's `user` table has no
  `score`/`badges`/`streak` columns, so the Drizzle store leaves the
  `applyGamificationAward` hook unset and records only the round's win/loss on
  the debate row.
- A round is held in component state, so a reload during a round returns to
  the picker. The transcript itself survives in `localStorage` and on the
  debate row; resuming from a stored `debateId` is not wired up.
- Only the vs-bot slice of the Go server is ported. Human-vs-human and team
  rounds, WebSocket spectating, matchmaking, tournaments and Glicko-2 ratings
  remain Go and are not reachable from this app.
