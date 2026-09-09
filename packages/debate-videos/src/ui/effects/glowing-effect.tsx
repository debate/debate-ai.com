"use client";

import { memo, useCallback, useEffect, useRef } from "react";
import { cn } from "../lib/utils";
import { animate } from "motion/react";

/**
 * One glow instance's participation in the shared pointer tracker below.
 */
interface GlowSubscriber {
  /** The element whose `--active`/`--start` variables this glow drives. */
  element: HTMLElement;
  /** Whether the element is near enough to the viewport to be worth measuring. */
  visible: boolean;
  /** Applies the current pointer position to the element. */
  apply: (x: number, y: number) => void;
}

/**
 * Every glow on the page shares one `pointermove` listener, one `scroll`
 * listener and one animation frame.
 *
 * A video grid mounts a glow per card and pages in sixty more every time the
 * user reaches the bottom, so per-instance listeners meant hundreds of
 * handlers each running `getBoundingClientRect()` — a forced layout — on
 * every pointer move and every scroll frame. That is what froze the page as
 * the library loaded. The shared tracker measures once per frame, and only
 * for the handful of cards actually on screen.
 */
const subscribers = new Map<Element, GlowSubscriber>();
/**
 * The subset of {@link subscribers} currently near the viewport.
 *
 * Kept separately so a frame costs one pass over the handful of cards on
 * screen rather than one over every card ever loaded: with the grid paging in
 * sixty at a time and unmounting none of them, walking the whole map to skip
 * the invisible ones was itself thousands of iterations per pointer move.
 */
const visibleSubscribers = new Set<GlowSubscriber>();

/** Last known pointer position, in client coordinates. */
let pointerX = 0;
let pointerY = 0;
/** Handle of the pending frame, or 0 when none is scheduled. */
let frameHandle = 0;
/** Shared observer that gates work to the glows near the viewport. */
let visibilityObserver: IntersectionObserver | null = null;

function getVisibilityObserver(): IntersectionObserver | null {
  if (visibilityObserver) return visibilityObserver;
  if (typeof IntersectionObserver === "undefined") return null;
  visibilityObserver = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        const subscriber = subscribers.get(entry.target);
        if (!subscriber) continue;
        subscriber.visible = entry.isIntersecting;
        if (entry.isIntersecting) visibleSubscribers.add(subscriber);
        else visibleSubscribers.delete(subscriber);
      }
    },
    // A margin wide enough that a card is already live by the time it
    // scrolls into view, without measuring the whole loaded library.
    { rootMargin: "200px" },
  );
  return visibilityObserver;
}

function flush() {
  frameHandle = 0;
  for (const subscriber of visibleSubscribers) {
    subscriber.apply(pointerX, pointerY);
  }
}

function schedule() {
  if (frameHandle) return;
  // Nothing on screen wants the pointer, so do not book a frame for it. A
  // scroll through a long grid otherwise queued one every frame purely to
  // find an empty list.
  if (visibleSubscribers.size === 0) return;
  frameHandle = requestAnimationFrame(flush);
}

function handlePointerMove(event: PointerEvent) {
  pointerX = event.clientX;
  pointerY = event.clientY;
  schedule();
}

/** Scrolling moves the elements under a stationary pointer, so re-measure. */
function handleScroll() {
  schedule();
}

function subscribe(subscriber: GlowSubscriber) {
  if (subscribers.size === 0) {
    document.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
  }
  subscribers.set(subscriber.element, subscriber);
  // Without an observer (jsdom, older browsers) every glow stays live, which
  // is the old behaviour rather than a broken one.
  const observer = getVisibilityObserver();
  if (observer) observer.observe(subscriber.element);
  else {
    subscriber.visible = true;
    visibleSubscribers.add(subscriber);
  }
}

function unsubscribe(subscriber: GlowSubscriber) {
  subscribers.delete(subscriber.element);
  visibleSubscribers.delete(subscriber);
  getVisibilityObserver()?.unobserve(subscriber.element);
  if (subscribers.size === 0) {
    document.removeEventListener("pointermove", handlePointerMove);
    window.removeEventListener("scroll", handleScroll);
    if (frameHandle) {
      cancelAnimationFrame(frameHandle);
      frameHandle = 0;
    }
  }
}

interface GlowingEffectProps {
  blur?: number;
  inactiveZone?: number;
  proximity?: number;
  spread?: number;
  variant?: "default" | "white";
  glow?: boolean;
  className?: string;
  disabled?: boolean;
  movementDuration?: number;
  borderWidth?: number;
}
const GlowingEffect = memo(
  ({
    blur = 0,
    inactiveZone = 0.7,
    proximity = 0,
    spread = 20,
    variant = "default",
    glow = false,
    className,
    movementDuration = 2,
    borderWidth = 1,
    disabled = true,
  }: GlowingEffectProps) => {
    const containerRef = useRef<HTMLDivElement>(null);
    /** Whether the border is currently lit, so the style is written on change only. */
    const isActiveRef = useRef<boolean | null>(null);
    /** The in-flight angle animation, stopped before a new one starts. */
    const angleAnimationRef = useRef<{ stop: () => void } | null>(null);

    const applyPointer = useCallback(
      (mouseX: number, mouseY: number) => {
        const element = containerRef.current;
        if (!element) return;

        const { left, top, width, height } = element.getBoundingClientRect();
        const center = [left + width * 0.5, top + height * 0.5];
        const distanceFromCenter = Math.hypot(mouseX - center[0], mouseY - center[1]);
        const inactiveRadius = 0.5 * Math.min(width, height) * inactiveZone;

        const isActive =
          distanceFromCenter >= inactiveRadius &&
          mouseX > left - proximity &&
          mouseX < left + width + proximity &&
          mouseY > top - proximity &&
          mouseY < top + height + proximity;

        if (isActiveRef.current !== isActive) {
          isActiveRef.current = isActive;
          element.style.setProperty("--active", isActive ? "1" : "0");
        }

        if (!isActive) {
          // Nothing is lit, so let any angle animation for this card stop
          // instead of ticking on behind an invisible border.
          angleAnimationRef.current?.stop();
          angleAnimationRef.current = null;
          return;
        }

        const currentAngle = parseFloat(element.style.getPropertyValue("--start")) || 0;
        const targetAngle =
          (180 * Math.atan2(mouseY - center[1], mouseX - center[0])) / Math.PI + 90;
        const angleDiff = ((targetAngle - currentAngle + 180) % 360) - 180;
        // Sub-degree movement is invisible; animating it only piles up
        // animation objects, one per pointer event per card.
        if (Math.abs(angleDiff) < 1) return;

        angleAnimationRef.current?.stop();
        angleAnimationRef.current = animate(currentAngle, currentAngle + angleDiff, {
          duration: movementDuration,
          ease: [0.16, 1, 0.3, 1],
          onUpdate: (value) => {
            element.style.setProperty("--start", String(value));
          },
        });
      },
      [inactiveZone, proximity, movementDuration],
    );

    useEffect(() => {
      if (disabled) return;
      const element = containerRef.current;
      if (!element) return;

      const subscriber: GlowSubscriber = { element, visible: false, apply: applyPointer };
      subscribe(subscriber);

      return () => {
        unsubscribe(subscriber);
        angleAnimationRef.current?.stop();
        angleAnimationRef.current = null;
      };
    }, [applyPointer, disabled]);

    return (
      <>
        <div
          className={cn(
            "pointer-events-none absolute -inset-px rounded-[inherit] border opacity-0 transition-opacity",
            glow && "opacity-100 !block",
            variant === "white" && "border-white",
            disabled && "hidden"
          )}
        />
        <div
          ref={containerRef}
          style={
            {
              "--blur": `${blur}px`,
              "--spread": spread,
              "--start": "0",
              "--active": "0",
              "--glowingeffect-border-width": `${borderWidth}px`,
              "--repeating-conic-gradient-times": "5",
              "--gradient":
                variant === "white"
                  ? `repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  var(--black),
                  var(--black) calc(25% / var(--repeating-conic-gradient-times))
                )`
                  : `radial-gradient(circle, #dd7bbb 10%, #dd7bbb00 20%),
                radial-gradient(circle at 40% 40%, #d79f1e 5%, #d79f1e00 15%),
                radial-gradient(circle at 60% 60%, #5a922c 10%, #5a922c00 20%),
                radial-gradient(circle at 40% 60%, #4c7894 10%, #4c789400 20%),
                repeating-conic-gradient(
                  from 236.84deg at 50% 50%,
                  #dd7bbb 0%,
                  #d79f1e calc(25% / var(--repeating-conic-gradient-times)),
                  #5a922c calc(50% / var(--repeating-conic-gradient-times)),
                  #4c7894 calc(75% / var(--repeating-conic-gradient-times)),
                  #dd7bbb calc(100% / var(--repeating-conic-gradient-times))
                )`,
            } as React.CSSProperties
          }
          className={cn(
            "pointer-events-none absolute inset-0 rounded-[inherit] opacity-100 transition-opacity",
            blur > 0 && "blur-[var(--blur)]",
            className,
            disabled && "hidden"
          )}
        >
          <div
            className={cn(
              "glow",
              "rounded-[inherit]",
              'after:content-[""] after:rounded-[inherit] after:absolute after:inset-[calc(-1*var(--glowingeffect-border-width))]',
              "after:[border:var(--glowingeffect-border-width)_solid_transparent]",
              "after:[background:var(--gradient)] after:[background-attachment:fixed]",
              "after:opacity-[var(--active)] after:transition-opacity after:duration-300",
              "after:[mask-clip:padding-box,border-box]",
              "after:[mask-composite:intersect]",
              "after:[mask-image:linear-gradient(#0000,#0000),conic-gradient(from_calc((var(--start)-var(--spread))*1deg),#00000000_0deg,#fff,#00000000_calc(var(--spread)*2deg))]"
            )}
          />
        </div>
      </>
    );
  }
);

GlowingEffect.displayName = "GlowingEffect";

export { GlowingEffect };
