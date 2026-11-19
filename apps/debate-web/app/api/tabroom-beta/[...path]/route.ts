import { proxyTabroomBeta } from "@debate-ai/webview/lib/tournaments/tabroom-beta-proxy"
import { tabroomFetch } from "@/lib/judge-paradigms/tabroom"

/**
 * Live Tabroom, proxied: `/api/tabroom-beta/<path>` answers with
 * `https://api.tabroom.com/v1/<path>` (the API behind beta.tabroom.com), so the
 * tournaments UI at `/tournament` never makes a cross-origin
 * request. See packages/debate-webview/src/lib/tournaments/tabroom-beta-proxy.ts. Read-only.
 * Upstream requests carry the site's Tabroom session cookie (`TABROOM_API_KEY`),
 * never the visitor's.
 */
export const GET = (request: Request) => proxyTabroomBeta(request, tabroomFetch())
export const HEAD = (request: Request) => proxyTabroomBeta(request, tabroomFetch())
