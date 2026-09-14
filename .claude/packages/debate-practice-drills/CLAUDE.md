# CLAUDE.md — `debate-practice-rounds` (`packages/debate-practice-drills`)

**Package name:** `debate-practice-rounds` — filter on that, not the directory.
Private. Entry `src/index.ts`, tests in `test/`.

Practice and AI round tooling: AI drill generator, AI coach mode, judge paradigm
picker, AI judge decision, opponent persona picker, word-count speeches,
practice round simulator, speech transcript summaries, argument-tree outline,
flow annotations, and AI response-outcome charts.

## This is the most downstream package in the repo

It composes **five** siblings: `debate-round`, `debate-speech-writer`,
`debate-timer`, `debate-search-evidence`, and `debate-contributor-progress`.

Consequences:

- Almost any break here originates upstream. Before debugging inside this
  package, check whether one of those five changed.
- **Compose, don't reimplement.** If you need round state, use `debate-round`;
  if you need a prompt, it belongs in `debate-speech-writer`. A local copy of an
  upstream behaviour is how these five drift apart.
- Adding a sixth dependency is a real architectural decision — say so in the PR.

## On the AI surfaces

- **AI judge decisions and coach feedback go to students, often minors.**
  Feedback should critique the argument, never the person. Keep the existing
  guardrails in the prompts.
- Prompts live in `debate-speech-writer`, not here. Put a new prompt there.
- An AI judge that is confidently wrong about a rule is worse than one that
  says it is unsure — preserve hedging in the output format.
