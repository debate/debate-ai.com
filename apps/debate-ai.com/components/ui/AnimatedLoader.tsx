"use client"

import QuantumOrbital, { DEFAULT_ORBITAL_SPHERE_CONFIG } from "grab-url/icons/quantum-sphere"
import { cn } from "@/lib/ui/lib/utils"

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
  const config = sizeConfig[size]

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={cn("flex flex-col items-center justify-center gap-4 text-center", className)}
    >
      <QuantumOrbital
        autoRandomize
        className="pointer-events-none"
        config={{
          ...DEFAULT_ORBITAL_SPHERE_CONFIG,
          minLines: config.minLines,
          maxLines: config.maxLines,
          minSphereSize: config.sphereSize,
          maxSphereSize: config.sphereSize,
          minLineWidth: 1,
          maxLineWidth: 1.5,
          minGlowIntensity: 5,
          maxGlowIntensity: 9,
          minRotationSpeed: config.rotationSpeed[0],
          maxRotationSpeed: config.rotationSpeed[1],
          minSaturation: 75,
          maxSaturation: 90,
          minLightness: 55,
          maxLightness: 68,
          autoRandomizeMin: 6000,
          autoRandomizeMax: 10000,
          opacity: 0.85,
        }}
      />
      {label && (
        <p className="max-w-xs text-sm font-medium text-muted-foreground">{label}</p>
      )}
    </div>
  )
}
