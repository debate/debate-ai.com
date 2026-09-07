/**
 * @fileoverview macOS-style Dock component with magnification effects.
 * Uses framer-motion for smooth animations and scaling.
 */

"use client"


import React, { type PropsWithChildren, useRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { motion, useMotionValue, useSpring, useTransform } from "framer-motion"

import { cn } from "../lib/utils"

export interface DockProps extends VariantProps<typeof dockVariants> {
  className?: string
  magnification?: number
  distance?: number
  /** Resting width/height of each icon, in px, before magnification. */
  iconSize?: number
  direction?: "top" | "middle" | "bottom"
  children: React.ReactNode
}

const DEFAULT_MAGNIFICATION = 60
const DEFAULT_DISTANCE = 140
const DEFAULT_ICON_SIZE = 40

const dockVariants = cva(
  "p-1.5 sm:p-2 flex rounded-2xl border supports-backdrop-blur:bg-white/10 supports-backdrop-blur:dark:bg-black/10 backdrop-blur-md",
  {
    variants: {
      /**
       * `false` (default) — a free-floating dock, sized to its contents and
       * centred in whatever space it is given. Used by the fixed top-left and
       * bottom-bar instances, which have the whole viewport to grow into.
       *
       * `true` — a dock hosted inside a fixed-width column (the app sidebar).
       * It takes the column's width instead of its own content width, and
       * wraps onto a second row rather than growing past the column, so it
       * can never reach across the border into the page content beside it —
       * a CardMirror editor, in the case of `/reason-editor` and `/doc`.
       */
      fluid: {
        false: "mx-auto w-max mt-4 sm:mt-8 h-[58px] sm:h-[58px] gap-1.5 sm:gap-2",
        true: "mx-0 mt-0 w-full max-w-full min-w-0 h-auto flex-wrap content-center justify-center gap-1 sm:gap-1.5",
      },
    },
    defaultVariants: { fluid: false },
  },
)

const Dock = React.forwardRef<HTMLDivElement, DockProps>(
  (
    {
      className,
      children,
      magnification = DEFAULT_MAGNIFICATION,
      distance = DEFAULT_DISTANCE,
      iconSize = DEFAULT_ICON_SIZE,
      direction = "bottom",
      fluid = false,
    },
    ref,
  ) => {
    const mousex = useMotionValue(Number.POSITIVE_INFINITY)

    const renderChildren = () => {
      return React.Children.map(children, (child: any) => {
        if (!React.isValidElement(child)) return child
        return React.cloneElement(child, {
          mousex: mousex,
          magnification: magnification,
          distance: distance,
          iconSize: iconSize,
        } as any)
      })
    }

    return (
      <motion.div
        ref={ref}
        onMouseMove={(e) => mousex.set(e.pageX)}
        onMouseLeave={() => mousex.set(Number.POSITIVE_INFINITY)}
        className={cn(dockVariants({ fluid, className }), "overflow-visible", {
          "items-start": direction === "top",
          "items-center": direction === "middle",
          "items-end": direction === "bottom",
        })}
      >
        {renderChildren()}
      </motion.div>
    )
  },
)

export interface DockIconProps {
  size?: number
  magnification?: number
  distance?: number
  iconSize?: number
  mousex?: any
  className?: string
  children?: React.ReactNode
  props?: PropsWithChildren
}

const DockIcon = ({
  size,
  magnification = DEFAULT_MAGNIFICATION,
  distance = DEFAULT_DISTANCE,
  iconSize = DEFAULT_ICON_SIZE,
  mousex,
  className,
  children,
  ...props
}: DockIconProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const motionValue = useMotionValue(Number.POSITIVE_INFINITY)

  const distanceCalc = useTransform(mousex || motionValue, (val: number) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 }
    return val - bounds.x - bounds.width / 2
  })

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640
  const baseSize = iconSize
  // Magnification never shrinks an icon below its resting size, and on
  // narrow viewports it is capped so a hovered icon cannot balloon the row.
  const mag = Math.max(baseSize, isMobile ? Math.min(magnification, 56) : magnification)
  const widthSync = useTransform(distanceCalc, [-distance, 0, distance], [baseSize, mag, baseSize])
  const width = useSpring(widthSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })

  return (
    <motion.div
      ref={ref}
      style={{ width }}
      className={cn("flex aspect-square shrink-0 cursor-pointer items-center justify-center rounded-full", className)}
      {...props}
    >
      {children}
    </motion.div>
  )
}

DockIcon.displayName = "DockIcon"

export interface DockItemProps extends VariantProps<typeof dockVariants> {
  className?: string
  children: React.ReactNode
  magnification?: number
  distance?: number
  iconSize?: number
  mousex?: any
  onClick?: () => void
}

const DockItem = ({ className, children, magnification, distance, iconSize, mousex, onClick, fluid, ...props }: DockItemProps) => {
  return (
    <div onClick={onClick} className={cn("relative group", className)} {...props}>
      {React.Children.map(children, (child: any) => {
        if (child?.type === DockIcon) {
          return React.cloneElement(child, {
            mousex: mousex,
            magnification: magnification,
            distance: distance,
            iconSize: iconSize,
          })
        }
        return child
      })}
    </div>
  )
}

DockItem.displayName = "DockItem"

const DockLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div
      className={cn(
        "absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 dark:bg-gray-200 px-2 py-0.5 text-xs text-white dark:text-black opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  )
}

DockLabel.displayName = "DockLabel"

export { Dock, DockIcon, DockItem, DockLabel, dockVariants }
