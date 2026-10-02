---
id: glicko-debate-rankings
title: "Glicko-2 Debate Rankings"
sidebar_position: 1
---

# Glicko-2 Debate Rankings

Glicko-2 is a rating system for estimating competitive strength from head-to-head results. It is a useful fit for debate rankings because teams do not all attend the same tournaments, face equally difficult opponents, or compete equally often.

Rather than assigning every team a single fixed score, Glicko-2 tracks three values:

| Symbol | Name | Meaning |
|---|---|---|
| \(r\) | Rating | Estimated competitive strength. Higher is stronger. |
| \(RD\) | Rating deviation | Uncertainty in the rating. Higher means less confidence and therefore faster early movement. |
| \(\sigma\) | Volatility | How much a team's underlying performance is expected to fluctuate over time. |

A ranking should display at least both rating and RD. A team at 1650 with RD 45 is a much more certain estimate than a team at 1650 with RD 220.

## Why use Glicko-2 for debate

Debate data has several properties that make a simple win percentage or fixed-K Elo ranking misleading:

- Teams attend different numbers of tournaments.
- Schedules have unequal strength: some teams repeatedly meet elite opposition while others have easier fields.
- New teams have little evidence, so their early ratings should move quickly.
- A team can become inactive for months or an entire season, making an old rating less trustworthy.
- Teams can improve rapidly after changing partners, coaches, research practices, or competitive experience.

Glicko-2 accounts for these issues through uncertainty. Upsetting a highly rated opponent with a well-established rating is stronger evidence than defeating a team whose rating is highly uncertain. Ratings also become less certain during inactivity.

## Rating model

Glicko-2 uses an internal scale for calculations:

```latex
\[
\mu = \frac{r - 1500}{173.7178},
\qquad
\phi = \frac{RD}{173.7178}.
\]
```

Where:

- \(r\) is the user-facing rating, typically centered around 1500.
- \(\mu\) is the internally scaled rating.
- \(RD\) is the user-facing rating deviation.
- \(\phi\) is the internally scaled rating deviation.

A conventional initial state is \(r = 1500\), \(RD = 350\), and \(\sigma = 0.06\). These are defaults, not a law of the system; a debate platform may calibrate them from historical results.

## Expected result

For a team with internal rating \(\mu\) competing against opponent \(j\), define the opponent-reliability adjustment:

```latex
\[
g(\phi_j) = \frac{1}{\sqrt{1 + \frac{3\phi_j^2}{\pi^2}}}.
\]
```

Then the expected score is:

```latex
\[
E(\mu, \mu_j, \phi_j)
= \frac{1}{1 + \exp\!\left[-g(\phi_j)(\mu - \mu_j)\right]}.
\]
```

Definitions:

| Term | Definition |
|---|---|
| \(\mu\) | The focal team's internal rating before the rating period. |
| \(\mu_j\) | Opponent \(j\)'s internal rating. |
| \(\phi_j\) | Opponent \(j\)'s internal rating deviation. |
| \(g(\phi_j)\) | A discount for uncertainty in the opponent's rating. |
| \(E\) | Expected score, from 0 to 1. |

For a binary debate result, encode the observed score \(s_j\) as:

```latex
\[
s_j =
\begin{cases}
1, & \text{win}, \\
0.5, & \text{draw or tied result, if the format permits it}, \\
0, & \text{loss}.
\end{cases}
\]
```

A value of \(E = 0.75\) means the current ratings imply a 75% expected score against that opponent. A win is positive evidence when \(s_j - E > 0\); a loss is negative evidence when \(s_j - E < 0\).

## Rating-period update

A **rating period** is the set of results processed together. It might be a tournament, a weekend, a weekly batch, or another fixed window. For debate, a tournament-level period is often intuitive because it avoids letting multiple rounds in the same tournament immediately compound in an order-dependent way.

After processing the period's results and updating volatility, Glicko-2 computes the new internal rating deviation \(\phi'\), then updates the rating:

```latex
\[
\mu' =
\mu +
\phi'^{\,2}
\sum_{j=1}^{m}
g(\phi_j)
\left[
s_j - E\!\left(\mu, \mu_j, \phi_j\right)
\right].
\]
```

Definitions:

| Term | Definition |
|---|---|
| \(\mu'\) | Updated internal rating after the period. |
| \(\mu\) | Internal rating before the period. |
| \(\phi'\) | Updated internal rating deviation after volatility and new results are considered. |
| \(m\) | Number of scored debates in the rating period. |
| \(j\) | Index of one opponent/result in the period. |
| \(g(\phi_j)\) | Reliability adjustment based on opponent \(j\)'s uncertainty. |
| \(s_j\) | Actual result against opponent \(j\): 1, 0.5, or 0. |
| \(E(\mu, \mu_j, \phi_j)\) | Expected score against opponent \(j\). |

Finally, convert the internal values back to display values:

```latex
\[
r' = 173.7178\mu' + 1500,
\qquad
RD' = 173.7178\phi'.
\]
```

## Interpreting the update

The expression \(s_j - E\) is the result residual:

- If a team was expected to score 0.70 and wins, the residual is \(1 - 0.70 = 0.30\): a positive but modest surprise.
- If it was expected to score 0.20 and wins, the residual is \(1 - 0.20 = 0.80\): a large upset and stronger positive evidence.
- If it was expected to score 0.70 and loses, the residual is \(0 - 0.70 = -0.70\): strong negative evidence.

The full update is not merely a sum of wins and losses. Opponent certainty matters, and the updated uncertainty multiplier \(\phi'^2\) controls how far the rating moves.

## Important batch-period behavior

When multiple debates are processed together, the post-period uncertainty \(\phi'\) is shared by the entire rating update. More games generally reduce RD, which means the system becomes more confident in the final rating.

This can create a counterintuitive batch effect: adding a second expected win against a much weaker opponent may increase the positive residual sum but also lower \(\phi'^2\). In some cases, the lower uncertainty multiplier can offset enough of the added residual that the final post-period rating is lower than it would have been with only the first result.

That behavior follows from the batch Glicko-2 formulation. It does **not** mean that winning is treated as bad evidence. Instead, the system is jointly estimating strength and confidence: more evidence can narrow the estimate while changing its final mean by less than a naïve per-win model would suggest.

## Recommended debate policies

### Unit being rated

Choose the competitive entity deliberately:

- **Team rating:** Best when the same pair competes together across a season.
- **Individual rating:** Best when partnerships change frequently or when individual speaker identity is central.
- **Hybrid model:** Maintain team ratings for matchup prediction and individual ratings for long-term participant history.

Do not silently transfer a team's rating to a new partnership unless your data model explicitly supports a roster-carryover rule.

### Result modeling

Use one match result per ballot or one aggregate round result, but be consistent. For formats with multiple judges, common choices are:

- Encode the panel decision as a single 1/0 team result.
- Treat each judge ballot as an individual result if ballots are sufficiently independent and available.
- Use fractional scores only when they have a defensible competitive meaning, such as a genuine tied result.

Speaker points should usually remain separate from the primary team-strength rating. They measure a related but different signal and are often not comparable across judges, tournaments, and divisions.

### Pools and divisions

Keep separate rating pools when competitive ecosystems are meaningfully different, such as novice versus varsity or policy versus parliamentary. Combining pools is defensible only when cross-pool results are common enough to anchor their relative strength.

### Inactivity

Increase uncertainty during inactive periods according to standard Glicko-2 processing. Do not automatically lower the visible rating simply because a team has not competed; represent the lack of current evidence through a higher RD.

## Displaying rankings responsibly

A leaderboard should avoid implying false precision. Recommended fields are:

| Field | Example | Purpose |
|---|---:|---|
| Rating | 1728 | Estimated competitive strength |
| RD | 61 | Confidence indicator; lower is more established |
| Volatility | 0.058 | Expected rating instability |
| Games or ballots | 24 | Evidence volume |
| Last active | 2026-09-20 | Freshness context |
| Conservative score | 1606 | Optional ranking value, such as \(r - 2RD\) |

A conservative score such as \(r - 2RD\) prevents a lightly tested team with a high point estimate from outranking a similarly rated but well-established team. It is useful for public leaderboards, but the raw Glicko-2 rating and RD should remain visible.

## Implementation notes

- Process every affected team from the same pre-period snapshot. Do not update Team A and then use its newly updated values while calculating Team B for the same period.
- Store the rating, RD, volatility, last rating timestamp, and a complete immutable log of match inputs and outputs.
- Define how forfeits, byes, no-contests, disqualifications, and round cancellations affect ratings before launching.
- Recompute historical ratings from the event log when changing system parameters or fixing result-ingestion bugs.
- Test the implementation against the canonical Glicko-2 worked example before using it in production.
- For live updating after every debate, use a clearly documented sequential or fractional-period adaptation. It is practical, but it is not identical to the canonical batch rating-period algorithm.

## Minimal example

Suppose Team Atlas has a rating of 1600 and faces a 1750-rated team. If Atlas is expected to score 0.30 but wins, its residual is:

```latex
\[
s - E = 1 - 0.30 = 0.70.
\]
```

That is substantial positive evidence. The exact rating gain still depends on both teams' RDs, Atlas's volatility, and the other games in the same rating period. A team with a high RD will typically move more than an equally rated team with a low RD.

## References

- Mark E. Glickman, *Example of the Glicko-2 System*.
- Mark E. Glickman, *The Glicko System*.
- For the canonical Glicko-2 equations and worked example, see the technical documentation at [glicko.net](https://www.glicko.net/glicko.html).
