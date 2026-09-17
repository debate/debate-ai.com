"use client"

import { cn } from "@/lib/ui/lib/utils"
import { OrbitalLoader } from "@/components/ui/OrbitalLoader"

export type AnimatedLoaderSize = "sm" | "md" | "lg"

interface AnimatedLoaderProps {
  label?: string
  size?: AnimatedLoaderSize
  className?: string
}

const sizeConfig = {
  sm: {
    sphereSize: 64,
    minLines: 5,
    maxLines: 8,
    rotationSpeed: [4, 9],
  },
  md: {
    sphereSize: 96,
    minLines: 6,
    maxLines: 10,
    rotationSpeed: [4, 11],
  },
  lg: {
    sphereSize: 144,
    minLines: 8,
    maxLines: 12,
    rotationSpeed: [5, 13],
  },
} as const

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
