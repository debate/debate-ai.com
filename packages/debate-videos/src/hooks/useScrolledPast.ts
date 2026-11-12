/**
 * @fileoverview Reports whether the page has scrolled past a marker element.
 * @module hooks/useScrolledPast
 */

import { useEffect, useState } from "react";

/**
 * Watches a zero-height sentinel and returns `true` once it has scrolled up
 * out of view — i.e. the page is scrolled past the point it marks.
 *
 * Used by the videos grid to fold its search and filter controls into a
 * compact bar pinned to the top of the window. An `IntersectionObserver`
 * rather than a scroll listener, so nothing runs on every scroll frame.
 * A sentinel *below* the viewport (not yet reached) does not count.
 *
 * @param sentinelRef - Ref on the marker element, placed just above the bar.
 * @returns Whether the marker is above the top of the viewport.
 */
export function useScrolledPast(
  sentinelRef: React.RefObject<HTMLElement | null>,
): boolean {
  const [past, setPast] = useState(false);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry) return;
      setPast(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [sentinelRef]);

  return past;
}
