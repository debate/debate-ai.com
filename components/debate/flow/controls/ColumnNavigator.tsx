/**
 * @fileoverview Column navigation buttons
 * @module components/debate/flow/controls/ColumnNavigator
 */

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ColumnNavigatorProps {
  /** Handler for previous column */
  onPrevious: () => void
  /** Handler for next column */
  onNext: () => void
}

/**
 * Previous/Next column navigation buttons
 */
export function ColumnNavigator({ onPrevious, onNext }: ColumnNavigatorProps) {
  return (
    <div className="flex items-center gap-1">
      <Button variant="ghost" size="icon" onClick={onPrevious} className="h-8 w-8" aria-label="Previous column">
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button variant="ghost" size="icon" onClick={onNext} className="h-8 w-8" aria-label="Next column">
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  )
}
