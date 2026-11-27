# @debate-ai/reading-mode

The host-independent half of the Debate AI browser extension's reading mode,
shared with the docs' Synergy Slayer reading mode.

- `@debate-ai/reading-mode/highlights`: mark a selected passage as
  `<mark class="reader-highlight">`, remove marks, list the marked passages.
- `@debate-ai/reading-mode/marks`: toggle underlining, highlighting or short
  (secondary) highlighting on a selection (`toggleMark`, the docs' auto
  modes), reset to the page's own marks (`clearMarks`), remove every mark (`removeAllMarks`),
  including taking it off authored `debate-hl` marks; mark a quoted phrase
  (`markPhrase`); and the AI prompt that cuts a passage (`autoCutPrompt`,
  `parseAutoCut`).
- `@debate-ai/reading-mode/summary-tags`: a summary tag (an AI-suggested, reader-edited
  note) stored as `data-summary-tag` on the highlights it covers: find the highlights a
  selection touches (`summaryTargets`), set or remove the tag (`setSummaryTag`,
  `removeSummaryTag`), keep its badge attributes in step (`syncSummaryTags`), and the
  prompt and reply parsing (`summaryPrompt`, `parseSummary`).
- `@debate-ai/reading-mode/questions`: the Ask and Questions prompts
  and reply parsing. Pass your own `generate({ system, prompt, maxTokens })`.
- `@debate-ai/reading-mode/sections`: load several rendered pages and keep one
  content element of each, to read a whole section as one document.
- `@debate-ai/reading-mode/export`: rendered HTML to Markdown (`htmlToMarkdown`),
  a cleaned copy (`exportableHtml`) and a standalone, printable HTML document
  (`standaloneHtmlDocument`), for the docs' Export menu.

```ts
import { suggestQuestions } from "@debate-ai/reading-mode/questions"

const questions = await suggestQuestions(generate, { article: text, maxQuestions: 4 })
```
