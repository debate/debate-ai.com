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
 */
export const HoverCardWrapper: React.FC<HoverCardWrapperProps> = ({
  children,
  className = ""
}) => {
  return (
    <div
      className={`group transition-transform duration-200 ease-out will-change-transform hover:-translate-y-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${className}`}
    >
      {children}
    </div>
  );
};
