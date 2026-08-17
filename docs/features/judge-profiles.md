# Judge Profiles

Shows every persisted judge profile as a roster — side-vote bias, average
speaker points, delivery-speed tolerance, theory receptiveness, and the
paradigm each judge is most often tagged with — ordered by rounds judged
(most experienced first).

- **Route:** `/judges`
- **Nav:** the global dock's Settings menu → **Judge Profiles**
- **Package:** [`debate-speech-writer`](../../packages/debate-speech-writer/README.md)

## What it shows

For every judge with a saved `JudgeProfile`:

| Column | Meaning |
| --- | --- |
| Judge | `judgeId` |
| Rounds | Total rounds judged, across every tournament tracked |
| Side record | Aff/Neg win record, flagged "notable bias" once it clears the `judge-profile.ts` threshold |
| Avg speaker pts | Overall average speaker points awarded |
| Speed tolerance | `low` / `medium` / `high`, or "unknown" if no round tracked pace |
| Theory receptiveness | `low` / `medium` / `high`, or "unknown" if no round raised a theory argument |
| Paradigm | The judge's most-tagged paradigm, if any round was tagged with one |

## Data flow

```
state/judgeProfiles.ts (localStorage: judgeProfiles)
  → buildJudgeProfilesRoster()             — lists every persisted JudgeProfile,
                                              ordered by rounds judged descending
                                              (ties broken alphabetically)
  → panels/JudgeProfilesPanel.tsx          — renders it as a roster table
  → apps/debate-ai.com/app/judges/page.tsx — mounts the panel as a route
```

Every profile field already existed and was Vitest-covered by
`judge/judge-profile.ts`'s `buildJudgeProfile`; this feature closes
follow-up (b), "a judge-profile card/panel UI," named under the "⚖️ Judge
Profiles" bullet in `TODO.md`, adding one small ordering helper
(`buildJudgeProfilesRoster`) to `state/judgeProfiles.ts` rather than
introducing new aggregation logic. Vitest-covered in
`packages/debate-speech-writer/test/judgeProfiles.test.ts`.

## Known gaps

- No real ballot data source yet (follow-up (a) — no `Round`/ballot schema
  in this repo captures speaker points, pace, or theory outcomes today);
  a `JudgeProfile` only appears here once a caller has supplied
  `JudgeRoundRecord`s (e.g. reconstructed from tab-service ballots) and
  saved the resulting profile through `saveJudgeProfile`.
- No profile editing/creation UI here — this panel only renders existing
  persisted profiles.
