/**
 * @fileoverview The rating number shown in the rankings tables. Site ratings
 * run 0–109, so the leading digits (`0` through `10`) name a team's tier and
 * are shaded from a rich gold at the top tier down to a muted gray at the
 * bottom; the last digit is set smaller beside them.
 * @module components/debate/DebateVideos/panels/leaderboard/RatingDigits
 */

/** Highest tier the leading digits can name (ratings 100–109). */
const TOP_TIER = 10

/**
 * The tier a rating sits in: its tens digit, so `07` is tier 0 and `104` is
 * tier 10. Clamped to 0–{@link TOP_TIER}.
 */
export function ratingTier(value: number): number {
  return Math.min(TOP_TIER, Math.max(0, Math.floor(Math.round(value) / 10)))
}

/**
 * Color for a tier's leading digits: gold at {@link TOP_TIER}, fading
 * step by step toward a warm gray at tier 0. Mid lightness keeps it legible
 * on both light and dark backgrounds.
 */
export function ratingTierColor(tier: number): string {
  const t = Math.min(TOP_TIER, Math.max(0, tier)) / TOP_TIER
  const hue = Math.round(30 + 15 * t)
  const saturation = Math.round(8 + 82 * t)
  const lightness = Math.round(55 - 10 * t)
  return `hsl(${hue} ${saturation}% ${lightness}%)`
}

/**
 * A rating rounded to a whole number and zero-padded to two digits, with
 * the tier digits bold, large and tier-colored and the last digit smaller,
 * so the tier reads at a glance: **10**4, **0**7.
 */
export function RatingDigits({ value }: { value: number }) {
  const text = Math.max(0, Math.round(value)).toString().padStart(2, "0")
  const head = text.slice(0, -1)
  const tail = text.slice(-1)
  return (
    <span className="text-foreground" aria-label={text}>
      <span className="text-base font-bold" style={{ color: ratingTierColor(ratingTier(value)) }}>
        {head}
      </span>
      <span className="text-xs font-medium text-muted-foreground">{tail}</span>
    </span>
  )
}
