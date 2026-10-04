# debate-types

Every shared Debate AI type in one place, published in-repo as **`@types/debate`**.
Each object and each field has a doc comment, so hovering one in your editor shows
what it means — no jumping to the owning package to find out.

Declarations only (`.d.ts`): no constants, no functions, nothing that runs. The
packages that used to declare these types keep their runtime code and re-export the
types from here, so existing imports keep working.

## Using it

Add it as a workspace dependency, then import from **`"debate"`**:

```jsonc
// package.json
"dependencies": { "@types/debate": "workspace:*" }
```

```ts
import type { Round, Card, PredictionMarket } from "debate"
```

The specifier is `"debate"`, not `"@types/debate"`: TypeScript refuses to import the
`@types/` scope by name (TS6137) and resolves `"debate"` to `@types/debate`, exactly as
it does for DefinitelyTyped packages. Use `import type` / `export type` so nothing is
emitted — there is no runtime module behind the name.

## What's in it

| File | Types | Previously declared in |
| --- | --- | --- |
| `timer.d.ts` | `TimerState`, `SpeechTimerState`, `TimerSpeech`, `DebateStyle`, `DebateStyleFlow` | `debate-timer` |
| `flow-record.d.ts` | `Flow`, `Box`, `Round`, `ArgumentType`, `EvidenceStatus` | `debate-timer` |
| `flow-model.d.ts` | `Scouting`, `Decision`, `Debater`, `Side` | `debate-flow` |
| `collab.d.ts` | `CollabDoc`, `CollabSheet`, `CollabCell`, `Register`, `Stamp`, `Json`, `Role` | `debate-flow` |
| `round-ui.d.ts` | `Setting` and its variants, `ViewMode`, `DebateFlowState`, `DebateFlowActions` | `debate-round` |
| `cards.d.ts` | `Card`, `OutlineNode`, `ParseResult`, `ParseOptions`, citation and name types | `debate-card-parser` |
| `videos.d.ts` | `VideoType`, `VideoQueryParams`, `VideoFacets`, feed/meta/stacks responses, topics, champions | `debate-videos`, `debate-data-sync` |
| `predictions.d.ts` | `PredictionMarket`, `MarketSource`, `NewMarket`, `NewBet`, wallet, board and Tabroom source types | `debate-predictions` |
| `practice.d.ts` | `DebateMessage`, `DebateVsBotRecord`, request/response bodies, `JudgmentData`, `GamificationAward` | `debate-round-practice-ai` |
| `tournaments.d.ts` | `D1DatabaseLike` and friends | `debate-tournaments` |
| `documents.d.ts` | `ReasonDocument` | `debate-webview` |
| `system.d.ts` | `SystemInfo` | `debate-flow` |

Constants (`STARTING_BALANCE`, `MARKET_KINDS`, `DEBATE_STYLE_LABELS`, …) and helper
functions (`generateRoundTitle`, `isRole`, `cellKey`, …) stay in their owning packages.

## Adding a type

1. Put it in the file for its domain (or add a new `.d.ts` and `export *` it from
   `src/index.d.ts`). Keep the file declarations-only.
2. Give the type and **every field** a `/** … */` comment. `bun run test` fails if an
   exported type or interface field has none (`test/docs.test.ts`).
3. In the owning package, `export type { … } from "debate"` instead of declaring it, so
   existing imports of that package keep resolving.
4. Add `"@types/debate": "workspace:*"` to that package's dependencies.

Names must be unique across the whole package (the barrel is flat). `videos.d.ts` calls
its style union `VideoDebateStyle` for that reason — `debate-videos` re-exports it under
its old name, `DebateStyle`.

## Not collected

Types tied to something that runs stay with it: component props, store shapes, types
derived from code (`keyof typeof …`, Drizzle `$inferSelect`), and the vendored Tabroom
schema in `debate-tournaments`. Many `debate-*` packages also declare small types inline
in feature files; those move here when they start crossing a package boundary.
