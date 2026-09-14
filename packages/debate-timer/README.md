<!-- template-git-repo:badges:start -->
<p align="center">
    <a href="https://debate-ai.com/docs"><img src="https://img.shields.io/badge/Docs-blue?logo=ReadTheDocs&logoColor=white" alt="Documentation" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/stargazers"><img src="https://img.shields.io/github/stars/debate/debate-ai.com" alt="GitHub Stars" /></a>
    <br />
    <a href="https://github.com/debate/debate-ai.com/issues"><img src="https://img.shields.io/github/issues/debate/debate-ai.com?logo=github" alt="GitHub Issues" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls"><img src="https://img.shields.io/github/issues-pr/debate/debate-ai.com?logo=github&label=PRs" alt="Open Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/pulls?q=is%3Apr+is%3Aclosed"><img src="https://img.shields.io/github/issues-pr-closed/debate/debate-ai.com?logo=github&label=PRs%20merged&color=8957e5" alt="Merged Pull Requests" /></a>
    <a href="https://github.com/debate/debate-ai.com/discussions"><img src="https://img.shields.io/github/discussions/debate/debate-ai.com" alt="GitHub Discussions" /></a>
    <a href="https://github.com/debate/debate-ai.com/commits/master/"><img src="https://img.shields.io/github/last-commit/debate/debate-ai.com.svg" alt="GitHub last commit" /></a>
    <br />
    <a href="https://stackblitz.com/github/debate/debate-ai.com/tree/master/packages/debate-timer"><img height="20px" src="https://developer.stackblitz.com/img/open_in_stackblitz.svg" alt="Open in StackBlitz" /></a>
    <img src="https://img.shields.io/badge/Bun-14151A?logo=bun&logoColor=white" alt="Bun" /> <img src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" alt="TypeScript" /> <img src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=white" alt="React" /> <img src="https://img.shields.io/badge/Vitest-6E9F18?logo=vitest&logoColor=white" alt="Vitest" />
</p>
<!-- template-git-repo:badges:end -->

# debate-timer

Round timing: the per-speech timer, the prep timer, per-format speech times, and the
speech recorder (mic selection, live waveform, playback) that records while the timer runs.

```tsx
import { SpeechTimer, PrepTimer, TimerProgressRing, useSpeechRecorder } from "debate-timer"
import { debateStyles, type DebateStyleKey } from "debate-timer/src/formats/debate-format-times"
import { wordCountStyles, getWordCountStatus } from "debate-timer/src/formats/word-count-format"
```

`TimerProgressRing` is a standalone, state-free SVG progress ring (0 = fresh, 1 =
time's up), extracted from the `debate-timer-progress` browser extension's timer
face so other UI — e.g. a nav button — can reuse the same circular-countdown
visual without pulling in the extension's timer logic.

`formats/word-count-format.ts` holds a second kind of format: speeches bounded by a
maximum word count instead of a timer, for asynchronous practice rounds. `countWords` and
`getWordCountStatus` are pure functions a submission UI can call as a debater types;
`estimateWordLimit` derives a word limit from an existing timed speech length so a
word-count format can mirror a timed format's speech order. This module is data and pure
logic only — it is not yet wired into `SpeechTimer`/`debate-round`'s timer state, which
is built around elapsed milliseconds.

Speech times are the source of truth for which columns a flow gets, so `debate-round`
depends on this package rather than the other way around.

## Package layout

Logic lives under `src/`, grouped by role; tests live under `test/`.

```
debate-timer/
├── src/
│   ├── audio/        # timer sound effects
│   ├── formats/      # per-format speech times and column layouts
│   ├── hooks/        # useSpeechRecorder
│   ├── recorder/     # mic selector, live waveform, recording player
│   ├── timers/       # SpeechTimer, PrepTimer
│   ├── types/        # timer and speech types
│   └── index.ts      # public entry point
└── test/             # Vitest suites for the format tables
```

## Tests

```bash
bun run test        # or: npx vitest run
bun run coverage    # writes ./coverage for this package alone
```

Suites live in `test/` and mirror the `src/` layout. Coverage for every package is
merged at the repo root by `bun run coverage` and uploaded to
[Codecov](https://app.codecov.io/gh/debate/debate-ai.com) by CI.

Current Codecov package coverage on `master` at commit `50322f5` is **4.10%** (tracked under
the `debate-timer` flag).
