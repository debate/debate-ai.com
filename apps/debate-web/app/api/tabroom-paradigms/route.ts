import { handleParadigmSearch } from "@debate/webview/lib/tournaments/paradigm-search"

/**
 * Judges' Tabroom paradigms by name: `/api/tabroom-paradigms?name=First|Last&…`
 * answers `{ "first last": personId | null }`, an id only when exactly one
 * Tabroom judge has that name. `/tournaments` pairings call it once per page
 * for judges whose pairing carries no paradigm id. See
 * packages/debate-webview/src/lib/tournaments/paradigm-search.ts. Read-only.
 */
export const GET = (request: Request) => handleParadigmSearch(request)
