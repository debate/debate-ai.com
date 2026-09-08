/**
 * @file comparison-table.tsx
 * @description Table component. Unused placeholder from the Fumadocs starter template; not linked from the homepage.
 */
import { Check, X, AlertCircle } from "lucide-react"

function CellValue({ value }: { value: boolean | string | "partial" }) {
  if (value === true) {
    return <Check className="h-5 w-5 text-primary mx-auto" />
  }
  if (value === false) {
    return <X className="h-5 w-5 text-muted-foreground/50 mx-auto" />
  }
  if (value === "partial") {
    return <AlertCircle className="h-5 w-5 text-yellow-500 mx-auto" />
  }
  return <span className="text-sm font-medium text-foreground">{value}</span>
}

export function ComparisonTable() {
  return null
}
