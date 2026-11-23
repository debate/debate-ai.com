# CLAUDE.md — `debate-practice-rounds` (`packages/debate-practice-drills`)

**Package name:** `debate-practice-rounds` — filter on that, not the directory.
Public (`@debate-ai/` scope). Entry `src/index.ts`, tests in `test/`.

Practice and AI round tooling: AI drill generator, AI coach mode, AI judge
decision, word-count speeches, practice round simulator, speech transcript
summaries, argument-tree outline, flow annotations, and AI response-outcome
charts. Also practice partners (`src/practice-partners`: challenges, the match
finder, the profile form), the judge pool (`src/judge-pool`: listings, hire
requests, the circuit's season weekends), and Online Challenges
(`src/debate-challenges`: async written debates vs players or the AI; turn
rules, XP/boost/trophy rewards, the topic list from `debate-topics.json`, and
the AI opponent/judge prompts, which are specific to this format and so live
here rather than in `debate-speech-writer`). Rebuttal Playlists
(`src/rebuttal-playlists`) follows the same split: static playlists, pure
pairing/drill rules, progress, and its own AI partner/coach/judge prompts;
the app's `lib/rebuttal-drills/` stores drills in `rebuttal_drills`. Topic
Sign-ups (`src/topic-signups`: the Practice Debates tab every listed
resolution links to, for signing up, finding partners, research squads and
research notes) keeps types, validation and the client here; the app's
`lib/topic-signups/` stores them in `topic_signups`, `topic_squads`,
`topic_squad_members` and `topic_notes`. The link format and board key
(`topicSignupHref`, `topicKey`) live in `debate-rankings`'
`src/topics/topic-signup-link.ts`, so `debate-videos` can link without
depending on this package.

The framework-free files in those folders (`types`, `validation`,
`challenge-actions`, `match`, `match-token`, `season-calendar`, `filter`,
`rules`, `rewards`, `topics`, `prompts`, `playlists`, `progress`) are
imported **by path** from the app's API routes and `lib/*/queries.ts`. Keep
them free of React and of `src/index.ts`, which pulls in every panel.

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
