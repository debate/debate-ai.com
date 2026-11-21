import { handleBadgeRequest } from "@/lib/badge/badge"

/**
 * An embeddable SVG stat badge, e.g. `/api/badge?label=Words&number=1250`.
 * Params, colour presets and headers are in lib/badge/badge.ts.
 */
export function GET(request: Request): Response {
  return handleBadgeRequest(request)
}
