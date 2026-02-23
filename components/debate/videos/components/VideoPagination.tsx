/**
 * @fileoverview Pagination controls for video list
 * @module components/debate/videos/components/VideoPagination
 */

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface VideoPaginationProps {
  currentPage: number
  totalPages: number
  onPrevPage: () => void
  onNextPage: () => void
}

/**
 * Pagination navigation buttons
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
