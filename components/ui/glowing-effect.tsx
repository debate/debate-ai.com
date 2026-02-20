"use client"

import { useEffect, useRef } from "react"

interface GlowingEffectProps {
  spread?: number
  glow?: boolean
  disabled?: boolean
  proximity?: number
  inactiveZone?: number
  borderWidth?: number
}

export function GlowingEffect({
  spread = 40,
  glow = true,
  disabled = false,
  proximity = 64,
  inactiveZone = 0.01,
  borderWidth = 2,
}: GlowingEffectProps) {
  const glowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (disabled || !glow) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!glowRef.current) return

      const card = glowRef.current.parentElement
      if (!card) return

      const rect = card.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Calculate distance from mouse to card center
      const centerX = rect.width / 2
      const centerY = rect.height / 2
      const distance = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2))

      // Only show glow if within proximity
      if (distance < proximity) {
        const opacity = Math.max(inactiveZone, 1 - distance / proximity)
        glowRef.current.style.opacity = opacity.toString()
        glowRef.current.style.background = `radial-gradient(${spread}px circle at ${x}px ${y}px, rgba(var(--primary-rgb, 59, 130, 246), 0.4), transparent 80%)`
      } else {
        glowRef.current.style.opacity = inactiveZone.toString()
      }
    }

    const handleMouseLeave = () => {
      if (!glowRef.current) return
      glowRef.current.style.opacity = inactiveZone.toString()
    }

    const card = glowRef.current?.parentElement
    if (card) {
      card.addEventListener("mousemove", handleMouseMove)
      card.addEventListener("mouseleave", handleMouseLeave)

      return () => {
        card.removeEventListener("mousemove", handleMouseMove)
        card.removeEventListener("mouseleave", handleMouseLeave)
      }
    }
  }, [spread, glow, disabled, proximity, inactiveZone])

  if (disabled || !glow) return null

  return (
    <div
      ref={glowRef}
      className="pointer-events-none absolute inset-0 rounded-xl transition-opacity duration-300"
      style={{
        opacity: inactiveZone,
        borderWidth: `${borderWidth}px`,
        borderStyle: "solid",
        borderColor: "transparent",
      }}
    />
  )
}
