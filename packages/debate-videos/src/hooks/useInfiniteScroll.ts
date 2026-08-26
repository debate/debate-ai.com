/**
 * @fileoverview Infinite scroll hook for videos
 * @module components/debate/videos/hooks/useInfiniteScroll
 */

import { useEffect } from "react";

/**
 * Observes a sentinel element and asks the feed for its next page when the
 * sentinel scrolls into view.
 *
 * Pages come from `/api/videos`, so this only signals intent — the feed hook
 * owns the request and ignores the call while one is already in flight.
 *
 * @param loadMoreTriggerRef - Ref attached to the sentinel element at the bottom of the list.
 * @param hasMore - Whether the feed has another page available.
 * @param isLoading - Whether a page request is already in progress.
 * @param loadMore - Callback that fetches the next page.
 */
export function useInfiniteScroll(
  loadMoreTriggerRef: React.RefObject<HTMLDivElement | null>,
  hasMore: boolean,
  isLoading: boolean,
  loadMore: () => void,
) {
  useEffect(() => {
    if (!loadMoreTriggerRef) return;
    const trigger = loadMoreTriggerRef.current;
    if (!trigger || !hasMore || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting) loadMore();
      },
      {
        root: null,
        rootMargin: "400px",
        threshold: 0,
      },
    );

    observer.observe(trigger);

    return () => observer.unobserve(trigger);
  }, [loadMoreTriggerRef, hasMore, isLoading, loadMore]);
}
