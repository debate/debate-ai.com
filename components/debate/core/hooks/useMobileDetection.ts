/**
 * @fileoverview Hook for detecting mobile viewport
 * @module components/debate/core/hooks/useMobileDetection
 */

import { useEffect } from "react"

/**
 * Hook to detect mobile viewport and update state
 * Monitors window resize and updates isMobile state
 *
 * @param setIsMobile - State setter for mobile detection
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
