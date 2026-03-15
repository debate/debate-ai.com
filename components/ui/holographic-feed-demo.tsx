"use client";

import React from 'react';
import {
    DataReadout,
    HoloButton,
    ProgressBar,
    DataViz,
    GlowingOrb,
    ScrollingRow,
    Starfield
} from '@/components/ui/scrolling-holographic-card-feed';

// --- Constants ---
const SCROLL_SPEEDS = {
    slow: '90s',
    medium: '85s',
    fast: '80s',
};

const cardTypes = [
    { id: 'readout-1', component: DataReadout, props: { value: '74.98%' } },
    { id: 'button-1', component: HoloButton, props: { text: 'INITIATE' } },
    { id: 'progress-1', component: ProgressBar, props: { progress: 65 } },
    { id: 'dataviz-1', component: DataViz, props: { bars: 5 } },
    { id: 'orb-1', component: GlowingOrb, props: {} },
    { id: 'readout-2', component: DataReadout, props: { value: 'SYNC' } },
    { id: 'button-2', component: HoloButton, props: { text: 'DECRYPT' } },
    { id: 'progress-2', component: ProgressBar, props: { progress: 40 } },
    { id: 'dataviz-2', component: DataViz, props: { bars: 3 } },
    { id: 'orb-2', component: GlowingOrb, props: { color: '#FF4500' } },
];

/**
 * The holographic feed demo component.
 */
export function HolographicFeedDemo() {
  return (
    <div className="app-container">
      <Starfield />
      <main className="py-12 relative z-10 overflow-hidden">
          {/* Edge Fades */}
          <div className="pointer-events-none absolute top-0 bottom-0 left-0 w-32 bg-gradient-to-r from-[#010409] to-transparent z-20"></div>
          <div className="pointer-events-none absolute top-0 bottom-0 right-0 w-32 bg-gradient-to-l from-[#010409] to-transparent z-20"></div>

          <ScrollingRow cards={cardTypes} duration={SCROLL_SPEEDS.fast} direction="left" />
          <ScrollingRow cards={cardTypes} duration={SCROLL_SPEEDS.slow} direction="right" />
          <ScrollingRow cards={cardTypes} duration={SCROLL_SPEEDS.medium} direction="left" />

          <div className="relative z-30 flex justify-center mt-8">
             <a className="px-6 py-3 flex items-center gap-2 border border-cyan-400/50 rounded-lg text-base font-semibold transition-all duration-300 bg-cyan-400/10 hover:bg-cyan-400/20 text-cyan-300 cursor-pointer shadow-lg shadow-cyan-500/10 hover:shadow-xl hover:shadow-cyan-500/20 hover:scale-105 backdrop-blur-sm font-['Orbitron']" href="#">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 16v-2m8-6h2M4 12H2m15.364 6.364l1.414 1.414M4.222 4.222l1.414 1.414m12.728 0l-1.414 1.414M5.636 18.364l-1.414 1.414M12 16a4 4 0 100-8 4 4 0 000 8z" /></svg>
                Explore The Archive
            </a>
        </div>
      </main>
    </div>
  );
}
