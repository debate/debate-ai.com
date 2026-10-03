/**
 * @fileoverview Which sidebar the dock's mobile sidebar button opens.
 *
 * Every app view has a sidebar of its own on desktop; below `md` it is hidden,
 * so the bottom dock's first button brings it up. What opens depends on the
 * view in the centre — the same split `AppSidebarShell` and the `/videos` page
 * make on desktop, as a pure function so it can be tested without rendering.
 *
 * @module lib/mobile-sidebar
 */

import { isVideoLibraryPath, ownsItsLayout } from "@debate/videos"
import { showsCardsOnlySidebar, showsReasonDocsPanels } from "./reason-docs/sidebar-routes"

/** Window event a view that owns its sidebar (`/debate`) listens for. */
export const OPEN_OWN_SIDEBAR_EVENT = "debate:open-sidebar"

export type MobileSidebarKind =
  /** The view draws its own sidebar; the dock only asks it to open. */
  | "own"
  /** `/research/cards`: the document panels alone. */
  | "cards"
  /** `/reason-editor`: document panels above the tool tree. */
  | "editor"
  /** The video library: video links above the tool tree. */
  | "videos"
  /** Every other view: the tool tree and footer. */
  | "tools"

export function mobileSidebarKind(pathname: string | null | undefined): MobileSidebarKind {
  if (!pathname) return "tools"
  if (ownsItsLayout(pathname)) return "own"
  if (showsCardsOnlySidebar(pathname)) return "cards"
  if (showsReasonDocsPanels(pathname)) return "editor"
  if (isVideoLibraryPath(pathname)) return "videos"
  return "tools"
}
