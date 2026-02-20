/**
 * @fileoverview Infinite scroll hook for videos
 * @module components/debate/core/videos/hooks/useInfiniteScroll
 */

import { useEffect } from "react";

/**
 * Hook for implementing infinite scroll pagination
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
