"use client";

import React from 'react';
import { motion } from 'framer-motion';

interface HoverCardWrapperProps {
  children: React.ReactNode;
  className?: string;
}

/**
 * A simple hover effect wrapper that lifts the card up on hover.
 * Based on the ArticleCardGrid hover behavior.
 */
export const HoverCardWrapper: React.FC<HoverCardWrapperProps> = ({
  children,
  className = ""
}) => {
  return (
    <motion.div
      className={`group ${className}`}
      whileHover={{ y: -8 }}
      transition={{ type: 'spring', stiffness: 300 }}
    >
      {children}
    </motion.div>
  );
};
