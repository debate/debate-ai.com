"use client";

import React from 'react';

interface HoverCardWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A simple hover effect wrapper that lifts the card up on hover.
 * Based on the ArticleCardGrid hover behavior.
 *
 * Deliberately a plain element with a CSS transition rather than a
 * `motion.div`: the video grid mounts one of these per card and appends sixty
 * more with every page of infinite scroll, so a motion component per card
 * meant hundreds of animation subscriptions and hover listeners for an effect
 * the compositor can run on its own. The lift is identical; the cost is not.
 *
 * No `will-change: transform` either, for the same reason and a worse one: it
 * is a standing instruction to keep the element on its own compositor layer
 * for as long as it exists, not a hint for the duration of an animation. One
 * per card meant the browser held a layer — and its GPU memory — for every
 * card in a library that pages in sixty at a time and never unmounts any of
 * them, so several pages in the compositor was juggling hundreds of layers
 * and the page stopped responding to clicks while still looking fine. The
 * browser promotes the element on its own for the length of the transform
 * transition, which is the only time the layer is worth anything.
 */
export const HoverCardWrapper: React.FC<HoverCardWrapperProps> = ({
  children,
  className = ""
}) => {
  return (
    <div
      className={`group transition-transform duration-200 ease-out hover:-translate-y-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${className}`}
    >
      {children}
    </div>
  );
};
