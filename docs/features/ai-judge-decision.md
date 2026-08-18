# AI Judge Decision

Requests a real Anthropic-backed judge verdict for a round — a winning side,
ordered voting-issue reasoning, and a short ballot paragraph — decided
strictly under that round's saved judge paradigm and weighing its saved flow
summary. Closes follow-up (a) under idea #5 ("AI Judge Decision Modes") in
`TODO.md`'s Product Feature Ideas list.

- **Route:** `/judge-decision`
- **Nav:** the global dock's Settings menu → **AI Judge Decision**
- **Package:** [`debate-round`](../../packages/debate-round/README.md)

## What it shows

A form to request a round's decision: a round ID and the two sides' display
labels (defaulting to "Affirmative"/"Negative"). Below the form, every
persisted `JudgeDecisionRecord` is listed — round ID, the paradigm it was
judged under, the winning side, the ballot paragraph, and each reasoning
bullet — with a "Clear" action per round.

Requesting a decision for a round that hasn't yet saved a flow summary
(`/summaries`) or a judge paradigm (`/paradigms`) shows an inline message
naming exactly what's missing, instead of calling the AI or crashing.

## Data flow

```
"Get AI decision" click:
  panels/JudgeDecisionPanel.tsx
    → buildJudgeDecisionAiInputFromStores(roundId, sideLabels)
        — round/judge-decision-from-stores.ts
        → getFlowSummary(roundId)              — state/flowSummaries.ts (localStorage)
        → getJudgeParadigmSelection(roundId)   — debate-speech-writer's
                                                   state/judgeParadigmSelections.ts (localStorage)
        → buildFlowSummaryTextFromRows()       — flow/flow-transcript-summary.ts (pure)
        (returns null if either store has no saved record for roundId)
    → requestJudgeDecision(input)               — round/judge-decision-client.ts
        → buildJudgeDecisionUserPrompt()         — round/judge-decision-ai.ts (pure)
            → buildJudgeParadigmPrompt()          — debate-speech-writer's
                                                      judge/judge-paradigms.ts (pure)
        → POST /api/reason-ai                    — apps/debate-ai.com/app/api/reason-ai/route.ts
            → https://api.anthropic.com/v1/messages
        → parseJudgeDecisionAiResponse()          — round/judge-decision-ai.ts (pure)
    → saveJudgeDecision()                         — state/judgeDecisions.ts (localStorage)
  → panels/JudgeDecisionPanel.tsx (renders the verdict inline)
  → apps/debate-ai.com/app/judge-decision/page.tsx (mounts the panel as a route)
```

This reuses the existing `/api/reason-ai` Anthropic proxy — the same route
`ai-versus-speech-client.ts`, `llm-card-scoring-client.ts`, and
`reason-editor` already call — rather than standing up a second route.
`/api/reason-ai` requires `ANTHROPIC_API_KEY` to be configured server-side
and the user to be signed in (the same gate every other caller of that route
goes through); without either, clicking "Get AI decision" surfaces the
proxy's error message inline (e.g. "Sign in to use AI features." or "AI
features are not configured on this server.") rather than crashing the
panel. A malformed, non-JSON, or off-menu (`winner` not matching either side
label) AI reply is handled the same way —
`parseJudgeDecisionAiResponse` returns `null` rather than throwing, and the
panel shows an inline error.

The existing static, free-form `judgeDecisionPrompt`
(`packages/debate-speech-writer/src/prompts/judge-decision-options.ts`) is
unchanged — this feature adds a second, structured path that asks for one
JSON verdict under a single selected paradigm, rather than that prompt's
dual-ballot, multi-paradigm-rotation format.

See `packages/debate-round/test/judge-decision-ai.test.ts` and
`judge-decision-client.test.ts` for prompt-building/response-parsing and
`fetch`-client coverage, `judgeDecisions.test.ts` for the persisted-store
coverage, and `judge-decision-from-stores.test.ts` for the
store-composition coverage.

## Known gaps

- Side labels are free-text, not derived from the round's actual saved
  `AiVersusSide`/format — a user can type any two labels, and they only need
  to match what the AI replies with.
- Decisions are per-browser localStorage, not a shared team resource.
- No UI regenerates a decision automatically when the underlying flow
  summary or paradigm selection changes after a decision was saved — a user
  must click "Get AI decision" again.
