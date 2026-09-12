<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-speech-writer"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=white" alt="React" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

# debate-speech-writer

The AI prompt library behind the FIAT speech and flow features, plus the batch
quote-analysis helper that scores parsed cards.

Each prompt is a plain exported template string, so a caller can compose it with its own
context and send it to whichever model the app is configured for:

```ts
import {
  speechToFlowPrompt,       // speech document -> a new flow column
  speechToResponsePrompt,   // opponent speech -> response options
  judgeDecisionPrompt,      // flow -> aff-wins and neg-wins decision outlines
  findFlawsPrompt,          // quote -> warrants, gaps and overstatements
  textToHighlightedPrompt,  // card text -> highlight/underline spans
  topicToResearchOutlinePrompt, // topic -> research outline of keyphrases
} from "debate-speech-writer"
```

`analyzeQuotes()` walks an outline of parsed cards (see `debate-card-parser`), sends each
card's HTML through `findFlawsPrompt`, and writes the summaries, warrants, scores and
flaws back onto the outline entries.

```ts
import { analyzeQuotes } from "debate-speech-writer"

const analyzed = await analyzeQuotes("./outline.json", { limit: 50, maxChars: 8000 })
```

Prompts are treated as a contract: the test suite asserts each one stays a distinct,
non-trivial string with no unreplaced template placeholders, so an accidental truncation
during editing fails CI rather than silently degrading model output.

`JudgeProfilesPanel` renders every persisted judge profile (built with `buildJudgeProfile`,
saved with `saveJudgeProfile`) as a roster, mounted at `/judges` in the web app:

```tsx
import { JudgeProfilesPanel } from "debate-speech-writer"

<JudgeProfilesPanel />
```

`JudgeParadigmPickerPanel` lets a user save a round's judge paradigm — a built-in one from
`judge-paradigms.ts` or a custom one built from a real judge's notes — through
`saveJudgeParadigmSelection`, and lists every round with a saved selection, mounted at
`/paradigms` in the web app:

```tsx
import { JudgeParadigmPickerPanel } from "debate-speech-writer"

<JudgeParadigmPickerPanel />
```

`OpponentPersonaPickerPanel` lets a user save a practice session's AI opponent persona — one
of the four built-in personas from `opponent-personas.ts` — plus an independent difficulty
level (Beginner/Intermediate/Advanced/Elite, from `opponentDifficulties`) — through
`saveOpponentPersonaSelection`, and lists every session with a saved selection, mounted at
`/practice-opponent` in the web app:

```tsx
import { OpponentPersonaPickerPanel } from "debate-speech-writer"

<OpponentPersonaPickerPanel />
```

`CoachMaterialsPanel` lets a coach upload grounding materials (lecture transcripts, camp
materials, instructional documents, practice-round recordings) through `saveCoachMaterial`,
lists every persisted material grouped by kind, and lets a coach ask the team coach AI a
question — previewing which materials + grounded prompt it draws on via
`findRelevantMaterialsFromStore`/`buildGroundedCoachPrompt`, then calling `requestTeamCoachAnswer`
for a real, grounded answer — mounted at `/coach-materials` in the web app:

```tsx
import { CoachMaterialsPanel } from "debate-speech-writer"

<CoachMaterialsPanel />
```

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-speech-writer/
├── src/
│   ├── analysis/     # batch LLM analysis over parsed cards
│   ├── coach/        # team coach-material library, grounded prompt, real AI Q&A call
│   ├── judge/        # judge-paradigm registry, judge-profile aggregation
│   ├── opponent/      # AI practice-opponent persona registry
│   ├── panels/       # JudgeProfilesPanel, JudgeParadigmPickerPanel, OpponentPersonaPickerPanel,
│   │                 # CoachMaterialsPanel
│   ├── prompts/      # the prompt library
│   ├── state/        # localStorage-backed persistence stores
│   └── index.ts      # public entry point
└── test/             # Vitest suites asserting the prompt contracts and state helpers
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **57.45%** (tracked under
the `debate-speech-writer` flag).
