/**
 * @fileoverview The window event the app dock's sidebar button fires on a view
 * that draws its own sidebar. The workspace listens for it; the dock in
 * `debate-webview` dispatches it (see its `lib/mobile-sidebar.ts`).
 */

/** Window event a view that owns its sidebar (`/debate`, the research workspace) listens for. */
export const OPEN_OWN_SIDEBAR_EVENT = "debate:open-sidebar"
