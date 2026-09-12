# CLAUDE.md — `debate-speech-writer`

Private. The **AI prompt library** behind FIAT's speech and flow features:
flow extraction, judge decisions, flaw finding, research outlines, and a batch
quote-analysis helper. Entry `src/index.ts`, tests in `test/`.

## This package is prompts, and prompts are code

- **Every prompt used anywhere in the product belongs here**, not inline at the
  call site. `debate-practice-drills` and `debate-round` consume this library;
  a prompt written next to a component is one nobody can find or review.
- **A prompt edit is a behaviour change.** Treat it like one: say what you
  changed and why, and pin the output contract (shape, required fields) in a
  test. A reworded prompt that silently drops a JSON field breaks a caller with
  no stack trace.
- **Keep output structured.** Callers parse these results. Free-form prose where
  a schema was expected is the failure mode.

## On what these prompts produce

Judge decisions, flaw finding and coach feedback are read by students, many of
them minors, about work they just did. The prompts critique **the argument**,
not the debater, and hedge where the model is not sure. Those guardrails are
deliberate — don't strip them for terseness.

Batch quote analysis fans out LLM calls; watch cost and rate limits when
changing batch sizes.
