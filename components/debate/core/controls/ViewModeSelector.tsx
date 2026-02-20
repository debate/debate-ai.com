/**
 * @fileoverview View mode selector dropdown
 * @module components/debate/core/controls/ViewModeSelector
 */

import { Eye } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface ViewModeSelectorProps {
  /** Current view mode */
  value: ViewMode
  /** Handler for view mode change */
  onChange: (mode: ViewMode) => void
  /** Icon size (sm or default) */
  size?: "sm" | "default"
}

/**
 * Dropdown for selecting content view mode
 */
export function ViewModeSelector({ value, onChange, size = "default" }: ViewModeSelectorProps) {
  const iconClass = size === "sm" ? "h-3 w-3" : "h-4 w-4"
  const buttonClass = size === "sm" ? "h-7 w-7" : "h-9 w-9"

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className={buttonClass}>
          <Eye className={iconClass} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onClick={() => onChange("read")}>
          <span className={value === "read" ? "font-semibold" : ""}>Read</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("highlighted")}>
          <span className={value === "highlighted" ? "font-semibold" : ""}>Embiggen Highlighted</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("h1-only")} className="pl-6">
          <span className={value === "h1-only" ? "font-semibold" : ""}>Expand to H1</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("h2-only")} className="pl-6">
          <span className={value === "h2-only" ? "font-semibold" : ""}>Expand to H2</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("h3-only")} className="pl-6">
          <span className={value === "h3-only" ? "font-semibold" : ""}>Expand to H3</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("underlined")}>
          <span className={value === "underlined" ? "font-semibold" : ""}>Embiggen Underlined</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("headings")}>
          <span className={value === "headings" ? "font-semibold" : ""}>Headings Only</span>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onChange("summaries-only")}>
          <span className={value === "summaries-only" ? "font-semibold" : ""}>Summaries Only</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
