/**
 * @fileoverview Intro banner for the Greatest of All-Time collection
 * (`/videos/topPicks`): the "All Time Greatest Legends" title over a strip of
 * drifting sparkles.
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
import { SparklesCore } from "../../ui/effects/sparkles";

export const GOAT_HEADING_TITLE = "All Time Greatest Legends";

export function GoatSparklesHeading() {
  return (
    <div className="mb-6 flex h-56 w-full flex-col items-center justify-center overflow-hidden rounded-md bg-black sm:h-72">
      <h1 className="relative z-20 px-4 text-center text-3xl font-bold text-white md:text-5xl lg:text-6xl">
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
