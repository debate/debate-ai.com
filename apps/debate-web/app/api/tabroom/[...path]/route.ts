import { handleTabroomRequest } from "@/lib/tournaments/handler"

/**
 * Tournament invitations, pairings, results and judge paradigms — upstream
 * Tabroom's public API on D1 (see lib/tournaments/handler.ts). Paths mirror
 * Tabroom's `/v1` API: `/api/tabroom/rest/tourns`,
 * `/api/tabroom/rest/tourns/:id/invite`, `/api/tabroom/pages/invite/upcoming`, …
 * Read-only: other methods answer 405.
 */
export const GET = handleTabroomRequest
export const HEAD = handleTabroomRequest
export const POST = handleTabroomRequest
