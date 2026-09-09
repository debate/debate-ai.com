/**
 * @fileoverview macOS-style Dock component with magnification effects.
 * Uses framer-motion for smooth animations and scaling.
 *
 * Two things here exist to keep the dock *clickable*, which is easy to lose
 * in a magnifying dock:
 *
 * 1. **Icons never change layout size.** Each slot is a fixed `iconSize` box;
 *    magnification is a `scale` transform on a visual layer inside it. When
 *    magnification animated `width` instead, approaching an icon widened it
 *    and shoved its neighbours sideways, so the button you aimed at slid out
 *    from under the cursor mid-click. A composited `scale` also costs no
 *    layout, where the width spring re-laid-out the whole row every frame.
 *
 * 2. **The cursor is never measured on the mouse-move path.** The distance
 *    transform reads a cached resting centre (see {@link DockMeasureContext})
 *    rather than calling `getBoundingClientRect` per icon per `mousemove`,
 *    which forced a synchronous layout on every pointer sample and is what
 *    made the dock — and the page under it — stutter as the cursor crossed.
 */

"use client"


import React, { type PropsWithChildren, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react"
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

/**
 * Bumped by {@link Dock} whenever the cursor (re)enters the row, telling each
 * icon its cached resting centre may be stale. Icons re-measure once per
 * signal instead of once per pointer sample.
 */
const DockMeasureContext = React.createContext(0)

/**
 * One shared, frame-throttled `resize`/`scroll` subscription for every icon in
 * every dock on the page.
 *
 * Each icon used to register its own capture-phase `scroll` listener on
 * `window` and re-measure from it. Capture-phase means the listener fires for
 * *every* scrollable element on the page, and re-measuring is a
 * `getBoundingClientRect` — a forced synchronous layout. With a couple of
 * dozen icons that was a couple of dozen forced layouts per scroll event, on
 * top of whatever the page under the dock was already doing; on `/videos`,
 * where the grid pages in hundreds of cards and layout is expensive, it was
 * enough on its own to make scrolling stutter and clicks miss.
 *
 * Now: one listener, and the measurements it triggers are batched into a
 * single animation frame no matter how many scroll events arrived in it.
 */
const layoutListeners = new Set<() => void>()
let layoutFrame = 0

function runLayoutListeners() {
  layoutFrame = 0
  for (const listener of layoutListeners) listener()
}

function onWindowLayoutChange() {
  if (layoutFrame) return
  layoutFrame = requestAnimationFrame(runLayoutListeners)
}

function subscribeToLayoutChanges(listener: () => void): () => void {
  if (layoutListeners.size === 0) {
    window.addEventListener("resize", onWindowLayoutChange, { passive: true })
    window.addEventListener("scroll", onWindowLayoutChange, { passive: true, capture: true })
  }
  layoutListeners.add(listener)
  return () => {
    layoutListeners.delete(listener)
    if (layoutListeners.size > 0) return
    window.removeEventListener("resize", onWindowLayoutChange)
    window.removeEventListener("scroll", onWindowLayoutChange, { capture: true })
    if (layoutFrame) {
      cancelAnimationFrame(layoutFrame)
      layoutFrame = 0
    }
  }
}

/**
 * True only on pointers that can hover precisely — a mouse or trackpad.
 *
 * On touch there is no cursor to magnify toward, and running the springs
 * anyway meant a tap first nudged every icon and then landed on whatever had
 * moved under the finger. Coarse pointers get a plain, still row.
 */
function useFinePointer() {
  const [fine, setFine] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return
    const query = window.matchMedia("(hover: hover) and (pointer: fine)")
    const sync = () => setFine(query.matches)
    sync()
    query.addEventListener?.("change", sync)
    return () => query.removeEventListener?.("change", sync)
  }, [])

  return fine
}

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
    const finePointer = useFinePointer()
    const [measureTick, setMeasureTick] = useState(0)

    // `clientX`, not `pageX`: the cached centres below come from
    // `getBoundingClientRect`, which is viewport-relative. Mixing the two
    // offset the magnification focus by the page's scroll on any scrolled
    // page, so the icon that grew was not the one under the cursor.
    const handleMouseMove = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (!finePointer) return
        mousex.set(event.clientX)
      },
      [finePointer, mousex],
    )

    const handleMouseEnter = useCallback(() => {
      if (!finePointer) return
      setMeasureTick((tick) => tick + 1)
    }, [finePointer])

    const handleMouseLeave = useCallback(() => {
      mousex.set(Number.POSITIVE_INFINITY)
    }, [mousex])

    const renderChildren = () => {
      return React.Children.map(children, (child: any) => {
        if (!React.isValidElement(child)) return child
        return React.cloneElement(child, {
          mousex: mousex,
          magnification: finePointer ? magnification : iconSize,
          distance: distance,
          iconSize: iconSize,
        } as any)
      })
    }

    return (
      <DockMeasureContext.Provider value={measureTick}>
        <motion.div
          ref={ref}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          className={cn(dockVariants({ fluid, className }), "overflow-visible", {
            "items-start": direction === "top",
            "items-center": direction === "middle",
            "items-end": direction === "bottom",
          })}
        >
          {renderChildren()}
        </motion.div>
      </DockMeasureContext.Provider>
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
  const pointerx = mousex || motionValue
  const measureTick = useContext(DockMeasureContext)

  // Resting centre of this slot, in viewport coordinates. Because the slot's
  // box size is fixed it only moves when the surrounding layout does, so one
  // measurement per cursor entry (plus resize/scroll) is enough — and none of
  // them happen while the cursor is moving.
  const centerRef = useRef(0)
  const measure = useCallback(() => {
    const bounds = ref.current?.getBoundingClientRect()
    if (bounds) centerRef.current = bounds.left + bounds.width / 2
  }, [])

  useLayoutEffect(() => {
    measure()
  }, [measure, measureTick, iconSize])

  useEffect(() => {
    if (typeof window === "undefined") return
    return subscribeToLayoutChanges(measure)
  }, [measure])

  const distanceCalc = useTransform(pointerx, (val: number) => val - centerRef.current)

  // Magnification never shrinks an icon below its resting size, and it is
  // capped so a hovered icon cannot balloon over its neighbours.
  const scaleTarget = Math.max(1, Math.min(magnification, iconSize * 1.6) / iconSize)
  const scaleSync = useTransform(distanceCalc, [-distance, 0, distance], [1, scaleTarget, 1])
  const scale = useSpring(scaleSync, {
    mass: 0.1,
    stiffness: 150,
    damping: 12,
  })

  return (
    <div
      ref={ref}
      // The hit area: a fixed box that never resizes, so the pointer target
      // stays exactly where the eye put it while the visual layer scales.
      style={{ width: iconSize, height: iconSize }}
      className={cn("relative flex aspect-square shrink-0 cursor-pointer items-center justify-center rounded-full", className)}
      {...props}
    >
      <motion.div
        // Visual only. `pointer-events-none` so a magnified icon overlapping
        // its neighbour cannot swallow that neighbour's click.
        style={{ scale, width: iconSize, height: iconSize }}
        className="pointer-events-none flex items-center justify-center rounded-full will-change-transform"
      >
        {children}
      </motion.div>
    </div>
  )
}

DockIcon.displayName = "DockIcon"

export interface DockItemProps
  extends VariantProps<typeof dockVariants>,
    // Hover/focus handlers and ARIA come straight through to the rendered
    // element; `onClick` is re-declared below so it can be handed to either
    // an anchor or the keyboard fallback.
    Omit<React.HTMLAttributes<HTMLElement>, "onClick" | "children"> {
  className?: string
  children: React.ReactNode
  magnification?: number
  distance?: number
  iconSize?: number
  mousex?: any
  onClick?: (event: React.MouseEvent<HTMLElement>) => void
  /**
   * Destination for a navigating item. Rendering a real anchor is what gives
   * the dock middle-click, open-in-new-tab, a status-bar target and keyboard
   * activation; hosts that navigate client-side still `preventDefault` in
   * `onClick` and route themselves.
   */
  href?: string
}

const DockItem = React.forwardRef<HTMLElement, DockItemProps>(
  ({ className, children, magnification, distance, iconSize, mousex, onClick, href, fluid, ...props }, ref) => {
    const contents = React.Children.map(children, (child: any) => {
      if (child?.type === DockIcon) {
        return React.cloneElement(child, {
          mousex: mousex,
          magnification: magnification,
          distance: distance,
          iconSize: iconSize,
        })
      }
      return child
    })

    const classes = cn("relative group outline-none focus-visible:ring-2 focus-visible:ring-primary", className)

    if (href) {
      return (
        <a
          ref={ref as React.Ref<HTMLAnchorElement>}
          href={href}
          onClick={onClick}
          className={classes}
          {...(props as React.AnchorHTMLAttributes<HTMLAnchorElement>)}
        >
          {contents}
        </a>
      )
    }

    // Not a `<button>`: this branch is also what Radix's `DropdownMenuTrigger`
    // renders through `asChild`, and the label/icon layers inside are block
    // elements. `role`/`tabIndex`/Enter+Space give it the same semantics.
    return (
      <div
        ref={ref as React.Ref<HTMLDivElement>}
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={(event) => {
          if (event.key !== "Enter" && event.key !== " ") return
          event.preventDefault()
          onClick?.(event as unknown as React.MouseEvent<HTMLElement>)
        }}
        className={classes}
        {...(props as React.HTMLAttributes<HTMLDivElement>)}
      >
        {contents}
      </div>
    )
  },
)

DockItem.displayName = "DockItem"

/**
 * The hover/focus tooltip for a dock item, hung under its icon.
 *
 * Anchored from the item's *bottom edge* (`top-full` plus a fixed `mt-1.5`),
 * not by pinning the label's own bottom edge a fixed distance below it. With
 * `bottom: -2rem` the gap was whatever was left of those 32px after the
 * label's height, so the label floated a variable distance clear of the icon
 * and a taller label (a wrapped one, or a larger text scale) climbed back up
 * over it. In the sidebar-hosted dock that gap put the tooltip down among the
 * panels below the dock — reading as a chip dropped on the panel header
 * rather than as the hovered icon's label. A constant 6px keeps it attached
 * to its icon at every icon size.
 *
 * `z-50` because the label leaves the dock's box and overlays whatever is
 * under it. The dock is the first thing in the sidebar column, so without a
 * stacking order of its own the label paints *below* any positioned element
 * that comes after it in the document.
 */
const DockLabel = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  return (
    <div
      className={cn(
        "absolute top-full left-1/2 z-50 mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-md bg-gray-800 dark:bg-gray-200 px-2 py-0.5 text-xs text-white dark:text-black shadow-md opacity-0 transition-opacity duration-200 pointer-events-none group-hover:opacity-100 group-focus-visible:opacity-100",
        className,
      )}
    >
      {children}
    </div>
  )
}

DockLabel.displayName = "DockLabel"

export { Dock, DockIcon, DockItem, DockLabel, dockVariants, DEFAULT_ICON_SIZE }
