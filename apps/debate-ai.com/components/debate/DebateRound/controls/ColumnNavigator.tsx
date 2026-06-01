/**
 * @fileoverview Column navigation buttons
 * @module components/debate/flow/controls/ColumnNavigator
 */

import { ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"

/** Props for the ColumnNavigator component. */
interface ColumnNavigatorProps {
  /** Handler called when the user navigates to the previous column. */
  onPrevious: () => void
  /** Handler called when the user navigates to the next column. */
  onNext: () => void
}

/**
 * Previous/Next column navigation buttons.
 *
 * @param props - Component props.
 * @param props.onPrevious - Callback invoked when the left chevron button is clicked.
 * @param props.onNext - Callback invoked when the right chevron button is clicked.
 * @returns A pair of icon buttons for navigating between columns.
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
