"use client"

/**
 * @fileoverview The level-up moment — a short, self-playing "cutscene" built
 * from Motion primitives rather than a video file, shown over
 * {@link DebaterLevelPanel} the instant an activity pushes the debater over
 * a level boundary.
 *
 * Why not an actual video: a cut per rank, per celebration variant, per theme
 * is a dozen assets that have to be re-encoded when the level curve or the
 * palette moves, and a prerendered movie can't show *this* level's title or
 * *this* XP total — the two things the person who just leveled up wants to
 * read. Everything a cutscene can do here (rays spinning up, a shockwave
 * leaving the badge, the old number knocking through to the new one, the XP
 * bar filling to where it now sits) is a handful of transforms over real
 * data, which also makes it testable and free at runtime.
 *
 * Structure, in the order it plays:
 *
 * 1. backdrop + a rotating conic ray burst
 * 2. two shockwave rings expanding out of the badge
 * 3. "LEVEL UP" eyebrow, letters staggered in
 * 4. the old level number knocked aside for the new one
 * 5. the rank title and the XP this activity paid
 * 6. the XP bar filling to its new position
 *
 * It plays once, auto-dismisses, and is always skippable: Escape, the
 * backdrop, or the Continue button all end it early. Under
 * `prefers-reduced-motion: reduce` every transition collapses to an instant
 * state change (`useReducedMotion` from framer-motion, the same preference
 * `debate-flow`'s `MotionRoot` installs app-wide) — the reader still gets the
 * level, the rank and the XP, just without the motion.
 *
 * @module panels/DebaterLevelUpOverlay
 */

import { Fragment, useEffect, useRef } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { Sparkles, Star } from "lucide-react"
import { Button } from "@debate/research-evidence/src/ui/primitives/button"
import { cn } from "@debate/research-evidence/src/ui/lib/utils"
import type { DebaterLevelProgress } from "../lib/debater-levels"

/** How long the cutscene plays before it dismisses itself. */
export const LEVEL_UP_AUTO_DISMISS_MS = 5200

/** The staggered-in eyebrow above the level number. */
const EYEBROW = "LEVEL UP"

/** Drifting sparks behind the badge. Enough to read as celebration, few enough to stay cheap. */
const SPARK_COUNT = 18

/** The shared "ease out hard, land soft" curve — the app-wide one from `debate-flow`'s `MotionRoot`. */
const EASE_OUT_QUART = [0.25, 1, 0.5, 1] as const

/** One spark's placement and timing. */
interface Spark {
  left: number
  size: number
  delay: number
  duration: number
  drift: number
  tone: "gold" | "primary"
}

/**
 * Deterministic spark layout, derived from the index rather than
 * `Math.random()`.
 *
 * `Math.random()` here would make the overlay's DOM differ between the
 * server render and the client's first render — a hydration mismatch on
 * every single level-up — and would make the layout untestable. Indexing a
 * hash instead gives the same scattered look with a fixed result, so the
 * markup is stable and a test can assert on it.
 */
function sparkLayout(count: number): Spark[] {
  return Array.from({ length: count }, (_, i) => {
    // A cheap integer hash, expanded well past 1 so neighbouring indices land
    // far apart rather than in a visible diagonal.
    const h = Math.sin((i + 1) * 12.9898) * 43758.5453
    const n = h - Math.floor(h)
    const m = Math.sin((i + 1) * 78.233) * 12345.6789
    const r = m - Math.floor(m)
    return {
      left: n * 100,
      size: 4 + n * 6,
      delay: 0.12 + r * 0.7,
      duration: 1.6 + n * 1.4,
      drift: (r - 0.5) * 60,
      tone: r > 0.65 ? "primary" : "gold",
    }
  })
}

/** The XP bar, replayed from empty so the fill is visible on every level-up. */
function LevelUpXpBar({ progress }: { progress: DebaterLevelProgress }) {
  const reduceMotion = useReducedMotion()
  const target = progress.isMaxLevel ? 1 : progress.fraction

  return (
    <div className="w-full">
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-amber-500/15">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-amber-400 to-amber-500"
          initial={reduceMotion ? false : { scaleX: 0 }}
          animate={{ scaleX: target }}
          transition={{ duration: reduceMotion ? 0 : 0.9, delay: reduceMotion ? 0 : 0.55, ease: EASE_OUT_QUART }}
          style={{ originX: 0 }}
        />
      </div>
      <p className="text-muted-foreground mt-1.5 text-xs tabular-nums">
        {progress.isMaxLevel
          ? "Max level reached"
          : `${progress.xpIntoLevel.toLocaleString()} / ${progress.xpForNextLevel.toLocaleString()} XP toward level ${progress.level + 1}`}
      </p>
    </div>
  )
}

export interface DebaterLevelUpOverlayProps {
  /** Whether the cutscene is playing. `false` unmounts it entirely. */
  open: boolean
  /** The level the debater just left, knocked out by `newLevel`'s number. */
  previousLevel: number
  /** The level they landed on, and everything shown after the reveal. */
  progress: DebaterLevelProgress
  /** XP this activity paid, shown next to the rank. */
  xpGained: number
  /** Called when the cutscene ends — by the timer, Escape, the backdrop, or Continue. */
  onDismiss: () => void
  /** Auto-dismiss delay. `0` keeps it up until dismissed deliberately. */
  autoDismissMs?: number
}

/**
 * The level-up cutscene. Renders nothing at all while `open` is false, so the
 * caller can hold it as plain state and never think about unmounting.
 */
export function DebaterLevelUpOverlay({
  open,
  previousLevel,
  progress,
  xpGained,
  onDismiss,
  autoDismissMs = LEVEL_UP_AUTO_DISMISS_MS,
}: DebaterLevelUpOverlayProps) {
  const reduceMotion = useReducedMotion()
  // Focus lands on the card itself rather than the Continue button: `Button`
  // is a plain function component that forwards no ref, and focusing a
  // container (tabIndex -1) is the usual dialog pattern anyway — the card is
  // the thing that just appeared, so it is the thing that should be read
  // from. Tab still reaches Continue next.
  const stageRef = useRef<HTMLDivElement>(null)
  const sparks = sparkLayout(SPARK_COUNT)

  useEffect(() => {
    if (!open || autoDismissMs <= 0) return
    const timer = window.setTimeout(onDismiss, autoDismissMs)
    return () => window.clearTimeout(timer)
  }, [open, autoDismissMs, onDismiss])

  useEffect(() => {
    if (!open) return
    stageRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        onDismiss()
      }
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open, onDismiss])

  // Under reduced motion `instant` collapses every duration in the timeline
  // below to 0, so each element only has to branch on its *initial* state
  // (`initial={false}`, which mounts it straight at its animated value). The
  // delays ride the same value rather than needing their own guard.
  const instant = reduceMotion ? 0 : undefined

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="debater-level-up"
          role="status"
          aria-live="polite"
          aria-label={`Level up. You reached level ${progress.level}, ${progress.title}, for ${xpGained} XP.`}
          className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden p-4"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={reduceMotion ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: instant ?? 0.2 }}
        >
          <button
            type="button"
            aria-label="Dismiss level up"
            tabIndex={-1}
            className="absolute inset-0 cursor-default bg-background/85 backdrop-blur-sm"
            onClick={onDismiss}
          />

          <motion.div
            ref={stageRef}
            tabIndex={-1}
            className="relative flex w-full max-w-sm flex-col items-center gap-4 overflow-hidden rounded-2xl border border-amber-500/40 bg-card p-8 text-center shadow-2xl outline-none"
            initial={reduceMotion ? false : { scale: 0.86, y: 18, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={reduceMotion ? { opacity: 1 } : { scale: 0.94, opacity: 0 }}
            transition={{ duration: instant ?? 0.5, ease: EASE_OUT_QUART }}
          >
            {/* The ray burst. A conic gradient rotated slowly, scaling in and
                fading out under the badge — the "shot" the whole cutscene is
                built around. It sits at the default stacking level and is
                simply painted first, so it reads as behind without a negative
                z-index (which would drop it behind the card's own background
                and out of sight); `overflow-hidden` on the card above clips it
                to the rounded edge. */}
            <motion.div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 size-72 -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70"
              style={{
                background:
                  "conic-gradient(from 0deg, rgba(245,158,11,0.55) 0deg 6deg, transparent 6deg 24deg, rgba(245,158,11,0.55) 24deg 30deg, transparent 30deg 48deg)",
                maskImage: "radial-gradient(circle, black 20%, transparent 68%)",
                WebkitMaskImage: "radial-gradient(circle, black 20%, transparent 68%)",
              }}
              initial={reduceMotion ? false : { scale: 0.5, opacity: 0, rotate: 0 }}
              animate={{ scale: 1, opacity: 1, rotate: reduceMotion ? 0 : 120 }}
              transition={{ duration: instant ?? 1.1, ease: EASE_OUT_QUART }}
            />

            {/* Two shockwave rings leaving the badge on the beat. */}
            {[0, 0.22].map((delay) => (
              <motion.div
                key={delay}
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-amber-400/60"
                initial={reduceMotion ? false : { scale: 0.4, opacity: 0.9 }}
                animate={{ scale: 2.6, opacity: 0 }}
                transition={{ duration: instant ?? 1.4, delay: instant ?? delay, ease: "easeOut" }}
              />
            ))}

            {sparks.map((spark, index) => (
              <motion.span
                key={index}
                aria-hidden
                className={cn(
                  "pointer-events-none absolute top-1/2 rounded-full",
                  spark.tone === "gold" ? "bg-amber-400" : "bg-primary",
                )}
                style={{ left: `${spark.left}%`, width: spark.size, height: spark.size }}
                initial={reduceMotion ? false : { opacity: 0, y: 0, x: 0 }}
                animate={{ opacity: [0, 1, 0], y: -140, x: spark.drift }}
                transition={{ duration: instant ?? spark.duration, delay: instant ?? spark.delay, ease: "easeOut" }}
              />
            ))}

            <motion.p
              className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.35em] text-amber-500 uppercase"
              initial="hidden"
              animate="shown"
              variants={{ shown: { transition: { staggerChildren: instant ?? 0.05, delayChildren: instant ?? 0.15 } } }}
            >
              {/* Split by word, then by letter, so the space between the two
                  words stays a real text node — a per-character split would
                  render "LEVELUP" to anything reading the text content. */}
              {EYEBROW.split(" ").map((word, wordIndex) => (
                <Fragment key={word}>
                  {wordIndex > 0 ? " " : null}
                  {word.split("").map((letter, letterIndex) => (
                    <motion.span
                      key={letterIndex}
                      variants={{
                        hidden: { opacity: 0, y: 8 },
                        shown: { opacity: 1, y: 0, transition: { duration: instant ?? 0.3, ease: EASE_OUT_QUART } },
                      }}
                    >
                      {letter}
                    </motion.span>
                  ))}
                </Fragment>
              ))}
            </motion.p>

            {/* The level number. The old one is knocked out to the left while
                the new one drops in, so the change is seen rather than read. */}
            <div className="relative flex h-20 w-full items-center justify-center">
              <motion.span
                aria-hidden
                className="text-muted-foreground absolute text-5xl font-bold tabular-nums"
                initial={reduceMotion ? false : { opacity: 0, x: 0, scale: 1 }}
                animate={{ opacity: [0, 0.7, 0], x: reduceMotion ? 0 : -90, scale: 0.6 }}
                transition={{ duration: instant ?? 0.9, ease: EASE_OUT_QUART }}
              >
                {previousLevel}
              </motion.span>
              <motion.span
                className="relative text-6xl font-bold tabular-nums text-amber-500"
                initial={reduceMotion ? false : { opacity: 0, scale: 0.3, y: 24 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: instant ?? 0.6, delay: instant ?? 0.18, ease: EASE_OUT_QUART }}
              >
                {progress.level}
              </motion.span>
            </div>

            <motion.div
              className="flex flex-col items-center gap-1"
              initial={reduceMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: instant ?? 0.4, delay: instant ?? 0.42, ease: EASE_OUT_QUART }}
            >
              <p className="flex items-center gap-1.5 text-lg font-semibold">
                <Star className="size-4 text-amber-500" aria-hidden />
                {progress.title}
              </p>
              <p className="text-muted-foreground text-sm">
                <span className="font-medium text-emerald-600 dark:text-emerald-400">+{xpGained} XP</span> earned
              </p>
            </motion.div>

            <motion.div
              className="w-full"
              initial={reduceMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: instant ?? 0.3, delay: instant ?? 0.5 }}
            >
              <LevelUpXpBar progress={progress} />
            </motion.div>

            <motion.div
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: instant ?? 0.3, delay: instant ?? 0.7 }}
            >
              <Button onClick={onDismiss} className="w-full">
                <Sparkles aria-hidden />
                Continue
              </Button>
            </motion.div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
