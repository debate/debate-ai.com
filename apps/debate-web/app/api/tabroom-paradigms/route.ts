import { handleParadigmSearch } from "@debate-ai/webview/lib/tournaments/paradigm-search"
import { tabroomFetch } from "@/lib/judge-paradigms/tabroom"

/**
 * Judges' Tabroom paradigms by name: `/api/tabroom-paradigms?name=First|Last&…`
 * answers `{ "first last": personId | null }`, an id only when exactly one
 * Tabroom judge has that name. `/tournaments` pairings call it once per page
 * for judges whose pairing carries no paradigm id. See
 * packages/debate-webview/src/lib/tournaments/paradigm-search.ts. Read-only.
 * Searches as the site's Tabroom session (`TABROOM_SESSION_TOKEN`) when set,
 * since Tabroom now asks paradigm readers to sign in.
 */
export const GET = (request: Request) => handleParadigmSearch(request, tabroomFetch())
