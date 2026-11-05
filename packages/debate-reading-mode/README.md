# @debate-ai/reading-mode

The host-independent half of the Debate AI browser extension's reading mode,
shared with the docs' Synergy Slayer reading mode.

- `@debate-ai/reading-mode/highlights`: mark a selected passage as
  `<mark class="reader-highlight">`, remove marks, list the marked passages.
- `@debate-ai/reading-mode/questions`: the Ask and Suggest questions prompts
  and reply parsing. Pass your own `generate({ system, prompt, maxTokens })`.
- `@debate-ai/reading-mode/sections`: load several rendered pages and keep one
  content element of each, to read a whole section as one document.

```ts
import { suggestQuestions } from "@debate-ai/reading-mode/questions"

const questions = await suggestQuestions(generate, { article: text, maxQuestions: 4 })
```
