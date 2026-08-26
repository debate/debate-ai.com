"use client";

import { LazyMotion, MotionConfig } from "motion/react";

/** Shared curve for every app animation; matches --ease-out-quart in globals.css. */
export const MOTION_TRANSITION = {
    duration: 0.2,
    ease: [0.25, 1, 0.5, 1],
} as const;

/** Loads Motion's DOM feature set (incl. layout animations) as a separate chunk. */
export const loadFeatures = () => import("motion/react").then((mod) => mod.domMax);

/**
 * Installs Motion once for the whole app: LazyMotion's async `features` loads
 * the feature bundle as a separate chunk after first render, and MotionConfig
 * makes every animation honor prefers-reduced-motion and share one curve. strict
 * forces `m.*` usage so no eager `motion.*` import sneaks the full bundle back in.
 */
export default function MotionRoot({ children }: { children: React.ReactNode }) {
    return (
        <LazyMotion features={loadFeatures} strict>
            <MotionConfig reducedMotion="user" transition={MOTION_TRANSITION}>
                {children}
            </MotionConfig>
        </LazyMotion>
    );
}
