/**
 * @fileoverview Shared visual primitives for the marketing-grade surfaces
 * (currently `/features`).
 *
 * Ported from qwksearch-research-agent's `components/features/effects.tsx`:
 * the same scroll-reveal, cursor spotlight, aurora backdrop, marquee, and
 * count-up, retuned to this app's tokens — `--card`, `--border`, and the
 * `--da-accent` pair `globals.css` derives from the app's accent hues —
 * instead of the source's hard-coded sky/violet.
 *
 * {@link SpotlightCard} additionally takes a `hueShift`, which rotates its
 * hover colours off that accent so a grid of cards lights up in a different
 * shade per card; `globals.css` turns the angle into the `--da-card-*` pair.
 *
 * Deliberately dependency-free (CSS + `IntersectionObserver` only) so a page
 * can use them without pulling an animation runtime into the bundle. The
 * keyframes live in `app/globals.css` under "Features page effects", because
 * Tailwind v4 only resolves `animate-*` names it can see in a stylesheet.
 *
 * @module features/effects
 */

"use client";

import {
  useEffect,
  useRef,
  useState,
  type ComponentType,
  type CSSProperties,
  type ElementType,
  type MouseEvent,
  type ReactNode,
} from "react";

import { cn } from "../lib/utils";

/** Props for {@link Reveal}. */
export interface RevealProps {
  children: ReactNode;
  /** Stagger before the transition starts, in ms. */
  delay?: number;
  className?: string;
  /** Element to render. Defaults to a `div`. */
  as?: ElementType;
}

/**
 * Fades and lifts its children into view the first time they intersect the
 * viewport.
 *
 * The hidden state is applied by the `data-da-reveal` attribute rather than a
 * class, so content stays fully rendered when JS never runs (SSR, no-JS) —
 * only a mounted component can hide anything.
 *
 * @param props - See {@link RevealProps}.
 * @returns The wrapper element.
 */
export function Reveal({ children, delay = 0, className, as = "div" }: RevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [shown, setShown] = useState(false);

  // `ElementType` is a union wide enough that TS narrows its props to `never`,
  // so the polymorphic tag is spelled as one open component before use.
  const Tag = as as ComponentType<Record<string, unknown>>;

  useEffect(() => {
    const el = ref.current;
    if (!el || shown) return;

    // No IntersectionObserver (older browsers, jsdom) → show at once.
    if (typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: "0px 0px -12% 0px", threshold: 0.05 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref}
      data-da-reveal={shown ? "shown" : "hidden"}
      style={{ "--da-reveal-delay": `${delay}ms` } as CSSProperties}
      className={className}
    >
      {children}
    </Tag>
  );
}

/**
 * Angle, in degrees, to rotate a card's hover colour off the app accent.
 *
 * Successive indices are spread by the golden angle, so any run of cards —
 * a grid row, or whatever survives a search filter — lands on hues far apart
 * on the wheel instead of the near-duplicates a plain `index * 40` would give.
 * It is a pure function of the card's position in the catalog, so a feature
 * keeps its colour across renders, filters and SSR/hydration.
 *
 * @param index - The card's index in the full, unfiltered list.
 * @returns A rotation in `[0, 360)`.
 */
export function cardHueShift(index: number): number {
  return Math.round((index * 137.508) % 360);
}

/** Props for {@link SpotlightCard}. */
export interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  /** Rotating conic-gradient border, revealed on hover/focus. */
  beam?: boolean;
  /** Radius of the cursor highlight, in px. */
  spotlightSize?: number;
  /**
   * Degrees to rotate this card's hover colour off the app accent — see
   * {@link cardHueShift}. Omitted, the card hovers in the app accent like
   * every other surface.
   */
  hueShift?: number;
}

/**
 * A card that tracks the cursor with a soft radial highlight, over an
 * optional rotating gradient border.
 *
 * The border lives on a 1px padding ring around the card body so the beam
 * reads as the border itself rather than a glow behind the card.
 *
 * @param props - See {@link SpotlightCardProps}.
 * @returns The card element.
 */
export function SpotlightCard({
  children,
  className,
  beam = true,
  spotlightSize = 420,
  hueShift,
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, on: false });

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    setSpot({ x: event.clientX - rect.left, y: event.clientY - rect.top, on: true });
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setSpot((s) => ({ ...s, on: true }))}
      onMouseLeave={() => setSpot((s) => ({ ...s, on: false }))}
      className={cn(
        "group/spotlight relative isolate overflow-hidden rounded-2xl p-px",
        beam && "da-border-beam",
        hueShift !== undefined && "da-card-tint",
        className,
      )}
      // Only the rotation is set here; `globals.css` turns it into the two
      // `--da-card-*` colours, so light and dark keep the lightness split the
      // rest of the accent tokens use rather than hard-coding one here.
      style={
        hueShift === undefined
          ? undefined
          : // Unitless, to match `--accent-hue`: the two are added inside one
            // `calc()`, and a `deg` there would not add to a bare number.
            ({ "--da-card-hue": `${hueShift}` } as CSSProperties)
      }
    >
      <div className="relative z-10 h-full rounded-[calc(1rem-1px)] border border-border bg-card/80 backdrop-blur-sm transition-colors duration-300 group-hover/spotlight:border-transparent">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] transition-opacity duration-300"
          style={{
            opacity: spot.on ? 1 : 0,
            // Two stops, not one: the highlight sweeps from the card's own
            // accent into its analogous partner, so each card reads as its
            // own gradient rather than a single tinted blob. Both fall back
            // to the page accent for a card with no `hueShift`.
            background: `radial-gradient(${spotlightSize}px circle at ${spot.x}px ${spot.y}px, color-mix(in oklab, var(--da-card-accent, var(--da-accent, var(--primary))) 22%, transparent), color-mix(in oklab, var(--da-card-accent-3, var(--da-accent-3, var(--primary))) 13%, transparent) 42%, transparent 72%)`,
          }}
        />
        <div className="relative h-full">{children}</div>
      </div>
    </div>
  );
}

/**
 * Full-bleed backdrop for a hero: a faint grid, masked to fade downward, with
 * slow-drifting aurora blobs in the page's two accent hues.
 *
 * @param props - Extra classes for the positioned wrapper.
 * @returns The decorative backdrop element.
 */
export function AuroraBackdrop({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 -z-10 overflow-hidden", className)}
    >
      <div className="absolute inset-0 bg-background" />
      <div
        className="absolute inset-0 opacity-[0.35] [mask-image:radial-gradient(ellipse_75%_55%_at_50%_0%,#000,transparent)]"
        style={{
          backgroundImage:
            "linear-gradient(to right, var(--border) 1px, transparent 1px), linear-gradient(to bottom, var(--border) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
        }}
      />
      <div className="da-aurora-blob da-aurora-primary absolute -top-40 left-1/4 h-[32rem] w-[32rem] rounded-full blur-[120px]" />
      <div
        className="da-aurora-blob da-aurora-primary absolute -top-24 right-[20%] h-[26rem] w-[26rem] rounded-full blur-[120px]"
        style={{ animationDelay: "-6s" }}
      />
      <div
        className="da-aurora-blob da-aurora-secondary absolute top-40 left-0 h-[22rem] w-[22rem] rounded-full blur-[110px]"
        style={{ animationDelay: "-12s" }}
      />
    </div>
  );
}

/** Props for {@link Marquee}. */
export interface MarqueeProps {
  children: ReactNode;
  /** One full pass, in seconds. Longer is slower. */
  durationSeconds?: number;
  /** Scroll right-to-left instead of left-to-right. */
  reverse?: boolean;
  className?: string;
}

/**
 * Infinite horizontal ticker. Renders its children twice so the track can
 * loop by translating exactly half its width, and pauses on hover so a
 * passing item can be read.
 *
 * @param props - See {@link MarqueeProps}.
 * @returns The ticker element.
 */
export function Marquee({
  children,
  durationSeconds = 40,
  reverse = false,
  className,
}: MarqueeProps) {
  return (
    <div
      className={cn(
        "da-marquee group relative flex overflow-hidden [mask-image:linear-gradient(to_right,transparent,#000_12%,#000_88%,transparent)]",
        className,
      )}
    >
      <div
        className="da-marquee-track flex w-max shrink-0 items-center gap-3 pr-3"
        style={
          {
            "--da-marquee-duration": `${durationSeconds}s`,
            "--da-marquee-gap": "0.75rem",
            animationDirection: reverse ? "reverse" : "normal",
          } as CSSProperties
        }
      >
        {children}
        <span aria-hidden className="contents">
          {children}
        </span>
      </div>
    </div>
  );
}

/** Props for {@link CountUp}. */
export interface CountUpProps {
  /** Final number to land on. */
  value: number;
  /** Length of the animation, in ms. */
  durationMs?: number;
  className?: string;
}

/**
 * Counts up to `value` the first time it scrolls into view, easing out so the
 * number settles rather than stopping dead.
 *
 * @param props - See {@link CountUpProps}.
 * @returns A `span` holding the current number.
 */
export function CountUp({ value, durationMs = 1200, className }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  // Server-render the final number so the value is present without JS, and
  // only rewind to 0 once the observer is actually wired up.
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const run = () => {
      const start = performance.now();
      const tick = (now: number) => {
        const progress = Math.min((now - start) / durationMs, 1);
        // easeOutCubic — fast start, soft landing on the final number.
        setDisplay(Math.round(value * (1 - Math.pow(1 - progress, 3))));
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    };

    if (
      typeof IntersectionObserver === "undefined" ||
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      setDisplay(value);
      return;
    }

    setDisplay(0);
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          observer.disconnect();
          run();
        }
      },
      { threshold: 0.4 },
    );

    observer.observe(el);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [value, durationMs]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}

/** Props for {@link Pill}. */
export interface PillProps {
  children: ReactNode;
  className?: string;
}

/**
 * Small accent-tinted pill, used for section eyebrows and inline chips.
 *
 * @param props - See {@link PillProps}.
 * @returns The pill element.
 */
export function Pill({ children, className }: PillProps) {
  return (
    <span
      className={cn(
        "da-accent-soft inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
        className,
      )}
    >
      {children}
    </span>
  );
}
