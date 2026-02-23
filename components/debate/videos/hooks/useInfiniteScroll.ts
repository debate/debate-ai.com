/**
 * @fileoverview Infinite scroll hook for videos
 * @module components/debate/videos/hooks/useInfiniteScroll
 */

import { useEffect } from "react";

/**
 * Observes a sentinel element and increments the current page when it enters
 * the viewport, implementing infinite scroll pagination.
 *
 * @param loadMoreTriggerRef - Ref attached to the sentinel element at the bottom of the list.
 * @param currentPage - The currently displayed page number.
 * @param totalPages - The total number of available pages.
 * @param isLoadingMore - Whether a page increment is already in progress.
 * @param setCurrentPage - Setter to advance to the next page.
 * @param setIsLoadingMore - Setter to toggle the loading-more flag.
 */
export function useInfiniteScroll(
  loadMoreTriggerRef: React.RefObject<HTMLDivElement | null>,
  currentPage: number,
  totalPages: number,
  isLoadingMore: boolean,
  setCurrentPage: (page: number) => void,
  setIsLoadingMore: (loading: boolean) => void,
) {
  useEffect(() => {
    if (!loadMoreTriggerRef) return;
    const trigger = loadMoreTriggerRef.current;
    if (!trigger) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (
          entry.isIntersecting &&
          currentPage < totalPages &&
          !isLoadingMore
        ) {
          setIsLoadingMore(true);
          setTimeout(() => {
            setCurrentPage(currentPage + 1);
            setIsLoadingMore(false);
          }, 500);
        }
      },
      {
        root: null,
        rootMargin: "100px",
        threshold: 0.1,
      },
    );

    observer.observe(trigger);

    return () => {
      if (trigger) {
        observer.unobserve(trigger);
      }
    };
  }, [
    loadMoreTriggerRef,
    currentPage,
    totalPages,
    isLoadingMore,
    setCurrentPage,
    setIsLoadingMore,
  ]);
}
