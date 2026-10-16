import { proxyTabroomBeta } from "@/lib/tournaments/tabroom-beta-proxy"

/**
 * Live Tabroom, proxied: `/api/tabroom-beta/<path>` answers with
 * `https://api.tabroom.com/v1/<path>` (the API behind beta.tabroom.com), so the
 * tournaments UI at `/tournaments` never makes a cross-origin
 * request. See lib/tournaments/tabroom-beta-proxy.ts. Read-only.
 */
export const GET = (request: Request) => proxyTabroomBeta(request)
export const HEAD = (request: Request) => proxyTabroomBeta(request)
