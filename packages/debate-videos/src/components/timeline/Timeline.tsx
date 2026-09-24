/**
 * @fileoverview A year-rail timeline: a scrollable column of pill buttons
 * (a row on narrow screens) beside an animated pane for the active entry.
 * Adapted from the shadcn-space "timeline-02" block for the Topic & Video
 * Statistics page, but content-agnostic — the caller renders the pane.
 * @module components/timeline/Timeline
 */

"use client";

import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { motion, AnimatePresence } from "motion/react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "../../ui/lib/utils";
import { Button } from "../../ui/primitives/button";

export interface TimelineEntry {
  /** Stable key; also keys the pane's enter/exit animation. */
  key: string;
  /** The pill's text — a year, usually. */
  label: string;
}

export interface TimelineProps {
  items: TimelineEntry[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** The pane for the active entry. */
  renderContent: (item: TimelineEntry, index: number) => ReactNode;
  /** Accessible name for the rail. */
  label?: string;
  className?: string;
}

/**
 * Controlled so the caller can keep the selection across filtering. The rail
 * scrolls itself (never the page) to keep the active pill centred, and
 * arrow keys / the prev-next buttons step through every entry.
 */
export function Timeline({
  items,
  activeIndex,
  onActiveIndexChange,
  renderContent,
  label = "Timeline",
  className,
}: TimelineProps) {
  const railRef = useRef<HTMLDivElement | null>(null);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // `scrollIntoView` would also scroll the page to the rail on first render,
  // so centre the pill inside the rail's own scroll box instead.
  useEffect(() => {
    const rail = railRef.current;
    const button = buttonRefs.current[activeIndex];
    if (!rail || !button) return;
    const vertical = rail.scrollHeight > rail.clientHeight;
    rail.scrollTo({
      top: vertical ? button.offsetTop - rail.clientHeight / 2 + button.offsetHeight / 2 : 0,
      left: vertical ? 0 : button.offsetLeft - rail.clientWidth / 2 + button.offsetWidth / 2,
      behavior: "smooth",
    });
  }, [activeIndex]);

  const activeItem = items[activeIndex];
  if (!activeItem) return null;

  const step = (delta: number) => {
    const next = Math.min(items.length - 1, Math.max(0, activeIndex + delta));
    if (next !== activeIndex) {
      onActiveIndexChange(next);
      buttonRefs.current[next]?.focus({ preventScroll: true });
    }
  };

  const onRailKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowDown" || e.key === "ArrowRight") step(1);
    else if (e.key === "ArrowUp" || e.key === "ArrowLeft") step(-1);
    else if (e.key === "Home") step(-activeIndex);
    else if (e.key === "End") step(items.length);
    else return;
    e.preventDefault();
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="grid grid-cols-12 gap-6">
        <div className="relative col-span-12 flex w-full shrink-0 flex-col items-center gap-2 lg:col-span-1 lg:w-auto">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Previous"
            disabled={activeIndex === 0}
            onClick={() => step(-1)}
            className="relative z-20 hidden lg:inline-flex"
          >
            <ChevronUp />
          </Button>
          <div
            ref={railRef}
            role="tablist"
            aria-label={label}
            onKeyDown={onRailKeyDown}
            className="relative flex w-full snap-x snap-mandatory flex-row gap-6 overflow-auto px-40 [scrollbar-width:none] lg:h-105 lg:snap-y lg:flex-col lg:px-0 lg:py-40 [&::-webkit-scrollbar]:hidden"
          >
            {items.map((item, index) => (
              <Button
                key={item.key}
                type="button"
                role="tab"
                aria-selected={activeIndex === index}
                tabIndex={activeIndex === index ? 0 : -1}
                variant={activeIndex === index ? "default" : "outline"}
                ref={(el) => {
                  buttonRefs.current[index] = el;
                }}
                onClick={() => onActiveIndexChange(index)}
                className="shrink-0 snap-center rounded-full px-5! transition-all duration-300"
              >
                <span className="text-sm font-medium tracking-tight">{item.label}</span>
              </Button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Next"
            disabled={activeIndex === items.length - 1}
            onClick={() => step(1)}
            className="relative z-20 hidden lg:inline-flex"
          >
            <ChevronDown />
          </Button>

          {/* Fade the rail's ends into the page. */}
          <div className="pointer-events-none absolute inset-x-0 top-10 z-10 hidden h-32 bg-linear-to-b from-background to-transparent lg:block" />
          <div className="pointer-events-none absolute inset-x-0 bottom-10 z-10 hidden h-32 bg-linear-to-t from-background to-transparent lg:block" />
        </div>

        <div role="tabpanel" className="col-span-12 flex w-full flex-1 overflow-hidden lg:col-span-11">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeItem.key}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="w-full"
            >
              {renderContent(activeItem, activeIndex)}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
