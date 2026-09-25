"use client"

import { useMemo } from "react"
import { cn } from "../../lib/ui/lib/utils"

export type OrbitalLoaderSize = "sm" | "md" | "lg"

interface OrbitalLoaderProps {
  size?: OrbitalLoaderSize
  className?: string
}

const sizeConfig = {
  sm: { sphereSize: 64, lines: 5, speed: 8 },
  md: { sphereSize: 96, lines: 7, speed: 10 },
  lg: { sphereSize: 144, lines: 9, speed: 12 },
} as const

const lineColors = [
  "hsl(var(--accent-hue), 80%, 70%)",
  "hsl(calc(var(--accent-hue) + 40), 80%, 65%)",
  "hsl(calc(var(--accent-hue) + 80), 75%, 60%)",
  "hsl(calc(var(--accent-hue) + 120), 70%, 55%)",
  "hsl(calc(var(--accent-hue) + 160), 75%, 60%)",
  "hsl(calc(var(--accent-hue) + 200), 80%, 65%)",
  "hsl(calc(var(--accent-hue) + 240), 80%, 70%)",
  "hsl(calc(var(--accent-hue) + 280), 80%, 65%)",
  "hsl(calc(var(--accent-hue) + 320), 80%, 70%)",
]

function OrbitalLine({
  angle,
  index,
  color,
  speed,
}: {
  angle: number
  index: number
  color: string
  speed: number
}) {
  const animDuration = `${speed + (index % 3)}s`

  return (
    <div
      className="absolute inset-0 rounded-full border-solid"
      style={{
        transform: `rotateY(${angle}deg)`,
        borderColor: color,
        borderWidth: "1.5px",
        opacity: 0.7 + (index % 3) * 0.1,
        transformStyle: "preserve-3d",
        animation: `orbitalLineSpin ${animDuration} infinite linear`,
        boxShadow: `0 0 ${4 + (index % 4) * 2}px ${color}`,
      }}
    />
  )
}

export function OrbitalLoader({ size = "md", className }: OrbitalLoaderProps) {
  const config = sizeConfig[size]

  const lines = useMemo(() => {
    return Array.from({ length: config.lines }, (_, i) => {
      const angle = (360 / config.lines) * i
      return (
        <OrbitalLine
          key={i}
          angle={angle}
          index={i}
          color={lineColors[i % lineColors.length]}
          speed={config.speed}
        />
      )
    })
  }, [config])

  return (
    <div
      className={cn("relative flex items-center justify-center", className)}
      style={{
        width: config.sphereSize,
        height: config.sphereSize,
        perspective: "1000px",
      }}
    >
      <div
        className="absolute inset-0 rounded-full"
        style={{
          border: "1.5px solid hsl(var(--accent-hue), 60%, 50%)",
          opacity: 0.5,
          transformStyle: "preserve-3d",
          animation: `orbitalSpin ${config.speed}s infinite linear`,
          boxShadow: `0 0 20px hsl(var(--accent-hue), 60%, 40%, 0.3), 0 0 40px hsl(var(--accent-hue), 60%, 30%, 0.15)`,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: config.sphereSize * 0.6,
          height: config.sphereSize * 0.6,
          border: "1.5px solid hsl(var(--accent-hue), 70%, 60%)",
          opacity: 0.6,
          transformStyle: "preserve-3d",
          animation: `orbitalSpin ${config.speed * 0.8}s infinite linear reverse`,
        }}
      />
      <div
        className="absolute rounded-full"
        style={{
          width: config.sphereSize * 0.3,
          height: config.sphereSize * 0.3,
          background: `radial-gradient(circle, hsl(var(--accent-hue), 80%, 70%), transparent)`,
          opacity: 0.4,
          animation: `orbPulse 2s ease-in-out infinite`,
        }}
      />
      {lines}
    </div>
  )
}
