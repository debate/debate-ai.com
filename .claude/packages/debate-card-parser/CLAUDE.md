# CLAUDE.md — `debate-card-parser`

Private. Turns Verbatim `.docx` files and HTML into structured evidence cards
with citations and highlighting. Entry: `src/index.ts` (consumed as source —
no build step). Tests in `test/`.

## Every input is hostile

This package's entire job is parsing files that came from somewhere else:
another debater's laptop, a shared drive, a camp file from 2014. So:

- **Malformed input is the normal case, not the exception.** A `.docx` with a
  broken relationship table, a truncated zip, mismatched highlight ranges, or
  HTML with unbalanced tags must produce a diagnosable failure — never an
  exception that reaches a route, and never a silently half-parsed card.
- **Never evaluate or execute anything from a document.** No dynamic HTML
  injection, no template evaluation of card text.
- **Highlighting and citation ranges are the product.** A card whose
  highlighting drifts by a character is worse than one that failed to parse —
  debaters read the underlined text as the argument. Offsets need tests.
- Round-tripping matters: `debate-editor` claims lossless Verbatim interop, and
  this parser is half of that claim.

Add a fixture for every real-world document shape you fix. That fixture corpus
is the only defense against a regression here.
