# debate-timer

Round timing: the per-speech timer, the prep timer, per-format speech times, and the
speech recorder (mic selection, live waveform, playback) that records while the timer runs.

```tsx
import { SpeechTimer, PrepTimer, useSpeechRecorder } from "debate-timer"
import { debateStyles, type DebateStyleKey } from "debate-timer/src/formats/debate-format-times"
import { wordCountStyles, getWordCountStatus } from "debate-timer/src/formats/word-count-format"
```

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

Current Codecov package coverage on `master` at commit `5b69dad` is **4.03%**.
