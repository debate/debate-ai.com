"use client"

/**
 * @fileoverview The app's one loading orb, used by {@link LoadingOverlay} and
 * by the panels that render their own loader.
 *
 * The orb is drawn by {@link OrbitalLoader}, an in-repo component, and that is
 * deliberate. It used to be `grab-url/icons/quantum-sphere`, which ships its
 * own React *bundled into the published file* — a second copy (19.2.5) beside
 * the one `react-dom` renders with (19.2.8). Hooks called from that copy read
 * a `ReactSharedInternals` that no renderer ever populates, so the first
 * `useRef` threw `Cannot read properties of null (reading 'useRef')`. Because
 * `LoadingProvider` mounts this in the root layout, that single import took
 * down every route through `global-error`.
 *
 * `resolve.dedupe` cannot fix that: the duplicate is inlined in the
 * dependency's own dist file, not resolved from node_modules. So: never render
 * a React component out of a package that bundles React — draw it here.
 */

import { cn } from "@/lib/ui/lib/utils"
import { OrbitalLoader } from "@/components/ui/OrbitalLoader"

export type AnimatedLoaderSize = "sm" | "md" | "lg"

interface AnimatedLoaderProps {
  label?: string
  size?: AnimatedLoaderSize
  className?: string
}

export function AnimatedLoader({
  label = "Loading",
  size = "md",
  className,
}: AnimatedLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("flex flex-col items-center justify-center gap-4 text-center", className)}
    >
      <OrbitalLoader size={size} className="pointer-events-none" />
      {label && (
        <p className="max-w-xs text-sm font-medium text-muted-foreground">{label}</p>
      )}
    </div>
  )
}
