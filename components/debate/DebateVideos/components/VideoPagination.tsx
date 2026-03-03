/**
 * @fileoverview Pagination controls for video list
 * @module components/debate/videos/components/VideoPagination
 */

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * Props for the VideoPagination component.
 */
interface VideoPaginationProps {
  /** The currently active page number (1-indexed). */
  currentPage: number
  /** The total number of available pages. */
  totalPages: number
  /** Callback invoked when the user clicks the previous-page button. */
  onPrevPage: () => void
  /** Callback invoked when the user clicks the next-page button. */
  onNextPage: () => void
}

/**
 * Renders previous/next pagination buttons and a current-page indicator.
 * Returns null when there is only one page or fewer.
 *
 * @param props - Pagination state and navigation callbacks.
 * @param props.currentPage - The active page number.
 * @param props.totalPages - Total number of pages available.
 * @param props.onPrevPage - Handler for the previous-page action.
 * @param props.onNextPage - Handler for the next-page action.
 * @returns A pagination control row, or null if pagination is unnecessary.
 */
export function VideoPagination({ currentPage, totalPages, onPrevPage, onNextPage }: VideoPaginationProps) {
  if (totalPages <= 1) return null

  return (
    <div className="flex justify-center items-center gap-4 mt-8">
      <Button variant="outline" size="icon" onClick={onPrevPage} disabled={currentPage === 1}>
        <ChevronLeft className="h-4 w-4" />
      </Button>

      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>

      <Button variant="outline" size="icon" onClick={onNextPage} disabled={currentPage >= totalPages}>
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
