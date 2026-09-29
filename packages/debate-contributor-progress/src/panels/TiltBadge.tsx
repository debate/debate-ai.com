"use client"

/**
 * @fileoverview Badge art that tilts toward the cursor on hover — the same
 * mouse-follow 3-D perspective tilt as the format logos on the leaderboard's
 * champion banner (`LeaderboardChampionBanner`), so challenge, milestone and
 * judge-award emblems "pop" the same way.
 */

export function TiltBadge({ src, alt, className = "h-32 w-32" }: { src: string; alt: string; className?: string }) {
  return (
    <span
      className="inline-block will-change-transform"
      onMouseMove={(e) => {
        const el = e.currentTarget
        el.style.transition = "transform 0.1s ease-out"
        const rect = el.getBoundingClientRect()
        const x = (e.clientX - rect.left) / rect.width
        const y = (e.clientY - rect.top) / rect.height
        el.style.transform = `perspective(600px) rotateX(${(y - 0.5) * -22}deg) rotateY(${(x - 0.5) * 22}deg) scale(1.06)`
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget
        el.style.transition = "transform 0.45s ease-out"
        el.style.transform = "perspective(600px) rotateX(0deg) rotateY(0deg) scale(1)"
      }}
    >
      <img src={src} alt={alt} className={`${className} object-contain`} />
    </span>
  )
}
