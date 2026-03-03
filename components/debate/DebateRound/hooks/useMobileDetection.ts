/**
 * @fileoverview Hook for detecting mobile viewport
 * @module components/debate/flow/hooks/useMobileDetection
 */

import { useEffect } from "react"

/**
 * Hook that detects whether the current viewport is mobile-sized and keeps
 * the provided state setter in sync as the window is resized.
 * A viewport width below 768 px is considered mobile.
 *
 * @param setIsMobile - State setter that receives `true` when the viewport is mobile-width
 */
export function useMobileDetection(setIsMobile: (mobile: boolean) => void) {
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }

    // Check on mount
    checkMobile()

    // Listen for resize
    window.addEventListener("resize", checkMobile)
    return () => window.removeEventListener("resize", checkMobile)
  }, [setIsMobile])
}
