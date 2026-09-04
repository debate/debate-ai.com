# debate-practice-vs-ai

**Practice vs AI** — a full timed debate round against an AI opponent, mounted
in debate-ai.com at [`/versus-ai`](../../apps/debate-ai.com/app/versus-ai/page.tsx)
and reachable from the app dock.

This package is the Node/TypeScript port of the Go `arguehub` vs-bot server and
its Vite/React client, both of which still sit alongside it in `backend/` and
`frontend/` as the reference sources. Nothing in the port calls Go, Mongo or
Gin: it is plain TypeScript, `fetch`-based, and runs under Next.js or a
Cloudflare Worker.

## What's in it

| Export | Ported from | What it is |
| --- | --- | --- |
| `./backend` | `backend/controllers/debatevsbot_controller.go`, `backend/services/*.go`, `backend/models/debatevsbot.go`, `backend/routes/debatevsbot.go` | The vs-bot server: 13 bot personalities, prompt construction, AI judging, gamification rules, and the four `/vsbot/*` handlers |
| `./client` | `frontend/src/services/vsbot.ts` | The browser client for those endpoints |
| `./ui` | `frontend/src/Pages/BotSelection.tsx`, `frontend/src/Pages/DebateRoom.tsx`, `frontend/src/components/JudgementPopup.tsx` | The round screens |

### Backend

- **`personalities.ts`** — all 13 personas from the 1000-line
  `GetBotPersonality` switch (Rookie Rick through Darth Vader), every field
  carried over verbatim, plus the neutral default.
- **`prompt.ts`** — `formatHistory`, `findLastUserMessage`,
  `inferOpponentStyle`, `constructPrompt` and the judging rubric, with the
  prompt text unchanged from the Go source.
- **`persona-fallbacks.ts`** — the per-persona "my systems are offline" and
  "say that again" lines, so the bot never breaks character on an error.
- **`model-client.ts`** — replaces the Go process-global `genai.Client` with an
  injectable `ModelClient`. Anthropic, Gemini (including the Go server's four
  `BLOCK_NONE` safety settings) and OpenAI implementations are provided, all as
  plain `fetch` calls.
- **`store.ts`** — replaces the hardcoded Mongo collection with a `DebateStore`
  interface plus an in-memory implementation. debate-ai.com supplies a
  Drizzle/D1-backed one in
  [`lib/practice-vs-ai/store.ts`](../../apps/debate-ai.com/lib/practice-vs-ai/store.ts).
- **`gamification.ts`** — the Go controller's point values (win 50, draw 25,
  loss 10) and badge thresholds (`FirstWin`, `Novice`, `Streak5`, `FactMaster`)
  as pure functions over a profile snapshot.
- **`handlers.ts`** — the four endpoints. Gin handlers took a `*gin.Context`
  and wrote to the socket; these take a parsed body plus an already-resolved
  actor and return `{ status, body }`, so the host owns auth and transport.

### What deliberately changed

- **Auth** — the Go handlers each parsed a bearer token and called
  `ValidateTokenAndFetchEmail`. The host resolves the caller instead and passes
  a `DebateActor`; debate-ai.com uses its Better Auth session cookie.
- **Routing** — upstream's three react-router routes (`/game`, `/debate/:id`,
  and the scorecard) became one Next.js route, because round setup was passed
  through `location.state` and would be lost on reload.
- **Turn advancement** — upstream called `advanceTurn` from inside `setState`
  updaters, a side effect during render that misfires under React 18+
  StrictMode. The updaters are pure here and turn changes apply against a ref.
- **Hardcoded dev URLs** — the scorecard's "skills to improve" cards pointed at
  `http://localhost:5173/coach/...`; they are now a `coachSkills` prop.

### Out of scope

Only the Practice vs AI (vs-bot) slice of the Go server is ported. The rest of
`backend/` — WebSocket rooms, human-vs-human and team debates, matchmaking,
tournaments, Glicko-2 ratings, auth, admin — is untouched and still Go.

## Using it

```tsx
// A page
import { DebatePracticeVsAi } from "debate-practice-vs-ai"

<DebatePracticeVsAi userId={session.user.id} userDisplayName={session.user.name} />
```

```ts
// A route handler
import { createAnthropicModelClient, createPracticeVsAiBackend } from "debate-practice-vs-ai"

const backend = createPracticeVsAiBackend({
  store,
  model: createAnthropicModelClient({ apiKey: process.env.ANTHROPIC_API_KEY! }),
})
const { status, body } = await backend.createDebate(actor, await request.json())
```

With no model key configured the round still runs: every persona answers with
its own in-character "my systems are offline" line, exactly as the Go server
behaved with an unset Gemini key.

## Layout

```
src/
├── backend/     # the ported Go vs-bot server
├── client/      # the ported browser client
├── ui/          # the ported round screens
└── index.ts
backend/         # the original Go source, kept as the port's reference
frontend/        # the original Vite/React source, kept as the port's reference
UPSTREAM.md      # the upstream project's own README
```

Run `bun run test` for the port's 55 tests and `bun run typecheck` for types.
