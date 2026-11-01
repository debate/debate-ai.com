/**
 * @fileoverview Intro banner for the Greatest of All-Time collection
 * (`/videos/topPicks`): the "All Time Greatest Legends" title over a strip of
 * drifting sparkles, with the trophy-goat icon above the title.
 *
 * The title itself is drawn as a halftone of dots: a dot-grid mask over a
 * white-to-sky gradient fill. On mount the dots grow out of nothing while the
 * text un-blurs, then the grid drifts slowly so the letters shimmer. Readers
 * who prefer reduced motion get the finished dotted title with no animation.
 *
 * Hovering or clicking the trophy plays a randomly chosen effect (spin,
 * bounce, wobble, flip, glow, confetti burst…), never the same one twice in a
 * row. Reduced motion turns these off too.
 *
 * Adapted from Aceternity's sparkles demo. The banner is shorter than the
 * demo's 40rem and the sparkle strip is capped at the container's width,
 * because it sits above the search bar and the grid rather than filling a
 * landing page, and must not overflow a phone screen.
 *
 * @module components/category-gallery/GoatSparklesHeading
 */

"use client";

import React, { useCallback, useState } from "react";
import Image from "next/image";
import { SparklesCore } from "../../../ui/effects/sparkles";
import { IconTrophyGoat } from "../../../ui/icons";

export const GOAT_HEADING_TITLE = "All Time Greatest Legends";

/**
 * Keyframes and the dot mask for the title. `--goat-dot` is registered so the
 * dot radius can animate; browsers without `@property` show the end state.
 */
const GOAT_DOTS_CSS = `
@property --goat-dot { syntax: "<length>"; inherits: false; initial-value: 1.7px; }
.goat-dots-title {
  --goat-dot: 1.7px;
  -webkit-mask-image: radial-gradient(circle, #000 var(--goat-dot), transparent calc(var(--goat-dot) + 0.6px));
  mask-image: radial-gradient(circle, #000 var(--goat-dot), transparent calc(var(--goat-dot) + 0.6px));
  -webkit-mask-size: 4px 4px;
  mask-size: 4px 4px;
  animation: goat-dots-in 1.8s cubic-bezier(0.2, 0.7, 0.2, 1) both, goat-dots-drift 8s linear 1.8s infinite;
}
@keyframes goat-dots-in {
  from { --goat-dot: 0px; opacity: 0; filter: blur(8px); transform: scale(1.08); }
  50% { opacity: 1; }
  to { --goat-dot: 1.7px; opacity: 1; filter: blur(0); transform: scale(1); }
}
@keyframes goat-dots-drift {
  from { -webkit-mask-position: 0 0; mask-position: 0 0; }
  to { -webkit-mask-position: 4px 4px; mask-position: 4px 4px; }
}
@media (prefers-reduced-motion: reduce) {
  .goat-dots-title { animation: none; }
}
`;

/** The effects the trophy can play on hover or click. */
export const TROPHY_EFFECTS = [
  "spin",
  "bounce",
  "wobble",
  "shake",
  "flip",
  "jello",
  "tada",
  "rubber",
  "swing",
  "heartbeat",
  "glow",
  "rainbow",
  "confetti",
] as const;

export type TrophyEffect = (typeof TROPHY_EFFECTS)[number];

/**
 * Picks a random trophy effect, skipping `previous` so each hover or click
 * visibly changes something.
 */
export function pickTrophyEffect(
  previous: TrophyEffect | null,
  random: () => number = Math.random,
): TrophyEffect {
  const choices = TROPHY_EFFECTS.filter((e) => e !== previous);
  return choices[Math.min(choices.length - 1, Math.floor(random() * choices.length))];
}

const CONFETTI_COLORS = ["#facc15", "#f472b6", "#38bdf8", "#4ade80", "#a78bfa", "#fb923c"];
const CONFETTI_PIECES = 18;

/** Keyframes for every trophy effect, one class per effect. */
const TROPHY_FX_CSS = `
.goat-trophy-fx { transform-origin: 50% 60%; }
.goat-trophy-fx-spin { animation: goat-fx-spin 0.8s cubic-bezier(0.3, 0.8, 0.3, 1); }
.goat-trophy-fx-bounce { animation: goat-fx-bounce 0.9s ease; }
.goat-trophy-fx-wobble { animation: goat-fx-wobble 0.9s ease; }
.goat-trophy-fx-shake { animation: goat-fx-shake 0.6s ease; }
.goat-trophy-fx-flip { animation: goat-fx-flip 0.9s ease; }
.goat-trophy-fx-jello { animation: goat-fx-jello 0.9s ease; }
.goat-trophy-fx-tada { animation: goat-fx-tada 1s ease; }
.goat-trophy-fx-rubber { animation: goat-fx-rubber 0.9s ease; }
.goat-trophy-fx-swing { transform-origin: 50% 0; animation: goat-fx-swing 1s ease; }
.goat-trophy-fx-heartbeat { animation: goat-fx-heartbeat 1.1s ease; }
.goat-trophy-fx-glow { animation: goat-fx-glow 1.2s ease; }
.goat-trophy-fx-rainbow { animation: goat-fx-rainbow 1.2s linear; }
.goat-trophy-fx-confetti { animation: goat-fx-pop 0.5s ease; }
@keyframes goat-fx-spin { from { transform: rotate(0); } to { transform: rotate(360deg); } }
@keyframes goat-fx-bounce {
  0%, 20%, 53%, 100% { transform: translateY(0); }
  40%, 43% { transform: translateY(-30%) scaleY(1.1); }
  70% { transform: translateY(-15%) scaleY(1.05); }
  80% { transform: translateY(0) scaleY(0.95); }
  90% { transform: translateY(-4%); }
}
@keyframes goat-fx-wobble {
  0%, 100% { transform: none; }
  15% { transform: translateX(-25%) rotate(-5deg); }
  30% { transform: translateX(20%) rotate(3deg); }
  45% { transform: translateX(-15%) rotate(-3deg); }
  60% { transform: translateX(10%) rotate(2deg); }
  75% { transform: translateX(-5%) rotate(-1deg); }
}
@keyframes goat-fx-shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8%); }
  20%, 40%, 60%, 80% { transform: translateX(8%); }
}
@keyframes goat-fx-flip {
  from { transform: perspective(400px) rotateY(0); }
  40% { transform: perspective(400px) rotateY(190deg) scale(1.1); }
  70% { transform: perspective(400px) rotateY(360deg) scale(0.95); }
  to { transform: perspective(400px) rotateY(360deg); }
}
@keyframes goat-fx-jello {
  0%, 11.1%, 100% { transform: none; }
  22.2% { transform: skewX(-12.5deg) skewY(-12.5deg); }
  33.3% { transform: skewX(6.25deg) skewY(6.25deg); }
  44.4% { transform: skewX(-3.125deg) skewY(-3.125deg); }
  55.5% { transform: skewX(1.5625deg) skewY(1.5625deg); }
  66.6% { transform: skewX(-0.78125deg) skewY(-0.78125deg); }
}
@keyframes goat-fx-tada {
  0%, 100% { transform: scale(1) rotate(0); }
  10%, 20% { transform: scale(0.9) rotate(-3deg); }
  30%, 50%, 70%, 90% { transform: scale(1.15) rotate(3deg); }
  40%, 60%, 80% { transform: scale(1.15) rotate(-3deg); }
}
@keyframes goat-fx-rubber {
  0%, 100% { transform: scale(1, 1); }
  30% { transform: scale(1.25, 0.75); }
  40% { transform: scale(0.75, 1.25); }
  50% { transform: scale(1.15, 0.85); }
  65% { transform: scale(0.95, 1.05); }
  75% { transform: scale(1.05, 0.95); }
}
@keyframes goat-fx-swing {
  20% { transform: rotate(15deg); }
  40% { transform: rotate(-10deg); }
  60% { transform: rotate(5deg); }
  80% { transform: rotate(-5deg); }
  100% { transform: rotate(0); }
}
@keyframes goat-fx-heartbeat {
  0%, 28%, 70% { transform: scale(1); }
  14%, 42% { transform: scale(1.3); }
}
@keyframes goat-fx-glow {
  0%, 100% { filter: drop-shadow(0 0 0 transparent); transform: scale(1); }
  50% { filter: drop-shadow(0 0 18px #facc15) drop-shadow(0 0 36px #f59e0b) brightness(1.3); transform: scale(1.12); }
}
@keyframes goat-fx-rainbow {
  from { filter: hue-rotate(0deg) saturate(2); }
  to { filter: hue-rotate(360deg) saturate(1); }
}
@keyframes goat-fx-pop {
  0%, 100% { transform: scale(1); }
  40% { transform: scale(1.2); }
}
.goat-trophy-confetti {
  position: absolute; left: 50%; top: 50%; width: 8px; height: 8px; border-radius: 2px;
  pointer-events: none; opacity: 0;
  animation: goat-fx-confetti 1s cubic-bezier(0.1, 0.8, 0.3, 1) forwards;
}
@keyframes goat-fx-confetti {
  0% { opacity: 1; transform: translate(-50%, -50%) rotate(0) scale(1); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), calc(-50% + var(--dy))) rotate(var(--rot)) scale(0.6); }
}
@media (prefers-reduced-motion: reduce) {
  .goat-trophy-fx, .goat-trophy-confetti { animation: none !important; }
  .goat-trophy-confetti { display: none; }
}
`;

/** Confetti pieces fanned evenly around the trophy, each with its own color. */
function TrophyConfetti() {
  return (
    <>
      {Array.from({ length: CONFETTI_PIECES }, (_, i) => {
        const angle = (i / CONFETTI_PIECES) * Math.PI * 2;
        const distance = 70 + (i % 3) * 18;
        const style = {
          background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
          "--dx": `${Math.round(Math.cos(angle) * distance)}px`,
          "--dy": `${Math.round(Math.sin(angle) * distance)}px`,
          "--rot": `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`,
        } as React.CSSProperties;
        return <span key={i} aria-hidden className="goat-trophy-confetti" style={style} />;
      })}
    </>
  );
}

/**
 * The trophy-goat icon as a button. Each hover or click picks a fresh random
 * effect; `run` bumps on every trigger so the same element restarts its
 * animation even when React would otherwise reuse it.
 */
function PlayfulTrophy() {
  const [fx, setFx] = useState<{ effect: TrophyEffect | null; run: number }>({
    effect: null,
    run: 0,
  });
  const play = useCallback(() => {
    setFx((prev) => ({ effect: pickTrophyEffect(prev.effect), run: prev.run + 1 }));
  }, []);

  return (
    <button
      type="button"
      onMouseEnter={play}
      onClick={play}
      aria-label="Celebrate the Greatest of All-Time trophy"
      className="absolute left-1/2 top-1/2 z-20 h-24 w-24 -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 sm:h-32 sm:w-32"
    >
      <Image
        key={fx.run}
        src={IconTrophyGoat}
        alt="Greatest of All-Time trophy"
        width={128}
        height={128}
        className={`goat-trophy-fx h-full w-full object-contain${fx.effect ? ` goat-trophy-fx-${fx.effect}` : ""}`}
        unoptimized
      />
      {fx.effect === "confetti" && <TrophyConfetti key={`c${fx.run}`} />}
    </button>
  );
}

export function GoatSparklesHeading() {
  return (
    <div className="mb-6 flex h-56 w-full flex-col items-center justify-center overflow-hidden rounded-md bg-black sm:h-72">
      <style>{GOAT_DOTS_CSS + TROPHY_FX_CSS}</style>
      <h1 className="goat-dots-title relative z-20 bg-gradient-to-b from-white via-indigo-200 to-sky-400 bg-clip-text px-4 text-center text-3xl font-extrabold text-transparent md:text-5xl lg:text-6xl">
        {GOAT_HEADING_TITLE}
      </h1>
      <div className="relative h-24 w-full max-w-[40rem] sm:h-32">
        <PlayfulTrophy />
        {/* Gradients */}
        <div className="absolute inset-x-[12.5%] top-0 h-[2px] w-3/4 bg-gradient-to-r from-transparent via-indigo-500 to-transparent blur-sm" />
        <div className="absolute inset-x-[12.5%] top-0 h-px w-3/4 bg-gradient-to-r from-transparent via-indigo-500 to-transparent" />
        <div className="absolute inset-x-[37.5%] top-0 h-[5px] w-1/4 bg-gradient-to-r from-transparent via-sky-500 to-transparent blur-sm" />
        <div className="absolute inset-x-[37.5%] top-0 h-px w-1/4 bg-gradient-to-r from-transparent via-sky-500 to-transparent" />

        {/* Core component */}
        <SparklesCore
          background="transparent"
          minSize={0.4}
          maxSize={1}
          particleDensity={1200}
          className="h-full w-full"
          particleColor="#FFFFFF"
        />

        {/* Radial gradient to prevent sharp edges */}
        <div className="absolute inset-0 h-full w-full bg-black [mask-image:radial-gradient(350px_200px_at_top,transparent_20%,white)]" />
      </div>
    </div>
  );
}
