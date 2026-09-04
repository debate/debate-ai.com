# debate-practice-vs-ai

An exportable **Online Debate Versus AI** practice-round feature for Debate AI
hosts. It provides the full format/side setup, turn-order workflow, persisted
local practice rounds, AI speech generation, regeneration, and transcript
download experience used by debate-ai.com.

```tsx
import { DebatePracticeVsAi } from "debate-practice-vs-ai"

export function PracticePage() {
  return <DebatePracticeVsAi />
}
```

`AiVersusRoundPanel` remains available as a named compatibility export. The
component expects the host to provide the Debate AI shared styles and the
`/api/reason-ai` endpoint used to generate speeches.

## Development

```bash
bun run typecheck
bun run test
```
