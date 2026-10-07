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
 * Adapted from Aceternity's sparkles demo. The banner is shorter than the
 * demo's 40rem and the sparkle strip is capped at the container's width,
 * because it sits above the search bar and the grid rather than filling a
 * landing page, and must not overflow a phone screen.
 *
 * @module components/category-gallery/GoatSparklesHeading
 */

"use client";

import React from "react";
import Image from "next/image";
import { SparklesCore } from "../../ui/effects/sparkles";
import { IconTrophyGoat } from "../../ui/icons";

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

export function GoatSparklesHeading() {
  return (
    <div className="mb-6 flex h-56 w-full flex-col items-center justify-center overflow-hidden rounded-md bg-black sm:h-72">
      <Image
        src={IconTrophyGoat}
        alt="Greatest of All-Time trophy"
        width={64}
        height={64}
        className="relative z-20 mb-3 h-12 w-12 object-contain sm:h-16 sm:w-16"
        unoptimized
      />
      <style>{GOAT_DOTS_CSS}</style>
      <h1 className="goat-dots-title relative z-20 bg-gradient-to-b from-white via-indigo-200 to-sky-400 bg-clip-text px-4 text-center text-3xl font-extrabold text-transparent md:text-5xl lg:text-6xl">
        {GOAT_HEADING_TITLE}
      </h1>
      <div className="relative h-24 w-full max-w-[40rem] sm:h-32">
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
